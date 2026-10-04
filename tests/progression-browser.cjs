const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5175');
    await page.waitForFunction(async () => {
      const { game } = await import(document.querySelector('script[src*="/src/main.js"]').src);
      window.testScene = game.scene.getScene('GameScene');
      return testScene?.orders?.order;
    });
    await page.evaluate(() => { testScene.deliveryEvents.random = () => .99; });
    await page.waitForTimeout(500);
    const snapshot = () => page.evaluate(() => testScene.orders.state.getSnapshot());
    const pos = () => page.evaluate(() => ({ x: testScene.player.x, y: testScene.player.y }));
    await page.click('#open-shop');
    await page.click('[data-item="old-shoes"]');
    assert.match(await page.locator('#shop-feedback').textContent(), /Не хватает/);
    await page.click('[data-item="good-shoes"]');
    assert.match(await page.locator('#shop-feedback').textContent(), /Сначала/);
    await page.click('[data-item="bicycle"]');
    assert.match(await page.locator('#shop-feedback').textContent(), /уровень 3/);
    const start = await pos();
    await page.keyboard.down('d'); await page.waitForTimeout(250); await page.keyboard.up('d');
    assert.deepEqual(await pos(), start, 'modal blocks movement');
    await page.keyboard.press('F2');
    assert.equal((await snapshot()).money, 1000);
    await page.click('[data-item="old-shoes"]');
    assert.equal((await snapshot()).money, 700);
    assert.equal((await snapshot()).movementSpeed, 168);
    assert.equal(await page.locator('[data-item="old-shoes"]').isDisabled(), true);
    await page.keyboard.press('F2');
    await page.click('[data-item="good-shoes"]');
    assert.equal((await snapshot()).money, 800);
    assert.equal((await snapshot()).movementSpeed, 176);
    assert.match(await page.locator('[data-item="old-shoes"]').textContent(), /ЭКИПИРОВАТЬ/);
    await page.keyboard.press('F2');
    await page.click('[data-item="thermobag"]');
    assert.equal((await snapshot()).money, 600);
    for (let i = 0; i < 3; i++) await page.keyboard.press('F3');
    await page.click('[data-item="bicycle"]');
    assert.match(await page.locator('#shop-feedback').textContent(), /Не хватает/);
    for (let i = 0; i < 3; i++) await page.keyboard.press('F2');
    await page.click('[data-item="bicycle"]');
    assert.equal((await snapshot()).money, 100);
    assert.equal((await snapshot()).transport, 'BICYCLE');
    assert.equal((await snapshot()).movementSpeed, 250);
    assert.equal(await page.evaluate(() => testScene.player.texture.key), 'courier-bicycle');
    assert.match(await page.locator('#money').textContent(), /100 ₽/);
    await page.click('#shop-dialog [data-close]');
    await page.click('#open-profile');
    assert.match(await page.locator('#profile-details').textContent(), /Велосипед/);
    assert.match(await page.locator('#profile-details').textContent(), /250 пикс/);
    await page.click('#equip-walking');
    assert.equal((await snapshot()).movementSpeed, 176);
    assert.equal(await page.evaluate(() => testScene.player.texture.key), 'courier');
    await page.click('#equip-bicycle');
    await page.keyboard.press('Escape');
    // Same building collision and camera remain in effect on the bicycle.
    await page.evaluate(() => testScene.player.setPosition(530, 600));
    await page.keyboard.down('d'); await page.waitForTimeout(700); await page.keyboard.up('d');
    assert.ok((await pos()).x <= 554.5, 'bicycle collision');
    await page.evaluate(() => testScene.player.setPosition(1200, 1000));
    await page.click('#accept-order');
    const timer = await page.locator('#timer').textContent();
    await page.click('#open-shop'); await page.waitForTimeout(1100);
    assert.notEqual(await page.locator('#timer').textContent(), timer, 'order timer continues in modal');
    await page.keyboard.press('e');
    assert.equal(await page.evaluate(() => testScene.orders.order.status), 'ACCEPTED');
    await page.click('#shop-dialog [data-close]');
    async function moveTo(x, y) {
      for (const [axis, goal, positive, negative] of [['x', x, 'd', 'a'], ['y', y, 's', 'w']]) {
        const current = (await pos())[axis];
        if (Math.abs(current - goal) < 6) continue;
        const key = current < goal ? positive : negative;
        await page.keyboard.down(key);
        try { await page.waitForFunction(({ axis, goal, positive }) => positive ? testScene.player[axis] >= goal - 5 : testScene.player[axis] <= goal + 5, { axis, goal, positive: current < goal }, { timeout: 15000 }); }
        catch (error) { console.log(await page.evaluate(() => ({ x: testScene.player.x, y: testScene.player.y, speed: testScene.player.speed, blocked: testScene.player.inputBlocked, enabled: testScene.input.keyboard.enabled, keys: Object.fromEntries(Object.entries(testScene.player.keys).map(([k,v]) => [k,v.isDown])), velocity: testScene.player.body.velocity, order: testScene.orders.order }))); throw error; }
        finally { await page.keyboard.up(key); }
      }
    }
    const order = await page.evaluate(() => testScene.orders.order);
    await moveTo(1200, order.restaurant.y); await moveTo(order.restaurant.x, order.restaurant.y);
    await page.waitForSelector('#interact', { state: 'visible' }); await page.keyboard.press('e');
    assert.equal(await page.evaluate(() => testScene.orders.order.status), 'PICKED_UP');
    await moveTo(1200, order.restaurant.y); await moveTo(1200, order.customer.y); await moveTo(order.customer.x, order.customer.y);
    await page.waitForSelector('#interact', { state: 'visible' }); await page.click('#interact');
    assert.equal(await page.evaluate(() => testScene.orders.order.status), 'DELIVERED');
    assert.equal((await snapshot()).money, 100 + order.reward + Math.round(order.reward * .1));
    assert.match(await page.locator('#result').textContent(), /Базовая оплата.*\nТермосумка/);
    await page.waitForSelector('#accept-order', { state: 'visible' }); await page.click('#accept-order');
    await page.evaluate(() => { testScene.orders.order.deadline = performance.now() - 1; });
    await page.waitForFunction(() => testScene.orders.order.status === 'FAILED');
    assert.equal((await snapshot()).transport, 'BICYCLE');
    for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 320, height: 568 }]) {
      await page.setViewportSize(viewport); await page.waitForTimeout(200);
      for (const [open, dialog] of [['#open-shop', '#shop-dialog'], ['#open-profile', '#profile-dialog']]) {
        await page.click(open);
        const bounds = await page.locator(dialog).boundingBox();
        const close = await page.locator(dialog + ' [data-close]').boundingBox();
        for (const box of [bounds, close]) assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height, JSON.stringify({ viewport, box }));
        assert.equal(await page.locator(dialog).evaluate(el => el.scrollWidth <= el.clientWidth), true, 'no horizontal overflow');
        if (dialog === '#shop-dialog') {
          await page.locator('[data-item="bicycle"]').scrollIntoViewIfNeeded();
          assert.equal(await page.locator(dialog + ' [data-close]').isVisible(), true);
          await page.locator(dialog + ' .modal-content').evaluate(el => { el.scrollTop = 0; });
        }
        await page.screenshot({ path: `tests/${dialog.slice(1)}-${viewport.width}x${viewport.height}.png` });
        await page.click(dialog + ' [data-close]');
      }
      if (viewport.width < 900) {
        await page.evaluate(() => testScene.player.setPosition(1200, 1000));
        const before = await pos();
        const button = await page.locator('[data-direction="right"]').boundingBox();
        await page.mouse.move(button.x + button.width / 2, button.y + button.height / 2);
        await page.mouse.down(); await page.waitForTimeout(250); await page.mouse.up();
        assert.ok((await pos()).x > before.x + 20, 'touch works after modal closes');
      }
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: 'tests/bicycle-world.png' });
    // Production must have no debug shortcut effects.
    if (process.env.PRODUCTION_URL) {
      await page.goto(process.env.PRODUCTION_URL);
      await page.waitForFunction(() => document.querySelector('#objective').textContent.startsWith('НОВЫЙ ЗАКАЗ'));
      const before = await page.locator('.stats').textContent();
      const xp = await page.locator('#xp').textContent();
      await page.keyboard.press('F2'); await page.keyboard.press('F3');
      await page.waitForTimeout(200);
      assert.equal(await page.locator('.stats').textContent(), before);
      assert.equal(await page.locator('#xp').textContent(), xp);
      await page.click('#open-shop');
      assert.match(await page.locator('#shop-money').textContent(), /0 ₽/);
    }
    assert.deepEqual(errors, [], 'browser errors');
    console.log('PASS: shop validations, atomic purchases, shoes, bag payout, bicycle route/collisions/failure, profile equipment, modal input, responsive panels, touch recovery and production cheats.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
