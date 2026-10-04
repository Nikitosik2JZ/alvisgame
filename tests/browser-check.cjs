// Run with PLAYWRIGHT_MODULE pointing to an installed playwright-core module.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5174');
    await page.waitForSelector('#offer-restaurant');
    await page.waitForFunction(async () => {
      const { game } = await import('/src/main.js');
      return game.scene.getScene('GameScene').orders?.order;
    });
    await page.evaluate(async () => { const { game } = await import('/src/main.js'); window.testScene = game.scene.getScene('GameScene'); });
    const inspect = () => page.evaluate(() => ({ x: testScene.player.x, y: testScene.player.y, order: testScene.orders.order }));
    const initial = await inspect();
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(250);
    await page.keyboard.up('ArrowRight');
    assert.ok((await inspect()).x > initial.x + 20, 'arrow movement');
    await page.evaluate(() => testScene.player.setPosition(530, 600));
    await page.keyboard.down('d');
    await page.waitForTimeout(700);
    await page.keyboard.up('d');
    assert.ok((await inspect()).x <= 554.5, 'static building blocks movement');
    await page.evaluate(() => testScene.player.setPosition(1200, 1000));
    await page.click('#accept-order');
    assert.equal((await inspect()).order.status, 'ACCEPTED');
    assert.equal(await page.locator('#interact').isVisible(), false);
    async function moveTo(x, y) {
      for (const [axis, goal, positive, negative] of [['x', x, 'd', 'a'], ['y', y, 's', 'w']]) {
        const current = (await inspect())[axis];
        if (Math.abs(current - goal) < 6) continue;
        const key = current < goal ? positive : negative;
        await page.keyboard.down(key);
        try {
          await page.waitForFunction(({ axis, goal, positive }) => positive ? testScene.player[axis] >= goal - 5 : testScene.player[axis] <= goal + 5, { axis, goal, positive: current < goal }, { timeout: 15000 });
        } finally { await page.keyboard.up(key); }
      }
    }
    const restaurant = (await inspect()).order.restaurant;
    await moveTo(1200, restaurant.y);
    await moveTo(restaurant.x, restaurant.y);
    await page.waitForSelector('#interact', { state: 'visible' });
    await page.keyboard.press('e');
    assert.equal((await inspect()).order.status, 'PICKED_UP');
    const customer = (await inspect()).order.customer;
    await moveTo(1200, restaurant.y);
    await moveTo(1200, customer.y);
    await moveTo(customer.x, customer.y);
    await page.waitForSelector('#interact', { state: 'visible' });
    await page.click('#interact');
    assert.equal((await inspect()).order.status, 'DELIVERED');
    assert.match(await page.locator('#money').textContent(), /^[1-3]\d{2} ₽$/);
    assert.match(await page.locator('#xp').textContent(), /^(1[5-9]|[2-3]\d|40) \/ 100 XP$/);
    await page.waitForSelector('#accept-order', { state: 'visible' });
    await page.click('#accept-order');
    const seconds = await page.locator('#timer').textContent();
    await page.waitForTimeout(1100);
    assert.notEqual(await page.locator('#timer').textContent(), seconds, 'timer decreases');
    await page.evaluate(() => { testScene.orders.order.deadline = performance.now() - 1; });
    await page.waitForFunction(() => testScene.orders.order.status === 'FAILED');
    assert.match(await page.locator('#result').textContent(), /Заказ провален/);
    await page.waitForSelector('#accept-order', { state: 'visible' });
    // Accelerated repeat deliveries verify level-up UI without long walks.
    for (let i = 0; i < 6 && await page.locator('#level').textContent() === '1'; i++) {
      await page.click('#accept-order');
      await page.evaluate(() => { const t = testScene.orders.getTarget(); testScene.player.setPosition(t.x, t.y); });
      await page.waitForSelector('#interact', { state: 'visible' });
      await page.click('#interact');
      await page.evaluate(() => { const t = testScene.orders.getTarget(); testScene.player.setPosition(t.x, t.y); });
      await page.waitForSelector('#interact', { state: 'visible' });
      await page.click('#interact');
      if (await page.locator('#level').textContent() !== '1') break;
      await page.waitForSelector('#accept-order', { state: 'visible' });
    }
    assert.notEqual(await page.locator('#level').textContent(), '1');
    assert.match(await page.locator('#result').textContent(), /НОВЫЙ УРОВЕНЬ/);
    for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 320, height: 568 }]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(150);
      assert.equal(await page.locator('.touch-controls').isVisible(), true);
      const boxes = await page.evaluate(() => ['.hud', '#order-panel', '.touch-controls'].map(selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x:r.x,y:r.y,right:r.right,bottom:r.bottom }; }));
      for (const box of boxes) assert.ok(box.x >= 0 && box.y >= 0 && box.right <= viewport.width && box.bottom <= viewport.height, JSON.stringify({viewport,box}));
      const pos = await inspect();
      const button = await page.locator('[data-direction="left"]').boundingBox();
      await page.mouse.move(button.x + button.width / 2, button.y + button.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(150);
      await page.mouse.up();
      assert.ok((await inspect()).x < pos.x, 'touch movement');
    }
    await page.screenshot({ path: 'tests/mobile-check.png' });
    assert.deepEqual(errors, [], 'browser runtime and console errors');
    console.log('PASS: movement, collisions, physical route, pickup E, delivery button, rewards, timer, failure, next offer, level up, responsive and touch controls.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
