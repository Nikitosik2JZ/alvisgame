// Stage 7 integration: isolated contexts and test saves, desktop plus four phone layouts.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const artifacts = process.env.ARTIFACT_DIR || path.join(require('node:os').tmpdir(), 'courier-stage7');

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
        await page.evaluate(async () => {
          const { game } = await import(document.querySelector('script[src*="/src/main.js"]').src); window.scene = game.scene.getScene('GameScene');
          clearInterval(scene.company.timer); scene.deliveryEvents.random = () => .99;
          window.companyNow = 0; window.companyWall = Date.now(); scene.company.now = () => companyNow;
          scene.company.wallNow = () => companyWall; scene.company.lastTick = 0; scene.company.random = () => .5;
        });
      };
      await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5174'); await ready();
      const open = async id => { if (!await page.locator(`#open-${id}`).isVisible()) await page.click('#open-menu'); await page.click(`#open-${id}`); };
      const close = async id => { await page.click(`#${id}-dialog [data-close]`); await page.waitForSelector(`#${id}-dialog`, { state: 'hidden' }); };
      const state = () => page.evaluate(() => scene.orders.state.getSnapshot());
      const view = name => page.click(`[data-company-view="${name}"]`);
      const shot = name => page.screenshot({ path: path.join(artifacts, `${viewport.width}x${viewport.height}-${name}.png`) });
      const bounds = async selector => {
        const b = await page.locator(selector).boundingBox();
        assert.ok(b && b.x >= 0 && b.y >= 0 && b.x + b.width <= viewport.width + 1 && b.y + b.height <= viewport.height + 1, `${selector}: ${JSON.stringify(b)}`);
        assert.ok(await page.locator('#company-dialog .modal-content').evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'no horizontal content overflow');
      };
      await open('company'); await bounds('#company-dialog [data-close]');
      await page.click('#company-open'); assert.match(await page.locator('#company-feedback').textContent(), /уровень 12/);
      await page.evaluate(async () => { const { xpForLevel } = await import('/src/config/gameBalance.js'); scene.orders.state.update({ xp: xpForLevel(12), money: 40000 }); });
      await page.fill('#company-name', 'Turbo Delivery'); await page.click('#company-open');
      assert.equal((await state()).money, 0); await page.click('#company-begin');
      await view('employees'); assert.equal(await page.locator('[data-candidate]').count(), 3);
      await page.locator('[data-candidate] button').first().click(); assert.match(await page.locator('#company-feedback').textContent(), /Не хватает денег/);
      await page.evaluate(() => scene.orders.state.update({ money: 500000 }));
      const old = (await state()).companyCandidates[0].id; await page.click('#company-refresh'); assert.notEqual((await state()).companyCandidates[0].id, old);
      const money = (await state()).money; await page.click('#company-refresh'); assert.equal((await state()).money, money - 300);
      await shot('candidates'); await page.locator('[data-candidate] button').first().click(); await page.locator('[data-candidate] button').first().click();
      let s = await state(); assert.equal(s.employees.length, 2); assert.notEqual(s.employees[0].archetype, s.employees[1].archetype);
      assert.ok(await page.locator('[data-candidate] button').first().isDisabled());
      await view('upgrades'); await page.click('#company-upgrade'); assert.equal((await state()).officeLevel, 2);
      await view('employees'); await page.locator('[data-candidate] button').first().click(); assert.equal((await state()).employees.length, 3);
      await view('vehicles'); for (const type of ['BICYCLE', 'MOPED', 'CAR']) await page.click(`[data-company-vehicle="${type}"] button`);
      await shot('fleet'); s = await state(); const [a, b] = s.employees, [bicycle, moped, car] = s.companyVehicles;
      await view('employees');
      const assign = async (id, vehicleId) => { await page.selectOption(`[data-employee="${id}"] select`, vehicleId || ''); await page.click(`[data-employee="${id}"] button`); };
      await assign(a.id, car.id); assert.equal((await state()).employees[0].assignedTransport, car.id);
      assert.ok(await page.locator(`[data-employee="${b.id}"] option[value="${car.id}"]`).evaluate(option => option.disabled));
      await assign(a.id, null); await assign(b.id, car.id); await assign(a.id, moped.id);
      await assign(s.employees[2].id, bicycle.id);
      await page.click(`[data-employee="${a.id}"] summary`);
      assert.match(await page.locator(`[data-employee="${a.id}"] [data-employee-detail]`).textContent(), /Эффективность.*Надёжность.*Скорость.*Успешных заказов/s);
      await shot('employee-detail'); await bounds('#company-dialog [data-close]');
      await page.evaluate(() => { companyNow += 600000; companyWall += 600000; scene.company.tick(); scene.company.events.pending = null; });
      s = await state(); assert.ok(s.companyBalance > 0); assert.ok(s.employees.some(e => e.level > 1)); assert.ok(s.companyReputation > 0);
      await view('upgrades');
      for (const key of ['dispatch', 'routing', 'training', 'advertising']) await page.click(`[data-upgrade="${key}"] button`);
      s = await state(); for (const value of Object.values(s.companyUpgrades)) assert.equal(value, 1);
      await page.click('#company-upgrade'); await page.click('#company-upgrade'); assert.equal((await state()).officeLevel, 4);
      assert.ok(await page.locator('#company-upgrade').isDisabled()); await shot('upgrades'); await bounds('#company-dialog [data-close]');
      await view('dashboard'); await page.fill('#company-name', '<b>Доставка</b>'); await page.click('#company-rename');
      assert.equal(await page.locator('#company-display-name b').count(), 0);
      assert.match(await page.locator('#company-summary').textContent(), /Бизнес-центр.*Репутация компании/s);
      const balance = (await state()).companyBalance; await page.click('#company-collect'); assert.equal((await state()).companyBalance, 0);
      assert.equal((await state()).companyStats.totalIncomeCollected, balance); await shot('overview');
      // Queue behind company modal, then test positive/negative/choice UI and movement guards.
      await page.evaluate(() => scene.company.events.debug(null, 'good-day')); assert.equal(await page.locator('#company-event-dialog').isVisible(), false);
      await close('company'); await page.waitForSelector('#company-event-dialog[open]');
      await page.keyboard.press('d'); assert.equal(await page.evaluate(() => scene.player.body.velocity.length()), 0);
      await page.click('#company-event-buttons button');
      await page.evaluate(() => scene.company.events.debug(null, 'illness')); await page.waitForSelector('#company-event-dialog[open]');
      assert.ok((await state()).employees.some(e => e.status === 'TEMPORARILY_UNAVAILABLE')); await page.click('#company-event-buttons button');
      await page.evaluate(() => { companyNow += 180000; companyWall += 180000; scene.company.tick(); scene.company.events.pending = null; });
      assert.ok((await state()).employees.every(e => e.status === 'WORKING'));
      for (const id of ['coffee', 'broken-choice', 'urgent-choice', 'raise-choice']) {
        await page.evaluate(id => scene.company.events.debug(null, id), id); await page.waitForSelector('#company-event-dialog[open]');
        for (const button of await page.locator('#company-event-buttons button').all()) {
          await button.scrollIntoViewIfNeeded(); const box = await button.boundingBox();
          assert.ok(box && box.height >= 44 && box.x >= 0 && box.x + box.width <= viewport.width + 1 && box.y >= 0 && box.y + box.height <= viewport.height + 1, 'business choices remain reachable');
        }
        await shot(`event-${id}`); await page.locator('#company-event-buttons button').first().click();
        assert.match(await page.locator('#company-event-buttons button').textContent(), /ПОНЯТНО/); await page.click('#company-event-buttons button');
      }
      await page.evaluate(() => { scene.orders.order = null; scene.orders.random = () => 0; scene.orders.generate(); }); await page.click('#accept-order');
      for (let i = 0; i < 2; i++) {
        await page.evaluate(() => { const t = scene.orders.getTarget(); scene.player.setPosition(t.x, t.y); });
        await page.waitForSelector('#interact', { state: 'visible' }); await page.click('#interact');
      }
      assert.equal((await state()).completedOrders, 1);
      await page.evaluate(() => { window.originalCompany = scene.company; scene.scene.restart(); }); await ready();
      assert.ok(await page.evaluate(() => scene.company === originalCompany)); assert.equal(await page.locator('#company-event-dialog').count(), 1);
      const saved = await page.evaluate(() => scene.orders.state.getSaveData());
      const seedReload = async data => {
        await page.evaluate(async data => {
          clearInterval(scene.company.timer); window.removeEventListener('pagehide', scene.company.onPageHide); document.removeEventListener('visibilitychange', scene.company.onHide);
          const { platformService } = await import('/src/services/PlatformService.js'); await platformService.save(data);
        }, data); await page.reload(); await ready();
      };
      await seedReload({ ...saved, companyBalance: 0, companyIncomeRemainder: 0, lastCompanyUpdateTimestamp: Date.now() - 3600000 });
      await page.waitForSelector('#company-offline:not([hidden])'); s = await state();
      assert.ok(s.companyBalance > 0); assert.equal(s.companyStats.negativeEvents, saved.companyStats.negativeEvents);
      assert.equal(s.companyStats.employeeFailures, saved.companyStats.employeeFailures); assert.equal(s.companyActiveTimeMs, saved.companyActiveTimeMs);
      assert.deepEqual(s.companyUpgrades, saved.companyUpgrades); await shot('offline'); await bounds('#company-dialog [data-close]');
      await page.click('#company-offline-collect'); await close('company');
      await seedReload({ ...saved, companyBalance: 0, lastCompanyUpdateTimestamp: Date.now() + 3600000 });
      assert.equal(await page.locator('#company-dialog').isVisible(), false); assert.equal((await state()).companyBalance, 0);
      const legacy = { version: 6, xp: 3850, money: 1000, companyUnlocked: true, companyName: 'Stage 6', companyLevel: 3,
        companyBalance: 1000, companyLifetimeEarnings: 4000, companyVehicles: [{ id: 'vehicle-1', type: 'MOPED' }],
        employees: Array.from({ length: 6 }, (_, i) => ({ id: `courier-${i + 1}`, name: 'Саша', level: 1, efficiency: 1,
          baseIncome: 100, status: 'WORKING', assignedTransport: i === 0 ? 'vehicle-1' : null, totalEarned: 500 })) };
      await seedReload(legacy); s = await state(); assert.equal(s.employees.length, 6); assert.equal(s.officeLevel, 3);
      assert.equal(s.employees[0].reliability, 1); assert.equal(s.employees[0].assignedTransport, 'vehicle-1');
      assert.equal(s.companyBalance, 1000); assert.equal(s.companyCandidates.length, 3);
      await open('company'); await view('employees'); await shot('legacy-employees'); await close('company');
      await seedReload({ version: 5, money: 1234, xp: 250, transport: 'BICYCLE', completedOrders: 7 });
      s = await state(); assert.equal(s.companyUnlocked, false); assert.equal(s.equippedTransport, 'BICYCLE'); assert.equal(s.completedOrders, 7);
      await page.close(); console.log(`PASS Stage 7 company/UI/events/offline/migration/personal delivery ${viewport.width}x${viewport.height}`);
    }
    assert.deepEqual(errors, [], 'browser console has no runtime errors');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
