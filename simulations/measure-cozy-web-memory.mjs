import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const folder=new URL('../reports/cozy/memory/',import.meta.url);
const meta=JSON.parse(await readFile(new URL('session.json',folder),'utf8'));
const entry=process.env.COZY_MEMORY_ENTRY||'intelligence';
assert.ok(['intelligence','empire'].includes(entry));
const label=meta.label+(entry==='intelligence'?'':'-'+entry);
const output=new URL(`${label}-web-memory.json`,folder);
await writeFile(output,JSON.stringify({status:'RUNNING',label:meta.label,entry}));
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:360,height:740},isMobile:true,hasTouch:true,deviceScaleFactor:1});
await context.addCookies(meta.cookies);
const page=await context.newPage(),cdp=await context.newCDPSession(page),errors=[];
page.on('pageerror',e=>errors.push(e.message));await cdp.send('Performance.enable');
const samples=[];
async function sample(stage){
 const raw=await cdp.send('Performance.getMetrics');await cdp.send('HeapProfiler.collectGarbage');
 const metrics=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
 const resources=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.initiatorType==='script').map(r=>({name:new URL(r.name).pathname,decoded:r.decodedBodySize,transfer:r.transferSize})));
 samples.push({stage,rawHeap:raw.metrics.find(m=>m.name==='JSHeapUsedSize')?.value,retainedHeap:metrics.JSHeapUsedSize,nodes:metrics.Nodes,documents:metrics.Documents,listeners:metrics.JSEventListeners,scripts:resources,scriptBytes:resources.reduce((v,r)=>v+r.decoded,0)});
}
async function walk(){for(const [name,help] of [['Infraestrutura','Como evoluir suas cidades'],['Militar','Como preparar seu exército'],['Governo','Como conduzir seu governo'],['Conselho','Como decidir no Conselho'],['Conquistas','Como acompanhar suas conquistas']]){
 await page.getByRole('button',{name,exact:true}).click();const guide=page.getByRole('dialog',{name:help,exact:true});if(await guide.count())await guide.getByRole('button',{name:'Pular',exact:true}).click();await page.getByRole('dialog',{name,exact:true}).waitFor();await page.getByRole('button',{name:'Fechar painel',exact:true}).click();
}}
try{
 const response=await page.goto(meta.url.replace(/intelligence$/,entry),{waitUntil:'networkidle'});
 const html=await response.text();
 const legacyAnalyticsSent=html.includes('profileHealth');
 if(process.env.COZY_MEMORY_EXPECT_ISOLATED==='1')assert.equal(legacyAnalyticsSent,false,'Cozy must not serialize legacy analytics');
 await page.getByRole('navigation',{name:'Áreas do reino'}).waitFor();
 const crownHelp=page.getByRole('dialog',{name:'Como comandar seu reino',exact:true});
 if(await crownHelp.count())await crownHelp.getByRole('button',{name:'Fechar ajuda',exact:true}).click();
 await sample('startup');await walk();await sample('one-panel-cycle');
 for(let i=0;i<9;i++)await walk();await sample('ten-panel-cycles');
 assert.deepEqual(errors,[]);await page.screenshot({path:new URL(`${label}-web-crown.png`,folder).pathname.replace(/^\/(\w:)/,'$1')});
 const result={status:'PASS',mode:meta.mode,label:meta.label,entry,htmlBytes:Buffer.byteLength(html),legacyAnalyticsSent,scope:'Chromium mobile viewport, production app and disposable Auth/Postgres; forced GC measures retained JS, not total peak/device memory.',samples,errors};
 await writeFile(output,JSON.stringify(result,null,2));console.log(JSON.stringify(samples.map(({stage,retainedHeap,nodes,documents,listeners,scriptBytes})=>({stage,retainedHeap,nodes,documents,listeners,scriptBytes})),null,2));
}catch(error){
 await writeFile(output,JSON.stringify({status:'FAIL',label:meta.label,entry,error:String(error),samples,errors},null,2));throw error;
}finally{await browser.close();}
