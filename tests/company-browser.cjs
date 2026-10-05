// Run against npm run dev. Uses a fresh browser context; never touches a user's save.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const artifacts = process.env.ARTIFACT_DIR || path.join(require('node:os').tmpdir(), 'courier-company-check');

(async () => {
  fs.mkdirSync(artifacts, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const errors = [];
  try {
    for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 844, height: 390 }, { width: 320, height: 568 }]) {
      const page = await browser.newPage({ viewport, hasTouch: viewport.width < 1000 });
      page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      const ready = async () => {
        await page.waitForSelector('#objective:not(:empty)');
        await page.evaluate(async () => { const { game } = await import(document.querySelector('script[src*="/src/main.js"]').src); window.scene = game.scene.getScene('GameScene'); });
        await page.waitForFunction(() => Boolean(window.scene?.orders?.order && window.scene?.companyUI)).catch(async e => {
          console.log(await page.evaluate(() => ({ keys: Object.keys(window.scene || {}), scripts: [...document.scripts].map(s => s.src) })), errors); throw e;
        });
        await page.evaluate(() => { scene.deliveryEvents.random = () => .99; });
      };
      await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5174'); await ready();
      const open = async id => { if (!await page.locator(`#open-${id}`).isVisible()) await page.click('#open-menu'); await page.click(`#open-${id}`); };
      const close = async id => { await page.click(`#${id}-dialog [data-close]`); await page.waitForSelector(`#${id}-dialog`, { state: 'hidden' }); };
      const state = () => page.evaluate(() => scene.orders.state.getSnapshot());
      const view = name => page.click(`[data-company-view="${name}"]`);
      const shot = name => page.screenshot({ path: path.join(artifacts, `${viewport.width}x${viewport.height}-company-${name}.png`) });
      const bounds = async selector => {
        const b = await page.locator(selector).boundingBox();
        assert.ok(b && b.x >= 0 && b.y >= 0 && b.x + b.width <= viewport.width + 1 && b.y + b.height <= viewport.height + 1, `${selector}: ${JSON.stringify(b)}`);
      };
      await open('company'); await bounds('#company-dialog'); await bounds('#company-dialog [data-close]');
      await page.click('#company-open'); assert.match(await page.locator('#company-feedback').textContent(), /уровень 12/);
      await page.evaluate(async () => { const { xpForLevel } = await import('/src/config/gameBalance.js'); scene.orders.state.update({ xp: xpForLevel(12) }); });
      await page.click('#company-open'); assert.match(await page.locator('#company-feedback').textContent(), /Не хватает денег/);
      await page.fill('#company-name', 'Быстрая доставка');
      assert.equal(await page.locator('#company-name').getAttribute('maxlength'), '20');
      await page.keyboard.press('d'); assert.equal(await page.evaluate(() => scene.player.body.velocity.length()), 0, 'name typing blocks gameplay');
      await page.fill('#company-name', 'Быстрая доставка');
      await page.evaluate(() => scene.orders.state.update({ money: 40000 }));
      await page.click('#company-open'); assert.equal((await state()).money, 0); assert.equal((await state()).companyName, 'Быстрая доставка');
      assert.ok(await page.locator('#company-celebration').isVisible()); await shot('milestone'); await page.click('#company-begin');
      await view('employees'); await page.click('#company-hire'); assert.match(await page.locator('#company-feedback').textContent(), /Не хватает денег/);
      await page.evaluate(() => scene.orders.state.update({ money: 150000 }));
      await page.click('#company-hire'); assert.equal((await state()).employees.length, 1);
      assert.equal((await state()).employees[0].assignedTransport, null); assert.match(await page.locator('[data-employee-status]').textContent(), /100.*мин.*РАБОТАЕТ/);
      await page.waitForFunction(() => scene.orders.state.values.companyBalance >= 1, null, { timeout: 4000 });
      assert.ok((await state()).companyBalance >= 1, 'real timer generates live income');
      // Freeze the service clock after proving real timer integration; subsequent money assertions are deterministic.
      await page.evaluate(() => {
        clearInterval(scene.company.timer); scene.company.tick();
        window.companyNow = 0; window.companyWall = Date.now(); scene.company.now = () => companyNow; scene.company.wallNow = () => companyWall; scene.company.lastTick = 0;
      });
      await page.click('#company-hire'); assert.equal((await state()).employees.length, 2);
      assert.ok(await page.locator('#company-hire').isDisabled()); assert.match(await page.locator('#company-hire-status').textContent(), /НЕТ СВОБОДНЫХ МЕСТ/);
      await view('vehicles'); await page.click('[data-company-vehicle="BICYCLE"] button'); await page.click('[data-company-vehicle="MOPED"] button');
      let s = await state(); assert.equal(s.companyVehicles.length, 2); assert.deepEqual(s.ownedTransports, ['WALKING']);
      assert.match(await page.locator('[data-company-vehicle="BICYCLE"] [data-inventory]').textContent(), /Свободно: 1/);
      await view('employees');
      const [first, second] = s.employees, [bicycle, moped] = s.companyVehicles;
      await page.selectOption(`[data-employee="${first.id}"] select`, bicycle.id); await page.click(`[data-employee="${first.id}"] button`);
      assert.match(await page.locator(`[data-employee="${first.id}"] [data-employee-status]`).textContent(), /Велосипед.*180/);
      assert.equal(await page.locator(`[data-employee="${second.id}"] option[value="${bicycle.id}"]`).evaluate(option => option.disabled), true);
      await page.selectOption(`[data-employee="${first.id}"] select`, ''); await page.click(`[data-employee="${first.id}"] button`);
      await page.selectOption(`[data-employee="${second.id}"] select`, bicycle.id); await page.click(`[data-employee="${second.id}"] button`);
      await page.selectOption(`[data-employee="${first.id}"] select`, moped.id); await page.click(`[data-employee="${first.id}"] button`);
      assert.match(await page.locator(`[data-employee="${first.id}"] [data-employee-status]`).textContent(), /Мопед.*300/);
      await bounds('#company-dialog [data-close]'); await shot('employees');
      const before = await state();
      await page.evaluate(() => { companyNow += 60000; companyWall += 60000; scene.company.tick(); });
      s = await state(); assert.equal(s.companyBalance - before.companyBalance, 480); assert.equal(s.money, before.money);
      await view('dashboard'); assert.match(await page.locator('#company-summary').textContent(), /480.*мин/);
      await shot('dashboard'); const balance = s.companyBalance; await page.click('#company-collect');
      s = await state(); assert.equal(s.companyBalance, 0); assert.equal(s.money, before.money + balance); assert.equal(s.companyStats.totalIncomeCollected, balance);
      // HTML-looking input must be rendered as text, including in the read-only profile.
      await page.fill('#company-name', '<b>Моя доставка</b>'); await page.click('#company-rename');
      assert.equal(await page.locator('#company-display-name b').count(), 0); assert.equal((await state()).companyName, '<b>Моя доставка</b>');
      await page.fill('#company-name', 'Быстрая доставка'); await page.click('#company-rename');
      await view('upgrades'); const money = (await state()).money; await page.click('#company-upgrade');
      assert.equal((await state()).companyLevel, 2); assert.equal((await state()).money, money - 15000);
      await view('employees'); assert.ok(await page.locator('#company-hire').isEnabled()); await page.click('#company-hire');
      await view('upgrades'); await page.click('#company-upgrade'); assert.equal((await state()).companyLevel, 3);
      assert.ok(await page.locator('#company-upgrade').isDisabled()); await shot('upgrades'); await close('company');
      await open('profile'); assert.match(await page.locator('#profile-details').textContent(), /Курьерский босс.*Быстрая доставка/s);
      assert.equal(await page.locator('#profile-dialog button').count(), 1); await close('profile');
      // Complete a normal personal delivery after company opening.
      await page.evaluate(() => { scene.orders.order = null; scene.orders.random = () => 0; scene.orders.generate(); }); await page.click('#accept-order');
      for (let i = 0; i < 2; i++) {
        await page.evaluate(() => { const t = scene.orders.getTarget(); scene.player.setPosition(t.x, t.y); });
        await page.waitForSelector('#interact', { state: 'visible' }); await page.click('#interact');
      }
      assert.equal((await state()).completedOrders, 1);
      // Service survives district scene restart with one timer owner and no repeated popup.
      await page.evaluate(() => { window.originalCompany = scene.company; scene.scene.restart(); }); await ready();
      assert.equal(await page.evaluate(() => scene.company === originalCompany), true);
      const saved = await page.evaluate(() => scene.orders.state.getSaveData());
      const seedReload = async data => {
        await page.evaluate(async data => {
          clearInterval(scene.company.timer); window.removeEventListener('pagehide', scene.company.onPageHide); document.removeEventListener('visibilitychange', scene.company.onHide);
          const { platformService } = await import('/src/services/PlatformService.js'); await platformService.save(data);
        }, data);
        await page.reload(); await ready();
      };
      await seedReload({ ...saved, companyBalance: 0, companyIncomeRemainder: 0, lastCompanyUpdateTimestamp: Date.now() - 3600000 });
      await page.waitForSelector('#company-offline:not([hidden])'); await bounds('#company-dialog [data-close]');
      s = await state(); assert.ok(s.companyBalance >= 34800 && s.companyBalance < 34820, `1h offline: ${s.companyBalance}`);
      assert.equal(s.companyName, saved.companyName); assert.equal(s.companyVehicles.length, 2); assert.equal(s.employees.length, 3); await shot('offline');
      await page.click('#company-offline-collect'); assert.ok((await state()).companyBalance <= 2); await close('company');
      const daySave = { ...saved, companyBalance: 0, companyIncomeRemainder: 0, lastCompanyUpdateTimestamp: Date.now() - 30 * 86400000 };
      await seedReload(daySave); await page.waitForSelector('#company-offline:not([hidden])');
      assert.equal((await state()).companyBalance, 69600, 'offline limited to 2h at 580 per min'); await page.click('#company-offline-later'); await close('company');
      await seedReload({ ...saved, companyBalance: 0, lastCompanyUpdateTimestamp: 'invalid' });
      assert.equal(await page.locator('#company-dialog').isVisible(), false); assert.ok((await state()).companyBalance < 20);
      await seedReload({ version: 5, money: 1234, xp: 250, transport: 'BICYCLE', ownedItems: ['thermobag'], completedOrders: 5 });
      s = await state(); assert.equal(s.companyUnlocked, false); assert.deepEqual(s.employees, []); assert.equal(s.equippedTransport, 'BICYCLE'); assert.equal(s.completedOrders, 5);
      await open('company'); assert.ok(await page.locator('#company-locked').isVisible()); await close('company');
      await page.close(); console.log(`PASS company unlock/name/hiring/capacity/fleet/reassignment/income/upgrades/offline/save/mobile ${viewport.width}x${viewport.height}`);
    }
    assert.deepEqual(errors, [], 'no browser runtime errors');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
