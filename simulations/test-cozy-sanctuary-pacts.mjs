import assert from 'node:assert/strict';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const E=loadCozyEngine(),P=loadCozyEngine('sanctuary-pacts');
const START=1800000000000,DAY=86400000;
function realm(mode='classic'){
 const w={id:'pact-world',name:'Pactos',status:'running',mode,startsAt:START,influenceVersion:2};let shared=E.createCozyShared(w);const states={};
 for(const id of ['p1','p2','p3']){const save=E.settleCozyState(E.createCozyState(w,id,id,START),shared,w,START);shared=save.shared;states[id]=save.state;states[id].resources={gold:5000,materials:5000,supplies:5000};states[id].sanctuaryVisits={'sanctuary-1':START,'sanctuary-2':START};}
 return {w,states,get shared(){return shared;},act(id,a,at=START){const s=E.applyCozyAction(states[id],shared,w,a,at);states[id]=s.state;shared=s.shared;return s;},settle(id,at=START){const s=E.settleCozyState(states[id],shared,w,at);states[id]=s.state;shared=s.shared;return s;},view(id,at=START){return E.getCozyComputed(states[id],shared,w,at);}};
}
// Preserve and exercise the contract of already-created, unguarded pacts.
function start(r,kind='defense',scope='solo',id='p1',at=START){r.act(id,{type:'sanctuary_pact_start',sanctuaryId:'sanctuary-1',kind,scope},at);delete r.shared.sanctuaryPacts.at(-1).guardian;delete r.shared.sanctuaryPacts.at(-1).supportRules;return r.shared.sanctuaryPacts.at(-1).id;}
function contribute(r,pactId,resource,amount='max',id='p1',at=START){r.act(id,{type:'sanctuary_pact_contribute',pactId,resource,amount},at);}
function finish(r,pactId,id='p1',at=START){const pact=r.shared.sanctuaryPacts.find(p=>p.id===pactId);for(const resource of ['gold','materials','supplies'])if(P.SANCTUARY_PACTS[pact.kind].cost[resource])contribute(r,pactId,resource,'max',id,at);return r.shared.sanctuaryPacts.find(p=>p.id===pactId);}
function group(r){r.act('p1',{type:'alliance_create',name:'Guardiões'});const id=r.states.p1.allianceId;r.act('p2',{type:'alliance_join',allianceId:id});return id;}
let checks=0;const test=(name,fn)=>{fn();checks++;console.log('PASS',name);};
test('Solo completion reserves exactly the required resources and activates only after every goal, without points',()=>{
 const r=realm(),before=r.view('p1'),id=start(r,'provisions');contribute(r,id,'gold');assert.equal(r.view('p1').sanctuaryBonuses.provisions,0);assert.equal(r.states.p1.resources.gold,4900);
 contribute(r,id,'materials');assert.equal(r.states.p1.resources.materials,4500);assert.equal(r.view('p1').sanctuaryBonuses.provisions,.1);
 assert.equal(r.states.p1.sanctuaryPactReceipts[id],'completed');assert.deepEqual(r.states.p1.progression.feats,before.influenceDetails.model==='zero-v1'?{wonders:[],surveys:[],collected:{},supports:[]}:null);
 assert.equal(r.view('p1').influence.legacy,before.influence.legacy);assert.equal(r.shared.sanctuaryPacts[0].until,START+7*DAY);
 assert.throws(()=>contribute(r,id,'materials'),/disponível/);assert.throws(()=>start(r),/pacto atual/);
});
test('Cancellation refunds each contributor once, including a member who left the group',()=>{
 const r=realm();group(r);const id=start(r,'defense','alliance');contribute(r,id,'materials',100,'p2');assert.equal(r.states.p2.resources.materials,4900);
 r.act('p2',{type:'alliance_leave'});assert.equal(r.states.p2.resources.materials,4900);
 r.act('p1',{type:'sanctuary_pact_cancel',pactId:id});r.settle('p2');assert.equal(r.states.p2.resources.materials,5000);
 r.settle('p2');assert.equal(r.states.p2.resources.materials,5000);assert.equal(r.states.p2.sanctuaryPactReceipts[id],'refunded');
 assert.throws(()=>r.act('p1',{type:'sanctuary_pact_cancel',pactId:id}),/disponível/);
});
test('Dissolution cancels pending tower reservations and refunds a former contributor',()=>{
 const r=realm();group(r);const id=start(r,'defense','alliance');contribute(r,id,'materials',100,'p2');r.act('p2',{type:'alliance_leave'});r.act('p1',{type:'alliance_leave'});r.settle('p2');
 assert.equal(r.shared.sanctuaryPacts[0].canceledAt,START);assert.equal(r.states.p2.resources.materials,5000);
});
test('Current group receives the active benefit; departure removes it and late membership grants no contribution receipt',()=>{
 const r=realm(),g=group(r),id=start(r,'defense','alliance');finish(r,id);r.settle('p2');assert.equal(r.view('p2').sanctuaryBonuses.defense,.1);
 r.act('p2',{type:'alliance_leave'});assert.equal(r.view('p2').sanctuaryBonuses.defense,0);
 delete r.states.p3.sanctuaryVisits;r.act('p3',{type:'alliance_join',allianceId:g});assert.equal(r.view('p3').sanctuaryBonuses.defense,.1);assert.equal(r.states.p3.sanctuaryPactReceipts?.[id],undefined);assert.equal(r.view('p3').influence.legacy,0);
});
test('Authority, prior recognition, resource goals, malformed amounts and independent scope locks are enforced',()=>{
 const r=realm();delete r.states.p1.sanctuaryVisits;assert.throws(()=>start(r),/Reconheça/);r.states.p1.sanctuaryVisits={'sanctuary-1':START};
 group(r);assert.throws(()=>start(r,'defense','alliance','p2'),/líder/);const id=start(r);
 assert.throws(()=>contribute(r,id,'materials',100,'p2'),/disponível/);
 for(const amount of [0,-1,NaN,Infinity,'100'])assert.throws(()=>contribute(r,id,'materials',amount),/válida/);
 assert.throws(()=>contribute(r,id,'gold'),/meta|Recursos/);assert.throws(()=>start(r),/pacto atual/);
 const guild=start(r,'provisions','alliance');assert.notEqual(guild,id);
 const before=JSON.stringify(r.states.p1);assert.throws(()=>r.act('p1',{type:'sanctuary_pact_start',sanctuaryId:'forged',kind:'defense',scope:'solo'}),/Torre/);assert.equal(JSON.stringify(r.states.p1),before);
});
test('The maximum contribution is capped by the real remaining goal, with no excess charge',()=>{
 const r=realm(),id=start(r);contribute(r,id,'materials',100);contribute(r,id,'materials');assert.equal(r.states.p1.resources.materials,4400);assert.equal(P.pactTotals(r.shared.sanctuaryPacts[0]).materials,600);
});
test('Tower and alliance benefits of the same family never stack and do not increase military influence',()=>{
 const r=realm();group(r);const before=r.view('p1'),id=start(r);finish(r,id);const boosted=r.view('p1');assert(boosted.defensePower>before.defensePower);assert.equal(boosted.influence.military,before.influence.military);
 r.act('p1',{type:'alliance_project_start',kind:'defense'});const project=r.shared.allianceProjects[0];for(const resource of ['materials','supplies'])r.act('p1',{type:'alliance_project_contribute',projectId:project.id,resource,amount:'max'});
 assert.equal(r.view('p1').defensePower,boosted.defensePower);
});
test('Supply benefits expire at the exact boundary and bulk offline settlement equals daily settlement in both rhythms',()=>{
 for(const mode of ['classic','express']){
  const r=realm(mode),id=start(r,'provisions');finish(r,id);const day=mode==='express'?DAY/4:DAY,rate=r.view('p1').productionPerDay.supplies/1.1,initial=r.states.p1.resources.supplies;
  const bulk=E.settleCozyState(r.states.p1,r.shared,r.w,START+8*day);let incremental={state:r.states.p1,shared:r.shared};
  for(let i=1;i<=8;i++)incremental=E.settleCozyState(incremental.state,incremental.shared,r.w,START+i*day);
  assert(Math.abs(bulk.state.resources.supplies-initial-(rate*7*1.1+rate))<1e-6);assert(Math.abs(bulk.state.resources.supplies-incremental.state.resources.supplies)<1e-6);
  assert.equal(E.getCozyComputed(bulk.state,bulk.shared,r.w,START+8*day).sanctuaryBonuses.provisions,0);
 }
});
test('Season end refunds an incomplete reservation without re-paying on reread',()=>{
 const r=realm(),id=start(r);contribute(r,id,'materials',100);const end=START+120*DAY;
 const s=r.settle('p1',end);assert.equal(s.state.sanctuaryPactReceipts[id],'refunded');const gold=s.state.resources.gold;
 const again=r.settle('p1',end);assert.equal(again.state.resources.gold,gold);assert.equal(again.state.reports.filter(x=>x.title==='Recursos da torre devolvidos').length,1);
});
test('New tower charters complement an alliance project up to 15%, while legacy pacts remain unchanged',()=>{
 const r=realm();group(r);const original=r.view('p1').defensePower;
 r.act('p1',{type:'alliance_project_start',kind:'defense'});const project=r.shared.allianceProjects[0];for(const resource of ['materials','supplies'])r.act('p1',{type:'alliance_project_contribute',projectId:project.id,resource,amount:'max'});
 r.act('p1',{type:'sanctuary_pact_start',sanctuaryId:'sanctuary-1',kind:'defense',scope:'alliance'});const pact=r.shared.sanctuaryPacts.at(-1);assert.equal(pact.supportRules,2);delete pact.guardian;finish(r,pact.id);
 assert.equal(P.realmSupportBonus(r.states.p1,'defense',START),.15);assert.ok(r.view('p1').defensePower>=Math.floor(original*1.15));
 delete r.shared.sanctuaryPacts.find(p=>p.id===pact.id).supportRules;r.settle('p1',START+1);assert.equal(P.realmSupportBonus(r.states.p1,'defense',START+1),.1);
});
console.log(`PASS ${checks} tower-pact scenarios.`);
