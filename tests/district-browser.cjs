// Stage 8 integration uses isolated browser contexts and never touches the player's save.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const artifacts = process.env.ARTIFACT_DIR || path.join(require('node:os').tmpdir(), 'courier-stage8');
const ids = ['residential', 'center', 'industrial', 'elite', 'business'];
const viewports = [{width:1280,height:800},{width:390,height:844},{width:430,height:932},{width:844,height:390},{width:320,height:568}];

(async () => {
  fs.mkdirSync(artifacts, {recursive:true});
  const browser = await chromium.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const errors = [];
  try {
    for (const viewport of process.env.PRODUCTION_ONLY ? [] : viewports) {
      const page = await browser.newPage({viewport,hasTouch:viewport.width<1000});
      page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error') errors.push(m.text());});
      await page.addInitScript(() => { if (!localStorage.getItem('courier-empire-save-v1')) localStorage.setItem('courier-empire-save-v1', JSON.stringify({ version:7, xp:450, money:10000, reputation:5, unlockedDistricts:['residential','center'], selectedDistrict:'center', ownedTransports:['WALKING','BICYCLE'], equippedTransport:'BICYCLE', completedOrders:52, ownedItems:['thermobag'], equippedItems:{BAG:'thermobag'} })); });
      const ready = async () => {
        await page.waitForSelector('#objective:not(:empty)');
        await page.evaluate(async () => {
          const {game} = await import(document.querySelector('script[src*="/src/main.js"]').src); window.scene = game.scene.getScene('GameScene');
          clearInterval(scene.company.timer); scene.deliveryEvents.random=()=>.99;
        });
      };
      await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5174'); await ready();
      const snapshot = () => page.evaluate(()=>scene.orders.state.getSnapshot());
      const open = async id => { if(!await page.locator(`#open-${id}`).isVisible()) await page.click('#open-menu'); await page.click(`#open-${id}`); };
      const close = id => page.click(`#${id === 'districts' ? 'district' : id}-dialog [data-close]`);
      const card = id => page.locator(`[data-district="${id}"]`);
      const shot = name => page.screenshot({path:path.join(artifacts,`${viewport.width}x${viewport.height}-${name}.png`)});
      const bounds = async selector => {
        const b=await page.locator(selector).boundingBox(); assert.ok(b && b.x>=0 && b.y>=0 && b.x+b.width<=viewport.width+1 && b.y+b.height<=viewport.height+1,`${selector} ${JSON.stringify(b)}`);
      };
      const switchTo = async id => {
        if ((await snapshot()).selectedDistrict === id) return;
        await open('districts'); await card(id).locator('button').click();
        await page.waitForFunction(id=>!scene.districtTransition && scene.orders.order?.district===id,id);
        await page.waitForFunction(()=>scene.cameras.main.fadeEffect.alpha===0);
        assert.equal(await page.locator('#open-districts').count(),1); assert.equal(await page.locator('#district-dialog').count(),1);
      };
      const force = async (type='STANDARD',variant) => page.evaluate(({type,variant})=>{
        scene.orders.order=null; scene.orders.random=()=>0; return scene.orders.generate({forcedType:type,forcedVariant:variant});
      },{type,variant});
      const deliver = async () => {
        await page.click('#accept-order');
        await page.evaluate(()=>scene.player.body.reset(scene.orders.order.restaurant.x,scene.orders.order.restaurant.y));
        await page.waitForSelector('#interact:not([hidden])'); await page.click('#interact');
        const count=await page.evaluate(()=>scene.orders.order.customers.length);
        for(let i=0;i<count;i++) {
          await page.evaluate(()=>scene.player.body.reset(scene.orders.order.customer.x,scene.orders.order.customer.y));
          await page.waitForSelector('#interact:not([hidden])'); await page.click('#interact');
        }
        assert.equal(await page.evaluate(()=>scene.orders.order.status),'DELIVERED');
      };

      let s=await snapshot(); assert.equal(s.selectedDistrict,'center'); assert.deepEqual(s.unlockedDistricts,['residential','center']); assert.equal(s.completedOrders,52);
      assert.equal(s.districtStats.center.completedOrders,0); assert.ok(s.districtIntroductionsSeen.includes('center'));
      assert.equal(JSON.parse(await page.evaluate(()=>localStorage.getItem('courier-empire-save-v1'))).version,8);
      await open('districts'); assert.equal(await card('business').count(),1); await bounds('#district-dialog [data-close]');
      assert.equal(await page.locator('#district-dialog .modal-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
      await shot('legacy-city');
      await card('industrial').locator('button').click(); assert.match(await page.locator('#district-feedback').textContent(),/уровень 7/);
      await page.evaluate(async()=>{const {xpForLevel}=await import('/src/config/gameBalance.js');scene.orders.state.update({xp:xpForLevel(7),money:7999});});
      await card('industrial').locator('button').click(); assert.match(await page.locator('#district-feedback').textContent(),/Не хватает денег/);
      await page.evaluate(async()=>{const {xpForLevel}=await import('/src/config/gameBalance.js');scene.orders.state.update({xp:xpForLevel(14),money:500000,reputation:39});});
      await card('elite').locator('button').click(); assert.match(await page.locator('#district-feedback').textContent(),/репутация 40/);
      await page.evaluate(()=>scene.orders.state.update({reputation:100}));
      await card('business').locator('button').click(); assert.match(await page.locator('#district-feedback').textContent(),/мопед или автомобиль/);
      await page.evaluate(()=>{scene.orders.state.values.ownedTransports=['WALKING','BICYCLE','MOPED','CAR'];scene.orders.state.refresh();});
      await card('industrial').locator('button').click(); await page.waitForSelector('#district-introduction:not([hidden])');
      assert.equal((await snapshot()).money,492000); await shot('industrial-intro');
      await page.click('#district-introduction button'); await page.waitForFunction(()=>!scene.districtTransition && scene.orders.order?.district==='industrial');
      assert.ok((await snapshot()).districtIntroductionsSeen.includes('industrial'));
      for(const id of ['elite','business']) {
        await open('districts'); await card(id).locator('button').click(); await page.click('#district-introduction button');
        await page.waitForFunction(id=>!scene.districtTransition && scene.orders.order?.district===id,id);
      }
      s=await snapshot(); assert.equal(s.money,429000); assert.equal(s.completedOrders,52); assert.equal(s.equippedItems.BAG,'thermobag');
      assert.equal(await page.evaluate(()=>scene.company.incomeFactors({baseIncome:100,efficiency:1,speed:1,reliability:1,level:1,permanentEfficiencyBonus:0}).districts.toFixed(2)),'1.14');

      const blockedState=await snapshot(); await force(); await page.click('#accept-order');
      await open('districts'); await card('residential').locator('button').click(); assert.match(await page.locator('#district-feedback').textContent(),/СНАЧАЛА ЗАВЕРШИТЕ ТЕКУЩИЙ ЗАКАЗ/);
      assert.equal((await snapshot()).selectedDistrict,'business'); await close('districts');
      await page.evaluate(()=>{scene.orders.order.deadline=0;scene.orders.update();});
      await open('shop'); assert.equal(await page.evaluate(()=>scene.orders.state.selectDistrict('residential')),false); await close('shop');
      assert.equal((await snapshot()).money,blockedState.money);

      for(const id of ids) {
        await switchTo(id); await shot(`${id}-world`);
        for(const transport of ['WALKING','BICYCLE','MOPED','CAR']) {
          assert.equal(await page.evaluate(t=>scene.orders.state.equipTransport(t).ok,transport),true);
          await page.evaluate(()=>scene.player.body.reset(1200,1000));
          await page.keyboard.down('w'); await page.waitForTimeout(150);
          const movement=await page.evaluate(()=>({y:scene.player.y,v:scene.player.body.velocity.y,speed:scene.player.speed}));
          await page.keyboard.up('w'); assert.ok(movement.y<995,`${id}/${transport}: moved`); assert.equal(Math.round(movement.v),-movement.speed);
          assert.equal(await force(),true); const before=(await snapshot()).districtStats[id].completedOrders; await deliver();
          assert.equal((await snapshot()).districtStats[id].completedOrders,before+1);
        }
        await open('districts'); assert.equal(await page.locator('#district-introduction').isVisible(),false); await close('districts');
      }

      await switchTo('elite'); assert.equal(await force('ELITE','documents'),true);
      assert.match(await page.locator('#offer-details').textContent(),/ДОКУМЕНТОВ/); assert.equal(await page.locator('#order-panel').getAttribute('data-value'),'elite');
      const eliteReward=await page.evaluate(()=>scene.orders.order.reward); assert.ok(eliteReward>1000); await shot('elite-offer');
      const money=(await snapshot()).money; await deliver(); assert.ok((await snapshot()).money>=money+eliteReward);
      await page.evaluate(()=>courierDebug.mastery(50)); await open('districts'); assert.match(await card('elite').textContent(),/Легенда района.*50 доставок.*\+5%/s); await shot('mastery'); await close('districts');

      for(const [id,event] of [['residential','yard-dog'],['center','street-closed'],['industrial','industrial-security'],['elite','elite-security'],['business','business-pass']]) {
        await switchTo(id); await force(); await page.click('#accept-order');
        await page.evaluate(async id=>{const {EVENTS}=await import('/src/data/events.js');const event=EVENTS.find(e=>e.id===id);scene.deliveryEvents.negativeStreak=0;scene.deliveryEvents.pending=event;scene.deliveryEvents.trigger(event.trigger);},event);
        await page.waitForSelector('#event-dialog[open]'); assert.equal(await page.evaluate(()=>scene.orders.state.selectDistrict('residential')),false);
        await shot(`${id}-event`);
        if(['industrial','business'].includes(id)) await page.locator('#event-buttons button').first().click();
        await page.locator('#event-buttons button').last().click();
        await page.evaluate(()=>{scene.orders.order.deadline=0;scene.orders.update();});
      }
      await page.evaluate(()=>scene.deliveryEvents.modifiers.add('test-green',1.15,30)); await switchTo('center');
      assert.equal(await page.evaluate(()=>scene.deliveryEvents.modifiers.items.size),0);
      const listeners=await page.evaluate(()=>scene.orders.state.listeners.size), bodies=await page.evaluate(()=>scene.physics.world.staticBodies.size);
      for(let i=0;i<6;i++) await switchTo(i%2?'center':'business');
      assert.equal(await page.evaluate(()=>scene.orders.state.listeners.size),listeners);
      await switchTo('center'); assert.equal(await page.evaluate(()=>scene.physics.world.staticBodies.size),bodies);
      const save=await page.evaluate(()=>scene.orders.state.getSaveData());
      await page.reload(); await ready();
      const restored=await snapshot(); assert.equal(restored.selectedDistrict,save.selectedDistrict); assert.deepEqual(restored.districtStats,save.districtStats); assert.deepEqual(restored.districtIntroductionsSeen,save.districtIntroductionsSeen);
      await open('districts'); await card('business').locator('button').scrollIntoViewIfNeeded(); await bounds('#district-dialog [data-close]'); await shot('city-bottom');
      console.log(`PASS Stage 8 ${viewport.width}x${viewport.height}: migration, requirements, introductions, 5 districts × 4 transports, events, elite, mastery, guards, repeated restart and reload`);
      await page.close();
    }
    if(process.env.PREVIEW_URL) {
      for(const viewport of viewports.slice(1)) {
        const page=await browser.newPage({viewport,hasTouch:true}); page.on('pageerror',e=>errors.push(e.message));
        await page.addInitScript(()=>localStorage.setItem('courier-empire-save-v1',JSON.stringify({version:8,xp:6000,money:500000,reputation:100,unlockedDistricts:['residential','center','industrial','elite','business'],selectedDistrict:'business',ownedTransports:['WALKING','MOPED','CAR']})));
        await page.goto(process.env.PREVIEW_URL); await page.waitForSelector('#objective:not(:empty)');
        assert.equal(await page.evaluate(()=>typeof courierDebug),'undefined'); assert.ok(await page.locator('.hud.collapsed').isVisible());
        await page.keyboard.press('Control+Alt+n'); await page.click('#open-menu'); await page.click('#open-districts');
        assert.equal(await page.locator('[data-district]').count(),5); assert.match(await page.locator('#city-summary').textContent(),/5 \/ 5/);
        await page.screenshot({path:path.join(artifacts,`${viewport.width}x${viewport.height}-production.png`)}); await page.close();
      }
      console.log('PASS production phone maps and development commands absent');
    }
    assert.deepEqual(errors,[]); console.log(`PASS no runtime console errors; screenshots: ${artifacts}`);
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1);});
