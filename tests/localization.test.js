import test from 'node:test';
import assert from 'node:assert/strict';
import { auditLocalization } from '../scripts/check-localization.mjs';
import { LocalizationService, localization, startupLanguage, resolvePlatformLanguage, SUPPORTED_LANGUAGES } from '../src/services/LocalizationService.js';
import { encodeMessage, migrateSavedMessage, renderMessage, validMessage } from '../src/services/LocalizedMessages.js';
import { GameState } from '../src/state/GameState.js';
test('bundled dictionaries match and source/HTML/CSS localization audit passes',()=>{
 const audit=auditLocalization();assert.equal(audit.ruKeys,audit.enKeys);assert.equal(audit.missingRU+audit.missingEN,0);assert.ok(audit.ruKeys>800);
});
test('exact supported languages and requested platform fallback mapping',()=>{
 assert.deepEqual(SUPPORTED_LANGUAGES,['ru','en']);
 for(const code of ['ru','be','kk','uk','uz','RU','ru-RU'])assert.equal(resolvePlatformLanguage(code),'ru');
 for(const code of ['en','de','fr','tr','es','zh','it','pt','ja','',undefined])assert.equal(resolvePlatformLanguage(code),'en');
});
test('local default, development overrides, and production SDK precedence',()=>{
 const local={isYandex:()=>false,getLanguage:()=>''}, sdk={isYandex:()=>true,getLanguage:()=> 'en'};
 assert.equal(startupLanguage(local,{development:false,search:'?lang=en'}),'ru');
 assert.equal(startupLanguage(local,{development:true,search:'?lang=en'}),'en');
 assert.equal(startupLanguage(local,{development:true,search:'?lang=tr'}),'ru');
 assert.equal(startupLanguage(sdk,{development:false,search:'?lang=ru'}),'en');
 assert.equal(startupLanguage(sdk,{development:true,search:'?lang=ru'}),'ru');
});
test('interpolation, locale numbers, currency and Russian/English plural rules',()=>{
 const l=new LocalizationService();l.initialize('ru');
 assert.match(l.currency(12500),/12\s500 ₽/);assert.equal(l.plural('count.orders',1),'1 заказ');assert.equal(l.plural('count.orders',2),'2 заказа');assert.equal(l.plural('count.orders',5),'5 заказов');assert.equal(l.plural('count.orders',21),'21 заказ');
 l.initialize('en');assert.equal(l.currency(12500),'12,500 ₽');assert.equal(l.plural('count.deliveries',1),'1 delivery');assert.equal(l.plural('count.deliveries',2),'2 deliveries');assert.equal(l.t('company-manager.007',{v0:3}),'Level 3 required');assert.ok(l.has('game.title'));assert.equal(l.getLanguage(),'en');
 for(const lang of SUPPORTED_LANGUAGES){l.initialize(lang);for(const [key,value]of Object.entries(l.catalogs[lang])){const vars=Object.fromEntries([...value.matchAll(/\{\{(\w+)\}\}/g)].map(m=>[m[1],7]));assert.ok(!/\{\{/.test(l.t(key,vars)),`${lang} ${key}`);}}
});
test('missing English dictionary falls back safely with an explicit release error',()=>{
 const errors=[],original=console.error;console.error=v=>errors.push(v);
 try{const l=new LocalizationService({ru:localization.catalogs.ru});assert.equal(l.initialize('en'),'ru');assert.equal(errors.length,1);assert.match(errors[0],/Missing en dictionary/);}finally{console.error=original;}
});
test('old task strings, default company name, recovery and logs migrate without changing progression',()=>{
 localization.initialize('ru');const s=new GameState({tasks:{date:()=> '2026-10-08'}});
 const raw=s.getSaveData();Object.assign(raw,{money:123456,xp:30000,reputation:100,companyUnlocked:true,companyName:localization.catalogs.ru['company-config.001'],officeLevel:2,
  employees:[{id:'courier-1',name:localization.catalogs.ru['company-config.002'],recoveryMessage:localization.catalogs.ru['company-events.019']}],
  companyLog:[localization.catalogs.ru['company-manager.009'],localization.t('company-manager.001',{v0:localization.catalogs.ru['company-config.002'],v1:3}),localization.t('company-manager.018',{v0:localization.catalogs.ru['company-config.018'].toLowerCase()})],
  dailyTasks:[{id:'deliveries',title:'Старое задание',description:'Старое описание',tier:'LATE',currentProgress:2}],dailyTaskDate:'2026-10-08'});
 s.loadSaveData(raw);const saved=s.getSaveData();assert.equal(saved.money,123456);assert.equal(saved.companyName,null);assert.ok(saved.companyLog.every(validMessage));assert.ok(saved.companyLog.every(v=>typeof v==='object'));assert.ok(!saved.dailyTasks.some(t=>t.title||t.description));
 localization.initialize('en');for(const log of saved.companyLog)assert.ok(!/[А-Яа-яЁё]/.test(renderMessage(log)),JSON.stringify(log));assert.equal(s.getSnapshot().employees[0].name,'Sasha');assert.equal(renderMessage(saved.employees[0].recoveryMessage),'Found them. Just having lunch.');
 localization.initialize('ru');
});
test('messages reject unknown IDs and malformed nesting and do not mutate snapshots',()=>{
 assert.equal(validMessage({key:'missing',variables:{}}),false);assert.equal(validMessage({parts:[{}],separator:'\n'}),false);
 const s=new GameState();s.values.companyLog=[encodeMessage(localization.t('company-manager.007',{v0:3}))];const snap=s.getSnapshot();snap.companyLog[0].variables.v0=99;assert.notEqual(s.values.companyLog[0].variables.v0,99);
});
test('unrecognized historical log text is preserved without leaking another language into UI',()=>{
 const original='Текст старого журнала из неизвестной версии';const stored=migrateSavedMessage(original);
 assert.equal(stored.legacyText,original);assert.ok(validMessage(stored));localization.initialize('en');assert.equal(renderMessage(stored),'Entry from an earlier version.');localization.initialize('ru');
});
