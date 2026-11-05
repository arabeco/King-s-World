import assert from 'node:assert/strict';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const E=loadCozyEngine(),P=loadCozyEngine('sanctuary-pacts');
const START=1800000000000,DAY=86400000;
function realm(mode='classic'){
 const w={id:'guardians',name:'Guardiões',status:'running',mode,startsAt:START,influenceVersion:2};let shared=E.createCozyShared(w);const states={};
 for(const id of ['p1','p2']){const s=E.settleCozyState(E.createCozyState(w,id,id,START),shared,w,START);shared=s.shared;states[id]=s.state;states[id].resources={gold:10000,materials:10000,supplies:10000};states[id].sanctuaryVisits={'sanctuary-1':START};}
 return {w,states,get shared(){return shared;},act(id,action,at=START){const s=E.applyCozyAction(states[id],shared,w,action,at);states[id]=s.state;shared=s.shared;return s;},settle(id,at){const s=E.settleCozyState(states[id],shared,w,at);states[id]=s.state;shared=s.shared;return s;},view(id,at=START){return E.getCozyComputed(states[id],shared,w,at);}};
}
function funded(r,scope='solo'){
 r.act('p1',{type:'sanctuary_pact_start',sanctuaryId:'sanctuary-1',kind:'defense',scope,guardianPower:0});const id=r.shared.sanctuaryPacts.at(-1).id;
 for(const resource of ['materials','supplies'])r.act('p1',{type:'sanctuary_pact_contribute',pactId:id,resource,amount:'max'});return id;
}
const army=r=>{r.states.p1.army={militia:250,shooters:0,scouts:0,machinery:0};};
let checks=0;function test(name,fn){fn();checks++;console.log('PASS',name);}
test('New pacts snapshot authoritative guardian power and do not activate or consume recognition at funding',()=>{
 const r=realm(),id=funded(r),p=r.shared.sanctuaryPacts[0];assert.equal(p.guardian.power,r.view('p1').sanctuaries[1].guardianPower);assert(p.guardian.power>0);assert.equal(p.completedAt,null);assert(P.pactFunded(p));assert.equal(r.view('p1').sanctuaryBonuses.defense,0);assert.equal(r.states.p1.sanctuaryPactReceipts?.[id],undefined);
});
test('Victory at arrival applies partial NPC losses and starts the buff exactly once, in both rhythms',()=>{
 for(const mode of ['classic','express']){
  const r=realm(mode);army(r);const id=funded(r),before=structuredClone(r.states.p1),quote=r.view('p1').sanctuaries.find(t=>t.id==='sanctuary-1');
  r.act('p1',{type:'sanctuary_pact_challenge',pactId:id});const order=r.states.p1.orders[0];assert.equal(order.arrivesAt,START+quote.travelMs);assert.equal(r.states.p1.resources.supplies,before.resources.supplies-quote.supplyCost);
  r.settle('p1',order.arrivesAt-1);assert.equal(r.shared.sanctuaryPacts[0].completedAt,null);
  r.settle('p1',order.arrivesAt);const p=r.shared.sanctuaryPacts[0],attempt=p.guardian.attempts[0];assert.equal(attempt.outcome,'won');assert(attempt.losses>0&&attempt.losses<250);assert.equal(p.completedAt,order.arrivesAt);assert.equal(r.view('p1',order.arrivesAt).sanctuaryBonuses.defense,.1);
  assert.equal(r.states.p1.sanctuaryPactReceipts[id],'completed');assert.deepEqual(r.states.p1.explored,before.explored);assert.deepEqual(r.states.p1.raided,before.raided);assert.equal(r.view('p1',order.arrivesAt).influence.legacy,0);
  const until=p.until,afterArmy=structuredClone(r.states.p1.army);r.states.p1.orders.push(order);r.settle('p1',order.arrivesAt+1);assert.equal(r.shared.sanctuaryPacts[0].until,until);assert.deepEqual(r.states.p1.army,afterArmy);
 }
});
test('Defeat preserves funded reservations, damages no city and permits a paid retry',()=>{
 const r=realm(),id=funded(r),city=structuredClone(r.states.p1.cities[0]),reserves=structuredClone(r.shared.sanctuaryPacts[0].contributions);
 r.act('p1',{type:'sanctuary_pact_challenge',pactId:id});const at=r.states.p1.orders[0].arrivesAt;r.settle('p1',at);
 const p=r.shared.sanctuaryPacts[0];assert.equal(p.guardian.attempts[0].outcome,'lost');assert.equal(p.completedAt,null);assert.deepEqual(p.contributions,reserves);assert.equal(r.states.p1.cities[0].integrity??100,city.integrity??100);assert.deepEqual(r.states.p1.cities[0].sectors,city.sectors);assert.equal(r.states.p1.hordesWon,0);assert.equal(r.view('p1',at).influence.legacy,0);
 army(r);r.act('p1',{type:'sanctuary_pact_challenge',pactId:id},at);assert.equal(r.shared.sanctuaryPacts[0].guardian.attempts.length,2);
});
test('A canceled pact or departing champion ends the encounter without combat or city damage',()=>{
 for(const leave of [false,true]){
  const r=realm();army(r);if(leave){r.act('p1',{type:'alliance_create',name:'Guarda'});r.act('p2',{type:'alliance_join',allianceId:r.states.p1.allianceId});r.states.p2.army={militia:250,shooters:0,scouts:0,machinery:0};}
  const id=funded(r,leave?'alliance':'solo'),actor=leave?'p2':'p1';r.act(actor,{type:'sanctuary_pact_challenge',pactId:id});const at=r.states[actor].orders[0].arrivesAt;
  r.act(actor,leave?{type:'alliance_leave'}:{type:'sanctuary_pact_cancel',pactId:id},START+1);r.settle(actor,at);
  const attempt=r.shared.sanctuaryPacts[0].guardian.attempts[0];assert.equal(attempt.outcome,'canceled');assert.equal(attempt.losses,0);assert.equal(r.states[actor].army.militia,250);assert.equal(r.shared.sanctuaryPacts[0].completedAt,null);
 }
});
test('Unfunded, foreign, unrecognized, empty-army and simultaneous challenges are rejected',()=>{
 const r=realm();r.act('p1',{type:'sanctuary_pact_start',sanctuaryId:'sanctuary-1',kind:'defense',scope:'solo'});let id=r.shared.sanctuaryPacts[0].id;
 assert.throws(()=>r.act('p1',{type:'sanctuary_pact_challenge',pactId:id}),/reservas/);
 for(const resource of ['materials','supplies'])r.act('p1',{type:'sanctuary_pact_contribute',pactId:id,resource,amount:'max'});
 assert.throws(()=>r.act('p2',{type:'sanctuary_pact_challenge',pactId:id}),/disponível/);
 const before=JSON.stringify(r.states.p1);delete r.states.p1.sanctuaryVisits;assert.throws(()=>r.act('p1',{type:'sanctuary_pact_challenge',pactId:id}),/Reconheça/);r.states.p1=JSON.parse(before);
 r.states.p1.army={militia:0,shooters:0,scouts:0,machinery:0};assert.throws(()=>r.act('p1',{type:'sanctuary_pact_challenge',pactId:id}),/Recrute/);army(r);
 r.act('p1',{type:'sanctuary_pact_challenge',pactId:id});assert.throws(()=>r.act('p1',{type:'sanctuary_pact_challenge',pactId:id}),/expedição/);
});
test('A challenge requires arrival strictly before the season deadline',()=>{
 const r=realm();army(r);const id=funded(r),quote=r.view('p1').sanctuaries.find(t=>t.id==='sanctuary-1'),at=START+120*DAY-quote.travelMs;
 assert.throws(()=>r.act('p1',{type:'sanctuary_pact_challenge',pactId:id},at),/tempo/);
});
console.log(`PASS ${checks} guardian scenarios.`);
