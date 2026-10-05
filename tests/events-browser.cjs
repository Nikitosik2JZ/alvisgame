const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const assert = require('node:assert/strict');
async function openScreen(page, selector) {
  if (!await page.locator(selector).isVisible()) await page.click('#open-menu');
  await page.click(selector);
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
    const errors = []; page.on('pageerror', e => {errors.push(e.message); console.error('Runtime:',e.message);}); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5176');
    await page.waitForFunction(async () => {
      const { game } = await import(document.querySelector('script[src*="/src/main.js"]').src); const scene = game.scene.getScene('GameScene'); if (scene?.orders?.order) { window.testScene = scene; return true; } return false;
    });
    const snapshot = () => page.evaluate(() => testScene.orders.state.getSnapshot());
    await page.keyboard.press('F7'); assert.equal((await snapshot()).level, 4);
    await openScreen(page, '#open-districts'); await page.getByRole('button', { name: 'ОТКРЫТЬ ЗА 3000 ₽' }).click();
    assert.equal((await snapshot()).money, 0);
    await page.getByRole('button', { name: 'ВЫБРАТЬ', exact: true }).click();
    await page.waitForFunction(() => testScene.orders.order.district === 'center');
    assert.equal(await page.locator('#open-districts').count(), 1);
    assert.equal((await snapshot()).selectedDistrict, 'center');
    assert.equal(await page.evaluate(async () => {
      const { platformService } = await import('/src/services/PlatformService.js');
      const { GameState } = await import('/src/state/GameState.js');
      const saved = testScene.orders.state.getSaveData();
      await platformService.save(saved); const restored = new GameState(); restored.loadSaveData(await platformService.loadSave());
      return JSON.stringify(saved) === JSON.stringify(restored.getSaveData());
    }), true);
    await openScreen(page, '#open-districts'); await page.getByRole('button', { name: 'ВЫБРАТЬ', exact: true }).click();
    await page.waitForFunction(() => testScene.orders.order.district === 'residential');
    await page.evaluate(() => { testScene.deliveryEvents.random = () => .99; });
    await page.evaluate(()=>{testScene.orders.state.update({money:3500});testScene.orders.state.purchaseTransport('BICYCLE');});
    for (const type of ['STANDARD', 'URGENT', 'FRAGILE', 'DOUBLE']) {
      await page.evaluate(type => {
        const manager = testScene.orders; manager.order = null;
        let calls = 0; const roll = { STANDARD: 0, URGENT: .7, FRAGILE: .84, DOUBLE: .99 }[type];
        manager.random = () => ++calls === 3 ? roll : 0; manager.generate();
      }, type);
      await page.click('#accept-order');
      await page.evaluate(() => testScene.player.setPosition(testScene.orders.order.restaurant.x, testScene.orders.order.restaurant.y));
      await page.keyboard.press('e');
      await page.evaluate(() => testScene.player.setPosition(testScene.orders.order.customer.x, testScene.orders.order.customer.y));
      await page.waitForTimeout(80); await page.click('#interact');
      if (type === 'DOUBLE') {
        assert.match(await page.locator('#objective').textContent(), /1 \/ 2/);
        await page.evaluate(() => testScene.player.setPosition(testScene.orders.order.customer.x, testScene.orders.order.customer.y));
        await page.waitForTimeout(80); await page.click('#interact');
        assert.match(await page.locator('#objective').textContent(), /2 \/ 2/);
      }
      assert.equal(await page.evaluate(() => testScene.orders.order.status), 'DELIVERED');
      assert.match(await page.locator('#result').textContent(), /XP/);
    }
    const show = async (id, stage='pickup') => {
      await page.evaluate(async ({id,stage}) => {
        const { EVENTS } = await import('/src/data/events.js');
        const manager = testScene.orders; manager.order = null; manager.random = () => 0; manager.generate(); manager.accept(); manager.interact(manager.order.restaurant);
        const event = EVENTS.find(e => e.id === id); testScene.deliveryEvents.negativeStreak = 0; testScene.deliveryEvents.pending = { ...event, trigger: stage };
        if (stage === 'customer') { testScene.player.setPosition(manager.order.customer.x,manager.order.customer.y); manager.interact(testScene.player); }
        else testScene.deliveryEvents.trigger(stage);
      }, {id,stage});
      await page.waitForSelector('#event-dialog[open]');
      await page.waitForFunction(() => { const seconds=testScene.orders.remainingSeconds(); return document.querySelector('#timer').textContent === `Осталось: ${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`; });
    };
    await show('cola','customer'); assert.match(await page.locator('#event-effects').textContent(), /Списано/);
    const position = await page.evaluate(() => ({x:testScene.player.x,y:testScene.player.y}));
    const timer = await page.locator('#timer').textContent();
    await page.keyboard.down('d'); await page.waitForTimeout(1100); await page.keyboard.up('d');
    assert.deepEqual(await page.evaluate(() => ({x:testScene.player.x,y:testScene.player.y})), position);
    assert.equal(await page.locator('#timer').textContent(), timer);
    await page.getByRole('button',{name:'ПОНЯТНО',exact:true}).click();
    assert.equal(await page.evaluate(() => testScene.orders.order.status), 'DELIVERED');
    await show('generous','customer'); assert.match(await page.locator('#event-effects').textContent(), /ЧАЕВЫЕ/);
    await page.getByRole('button',{name:'ПОНЯТНО',exact:true}).click();
    for (const id of ['silent','lift','fries']) {
      await show(id,id==='fries'?'pickup':'customer');
      assert.equal(await page.locator('#event-buttons button').count(),2);
      await page.locator('#event-buttons button').first().click(); assert.ok((await page.locator('#event-effects').textContent()).length);
      await page.getByRole('button',{name:'ПОНЯТНО',exact:true}).click();
    }
    await page.evaluate(() => { testScene.orders.order=null; testScene.orders.generate(); });
    await openScreen(page, '#open-events');
    assert.equal(await page.locator('#event-history p').count(),5);
    await page.click('#event-history-dialog [data-close]');
    await openScreen(page, '#open-profile');
    assert.match(await page.locator('#profile-details').textContent(), /Новичок|Надёжный|Любимчик|Легенда/);
    const before = await snapshot(); await page.keyboard.press('F4'); assert.deepEqual(await snapshot(), before);
    await page.click('#profile-dialog [data-close]');
    for (const key of ['F4','F5','F6']) {
      await page.keyboard.press(key); await page.waitForSelector('#event-dialog[open]');
      if (await page.locator('#event-buttons button').count() === 2) await page.locator('#event-buttons button').first().click();
      await page.getByRole('button',{name:'ПОНЯТНО',exact:true}).click();
    }
    for (const viewport of [{width:390,height:844},{width:844,height:390},{width:320,height:568}]) {
      await page.setViewportSize(viewport); await show('fries');
      await page.screenshot({path:`tests/stage4-event-${viewport.width}x${viewport.height}.png`});
      const box = await page.locator('#event-dialog').boundingBox(); assert.ok(box.x>=0 && box.y>=0 && box.x+box.width<=viewport.width);
      await page.locator('#event-buttons button').first().click(); await page.getByRole('button',{name:'ПОНЯТНО',exact:true}).click();
      const start=await page.evaluate(() => { testScene.player.setPosition(1200,1000); return {x:1200,y:1000}; });
      const right=await page.locator('#joystick').boundingBox();
      await page.mouse.move(right.x+right.width-8,right.y+right.height/2); await page.mouse.down(); await page.waitForTimeout(200); await page.mouse.up();
      assert.ok(await page.evaluate(x=>testScene.player.x>x,start.x));
      await page.screenshot({path:`tests/stage4-${viewport.width}x${viewport.height}.png`});
      await page.evaluate(() => {testScene.orders.order=null;testScene.orders.generate();});
      await openScreen(page, '#open-districts'); assert.equal(await page.getByRole('button',{name:'ВЫБРАТЬ',exact:true}).isEnabled(),true);
      await page.click('#district-dialog [data-close]');
    }
    assert.deepEqual(errors,[]);
    if (process.env.PRODUCTION_URL) {
      await page.goto(process.env.PRODUCTION_URL); await page.waitForSelector('#objective:not(:empty)');
      const before=await page.locator('.stats').textContent();
      for(const key of ['F2','F3','F4','F5','F6','F7']) await page.keyboard.press(key);
      await page.waitForTimeout(200); assert.equal(await page.locator('.stats').textContent(),before);
      assert.equal(await page.locator('#event-dialog[open]').count(),0); assert.deepEqual(errors,[]);
    }
    console.log('PASS: four deliveries, district purchase/switch/restart, all choice UIs, event results, modal/timer/input blocking, history, responsive touch controls, console, production cheats.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});




