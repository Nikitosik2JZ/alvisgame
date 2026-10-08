// Local Chrome UI tests and explicitly labelled SDK contract mocks, not Yandex moderation.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const base = process.env.GAME_URL || 'http://127.0.0.1:5173';
const production = process.env.PREVIEW_URL || 'http://127.0.0.1:5179';
const dir = path.join(process.cwd(), 'artifacts/localization');
const seed = { version: 11, money: 2000000, xp: 30000, reputation: 200, completedOrders: 100,
  ownedTransports: ['WALKING','BICYCLE','MOPED','CAR'], equippedTransport: 'CAR',
  ownedItems: ['old-shoes','good-shoes','thermobag'], equippedItems: {SHOES:'good-shoes',BAG:'thermobag'},
  unlockedDistricts: ['residential','center','industrial','elite','business'], districtIntroductionsSeen: ['residential','center','industrial','elite','business'],
  companyUnlocked: true, companyName: 'Моя доставка', officeLevel: 2, companyBalance: 20000,
  employees: [{id:'courier-1',name:'Саша',archetype:'FAST',level:3,assignedTransport:'vehicle-1'}],
  companyVehicles: [{id:'vehicle-1',type:'CAR'}],
  companyLog: ['Собственная служба доставки открыта. Пора нанимать людей.','Саша: уровень 3!','Пока вас не было: +1200 ₽.','Куплен велосипед для компании.', 'Нашёлся. Просто обедал.'],
  tasksIntroductionSeen:true, currentDeliveryStreak:4, bestDeliveryStreak:7,
  dailyTaskDate:new Date().toISOString().slice(0,10), dailyTasks:[{id:'deliveries',title:'Старое русское задание',tier:'LATE',currentProgress:2}],
};
const viewports=[{width:1280,height:800},{width:390,height:844},{width:430,height:932},{width:844,height:390}];
(async()=>{
 fs.mkdirSync(dir,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const errors=[], results=[];
 const observe=page=>{page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});};
 const ready=async page=>{
  await page.waitForSelector('#objective:not(:empty)');
  await page.evaluate(async()=>{const entry=await import(document.querySelector('script[type="module"][src]:not([src*="/@vite/"])').src);window.scene=entry.game.scene.getScene('GameScene');window.platform=entry.platformService;window.life=entry.lifecycle;});
  await page.waitForFunction(()=>!!scene.orders.order&&platform.ready&&!document.querySelector('#loading'));
  await page.evaluate(()=>{scene.deliveryEvents.random=()=>.99;scene.company.events.pending=null;scene.company.events.active=null;scene.company.hidden=true;});
  if(await page.locator('#company-dialog[open]').count())await page.click('#company-dialog [data-close]');
 };
 const mixed=async(page,language,context)=>{
  const text=await page.evaluate(()=>document.body.innerText);
  assert.ok(!/\{\{|\{n\}/.test(text),`${context}: unresolved interpolation`);
  if(language==='en')assert.ok(!/[А-Яа-яЁё]/.test(text),`${context}: Cyrillic in English: ${text}`);
  else {
   const cleaned=text.replace(/Burger House|Pizza Point|Sushi Place|W A S D|WASD|HUD|VIP|\bID\b|\bE\b/g,'');
   assert.ok(!/[a-zA-Z]{2}/.test(cleaned),`${context}: English in Russian: ${cleaned}`);
  }
 };
 const layout=async(page,selector)=>{
  const check=await page.locator(selector).evaluate(n=>{const b=n.getBoundingClientRect(),c=n.querySelector('.modal-content')||n;return {fits:b.left>=-1&&b.right<=innerWidth+1&&b.top>=-1&&b.bottom<=innerHeight+1,overflow:c.scrollWidth>c.clientWidth+1};});
  assert.ok(check.fits,`${selector} outside viewport`);assert.ok(!check.overflow,`${selector} horizontal overflow`);
 };
 for(const language of process.env.ONLY_PRODUCTION ? [] : ['ru','en'])for(const viewport of viewports){
  const page=await browser.newPage({viewport,hasTouch:viewport.width<1000});observe(page);page.setDefaultTimeout(10000);
  await page.addInitScript(seed=>{if(!localStorage.getItem('courier-empire-save-v1'))localStorage.setItem('courier-empire-save-v1',JSON.stringify(seed));},seed);
  await page.goto(`${base}/?lang=${language}`);await ready(page);
  assert.equal(await page.evaluate(()=>document.documentElement.lang),language);
  await mixed(page,language,'startup');await layout(page,'.hud');await layout(page,'#order-panel');
  if(viewport.width<1000)await layout(page,'#joystick');
  const open=async id=>{if(id==='menu'&&viewport.width===1280){await page.evaluate(()=>document.querySelector('#open-menu').click());return;}if(!await page.locator(`#open-${id}`).isVisible())await page.click('#open-menu');await page.click(`#open-${id}`);};
  const close=async id=>page.click(`#${id}-dialog [data-close]`);
  for(const [id,dialog] of [['menu','menu'],['shop','shop'],['garage','garage'],['profile','profile'],['districts','district'],['company','company'],['tasks','tasks'],['progress','progress'],['events','event-history'],['rating','rating']]){
   await open(id);await mixed(page,language,id);await layout(page,`#${dialog}-dialog`);
   if(id==='tasks')for(const tab of ['challenges','streak','daily']){await page.click(`[data-task-view="${tab}"]`);await mixed(page,language,tab);await layout(page,'#tasks-dialog');}
   if(id==='progress')for(const tab of ['achievements','records','legacy','career']){await page.click(`[data-progress-view="${tab}"]`);await mixed(page,language,tab);await layout(page,'#progress-dialog');}
   if(id==='company')for(const tab of ['employees','vehicles','upgrades','dashboard']){await page.click(`[data-company-view="${tab}"]`);await mixed(page,language,tab);await layout(page,'#company-dialog');}
   await page.screenshot({path:path.join(dir,`${language}-${viewport.width}x${viewport.height}-${id}.png`)});await close(dialog);
  }
  for(const type of ['STANDARD','URGENT','FRAGILE','DOUBLE','LARGE','ELITE']){
   await page.evaluate(type=>{scene.orders.order=null;scene.orders.state.values.selectedDistrict=type==='ELITE'?'business':'residential';if(!scene.orders.generate({forcedType:type}))throw new Error('Cannot generate '+type);},type);await mixed(page,language,type);
   await page.click('#accept-order');await mixed(page,language,type+' active');
   for(let i=0;i<3;i++)await page.evaluate(()=>{if(['ACCEPTED','PICKED_UP'].includes(scene.orders.order.status)){scene.deliveryEvents.pending=null;const t=scene.orders.getTarget();scene.player.setPosition(t.x,t.y);scene.orders.interact(scene.player);}});
   assert.equal(await page.evaluate(()=>scene.orders.order.status),'DELIVERED');await mixed(page,language,type+' result');await layout(page,'#order-panel');
   await page.click('#rewarded-delivery');await mixed(page,language,'ad unavailable');await page.click('#continue-delivery');
  }
  await page.evaluate(()=>{scene.orders.order=null;scene.orders.generate();scene.orders.accept();scene.orders.order.deadline=scene.orders.now()-1;scene.orders.update();});await mixed(page,language,'failure');await page.click('#continue-delivery');
  // Every personal event, both choices and deterministic low/high outcome rolls.
  if(viewport.width===1280){
   const events=await page.evaluate(async()=>{const {EVENTS}=await import('/src/data/events.js');return EVENTS.map(e=>({id:e.id,choices:e.choices?.length||1}));});
   for(const event of events)for(let choice=0;choice<event.choices;choice++)for(const roll of [0,.99]){
    await page.evaluate(async({id,roll})=>{const {EVENTS}=await import('/src/data/events.js');scene.orders.order=null;scene.orders.generate({forcedType:'STANDARD'});scene.orders.accept();const e=EVENTS.find(e=>e.id===id);scene.deliveryEvents.random=()=>roll;scene.deliveryEvents.active={event:e,resume:()=>{},pausedAt:scene.orders.now()};scene.deliveryEvents.onShow(e);},{id:event.id,roll});
    await mixed(page,language,event.id+' event');await layout(page,'#event-dialog');
    if(event.choices>1)await page.locator('#event-buttons button').nth(choice).click();
    await mixed(page,language,event.id+' outcome');await page.locator('#event-buttons button').last().click();
   }
   const companyEvents=await page.evaluate(async()=>{const {COMPANY_EVENTS}=await import('/src/data/companyEvents.js');return COMPANY_EVENTS.map(e=>({id:e.id,choices:e.choices?.length||1}));});
   for(const event of companyEvents)for(let choice=0;choice<event.choices;choice++)for(const roll of [0,.99]){
    await page.evaluate(async({id,roll})=>{const {COMPANY_EVENTS}=await import('/src/data/companyEvents.js');const m=scene.company.events;scene.orders.state.values.money=2000000;scene.company.random=()=>roll;const e=COMPANY_EVENTS.find(e=>e.id===id);m.active={event:e,employeeId:'courier-1',resolved:false};m.onShow(e);},{id:event.id,roll});
    await mixed(page,language,event.id+' company event');await layout(page,'#company-event-dialog');
    if(event.choices>1)await page.locator('#company-event-buttons button').nth(choice).click();
    await mixed(page,language,event.id+' company outcome');await page.locator('#company-event-buttons button').last().click();
   }
   await open('company');await mixed(page,language,'company log');await close('company');
   const data=await page.evaluate(async()=>{const {DAILY_TASKS,instantiateTask}=await import('/src/data/dailyTasks.js');const {ACHIEVEMENTS}=await import('/src/data/achievements.js');const {DISTRICTS}=await import('/src/config/districtConfig.js');return {tasks:[1,6,20].flatMap(level=>DAILY_TASKS.map(d=>instantiateTask(d,level).title)),achievements:ACHIEVEMENTS.map(a=>a.title+' '+a.description),districts:Object.values(DISTRICTS).map(d=>d.name+' '+d.description)};});
   if(language==='en')assert.ok(!/[А-Яа-яЁё]/.test(JSON.stringify(data)));assert.ok(!/\{\{/.test(JSON.stringify(data)));assert.equal(data.tasks.length,84);
  }
  const saved=await page.evaluate(()=>scene.orders.state.getSaveData());
  assert.ok(saved.dailyTasks.every(t=>!Object.hasOwn(t,'title')&&!Object.hasOwn(t,'description')));assert.ok(saved.companyLog.every(t=>typeof t==='object'));
  await page.goto(`${base}/?lang=${language==='ru'?'en':'ru'}`);await ready(page);await mixed(page,language==='ru'?'en':'ru','cross-language save');
  const restored=await page.evaluate(()=>scene.orders.state.getSaveData());assert.equal(restored.money,saved.money);assert.deepEqual(restored.ownedTransports,saved.ownedTransports);assert.equal(restored.completedOrders,saved.completedOrders);
  results.push(`${language} ${viewport.width}x${viewport.height}: PASS`);console.log(results.at(-1));await page.close();
 }
 // Existing transaction feedback, unlock introductions and all achievement notifications.
 for(const language of process.env.ONLY_PRODUCTION ? [] : ['ru','en']){
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});observe(page);
  await page.addInitScript(seed=>localStorage.setItem('courier-empire-save-v1',JSON.stringify({...seed,companyUnlocked:false,companyName:null,employees:[],companyLog:[],companyCandidates:[],ownedItems:[],equippedItems:{SHOES:null,BAG:null},ownedTransports:['WALKING'],equippedTransport:'WALKING',unlockedDistricts:['residential']})),seed);
  await page.goto(`${base}/?lang=${language}`);await ready(page);
  const open=async id=>{await page.click('#open-menu');await page.click(`#open-${id}`);};
  await open('shop');await page.click('[data-item="old-shoes"]');await mixed(page,language,'equipment purchase');await page.click('#shop-dialog [data-close]');
  await open('garage');await page.click('[data-transport="BICYCLE"]');await mixed(page,language,'vehicle purchase');if(await page.locator('#celebration-go').isVisible())await page.click('#celebration-go');await page.click('#garage-dialog [data-close]');
  await open('districts');await page.locator('#district-list button').nth(1).click();await mixed(page,language,'district unlock introduction');await page.click('#district-dialog [data-close]');
  await open('company');await page.click('#company-open');await mixed(page,language,'company unlock');await page.click('#company-begin');await page.click('[data-company-view="employees"]');await page.locator('#company-candidates button').first().click();await mixed(page,language,'employee hire');await page.click('#company-dialog [data-close]');
  const count=await page.evaluate(async()=>{const {ACHIEVEMENTS}=await import('/src/data/achievements.js');window.allAchievements=ACHIEVEMENTS;return ACHIEVEMENTS.length;});
  for(let i=0;i<count;i++){await page.evaluate(i=>{clearTimeout(scene.progressUI.toastTimer);scene.progressUI.queue=[{type:'achievement',definition:allAchievements[i]}];scene.progressUI.nextToast();},i);await mixed(page,language,'achievement '+i);}
  await open('tasks');await page.evaluate(()=>{const t=scene.orders.state.values.dailyTasks[0];t.currentProgress=t.target;scene.orders.state.tasks.complete(t);scene.orders.state.refresh();});await mixed(page,language,'task completion');await page.locator('#tasks-content [data-task-action^="daily:"]').first().click();await mixed(page,language,'task reward');await page.click('#tasks-dialog [data-close]');
  results.push(`${language}: purchases, unlocks, hire, all 37 achievement toasts, task completion/reward: PASS`);console.log(results.at(-1));await page.close();
 }
 // Production: no URL override, first rendered UI and Game Ready already localized.
 for(const lang of ['ru','en','be','de']){
  const page=await browser.newPage({viewport:{width:390,height:844}});observe(page);
  await page.addInitScript(({lang,seed})=>{
   window.sdkAudit={read:false,ready:false};
   window.sdkPlayer={authorized:false,getUniqueID:()=> 'localization-contract-guest',isAuthorized:()=>sdkPlayer.authorized,getData:async()=>({courierEmpire:{saveVersion:11,gameState:seed}}),setData:async()=>{}};
   window.YaGames={init:async()=>({environment:{i18n:{get lang(){sdkAudit.read=true;return lang;}}},serverTime:()=>Date.now(),on:()=>{},getPlayer:async()=>sdkPlayer,features:{LoadingAPI:{ready(){sdkAudit.ready=true;sdkAudit.language=document.documentElement.lang;sdkAudit.text=document.body.innerText;}},GameplayAPI:{start(){},stop(){}}}})};
  },{lang,seed});
  await page.goto(`${production}/?lang=${lang==='ru'?'en':'ru'}`);await page.waitForFunction(()=>sdkAudit.ready&&!document.querySelector('#loading'));const resolved=['ru','be'].includes(lang)?'ru':'en';
  const audit=await page.evaluate(()=>sdkAudit);assert.ok(audit.read&&audit.ready);assert.equal(audit.language,resolved);if(resolved==='en')assert.ok(!/[А-Яа-яЁё]/.test(audit.text));await mixed(page,resolved,'production SDK '+lang);
  // Guest explanation, cancellation and leaderboard-unavailable state use real UI with contract doubles.
  await page.click('#open-menu');await page.click('#open-rating');await mixed(page,resolved,'authorization');await page.click('#yandex-login');await mixed(page,resolved,'sign-in confirmation');await page.click('#confirm-yandex-login');await mixed(page,resolved,'cancelled authorization');
  await page.evaluate(()=>{sdkPlayer.authorized=true;});await page.click('#rating-dialog [data-close]');await page.click('#open-menu');await page.click('#open-rating');await mixed(page,resolved,'leaderboard error');
  results.push(`production SDK contract ${lang} → ${resolved}: PASS`);console.log(results.at(-1));await page.close();
 }
 assert.deepEqual(errors,[],'Console/runtime errors');fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify({results,errors,realYandex:'REQUIRES YANDEX DEBUG TEST'},null,2));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
