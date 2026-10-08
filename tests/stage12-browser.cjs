// Local Chrome checks and explicit SDK contract doubles. Never real Yandex certification.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const dev = process.env.GAME_URL || 'http://127.0.0.1:5179', prod = process.env.PREVIEW_URL || 'http://127.0.0.1:5188';
const dir = path.join(process.cwd(), 'artifacts/stage12');
const sizes = [[360,640],[375,667],[390,844],[412,915],[430,932],[640,360],[844,390],[915,412],[1280,720],[1366,768],[1920,1080]];
const seed = { version: 11, money: 2000000, xp: 30000, reputation: 200, completedOrders: 100,
  ownedTransports: ['WALKING','BICYCLE','MOPED','CAR'], equippedTransport: 'CAR',
  ownedItems: ['old-shoes','good-shoes','thermobag'], equippedItems: { SHOES:'good-shoes', BAG:'thermobag' },
  unlockedDistricts:['residential','center','industrial','elite','business'], districtIntroductionsSeen:['residential','center','industrial','elite','business'],
  companyUnlocked:true, officeLevel:2, companyName:null, employees:[{id:'courier-1',name:'Саша'}], tasksIntroductionSeen:true };
const errors = [], results = [], profile = [];
const observe = page => { page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if(m.type()==='error') errors.push(m.text()); }); };
async function ready(page, production = false) {
  await page.waitForFunction(() => !document.querySelector('#loading') && !!document.querySelector('#objective')?.textContent);
  await page.waitForFunction(async production => {
    const url = production ? performance.getEntriesByType('resource').map(r=>r.name).find(n=>/\/game-[^/]+\.js$/.test(n) && !n.includes('legacy')) : document.querySelector('script[src*="/src/main.js"]').src;
    if (!url) return false; const entry = await import(url); if(!entry.game) return false;
    window.scene = entry.game.scene.getScene('GameScene'); window.life = entry.lifecycle; window.platform = entry.platformService;
    return !!scene?.orders?.order;
  }, production);
  await page.evaluate(async production => {
    const url = production ? performance.getEntriesByType('resource').map(r=>r.name).find(n=>/\/game-[^/]+\.js$/.test(n) && !n.includes('legacy')) : document.querySelector('script[src*="/src/main.js"]').src;
    const entry = await import(url);
    window.scene = entry.game.scene.getScene('GameScene'); window.life = entry.lifecycle; window.platform = entry.platformService;
    window.scene.deliveryEvents.random=()=>.99; window.scene.company.events.pending=null; window.scene.company.hidden=true;
  }, production);
}
async function open(page, id) { if(!await page.locator(`#open-${id}`).isVisible()) await page.click('#open-menu'); await page.click(`#open-${id}`); }
const close = (page,id) => page.click(`#${id}-dialog [data-close]`);
async function layout(page,selector) {
  const value=await page.locator(selector).evaluate(n=>{const b=n.getBoundingClientRect(),c=n.querySelector('.modal-content')||n;return {fits:b.left>=-1&&b.right<=innerWidth+1&&b.top>=-1&&b.bottom<=innerHeight+1,overflow:c.scrollWidth>c.clientWidth+1,close:n.querySelector('[data-close]')?.getBoundingClientRect().bottom<=innerHeight};});
  assert.ok(value.fits,selector+' outside viewport'); assert.ok(!value.overflow,selector+' horizontal overflow'); if(selector.endsWith('-dialog'))assert.ok(value.close,selector+' close unreachable');
}
async function mixed(page,lang) {
  const text=await page.evaluate(()=>document.body.innerText); assert.ok(!/\{\{/.test(text),'Unresolved placeholders');
  if(lang==='en') assert.ok(!/[А-Яа-яЁё]/.test(text),'Mixed English UI: '+text);
  else assert.ok(!/[a-zA-Z]{2}/.test(text.replace(/Burger House|Pizza Point|Sushi Place|W A S D|WASD|HUD|VIP|\bID\b|\bE\b/g,'')),'Mixed Russian UI: '+text);
}
async function sdk(page,lang,save=null) {
  await page.addInitScript(({lang,save})=>{
    const handlers={}; window.contract={ready:0,start:0,stop:0,handlers};
    window.testSDK={environment:{i18n:{lang}},serverTime:()=>Date.now(),on:(e,f)=>handlers[e]=f,
      getPlayer:async()=>({getUniqueID:()=> 'release-guest',isAuthorized:()=>false,getData:async()=>({courierEmpire:save}),setData:async()=>{}}),
      features:{LoadingAPI:{ready(){window.contract.ready++;window.contract.readyLanguage=document.documentElement.lang;}},GameplayAPI:{start(){window.contract.start++;},stop(){window.contract.stop++;}}},
      adv:{showRewardedVideo({callbacks}){window.adCallbacks=callbacks;callbacks.onOpen();},showFullscreenAdv({callbacks}){window.adCallbacks=callbacks;callbacks.onOpen();}}};
    window.YaGames={init:async()=>testSDK};
  },{lang,save:save?{saveVersion:11,revision:1,gameState:save}:null});
}
(async()=>{
 fs.mkdirSync(dir,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try {
  // New player: actual movement, one pickup/delivery, completion and immediate skip/reload.
  for(const lang of ['ru','en'])for(const mobile of [false,true]) {
    const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:720},hasTouch:mobile});observe(page);
    await page.goto(`${dev}/?lang=${lang}`);await ready(page);assert.equal(await page.locator('#tutorial').getAttribute('data-step'),'welcome');await mixed(page,lang);await layout(page,'#tutorial');
    await page.click('[data-tutorial-next]');
    assert.equal(await page.locator('#accept-order').isDisabled(), true);
    if(mobile){const b=await page.locator('#joystick').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width-3,b.y+b.height/2);await page.waitForTimeout(450);await page.mouse.up();}
    else {await page.keyboard.down('d');await page.waitForTimeout(450);await page.keyboard.up('d');}
    await page.waitForFunction(()=>window.scene.tutorialUI.manager.step==='order');await page.click('#accept-order');assert.equal(await page.locator('#tutorial').getAttribute('data-step'),'pickup');
    // Move along the road corridor using keyboard input, no synthetic payout.
    for(const leg of ['x','y']) {
      const delta=await page.evaluate(leg=>window.scene.orders.getTarget()[leg]-window.scene.player[leg],leg);
      const key=leg==='x'?(delta>0?'d':'a'):(delta>0?'s':'w');await page.keyboard.down(key);await page.waitForTimeout(Math.max(0,Math.abs(delta)/160*1000-20));await page.keyboard.up(key);
    }
    await page.waitForFunction(()=>window.scene.orders.canInteract(window.scene.player));if(mobile)await page.click('#interact');else await page.keyboard.press('e');
    assert.equal(await page.locator('#tutorial').getAttribute('data-step'),'delivery');
    for(const leg of ['x','y']) {const delta=await page.evaluate(leg=>window.scene.orders.getTarget()[leg]-window.scene.player[leg],leg);const key=leg==='x'?(delta>0?'d':'a'):(delta>0?'s':'w');await page.keyboard.down(key);await page.waitForTimeout(Math.max(0,Math.abs(delta)/160*1000-20));await page.keyboard.up(key);}
    if(mobile)await page.click('#interact');else await page.keyboard.press('e');await page.waitForFunction(()=>window.scene.tutorialUI.manager.step==='reward');
    await mixed(page,lang);await page.screenshot({path:path.join(dir,`tutorial-${lang}-${mobile?'mobile':'desktop'}.png`)});
    for(let i=0;i<3;i++)await page.click('[data-tutorial-next]');assert.equal(await page.locator('#tutorial').isVisible(),false);
    const saved=await page.evaluate(()=>window.scene.orders.state.getSaveData());assert.equal(saved.tutorialVersionSeen,1);assert.equal(saved.completedOrders,1);
    await page.reload();await ready(page);assert.equal(await page.locator('#tutorial').isVisible(),false);assert.equal(await page.evaluate(()=>window.scene.orders.state.values.money),saved.money);
    const fresh=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:720},hasTouch:mobile});observe(fresh);
    await fresh.goto(`${dev}/?lang=${lang}`);await ready(fresh);await fresh.click('[data-tutorial-skip]');
    assert.equal(await fresh.evaluate(()=>JSON.parse(localStorage.getItem('courier-empire-save-v1')).tutorialVersionSeen),1);await fresh.reload();await ready(fresh);assert.equal(await fresh.locator('#tutorial').isVisible(),false);await fresh.close();
    results.push(`new player ${lang} ${mobile?'mobile':'desktop'}: tutorial movement/pickup/delivery/finish/skip/reload PASS`);console.log(results.at(-1));await page.close();
  }
  for(const production of [false,true])for(const lang of ['ru','en'])for(const [width,height]of sizes) {
    const page=await browser.newPage({viewport:{width,height},hasTouch:width<1000});observe(page);
    if(production)await sdk(page,lang,seed);else await page.addInitScript(seed=>{if(!localStorage.getItem('courier-empire-save-v1'))localStorage.setItem('courier-empire-save-v1',JSON.stringify(seed));},seed);
    await page.goto(`${production?prod:dev}/?lang=${lang}`);await ready(page,production);assert.equal(await page.locator('#tutorial').isVisible(),false);
    for(const zoom of [.8,1,1.25]) {
      // Equivalent CSS viewport to real browser zoom, not CSS transform scaling.
      await page.setViewportSize({width:Math.round(width/zoom),height:Math.round(height/zoom)});await page.waitForTimeout(30);
      await layout(page,'.hud');await layout(page,'#order-panel');await mixed(page,lang);
      for(const [id,dialog] of [['shop','shop'],['garage','garage'],['profile','profile'],['districts','district'],['company','company'],['tasks','tasks'],['progress','progress'],['events','event-history'],['rating','rating'],['settings','settings']]) {
        await open(page,id);await layout(page,`#${dialog}-dialog`);await mixed(page,lang);
        if(id==='settings' && zoom===1){await page.locator('#master-volume').fill('27');await page.locator('#sound-muted').check();}
        if(id==='company'&&zoom===1)for(const tab of ['employees','vehicles','upgrades','dashboard']){await page.click(`[data-company-view="${tab}"]`);await layout(page,'#company-dialog');await mixed(page,lang);}
        if(id==='tasks'&&zoom===1)for(const tab of ['challenges','streak','daily']){await page.click(`[data-task-view="${tab}"]`);await mixed(page,lang);}
        if(id==='progress'&&zoom===1)for(const tab of ['achievements','records','legacy','career']){await page.click(`[data-progress-view="${tab}"]`);await mixed(page,lang);}
        if(zoom===1 && [360,844,1280].includes(width))await page.screenshot({path:path.join(dir,`${production?'production':'dev'}-${lang}-${width}x${height}-${id}.png`)});
        await close(page,dialog);
      }
    }
    await page.reload();await ready(page,production);assert.equal(await page.evaluate(()=>window.scene.orders.state.values.masterVolume),.27);assert.equal(await page.evaluate(()=>window.scene.orders.state.values.muted),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    const a=await page.evaluate(()=>({context:!document.querySelector('canvas').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true})),touch:getComputedStyle(document.body).touchAction}));assert.ok(a.context);assert.equal(a.touch,'none');
    if(production){assert.equal(await page.evaluate(()=>window.contract.ready),1);assert.equal(await page.evaluate(()=>window.contract.readyLanguage),lang);assert.equal(await page.evaluate(()=>typeof courierDebug),'undefined');}
    results.push(`${production?'production SDK double':'dev LOCAL'} ${lang} ${width}x${height}, 80/100/125% viewport equivalents, 10 panels: PASS`);console.log(results.at(-1));await page.close();
  }
  // Production contract: ad callbacks, nested pauses and exact once-only reward.
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});observe(page);await sdk(page,'en',seed);await page.goto(prod);await ready(page,true);
  await page.evaluate(()=>{window.scene.orders.order=null;window.scene.orders.generate({forcedType:'STANDARD'});window.scene.orders.accept();window.scene.deliveryEvents.pending=null;window.scene.orders.interact(window.scene.orders.getTarget());window.scene.orders.interact(window.scene.orders.getTarget());});
  const before=await page.evaluate(()=>window.scene.orders.state.values.money);const bonus=await page.evaluate(()=>window.scene.orders.state.values.deliveryAdBonus.amount);
  await page.click('#rewarded-delivery');assert.equal(await page.evaluate(()=>window.life.paused),true);assert.equal(await page.evaluate(()=>window.scene.player.movementInput.pointer),null);
  await page.evaluate(()=>{window.contract.handlers.game_api_pause();window.adCallbacks.onRewarded();window.adCallbacks.onRewarded();window.adCallbacks.onClose();});
  assert.equal(await page.evaluate(()=>window.scene.orders.state.values.money),before+bonus);assert.equal(await page.evaluate(()=>window.life.paused),true);await page.evaluate(()=>window.contract.handlers.game_api_resume());
  await open(page,'garage');await page.evaluate(()=>{window.contract.handlers.game_api_pause();window.contract.handlers.game_api_resume();});assert.equal(await page.evaluate(()=>window.life.paused),true);await close(page,'garage');
  await page.evaluate(()=>{window.scene.orders.order=null;window.scene.orders.generate();window.scene.orders.accept();});const remaining=await page.evaluate(()=>window.scene.orders.remainingSeconds());
  await page.evaluate(()=>window.contract.handlers.game_api_pause());await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>window.scene.orders.remainingSeconds()),remaining);await page.evaluate(()=>window.contract.handlers.game_api_resume());
  // Repeated district scene restarts must keep stable bodies, children, subscriptions and DOM.
  await page.evaluate(()=>{window.scene.orders.order.status='DELIVERED';});
  const counts=[];
  for(let i=0;i<12;i++) {await page.evaluate(i=>{window.scene.orders.order.status='DELIVERED';window.scene.orders.state.selectDistrict(i%2?'residential':'center');window.scene.transitionDistrict();},i);await page.waitForTimeout(450);await ready(page,true);counts.push(await page.evaluate(()=>({state:window.scene.orders.state.listeners.size,life:window.life.listeners.size,bodies:window.scene.physics.world.bodies.size,staticBodies:window.scene.physics.world.staticBodies.size,children:window.scene.children.list.length,dialogs:document.querySelectorAll('dialog').length})));}
  assert.deepEqual(counts.slice(2).map(c=>[c.state,c.life,c.dialogs]),counts.slice(2).map(()=>[counts[2].state,counts[2].life,counts[2].dialogs]));
  const fps=await page.evaluate(()=>new Promise(resolve=>{const frames=[];let last=performance.now();const tick=now=>{frames.push(now-last);last=now;if(frames.length<180)requestAnimationFrame(tick);else resolve({medianFrameMs:frames.sort((a,b)=>a-b)[90],p95FrameMs:frames[171],heapBytes:performance.memory?.usedJSHeapSize,children:window.scene.children.list.length,bodies:window.scene.physics.world.bodies.size});};requestAnimationFrame(tick);}));
  profile.push({environment:'Headless Chrome on this Windows host, no physical mobile hardware',counts,fps});await page.screenshot({path:path.join(dir,'production-stress.png')});await page.close();
  // Actual LOCAL production and forced legacy loader smoke check in current Chrome.
  for(const legacy of [false,true]) {
    const p=await browser.newPage({viewport:{width:390,height:844}});observe(p);
    if(legacy)await p.route('**/',async route=>{const response=await route.fetch();let html=await response.text();html=html.replace(/<script\b[^>]*type="module"[^>]*>[\s\S]*?<\/script>/g,'').replace(/ nomodule/g,'');await route.fulfill({response,body:html});});
    await p.goto(prod);await p.waitForSelector('#tutorial:not([hidden])');assert.equal(await p.title(),'Курьерская Империя');await p.click('[data-tutorial-skip]');await open(p,'settings');await layout(p,'#settings-dialog');await p.close();
    results.push(`${legacy?'forced SystemJS legacy loader':'actual LOCAL production'}: startup/tutorial/settings PASS`);
  }
  assert.deepEqual(errors,[],'Browser console/runtime errors');
  fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify({results,errors,profile,realYandex:'MANUAL TEST REQUIRED',physicalMobile:'UNVERIFIED ON PHYSICAL DEVICE',zoom:'CSS viewport equivalents; actual browser UI zoom still manual'},null,2));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
