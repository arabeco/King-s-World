import assert from 'node:assert/strict';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const E=loadCozyEngine(),P=loadCozyEngine('sanctuary-pacts'),R=loadCozyEngine('sanctuary-raids'),H=loadCozyEngine('hordes');
const START=1800000000000,DAY=86400000;
function realm(mode='classic'){
 const day=mode==='express'?DAY/4:DAY,now=START+15*day;
 const w={id:'tower-raids',name:'Torres',status:'running',mode,startsAt:START,influenceVersion:2};let shared=E.createCozyShared(w);const states={};
 for(const id of ['p1','p2','p3']){
  const save=E.settleCozyState(E.createCozyState(w,id,id,now),shared,w,now);shared=save.shared;states[id]=save.state;
  states[id].resources={gold:10000,materials:10000,supplies:10000};states[id].army={militia:1000,shooters:0,scouts:0,machinery:0};states[id].sanctuaryVisits={'sanctuary-1':now,'sanctuary-2':now};
 }
 return {w,day,now,wave:START+19*day,states,get shared(){return shared;},act(id,a,at=now){const s=E.applyCozyAction(states[id],shared,w,a,at);states[id]=s.state;shared=s.shared;return s;},settle(id,at){const s=E.settleCozyState(states[id],shared,w,at);states[id]=s.state;shared=s.shared;return s;},view(id,at=now){return E.getCozyComputed(states[id],shared,w,at);}};
}
function active(r,kind='provisions',scope='solo',tower='sanctuary-1'){
 r.act('p1',{type:'sanctuary_pact_start',sanctuaryId:tower,kind,scope,raids:null});const pact=r.shared.sanctuaryPacts.at(-1);
 for(const resource of ['gold','materials','supplies'])if(P.SANCTUARY_PACTS[kind].cost[resource])r.act('p1',{type:'sanctuary_pact_contribute',pactId:pact.id,resource,amount:'max'});
 r.act('p1',{type:'sanctuary_pact_challenge',pactId:pact.id});const at=r.states.p1.orders.at(-1).arrivesAt;r.settle('p1',at);
 return r.shared.sanctuaryPacts.find(p=>p.id===pact.id);
}
function group(r){r.act('p1',{type:'alliance_create',name:'Guarda'});r.act('p2',{type:'alliance_join',allianceId:r.states.p1.allianceId});}
const pledge=(r,id,pact,at)=>r.act(id,{type:'sanctuary_pact_defend',pactId:pact.id,waveDay:20,power:999999},at);
let checks=0;function test(name,fn){fn();checks++;console.log('PASS',name);}
test('Only new pacts schedule strictly future world waves within their original bonus deadline, in both rhythms',()=>{
 for(const mode of ['classic','express']){
  const r=realm(mode),p=active(r);assert.equal(p.raids.version,1);
  assert.deepEqual(p.raids.waves.map(({day,arrivesAt,power})=>({day,arrivesAt,power})),[H.hordeSchedule(START,r.day)[0]]);
  assert.equal(p.raids.waves[0].arrivesAt,r.wave);assert.equal(p.raids.waves[0].power,r.view('p1',p.completedAt).nextHorde.power);
  const copy=structuredClone(p);P.activateSanctuaryPact(copy,r.wave,r.day,START+120*r.day,H.hordeSchedule(START,r.day));assert.equal(copy.raids.waves.length,0,'No surprise attack at the exact activation instant');
  P.activateSanctuaryPact(copy,r.wave-7*r.day,r.day,START+120*r.day,H.hordeSchedule(START,r.day));assert.equal(copy.raids.waves.length,0,'Expiry excludes a simultaneous attack');
 }
});
test('A support pledge uses the real offer once, costs nothing and moves no troops or orders or influence',()=>{
 const r=realm(),p=active(r),at=p.completedAt,offer=r.view('p1',at).supportOffer,before=structuredClone(r.states.p1),score=r.view('p1',at).influence;
 pledge(r,'p1',p,at);const wave=r.shared.sanctuaryPacts[0].raids.waves[0];
 assert.equal(wave.defenders[0].power,offer);assert.equal(wave.defenders.length,1);assert.deepEqual(r.states.p1.resources,before.resources);assert.deepEqual(r.states.p1.army,before.army);assert.deepEqual(r.states.p1.orders,before.orders);
 assert.deepEqual(r.view('p1',at).influence,score);assert.equal(r.states.p1.cooperation,before.cooperation);assert.equal(r.states.p1.supportSentAt,at);
 assert.throws(()=>pledge(r,'p1',p,at),/confirmado/);assert.equal(r.shared.sanctuaryPacts[0].raids.waves[0].defenders.length,1);
});
test('Alliance members can defend; confirmed support survives departure, while newcomers gain no historical support credit',()=>{
 const r=realm();group(r);const p=active(r,'provisions','alliance'),at=p.completedAt;r.settle('p2',at);
 const expected=r.view('p2',at).supportOffer;pledge(r,'p2',p,at);r.act('p2',{type:'alliance_leave'},at+1);
 R.resolveSanctuaryRaids(r.shared,r.wave);const wave=r.shared.sanctuaryPacts[0].raids.waves[0];assert.equal(wave.outcome,'won');assert.equal(wave.defense,expected);assert(wave.recipients.includes('p2'));
 r.settle('p2',r.wave);assert.equal(r.states.p2.sanctuaryRaidReceipts.length,1);assert.equal(r.view('p2',r.wave).sanctuaryBonuses.provisions,0);
 assert.equal(r.states.p2.progression.feats.supports.length,0);assert.equal(r.states.p2.cooperation,0);
 r.act('p3',{type:'alliance_join',allianceId:r.states.p1.allianceId},r.wave+1);assert.equal(r.states.p3.sanctuaryRaidReceipts,undefined);
});
test('The existing help cooldown is shared and one kingdom cannot pledge to two towers in the same wave',()=>{
 const r=realm();group(r);const clan=active(r,'provisions','alliance'),solo=active(r,'defense','solo','sanctuary-2'),at=Math.max(clan.completedAt,solo.completedAt);
 pledge(r,'p1',clan,at);r.states.p1.supportSentAt=null;
 assert.throws(()=>pledge(r,'p1',solo,at+1),/outra torre/);
 r.states.p2.supportSentAt=at;assert.throws(()=>pledge(r,'p2',clan,at+1),/intervalo/);
 r.act('p1',{type:'support_request'},at);const request=r.shared.support[0];assert.throws(()=>r.act('p2',{type:'support_send',requestId:request.id},at+1),/uma vez por dia/);
});
test('A successful tower defense preserves the original deadline and produces one result without any extra combat damage',()=>{
 const r=realm(),p=active(r),at=p.completedAt;pledge(r,'p1',p,at);const before=JSON.stringify(r.states),until=p.until;
 R.resolveSanctuaryRaids(r.shared,r.wave);R.resolveSanctuaryRaids(r.shared,r.wave+1);
 const saved=r.shared.sanctuaryPacts[0];assert.equal(saved.raids.waves[0].outcome,'won');assert.equal(saved.until,until);assert.equal(saved.endedAt,undefined);assert.equal(JSON.stringify(r.states),before);
 r.settle('p1',r.wave);const count=r.states.p1.reports.filter(x=>x.title==='Torre protegida').length;assert.equal(count,1);r.settle('p1',r.wave+1);assert.equal(r.states.p1.reports.filter(x=>x.title==='Torre protegida').length,1);
 assert.equal(r.states.p1.sanctuaryPactReceipts[p.id],'completed');assert.equal(r.states.p1.progression.feats.supports.length,0);
});
test('Defeat ends only the consumed pact bonus, gives no refund, and permits another pact in its scope',()=>{
 const r=realm(),p=active(r),before=JSON.stringify(r.states),until=p.until;R.resolveSanctuaryRaids(r.shared,r.wave);
 const saved=r.shared.sanctuaryPacts[0];assert.equal(saved.endedAt,r.wave);assert.equal(saved.until,until);assert.equal(P.pactEffectiveUntil(saved),r.wave);assert.equal(JSON.stringify(r.states),before);
 r.settle('p1',r.wave);assert.equal(r.view('p1',r.wave).sanctuaryBonuses.provisions,0);assert.equal(r.states.p1.sanctuaryPactReceipts[p.id],'completed');
 const gold=r.states.p1.resources.gold;r.settle('p1',r.wave);assert.equal(r.states.p1.resources.gold,gold);assert.equal(r.states.p1.reports.filter(x=>x.title==='Sintonia interrompida pela horda').length,1);
 r.act('p1',{type:'sanctuary_pact_start',sanctuaryId:'sanctuary-2',kind:'provisions',scope:'solo'},r.wave+1);assert.equal(r.shared.sanctuaryPacts.length,2);
});
test('Offline production stops the supply benefit exactly at the lost wave, in bulk, stepwise and for a later-reading ally',()=>{
 for(const mode of ['classic','express']){
  const bulk=realm(mode),daily=realm(mode);group(bulk);group(daily);
  const bp=active(bulk,'provisions','alliance'),dp=active(daily,'provisions','alliance');bulk.settle('p2',bp.completedAt);daily.settle('p2',dp.completedAt);
  const end=bulk.wave+2*bulk.day;
  bulk.settle('p1',end);bulk.settle('p2',end);
  for(let at=dp.completedAt+daily.day;at<end;at+=daily.day){daily.settle('p1',at);daily.settle('p2',at);}daily.settle('p1',end);daily.settle('p2',end);
  for(const id of ['p1','p2'])for(const resource of ['gold','materials','supplies'])assert(Math.abs(bulk.states[id].resources[resource]-daily.states[id].resources[resource])<1e-6,`${mode}/${id}/${resource}`);
  assert.equal(bulk.states.p2.sanctuaryBenefits[0].until,bulk.wave);assert.equal(bulk.states.p2.sanctuaryRaidReceipts.length,1);
 }
});
test('A lost defense bonus is removed before the simultaneous normal horde, while alliance benefits can still cover it',()=>{
 for(const fallback of [false,true]){
  const r=realm(),p=active(r,'defense');r.states.p1.army={militia:3,shooters:0,scouts:0,machinery:0};r.states.p1.cities[0].sectors.defense=4;
  if(fallback){r.states.p1.allianceId='fallback';r.states.p1.allianceBenefits=[{projectId:'fallback',allianceId:'fallback',kind:'defense',from:p.completedAt,until:p.until}];r.shared.alliances.push({id:'fallback',name:'Fallback',founderId:'p1',members:['p1'],createdAt:p.completedAt});r.shared.allianceProjects=[{id:'fallback',allianceId:'fallback',kind:'defense',createdAt:p.completedAt,completedAt:p.completedAt,until:p.until,contributions:{}}];}
  assert.equal(r.view('p1',r.wave-1).defensePower,fallback?86:82);r.settle('p1',r.wave);
  assert.equal(r.states.p1.hordesWon,fallback?1:0);assert.equal(r.shared.sanctuaryPacts[0].endedAt,r.wave);
 }
});
test('Existing pacts without the explicit raid version remain protected from retroactive attacks',()=>{
 const r=realm(),p=active(r,'defense');delete r.shared.sanctuaryPacts[0].raids;
 r.settle('p1',r.wave);assert.equal(r.shared.sanctuaryPacts[0].endedAt,undefined);assert.equal(r.view('p1',r.wave).sanctuaryBonuses.defense,.1);assert.equal(r.view('p1',r.wave).sanctuaryThreats.length,0);
 assert.throws(()=>pledge(r,'p1',p,r.wave),/ameaça/);
});
test('Foreign and late support is rejected, and a dissolved alliance cancels rather than wins a tower encounter',()=>{
 const r=realm();group(r);const p=active(r,'provisions','alliance');
 assert.throws(()=>pledge(r,'p3',p,p.completedAt),/ameaça/);pledge(r,'p2',p,p.completedAt);
 r.act('p2',{type:'alliance_leave'},p.completedAt+1);r.act('p1',{type:'alliance_leave'},p.completedAt+2);
 R.resolveSanctuaryRaids(r.shared,r.wave);assert.equal(r.shared.sanctuaryPacts[0].raids.waves[0].outcome,'canceled');assert.equal(r.shared.sanctuaryPacts[0].endedAt,undefined);
 assert.throws(()=>pledge(r,'p2',p,r.wave),/ameaça/);
});
console.log(`PASS ${checks} tower-raid scenarios (existing waves/support values; no remote database).`);
