import fs from 'node:fs';
import assert from 'node:assert/strict';
import { parseAst } from 'rolldown/parseAst';
export function auditLocalization() {
  const ru=JSON.parse(fs.readFileSync('src/locales/ru.json','utf8')),en=JSON.parse(fs.readFileSync('src/locales/en.json','utf8'));
  const missingRU=Object.keys(en).filter(k=>!Object.hasOwn(ru,k)),missingEN=Object.keys(ru).filter(k=>!Object.hasOwn(en,k));
  assert.deepEqual(missingRU,[],'Missing Russian keys');assert.deepEqual(missingEN,[],'Missing English keys');
  const placeholders=text=>[...text.matchAll(/\{\{(\w+)\}\}/g)].map(m=>m[1]).sort();
  for(const key of Object.keys(ru)){
    assert.ok(typeof en[key]==='string'&&en[key].trim(),`Empty English key ${key}`);
    assert.ok(typeof ru[key]==='string'&&ru[key].trim(),`Empty Russian key ${key}`);
    assert.deepEqual(placeholders(ru[key]),placeholders(en[key]),`Placeholder mismatch ${key}`);
    assert.ok(!/[А-Яа-яЁё]/.test(en[key]),`Cyrillic English value ${key}`);
    // Proper restaurant names, input keys and accepted abbreviations are intentional.
    const text=ru[key].replace(/<[^>]+>/g,'').replace(/\{\{\w+\}\}/g,'').replace(/Burger House|Pizza Point|Sushi Place|WASD|HUD|VIP|\bID\b|\bE\b/g,'');
    assert.ok(!/[a-zA-Z]{2}/.test(text),`Unexpected English Russian value ${key}`);
  }
  const files=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(`${dir}/${e.name}`):[`${dir}/${e.name}`]);
  const suspicious=[],referenced=new Set();
  const cyr=/[А-Яа-яЁё]/;
  // Explicit non-UI literal contexts: module paths, internal IDs/enums, DOM/CSS
  // selectors/markup without text, keyboard/font identifiers and developer diagnostics.
  const internal=/^(?:[A-Z][A-Z0-9_]*|[a-z][a-zA-Z0-9_.:-]*|[.#:\[]|\.\.?\/|--|\/src\/)/;
  const proper=new Set(['Burger House','Pizza Point','Sushi Place','Arial','POST OFFICE','CORNER SHOP','W,A,S,D,UP,DOWN,LEFT,RIGHT','12px','14px','18px','__proto__']);
  function walk(n,parent,file,ancestors=[]){
    if(!n||typeof n!=='object')return;
    const literal=n.type==='Literal'&&typeof n.value==='string',quasi=n.type==='TemplateElement';
    if(literal||quasi){
      const value=literal?n.value:n.value.cooked;
      const diagnostic=ancestors.some(a=>a.type==='NewExpression'&&a.callee?.name==='Error'||a.type==='CallExpression'&&a.callee?.object?.name==='console');
      if(cyr.test(value)&&!diagnostic)suspicious.push(`${file}:${n.start}: hardcoded Cyrillic`);
      if(literal&&parent?.type==='CallExpression'&&parent.arguments?.[0]===n&&['tr','t','message','logMessage','plural'].includes(parent.callee?.name||parent.callee?.property?.name)){
        if(parent.callee?.property?.name==='plural')assert.ok(Object.hasOwn(ru,`${value}.other`),`${file}: unknown plural ${value}`);
        else {assert.ok(Object.hasOwn(ru,value),`${file}: unknown key ${value}`);referenced.add(value);}
      }
      const readable=literal&&/[A-Za-z]{2}/.test(value)&&!internal.test(value)&&!proper.has(value)&&!diagnostic;
      const visible=parent?.type==='Property'&&['name','title','description','label','placeholder','consequence'].includes(parent.key?.name)
        ||parent?.type==='AssignmentExpression'&&['textContent','innerText'].includes(parent.left?.property?.name)
        ||parent?.type==='CallExpression'&&['el','button','node'].includes(parent.callee?.name||parent.callee?.property?.name)&&parent.arguments?.[1]===n
        ||parent?.type==='CallExpression'&&parent.callee?.property?.name==='text'&&parent.arguments?.[2]===n
        ||parent?.type==='CallExpression'&&parent.callee?.property?.name==='setAttribute'&&['aria-label','placeholder','title'].includes(parent.arguments?.[0]?.value)&&parent.arguments?.[1]===n;
      const worldID=file==='src/world/districtLayouts.js'&&parent?.type==='Property'&&parent.key?.name==='name';
      if(literal&&visible&&!worldID&&!diagnostic&&/[A-Za-z]{2}/.test(value)&&!proper.has(value)&&value.replace(/<[^>]*>/g,'').match(/[A-Za-z]{2}/))suspicious.push(`${file}:${n.start}: hardcoded visible English ${value}`);
      if(readable){
        const text=value.replace(/<[^>]*>/g,'').replace(/\{\{\w+\}\}/g,'');
        const technical=ancestors.some(a=>a.type==='ImportDeclaration'||a.type==='ExportNamedDeclaration')||['Platform timeout','Player unavailable','Localization must initialize before game state','(pointer: coarse)','(max-width: 900px), (pointer: coarse)','INPUT','TEXTAREA','SELECT'].includes(value);
        if(/[A-Za-z]{2}/.test(text)&&!technical)suspicious.push(`${file}:${n.start}: suspicious English ${value}`);
      }
    }
    for(const [key,v]of Object.entries(n)){
      if(['parent','comments'].includes(key))continue;
      if(Array.isArray(v))v.forEach(child=>walk(child,n,file,[...ancestors,n]));else if(v&&typeof v==='object')walk(v,n,file,[...ancestors,n]);
    }
  }
  for(const file of files('src').filter(f=>f.endsWith('.js')))walk(parseAst(fs.readFileSync(file,'utf8')),null,file);
  const html=fs.readFileSync('index.html','utf8');assert.ok(!cyr.test(html),'Hardcoded HTML Cyrillic');
  for(const m of html.matchAll(/data-i18n(?:-[\w-]+)?="([^"]+)"/g))assert.ok(Object.hasOwn(ru,m[1]),`Unknown HTML key ${m[1]}`);
  for(const file of files('src').filter(f=>f.endsWith('.css'))){const text=fs.readFileSync(file,'utf8');assert.ok(!/content\s*:\s*['"][^'"]*[A-Za-zА-Яа-яЁё]/.test(text),'CSS-generated text requires localization');}
  assert.deepEqual(suspicious,[],'Hardcoded user-facing text');
  return {ruKeys:Object.keys(ru).length,enKeys:Object.keys(en).length,missingRU:missingRU.length,missingEN:missingEN.length,hardcodedCyrillic:0,hardcodedEnglish:0,referencedKeys:referenced.size,mixedCatalogs:'PASS'};
}
if(process.argv[1]?.endsWith('check-localization.mjs'))console.log('Localization audit PASS:',JSON.stringify(auditLocalization()));
