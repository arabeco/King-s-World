// Real React hook + browser networking, with no remote service or game mutation.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {chromium} from 'playwright';

const root=new URL('../',import.meta.url);
const source=name=>readFileSync(new URL(name,root),'utf8');
const compile=name=>ts.transpileModule(source(name),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const browser=await chromium.launch({headless:true});
let checks=0;
try{
 const context=await browser.newContext();
 const page=await context.newPage();
 const mountHarness=async(page)=>{
 await page.route('https://cozy.test/',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><div id="app"></div>'}));
 await page.goto('https://cozy.test/');
 await page.addScriptTag({path:fileURLToPath(new URL('node_modules/react/umd/react.development.js',root))});
 await page.addScriptTag({path:fileURLToPath(new URL('node_modules/react-dom/umd/react-dom.development.js',root))});
 await page.evaluate(({ordering,hook})=>{
  const orderModule={exports:{}};
  new Function('module','exports',ordering)(orderModule,orderModule.exports);
  const hookModule={exports:{}};
  new Function('require','module','exports',hook)(name=>name==='react'?window.React:orderModule.exports,hookModule,hookModule.exports);
  window.testRoot=ReactDOM.createRoot(document.querySelector('#app'));
  window.renderWorld=id=>{
   // Keep a stable component identity to exercise the actual world-id effect.
   window.Harness??=function Harness({worldId}){window.cozy=hookModule.exports.useCozyWorld(worldId);return React.createElement('div',null,window.cozy.payload?.world.id||'loading');};
   window.testRoot.render(React.createElement(React.StrictMode,null,React.createElement(window.Harness,{worldId:id})));
  };
 },{ordering:compile('lib/cozy/snapshot-order.ts'),hook:compile('components/cozy/useCozyWorld.ts')});
 };
 await mountHarness(page);
 const snapshot=(id,revision,serverNow=Date.now())=>({world:{id},revision,serverNow,state:{playerId:`player-${id}`,orders:[]},computed:{cityLife:{}}});
 let requests=[],handler=async route=>route.fulfill({json:snapshot('a',1)});
 await page.route('**/api/worlds/*/cozy',async route=>{requests.push(route.request());await handler(route);});
 await page.evaluate(()=>window.renderWorld('a'));
 await page.waitForFunction(()=>window.cozy?.payload?.revision===1&&!window.cozy.loading);
 const check=async(name,fn)=>{await fn();checks++;console.log('PASS',name);};
 await check('Delayed reads cannot replace a confirmed newer command or rewind its timestamp',async()=>{
  let release,started;const gate=new Promise(r=>release=r),arrival=new Promise(r=>started=r);
  const old=snapshot('a',1,Date.now()-60000),newer=snapshot('a',2);
  handler=async route=>{if(route.request().method()==='GET'){started();await gate;await route.fulfill({json:old});}else await route.fulfill({json:newer});};
  await page.evaluate(()=>{void window.cozy.refresh();});await arrival;
  assert.equal(await page.evaluate(()=>window.cozy.act({type:'read_reports'})),true);
  release();await page.waitForFunction(()=>!window.cozy.refreshing);
  assert.equal(await page.evaluate(()=>window.cozy.lastAction),null,'Automatic read acknowledgement stays silent after synchronization');
  assert.deepEqual(await page.evaluate(()=>[window.cozy.payload.revision,window.cozy.payload.serverNow]),[2,newer.serverNow]);
 });
 await check('A delayed response from a previous world cannot change the current world',async()=>{
  let release,started;const gate=new Promise(r=>release=r),arrival=new Promise(r=>started=r);
  handler=async route=>{if(route.request().url().includes('/a/')){started();await gate;await route.fulfill({json:snapshot('a',99)});}else await route.fulfill({json:snapshot('b',1)});};
  await page.evaluate(()=>{void window.cozy.refresh();});await arrival;
  await page.evaluate(()=>window.renderWorld('b'));
  await page.waitForFunction(()=>window.cozy.payload?.world.id==='b');
  const oldReply=page.waitForResponse(r=>r.url().includes('/a/'));release();await oldReply;
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  assert.equal(await page.evaluate(()=>window.cozy.payload.world.id),'b');
 });
 await check('Concurrent refreshes share one request and a timed-out read unlocks retry',async()=>{
  await page.clock.install();
  let release,started;const gate=new Promise(r=>release=r),arrival=new Promise(r=>started=r);
  handler=async route=>{started();await gate;try{await route.fulfill({json:snapshot('b',2)});}catch{/* Browser already aborted. */}};
  const before=requests.length;
  await page.evaluate(()=>{void window.cozy.refresh();void window.cozy.refresh();void window.cozy.refresh();});await arrival;
  assert.equal(requests.length,before+1);
  await page.clock.runFor(20001);await page.waitForFunction(()=>!window.cozy.refreshing&&!!window.cozy.error);
  assert.equal(await page.evaluate(()=>window.cozy.error),'O reino demorou a responder. Tente sincronizar novamente.');
  release();handler=async route=>route.fulfill({json:snapshot('b',3)});
  await page.evaluate(()=>window.cozy.refresh());assert.equal(await page.evaluate(()=>window.cozy.payload.revision),3);
 });
 await check('Network failure preserves the last kingdom and gives a localized recovery message',async()=>{
  const prior=await page.evaluate(()=>window.cozy.payload);
  handler=route=>route.abort('internetdisconnected');await page.evaluate(()=>window.cozy.refresh());
  assert.equal(await page.evaluate(()=>window.cozy.error),'Não foi possível alcançar o reino. Verifique a conexão e tente sincronizar novamente.');
  assert.deepEqual(await page.evaluate(()=>window.cozy.payload),prior);assert.equal(await page.evaluate(()=>window.cozy.uncertain),null);
  handler=route=>route.fulfill({json:snapshot('b',prior.revision+1)});await page.evaluate(()=>window.cozy.refresh());assert.equal(await page.evaluate(()=>window.cozy.error),null);
 });
 await check('An invalid server response produces a readable retry message without losing the kingdom',async()=>{
  const prior=await page.evaluate(()=>window.cozy.payload);
  handler=route=>route.fulfill({status:200,contentType:'text/html',body:'<html>temporary gateway failure</html>'});await page.evaluate(()=>window.cozy.refresh());
  assert.equal(await page.evaluate(()=>window.cozy.error),'A resposta do reino chegou incompleta. Tente sincronizar novamente.');assert.deepEqual(await page.evaluate(()=>window.cozy.payload),prior);
  handler=route=>route.fulfill({json:snapshot('b',prior.revision+1)});await page.evaluate(()=>window.cozy.refresh());assert.equal(await page.evaluate(()=>window.cozy.error),null);
 });
 await check('Unconfirmed writes preserve their receipt and retry with the identical request id',async()=>{
  let received,release;const arrival=new Promise(r=>received=r),gate=new Promise(r=>release=r);let first;
  handler=async route=>{first=route.request().postDataJSON();received();await gate;try{await route.fulfill({json:snapshot('b',4)});}catch{/* Browser already aborted. */}};
  await page.evaluate(()=>{void window.cozy.act({type:'recruit',troop:'militia',amount:1});});await arrival;
  await page.clock.runFor(20001);await page.waitForFunction(()=>!!window.cozy.uncertain&&!window.cozy.pending);
  assert.equal(await page.evaluate(()=>window.cozy.act({type:'recruit',troop:'militia',amount:1})),false);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('kw-cozy-pending:b:player-b')).requestId),first.requestId);
  release();let retry;
  handler=async route=>{retry=route.request().postDataJSON();await route.fulfill({json:snapshot('b',4)});};
  assert.equal(await page.evaluate(()=>window.cozy.retryCommand()),true);
  assert.deepEqual(retry,first);assert.equal(await page.evaluate(()=>localStorage.getItem('kw-cozy-pending:b:player-b')),null);
 });
 await check('Equal revisions reject an older timestamp and a foreign world payload',async()=>{
  const prior=await page.evaluate(()=>window.cozy.payload);
  handler=async route=>route.fulfill({json:snapshot('b',prior.revision,prior.serverNow-10000)});
  await page.evaluate(()=>window.cozy.refresh());assert.equal(await page.evaluate(()=>window.cozy.payload.serverNow),prior.serverNow);
  handler=async route=>route.fulfill({json:snapshot('other',999)});
  await page.evaluate(()=>window.cozy.refresh());assert.equal(await page.evaluate(()=>window.cozy.payload.world.id),'b');
 });
 await check('A stored receipt survives remount and prevents a different command until confirmation',async()=>{
  const receipt={action:{type:'recruit',troop:'militia',amount:1},requestId:'saved-receipt-c'};
  handler=async route=>route.fulfill({json:snapshot('c',1)});
  await page.evaluate(receipt=>{localStorage.setItem('kw-cozy-pending:c:player-c',JSON.stringify(receipt));window.renderWorld('c');},receipt);
  await page.waitForFunction(()=>window.cozy.payload?.world.id==='c'&&!!window.cozy.uncertain);
  assert.equal(await page.evaluate(()=>window.cozy.act({type:'recruit',troop:'militia',amount:1})),false);
  let actual;handler=async route=>{actual=route.request().postDataJSON();await route.fulfill({json:snapshot('c',2)});};
  assert.equal(await page.evaluate(()=>window.cozy.retryCommand()),true);assert.deepEqual(actual,receipt);
 });
 await check('An old world command cannot unlock a command still pending in the next world',async()=>{
  let oldRelease,newRelease,oldStarted,newStarted;
  const oldGate=new Promise(r=>oldRelease=r),newGate=new Promise(r=>newRelease=r);
  const oldArrival=new Promise(r=>oldStarted=r),newArrival=new Promise(r=>newStarted=r);
  handler=async route=>{
   const old=route.request().url().includes('/c/');
   if(route.request().method()==='POST'){
    (old?oldStarted:newStarted)();await(old?oldGate:newGate);
   }
   await route.fulfill({json:snapshot(old?'c':'d',3)});
  };
  await page.evaluate(()=>{window.oldResult=window.cozy.act({type:'recruit',troop:'militia',amount:1});});await oldArrival;
  await page.evaluate(()=>window.renderWorld('d'));await page.waitForFunction(()=>window.cozy.payload?.world.id==='d');
  await page.evaluate(()=>{window.newResult=window.cozy.act({type:'recruit',troop:'militia',amount:1});});await newArrival;
  oldRelease();assert.equal(await page.evaluate(()=>window.oldResult),false);
  assert.equal(await page.evaluate(()=>window.cozy.pending),true);
  assert.equal(await page.evaluate(()=>window.cozy.act({type:'recruit',troop:'militia',amount:1})),false);
  newRelease();assert.equal(await page.evaluate(()=>window.newResult),true);
 });
 await check('Expiring city effects trigger an authoritative refresh without an active order',async()=>{
  const initial=snapshot('d',4);initial.computed.cityLife={capital:{effectEndsAt:initial.serverNow+1000}};
  handler=async route=>route.fulfill({json:initial});await page.evaluate(()=>window.cozy.refresh());
  let reads=0;handler=async route=>{reads++;await route.fulfill({json:snapshot('d',5)});};
  await page.clock.runFor(3000);await page.waitForFunction(()=>window.cozy.payload.revision===5);assert(reads>=1);
 });
 await check('An expiring alliance benefit refreshes the authoritative state without any orders',async()=>{
  const initial=snapshot('d',6);initial.state.allianceId='group';initial.state.allianceBenefits=[{projectId:'project',allianceId:'group',kind:'provisions',from:initial.serverNow-1000,until:initial.serverNow+1000}];
  handler=async route=>route.fulfill({json:initial});await page.evaluate(()=>window.cozy.refresh());
  let reads=0;handler=async route=>{reads++;await route.fulfill({json:snapshot('d',7)});};
  await page.clock.runFor(3000);await page.waitForFunction(()=>window.cozy.payload.revision===7);assert(reads>=1);
 });
 await check('An expiring sanctuary benefit triggers refresh even without an order',async()=>{
  const initial=snapshot('d',8);initial.state.sanctuaryBenefits=[{pactId:'tower-pact',allianceId:null,ownerPlayerId:'player-d',kind:'provisions',from:initial.serverNow-1000,until:initial.serverNow+1000}];
  handler=async route=>route.fulfill({json:initial});await page.evaluate(()=>window.cozy.refresh());
  let reads=0;handler=async route=>{reads++;await route.fulfill({json:snapshot('d',9)});};
  await page.clock.runFor(3000);await page.waitForFunction(()=>window.cozy.payload.revision===9);assert(reads>=1);
 });
 await check('A tower horde triggers an authoritative refresh without orders or an expiring benefit',async()=>{
  const initial=snapshot('d',10);initial.computed.sanctuaryThreats=[{pactId:'threat',arrivesAt:initial.serverNow+1000}];
  handler=async route=>route.fulfill({json:initial});await page.evaluate(()=>window.cozy.refresh());
  let reads=0;handler=async route=>{reads++;await route.fulfill({json:snapshot('d',11)});};
  await page.clock.runFor(3000);await page.waitForFunction(()=>window.cozy.payload.revision===11);assert(reads>=1);
 });
 await check('A delayed acknowledgement is coalesced and never blocks recruitment or rewinds its result',async()=>{
  const prior=await page.evaluate(()=>window.cozy.payload);let release,started,acks=0;
  const gate=new Promise(r=>release=r),arrival=new Promise(r=>started=r);
  handler=async route=>{
   const action=route.request().postDataJSON()?.action;
   if(action?.type==='read_reports'){acks++;started();await gate;await route.fulfill({json:snapshot('d',prior.revision+1)});}
   else await route.fulfill({json:snapshot('d',prior.revision+2)});
  };
  await page.evaluate(()=>{window.ackOne=window.cozy.act({type:'read_reports'});window.ackTwo=window.cozy.act({type:'read_reports'});});await arrival;
  assert.equal(acks,1);assert.equal(await page.evaluate(()=>window.cozy.pending),false);assert.equal(await page.evaluate(()=>window.cozy.uncertain),null);
  assert.equal(await page.evaluate(()=>localStorage.getItem('kw-cozy-pending:d:player-d')),null);
  assert.equal(await page.evaluate(()=>window.cozy.act({type:'recruit',troop:'militia',amount:1})),true);
  release();assert.deepEqual(await page.evaluate(()=>Promise.all([window.ackOne,window.ackTwo])),[true,true]);
  assert.equal(await page.evaluate(()=>window.cozy.payload.revision),prior.revision+2);assert.equal(await page.evaluate(()=>window.cozy.lastAction.action.type),'recruit');
 });
 await check('Failed acknowledgements stay silent and do not create a spending receipt or block the next command',async()=>{
  const prior=await page.evaluate(()=>window.cozy.payload),priorError=await page.evaluate(()=>window.cozy.error);
  for(const kind of ['server','network','invalid']){
   handler=route=>kind==='network'?route.abort('internetdisconnected'):kind==='invalid'?route.fulfill({status:200,contentType:'text/html',body:'gateway'}):route.fulfill({status:503,json:{error:'Unavailable'}});
   assert.equal(await page.evaluate(()=>window.cozy.act({type:'read_reports'})),false);assert.equal(await page.evaluate(()=>window.cozy.error),priorError);assert.equal(await page.evaluate(()=>window.cozy.uncertain),null);assert.equal(await page.evaluate(()=>window.cozy.pending),false);
   assert.equal(await page.evaluate(()=>localStorage.getItem('kw-cozy-pending:d:player-d')),null);
  }
  handler=route=>route.fulfill({json:snapshot('d',prior.revision+1)});assert.equal(await page.evaluate(()=>window.cozy.act({type:'recruit',troop:'militia',amount:1})),true);
 });
 await check('An acknowledgement timeout releases its own request without locking gameplay',async()=>{
  const prior=await page.evaluate(()=>window.cozy.payload);let started,release;const arrival=new Promise(r=>started=r),gate=new Promise(r=>release=r);
  handler=async route=>{started();await gate;try{await route.fulfill({json:snapshot('d',prior.revision+1)});}catch{}};
  await page.evaluate(()=>{window.timedAck=window.cozy.act({type:'read_reports'});});await arrival;await page.clock.runFor(5001);
  assert.equal(await page.evaluate(()=>window.timedAck),false);assert.equal(await page.evaluate(()=>window.cozy.pending),false);assert.equal(await page.evaluate(()=>window.cozy.uncertain),null);release();
  handler=route=>route.fulfill({json:snapshot('d',prior.revision+2)});assert.equal(await page.evaluate(()=>window.cozy.act({type:'read_reports'})),true);
 });
 await check('An old automatic-read receipt is discarded on entry without replaying a gameplay command',async()=>{
  const clean=await browser.newPage();await mountHarness(clean);const key='kw-cozy-pending:old-ack:player-old-ack';
  await clean.evaluate(key=>{const receipt=JSON.stringify({requestId:'old-read-receipt',action:{type:'read_reports'}});localStorage.setItem(key,receipt);sessionStorage.setItem(key,receipt);},key);
  let posts=0;await clean.route('**/api/worlds/*/cozy',route=>{if(route.request().method()==='POST')posts++;return route.fulfill({json:snapshot('old-ack',1)});});await clean.evaluate(()=>window.renderWorld('old-ack'));await clean.waitForFunction(()=>window.cozy?.payload?.world.id==='old-ack');
  assert.equal(await clean.evaluate(()=>window.cozy.uncertain),null);assert.equal(await clean.evaluate(key=>localStorage.getItem(key),key),null);assert.equal(await clean.evaluate(key=>sessionStorage.getItem(key),key),null);assert.equal(posts,0);await clean.close();
 });
 await check('Closing the tab preserves an unconfirmed receipt and reopening never sends it automatically',async()=>{
  let original;
  handler=async route=>{if(route.request().method()==='POST'){original=route.request().postDataJSON();await route.fulfill({status:503,json:{error:'Confirmação indisponível'}});}else await route.fulfill({json:snapshot('d',8)});};
  assert.equal(await page.evaluate(()=>window.cozy.act({type:'recruit',troop:'militia',amount:1})),false);
  assert.equal(await page.evaluate(()=>window.cozy.uncertain.requestId),original.requestId);
  await page.close();
  const reopened=await context.newPage();
  await mountHarness(reopened);
  let posts=0,actual;
  handler=async route=>{if(route.request().method()==='POST'){posts++;actual=route.request().postDataJSON();}await route.fulfill({json:snapshot('d',9)});};
  await reopened.route('**/api/worlds/*/cozy',route=>handler(route));
  await reopened.evaluate(()=>window.renderWorld('d'));
  await reopened.waitForFunction(()=>window.cozy?.payload?.world.id==='d'&&!!window.cozy.uncertain);
  assert.equal(posts,0);assert.equal(await reopened.evaluate(()=>window.cozy.act({type:'recruit',troop:'militia',amount:1})),false);
  assert.equal(await reopened.evaluate(()=>window.cozy.retryCommand()),true);
  assert.deepEqual(actual,original);assert.equal(posts,1);
  assert.equal(await reopened.evaluate(()=>localStorage.getItem('kw-cozy-pending:d:player-d')),null);
  assert.equal(await reopened.evaluate(()=>sessionStorage.getItem('kw-cozy-pending:d:player-d')),null);
  await reopened.close();
 });
 await check('Another player on the same world cannot inherit a saved action',async()=>{
  const other=await browser.newPage();await mountHarness(other);
  const saved={requestId:'other-king-receipt',action:{type:'recruit',troop:'militia',amount:5}};
  await other.evaluate(saved=>localStorage.setItem('kw-cozy-pending:d:player-d',JSON.stringify(saved)),saved);
  let posts=0;
  await other.route('**/api/worlds/*/cozy',route=>{if(route.request().method()==='POST')posts++;const data=snapshot('d',1);data.state.playerId='player-other';return route.fulfill({json:data});});
  await other.evaluate(()=>window.renderWorld('d'));
  await other.waitForFunction(()=>window.cozy?.payload?.state.playerId==='player-other');
  assert.equal(await other.evaluate(()=>window.cozy.uncertain),null);assert.equal(posts,0);
  assert.equal(await other.evaluate(()=>JSON.parse(localStorage.getItem('kw-cozy-pending:d:player-d')).requestId),saved.requestId);
  await other.close();
 });
 await check('Malformed stored actions do not block entry and unavailable storage does not block commands',async()=>{
  const clean=await browser.newPage();await mountHarness(clean);
  await clean.evaluate(()=>localStorage.setItem('kw-cozy-pending:e:player-e',JSON.stringify({requestId:'valid-receipt',action:[]})));
  await clean.route('**/api/worlds/*/cozy',route=>route.fulfill({json:snapshot('e',1)}));
  await clean.evaluate(()=>window.renderWorld('e'));await clean.waitForFunction(()=>window.cozy?.payload?.world.id==='e');
  assert.equal(await clean.evaluate(()=>window.cozy.uncertain),null);
  assert.equal(await clean.evaluate(()=>localStorage.getItem('kw-cozy-pending:e:player-e')),null);
  await clean.evaluate(()=>{for(const key of ['localStorage','sessionStorage'])Object.defineProperty(window,key,{configurable:true,get(){throw new DOMException('Storage disabled','SecurityError');}});});
  assert.equal(await clean.evaluate(()=>window.cozy.act({type:'read_reports'})),true);
  await clean.close();
 });
 console.log(`PASS ${checks} synchronization scenarios (React + local browser transport).`);
}finally{await browser.close();}
