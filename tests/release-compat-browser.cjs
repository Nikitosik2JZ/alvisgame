// Current Chrome compatibility doubles, not physical old browser verification.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{fs.mkdirSync('artifacts/stage12',{recursive:true});const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const errors=[],results=[];
try {for(const mode of ['wide','tall','fallback','canvas']) {const p=await b.newPage({viewport:mode==='wide'?{width:2560,height:1080}:mode==='tall'?{width:1000,height:2400}:{width:390,height:844}});p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
if(mode==='fallback')await p.addInitScript(()=>{window.structuredClone=undefined;window.ResizeObserver=undefined;CSS.escape=undefined;Intl.PluralRules=undefined;HTMLDialogElement.prototype.showModal=undefined;HTMLDialogElement.prototype.close=undefined;const supports=CSS.supports.bind(CSS);CSS.supports=(...a)=>a[0]==='display'&&a[1]==='grid'?false:supports(...a);});
if(mode==='canvas')await p.addInitScript(()=>{const context=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:context.call(this,type,...args);};});
await p.goto(process.env.PREVIEW_URL||'http://127.0.0.1:5188');await p.waitForSelector('#tutorial:not([hidden])');await p.click('[data-tutorial-skip]');
if(['wide','tall'].includes(mode)){const rect=await p.locator('canvas').boundingBox();assert.ok(Math.max(rect.width,rect.height)/Math.min(rect.width,rect.height)<=2.001);}
if(!await p.locator('#open-settings').isVisible())await p.click('#open-menu');await p.click('#open-settings');await p.click('#settings-dialog [data-close]');
if(mode==='fallback'){await p.click('#open-menu');await p.click('#open-progress');await p.click('[data-progress-view="records"]');await p.click('#progress-dialog [data-close]');}
for(let i=0;i<25;i++)await p.setViewportSize(i%2?{width:390,height:844}:{width:844,height:390});
await p.evaluate(()=>{history.pushState(null,'','#a');history.pushState(null,'','#b');});await p.goBack();await p.goForward();assert.ok(await p.locator('canvas').isVisible());await p.screenshot({path:`artifacts/stage12/extra-${mode}.png`});results.push(mode+' startup/settings/rapid-resize/history PASS');await p.close();}
assert.deepEqual(errors,[]);fs.writeFileSync('artifacts/stage12/extra.json',JSON.stringify({chrome:await b.version(),results,errors},null,2));console.log(results.join('\n'));}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
