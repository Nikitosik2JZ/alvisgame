const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const artifacts = process.env.ARTIFACT_DIR || path.join(require('node:os').tmpdir(), 'courier-mobile-ux');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const errors = [];
  fs.mkdirSync(artifacts, { recursive: true });
  try {
    for (const viewport of [{width:390,height:844},{width:430,height:932},{width:844,height:390},{width:320,height:568}]) {
      const page = await browser.newPage({ viewport, hasTouch:true });
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5174');
      await page.waitForFunction(async () => {
        const { game } = await import(document.querySelector('script[src*="/src/main.js"]').src);
        const scene = game.scene.getScene('GameScene');
        if (scene?.orders?.order) { window.s = scene; return true; }
        return false;
      });
      await page.evaluate(async () => { const { game } = await import(document.querySelector('script[src*="/src/main.js"]').src); window.s = game.scene.getScene('GameScene'); s.deliveryEvents.random = () => .99; });
      const shot = name => page.screenshot({ path:path.join(artifacts, `${viewport.width}x${viewport.height}-${name}.png`) });
      const bounds = async selector => {
        const b = await page.locator(selector).boundingBox();
        assert.ok(b && b.x>=0 && b.y>=0 && b.x+b.width<=viewport.width+1 && b.y+b.height<=viewport.height+1, `${selector}: ${JSON.stringify(b)}`);
        return b;
      };
      assert.ok(await page.locator('.hud').evaluate(el=>el.classList.contains('collapsed')));
      assert.ok((await bounds('.hud')).height<=55);
      assert.equal(await page.locator('h1').isVisible(), false);
      for (const id of ['money','level','reputation']) assert.ok(await page.locator(`#${id}`).isVisible());
      await bounds('#order-panel'); await bounds('#joystick'); await shot('offer');
      await page.click('#toggle-hud'); await page.waitForFunction(()=>!document.querySelector('.hud').classList.contains('collapsed')); assert.ok(await page.locator('h1').isVisible());
      await shot('expanded'); await page.click('#toggle-hud');
      await page.click('#accept-order');
      assert.equal(await page.evaluate(()=>s.orders.order.status), 'ACCEPTED');
      assert.ok((await bounds('#order-panel')).height<95);
      await page.click('#toggle-order'); assert.ok(await page.locator('#active-order-details').isVisible());
      await page.click('#toggle-order'); assert.equal(await page.locator('#active-order-details').isVisible(),false);
      await shot('active');
      await page.evaluate(()=>s.player.setPosition(1200,1000));
      const j = await bounds('#joystick'); const cx=j.x+j.width/2, cy=j.y+j.height/2;
      const touch = await page.context().newCDPSession(page);
      const drag = async (x,y) => {
        await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx,y:cy,id:1}]});
        await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y,id:1}]});
        await page.waitForTimeout(80);
        return page.evaluate(()=>({x:s.player.body.velocity.x,y:s.player.body.velocity.y,speed:s.player.speed*(s.player.speedMultiplier||1)}));
      };
      let v=await drag(cx+80,cy+37);
      assert.ok(v.x>0 && v.y>0 && Math.abs(v.x/v.y-80/37)<.1);
      assert.ok(Math.abs(Math.hypot(v.x,v.y)-v.speed)<.1);
      await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await page.waitForTimeout(60);
      assert.equal(await page.evaluate(()=>s.player.body.velocity.length()),0);
      await drag(cx+2,cy); assert.equal(await page.evaluate(()=>s.player.body.velocity.length()),0);
      await touch.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
      assert.equal(await page.evaluate(()=>s.player.movementInput.pointer),null);
      await drag(cx+80,cy);
      await page.evaluate(()=>document.querySelector('#open-menu').click());
      assert.equal(await page.evaluate(()=>s.player.movementInput.pointer),null);
      assert.equal(await page.evaluate(()=>s.player.body.velocity.length()),0);
      await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await page.click('#menu-dialog [data-close]');
      await page.evaluate(()=>{const t=s.orders.getTarget();s.player.setPosition(t.x,t.y);});
      await page.waitForSelector('#interact',{state:'visible'}); await bounds('#interact');
      await page.tap('#interact'); assert.equal(await page.evaluate(()=>s.orders.order.status),'PICKED_UP');
      for (const [opener,dialog] of [['open-shop','shop-dialog'],['open-profile','profile-dialog'],['open-garage','garage-dialog'],['open-districts','district-dialog']]) {
        await page.tap('#open-menu');
        assert.equal(await page.evaluate(()=>s.player.inputBlocked),true);
        await page.tap(`#${opener}`); await page.waitForSelector(`#${dialog}[open]`);
        await bounds(`#${dialog}`); await bounds(`#${dialog} [data-close]`);
        await page.keyboard.down('d'); await page.waitForTimeout(60); await page.keyboard.up('d');
        assert.equal(await page.evaluate(()=>s.player.body.velocity.length()),0);
        // Programmatic background actions also honor the input gate.
        const status = await page.evaluate(()=>s.orders.order.status);
        await page.evaluate(()=>document.querySelector('#interact').click());
        assert.equal(await page.evaluate(()=>s.orders.order.status),status);
        await shot(dialog); await page.click(`#${dialog} [data-close]`);
        assert.equal(await page.evaluate(()=>s.player.inputBlocked),false);
      }
      await page.evaluate(async()=>{
        const { EVENTS }=await import('/src/data/events.js');
        s.deliveryEvents.pending={...EVENTS.find(e=>e.id==='fries'),trigger:'pickup'};
        s.deliveryEvents.trigger('pickup');
      });
      await page.waitForSelector('#event-dialog[open]'); await bounds('#event-dialog'); await shot('event');
      await page.locator('#event-buttons button').first().click();
      await page.getByRole('button',{name:'ПОНЯТНО',exact:true}).click();
      await page.evaluate(()=>{const t=s.orders.getTarget();s.player.setPosition(t.x,t.y);});
      await page.waitForSelector('#interact',{state:'visible'}); await page.tap('#interact');
      assert.equal(await page.evaluate(()=>s.orders.order.status),'DELIVERED');
      await shot('result');
      await page.evaluate(()=>s.scene.restart());
      await page.waitForTimeout(250);
      assert.ok(await page.locator('.hud').evaluate(el=>el.classList.contains('collapsed')));
      await page.close();
      console.log(`PASS mobile ${viewport.width}x${viewport.height}`);
    }
    const page = await browser.newPage({viewport:{width:1280,height:800}});
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5174');
    await page.waitForFunction(async()=>{const {game}=await import(document.querySelector('script[src*="/src/main.js"]').src);const scene=game.scene.getScene('GameScene');if(scene?.orders?.order){window.s=scene;return true;}return false;});
    await page.evaluate(async()=>{const {game}=await import(document.querySelector('script[src*="/src/main.js"]').src);window.s=game.scene.getScene('GameScene');});
    assert.equal(await page.locator('#joystick').isVisible(),false);
    assert.ok(await page.locator('h1').isVisible());
    for (const keys of [['d'],['ArrowRight'],['w','d']]) {
      for (const k of keys) await page.keyboard.down(k);
      await page.waitForTimeout(80);
      const v=await page.evaluate(()=>({length:s.player.body.velocity.length(),speed:s.player.speed*(s.player.speedMultiplier||1)}));
      assert.ok(Math.abs(v.length-v.speed)<.1);
      for (const k of keys) await page.keyboard.up(k);
    }
    await page.click('#accept-order');
    await page.evaluate(()=>{const t=s.orders.getTarget();s.player.setPosition(t.x,t.y);s.deliveryEvents.random=()=>.99;});
    await page.keyboard.press('e'); assert.equal(await page.evaluate(()=>s.orders.order.status),'PICKED_UP');
    await page.screenshot({path:path.join(artifacts,'desktop.png')});
    await page.evaluate(async()=>{
      const { TRANSPORTS } = await import('/src/config/transportConfig.js');
      const { xpForLevel } = await import('/src/config/gameBalance.js');
      const state=s.orders.state;
      s.orders.order=null;
      state.update({xp:xpForLevel(10),money:100000});
      for(const t of TRANSPORTS.slice(1)) state.purchaseTransport(t.id);
      state.purchaseItem('old-shoes');
      for(const t of TRANSPORTS) {
        state.equipTransport(t.id);
        s.deliveryEvents.modifiers.items.clear();
        s.deliveryEvents.modifiers.add('rain',t.weatherModifier,10);
        s.deliveryEvents.modifiers.add('test-speed',1.2,10);
        s.player.movementInput.pointer=-1;
        s.player.movementInput.vector={x:Math.SQRT1_2,y:Math.SQRT1_2};
        s.update(0);
        const expected=state.getSnapshot().movementSpeed*t.weatherModifier*1.2;
        if(Math.abs(s.player.body.velocity.length()-expected)>.01) throw Error(`${t.id}: incorrect analog speed`);
        s.player.clearInput();
      }
    });
    assert.deepEqual(errors,[]);
    console.log('PASS desktop keyboard, E, diagonal speed, no console errors');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
