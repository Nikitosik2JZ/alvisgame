// Real LOCAL-mode browser checks. No injected YaGames object or fake platform results.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.GAME_URL || 'http://127.0.0.1:5178';
const key = 'courier-empire-save-v1';
const artifacts = path.join(process.cwd(), 'artifacts', 'stage11');
const seed = { version: 10, money: 200000, xp: 10000, reputation: 150, completedOrders: 30,
  ownedTransports: ['WALKING', 'BICYCLE', 'MOPED', 'CAR'], equippedTransport: 'CAR', unlockedDistricts: ['residential'],
  companyUnlocked: true, officeLevel: 1, companyName: 'Stage 11', employees: [{ id: 'courier-1', name: 'Саша' }] };
(async () => {
  fs.mkdirSync(artifacts, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const errors = [];
  try {
    for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
      const page = await browser.newPage({ viewport, hasTouch: viewport.width < 1000 });
      const modes = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); if (m.text().includes('[Platform] LOCAL mode')) modes.push(m.text()); });
      await page.addInitScript(({ seed, key }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(seed)); }, { seed, key });
      const ready = async () => {
        await page.waitForFunction(async () => {
          const { game, lifecycle, platformService } = await import(document.querySelector('script[src*="/src/main.js"]').src);
          window.scene = game.scene.getScene('GameScene'); window.life = lifecycle; window.platform = platformService;
          return !!scene?.orders?.order && platform.ready && !document.querySelector('#loading');
        });
        await page.evaluate(() => { scene.deliveryEvents.random = () => .99; scene.company.events.nextAt = Infinity; });
        if (await page.locator('#company-dialog[open]').count()) await page.click('#company-dialog [data-close]');
      };
      const snapshot = () => page.evaluate(() => scene.orders.state.getSnapshot());
      const open = async id => { if (!await page.locator(`#open-${id}`).isVisible()) await page.click('#open-menu'); await page.click(`#open-${id}`); };
      const close = async id => page.click(`#${id}-dialog [data-close]`);
      const layout = async id => assert.equal(await page.evaluate(id => {
        const d = document.querySelector(`#${id}-dialog`), b = d.getBoundingClientRect(), c = d.querySelector('.modal-content');
        return b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight && c.scrollWidth <= c.clientWidth + 1;
      }, id), true);
      await page.goto(base); await ready(); assert.equal(modes.length, 1); assert.equal(await page.evaluate(() => document.documentElement.lang), 'ru');
      await open('rating'); await layout('rating'); assert.match(await page.locator('#rating-content').innerText(), /ВАШ СЧЁТ/); await close('rating');
      await page.evaluate(() => { scene.orders.order = null; scene.orders.generate({ forcedType: 'STANDARD' }); });
      await page.click('#accept-order');
      const remaining = await page.evaluate(() => scene.orders.remainingSeconds());
      await open('garage'); await layout('garage');
      if (viewport.width < 1000) {
        const panel = page.locator('#garage-dialog .modal-content');
        const box = await panel.boundingBox();
        const touch = await page.context().newCDPSession(page);
        const x = box.x + box.width / 2, y = box.y + Math.min(box.height - 20, 220);
        await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        for (let i = 1; i <= 8; i++) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - i * 15 }] });
        await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(100);
        assert.ok(await panel.evaluate(node => node.scrollHeight <= node.clientHeight || node.scrollTop > 0), 'Internal menu must scroll by touch');
        await touch.detach();
      }
      await page.evaluate(() => platform.emit('pause')); await close('garage');
      assert.equal(await page.evaluate(() => life.paused && scene.player.inputBlocked && !scene.input.keyboard.enabled), true);
      await page.waitForTimeout(1200); assert.equal(await page.evaluate(() => scene.orders.remainingSeconds()), remaining);
      await open('garage'); await page.evaluate(() => platform.emit('resume')); assert.equal(await page.evaluate(() => life.paused), true);
      await close('garage'); assert.equal(await page.evaluate(() => life.paused), false);
      await page.evaluate(() => { window.beforeHidden = scene.orders.remainingSeconds(); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('blur')); });
      await page.waitForTimeout(300); assert.equal(await page.evaluate(() => scene.orders.remainingSeconds()), await page.evaluate(() => beforeHidden));
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      const beforeDelivery = await snapshot();
      await page.evaluate(() => { scene.deliveryEvents.pending = null; const t = scene.orders.getTarget(); scene.player.setPosition(t.x, t.y); scene.orders.interact(scene.player); });
      await page.evaluate(() => { const t = scene.orders.getTarget(); scene.player.setPosition(t.x, t.y); scene.orders.interact(scene.player); });
      await page.waitForSelector('#result-actions:not([hidden])'); const delivered = await snapshot();
      assert.equal(await page.evaluate(() => {
        const button = document.querySelector('#continue-delivery').getBoundingClientRect();
        const panel = document.querySelector('#order-panel').getBoundingClientRect();
        return button.top >= panel.top && button.bottom <= panel.bottom && button.bottom <= innerHeight;
      }), true, 'Continue without advertising must be visible on the result');
      await page.screenshot({ path: path.join(artifacts, `${viewport.width}x${viewport.height}-result.png`) });
      assert.equal(delivered.completedOrders, beforeDelivery.completedOrders + 1); assert.ok(delivered.money > beforeDelivery.money);
      const payout = delivered.money - beforeDelivery.money; assert.match(await page.locator('#delivery-ad-bonus').innerText(), new RegExp(`\\+${Math.floor(payout / 2)} ₽`));
      await page.click('#rewarded-delivery'); assert.match(await page.locator('#ad-feedback').innerText(), /РЕКЛАМА СЕЙЧАС НЕДОСТУПНА/); assert.equal((await snapshot()).money, delivered.money);
      await page.click('#continue-delivery'); assert.equal(await page.evaluate(() => life.paused), false); assert.equal(await page.evaluate(() => scene.orders.order.status), 'AVAILABLE');
      await open('shop'); const purchase = await page.evaluate(() => scene.orders.state.purchaseItem('old-shoes')); assert.equal(purchase.ok, true); await close('shop');
      const district = await page.evaluate(() => scene.orders.state.unlockDistrict('center')); assert.equal(district, true);
      const company = await page.evaluate(() => scene.company.upgrade()); assert.equal(company.ok, true);
      const achievement = await page.evaluate(() => scene.orders.state.progression.claim('first-order')); assert.equal(achievement.ok, true);
      const taskClaim = await page.evaluate(() => { const t = scene.orders.state.values.dailyTasks[0]; t.currentProgress = t.target; scene.orders.state.tasks.complete(t); scene.orders.state.refresh(); return scene.orders.state.tasks.claim(t.id); }); assert.equal(taskClaim.ok, true);
      const saved = await snapshot(); await page.reload(); await ready(); const restored = await snapshot();
      for (const field of ['money', 'xp', 'reputation', 'completedOrders', 'officeLevel']) assert.equal(restored[field], saved[field]);
      assert.deepEqual(restored.ownedItems, saved.ownedItems); assert.deepEqual(restored.unlockedDistricts, saved.unlockedDistricts); assert.deepEqual(restored.claimedAchievementRewards, saved.claimedAchievementRewards); assert.equal(restored.dailyTasks[0].claimed, true);
      if (viewport.width < 1000) {
        const start = await page.evaluate(() => ({ x: scene.player.x, y: scene.player.y }));
        const joystick = await page.locator('#joystick').boundingBox();
        await page.mouse.move(joystick.x + joystick.width / 2, joystick.y + joystick.height / 2); await page.mouse.down(); await page.mouse.move(joystick.x + joystick.width - 4, joystick.y + joystick.height / 2); await page.waitForTimeout(150); await page.mouse.up();
        assert.ok(await page.evaluate(start => Math.hypot(scene.player.x - start.x, scene.player.y - start.y) > 2, start));
        assert.equal(await page.evaluate(() => scene.player.movementInput.pointer), null);
      } else {
        const start = await page.evaluate(() => scene.player.x); await page.keyboard.down('d'); await page.waitForTimeout(150); await page.keyboard.up('d'); assert.ok(await page.evaluate(start => scene.player.x > start, start));
      }
      const orientationSnapshot = await snapshot(); await page.setViewportSize({ width: viewport.height, height: viewport.width }); await page.waitForTimeout(200); assert.equal((await snapshot()).money, orientationSnapshot.money); await page.setViewportSize(viewport);
      const root = await page.evaluate(() => ({ overflow: getComputedStyle(document.body).overflow, overscroll: getComputedStyle(document.body).overscrollBehavior, touch: getComputedStyle(document.body).touchAction, context: !document.querySelector('canvas').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })) }));
      assert.equal(root.overflow, 'hidden'); assert.equal(root.overscroll, 'none'); assert.equal(root.touch, 'none'); assert.equal(root.context, true);
      await page.screenshot({ path: path.join(artifacts, `${viewport.width}x${viewport.height}.png`) });
      console.log(`PASS LOCAL ${viewport.width}x${viewport.height}: migration, rating, nested pause, order timer, result/no-op ad, persistence after transactions, controls, orientation, browser gestures`); await page.close();
    }
    assert.deepEqual(errors, []); console.log('PASS no LOCAL browser console/runtime errors. Real SDK checks REQUIRE YANDEX DEBUG ENVIRONMENT.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
