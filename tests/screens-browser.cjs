const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const artifacts = process.env.ARTIFACT_DIR || path.join(require('node:os').tmpdir(),'courier-screen-check');

(async()=>{
  fs.mkdirSync(artifacts,{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const errors=[];
  try {
    for(const viewport of [{width:1280,height:800},{width:390,height:844},{width:430,height:932},{width:844,height:390}]) {
      const page=await browser.newPage({viewport,hasTouch:viewport.width<1000});
      page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
      const ready=async()=>{
        await page.waitForSelector('#objective:not(:empty)');
        await page.evaluate(async()=>{const {game}=await import(document.querySelector('script[src*="/src/main.js"]').src);window.scene=game.scene.getScene('GameScene');});
      };
      await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5174');await ready();
      const snapshot=()=>page.evaluate(()=>scene.orders.state.getSnapshot());
      const open=async(id)=>{if(!await page.locator(`#open-${id}`).isVisible())await page.click('#open-menu');await page.click(`#open-${id}`);};
      const close=async(id)=>page.click(`#${id}-dialog [data-close]`);
      await page.evaluate(async()=>{
        const {xpForLevel}=await import('/src/config/gameBalance.js');
        scene.orders.state.update({money:100000,xp:xpForLevel(10)});
        scene.deliveryEvents.random=()=>.99;
      });
      await open('shop');
      assert.deepEqual(await page.locator('#shop-items [data-item]').evaluateAll(nodes=>nodes.map(n=>n.dataset.item)),['old-shoes','good-shoes','thermobag']);
      assert.equal(await page.locator('#shop-dialog [data-transport]').count(),0);
      await page.click('[data-item="old-shoes"]');await page.click('[data-item="good-shoes"]');await page.click('[data-item="thermobag"]');
      assert.equal((await snapshot()).equippedItems.SHOES,'good-shoes');assert.equal((await snapshot()).equippedItems.BAG,'thermobag');
      await page.screenshot({path:path.join(artifacts,`${viewport.width}-shop.png`)});await close('shop');
      await open('garage');
      assert.deepEqual(await page.locator('#garage-items [data-transport]').evaluateAll(nodes=>nodes.map(n=>n.dataset.transport)),['WALKING','BICYCLE','MOPED','CAR']);
      assert.equal(await page.locator('#garage-dialog [data-item]').count(),0);
      for(const id of ['BICYCLE','MOPED','CAR']) {
        await page.click(`[data-transport="${id}"]`);
        assert.equal((await snapshot()).equippedTransport,id);
        if(await page.locator('#celebration-go').isVisible()) {
          await page.click('#celebration-go');await open('garage');
        }
      }
      await page.click('[data-transport="WALKING"]');assert.equal((await snapshot()).movementSpeed,176);
      await page.click('[data-transport="MOPED"]');assert.equal((await snapshot()).movementSpeed,340);
      await page.screenshot({path:path.join(artifacts,`${viewport.width}-garage.png`)});await close('garage');
      const owned=await snapshot();assert.equal(owned.ownedItems.includes('bicycle'),false);assert.equal('TRANSPORT' in owned.equippedItems,false);
      await open('profile');
      assert.equal(await page.locator('#profile-dialog button').count(),1);
      const text=await page.locator('#profile-details').textContent();
      for(const label of ['МОПЕД','Хорошие кроссовки','Термосумка','Выполнено заказов','Заработано всего','Чаевые','Штрафы оплачены'])assert.ok(text.includes(label),label);
      const closeBox=await page.locator('#profile-dialog [data-close]').boundingBox();assert.ok(closeBox.y>=0 && closeBox.y+closeBox.height<=viewport.height);
      await page.locator('#profile-dialog .modal-content').evaluate(el=>el.scrollTop=el.scrollHeight);
      assert.ok(await page.locator('#profile-dialog [data-close]').isVisible());
      await page.screenshot({path:path.join(artifacts,`${viewport.width}-profile.png`)});await close('profile');
      assert.deepEqual(await snapshot(),owned,'read-only profile');
      await open('events');assert.ok((await page.locator('#event-history').textContent()).includes('Пока без приключений'));await close('event-history');
      await page.evaluate(()=>{scene.orders.order=null;scene.orders.random=()=>0;scene.orders.generate();});
      await page.click('#accept-order');
      for(let i=0;i<2;i++) {
        await page.evaluate(()=>{const t=scene.orders.getTarget();scene.player.setPosition(t.x,t.y);});
        await page.waitForSelector('#interact',{state:'visible'});await page.click('#interact');
      }
      assert.equal((await snapshot()).completedOrders,1);assert.ok((await snapshot()).totalMoneyEarned>0);
      const saved=await page.evaluate(()=>scene.orders.state.getSaveData());
      await page.reload();await ready();
      assert.deepEqual(await page.evaluate(()=>scene.orders.state.getSaveData()),saved,'automatic save/reload');
      await page.evaluate(async()=>{
        const {platformService}=await import('/src/services/PlatformService.js');
        await platformService.save({version:2,money:123,xp:250,ownedItems:['bicycle','thermobag'],equippedItems:{TRANSPORT:'bicycle',BAG:'thermobag'}});
      });
      await page.reload();await ready();
      const legacy=await snapshot();assert.equal(legacy.equippedTransport,'BICYCLE');assert.deepEqual(legacy.ownedItems,['thermobag']);assert.equal(legacy.completedOrders,0);
      await open('profile');assert.ok((await page.locator('#profile-details').textContent()).includes('ВЕЛОСИПЕД'));await close('profile');
      await page.close();console.log(`PASS screens, purchasing, read-only profile, statistics, save migration ${viewport.width}x${viewport.height}`);
    }
    assert.deepEqual(errors,[]);
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
