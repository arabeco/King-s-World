import assert from 'node:assert/strict';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const E=loadCozyEngine(),{wonderPlan}=loadCozyEngine('legacy-objectives');
const START=1800000000000,DAY=86400000;
const world={id:'sanctuary-test',name:'Torres',mode:'classic',status:'running',startsAt:START,influenceVersion:2};
const setup=(w=world)=>E.settleCozyState(E.createCozyState(w,'king','Rei',START),E.createCozyShared(w),w,START);
const view=(s,at=START,w=world)=>E.getCozyComputed(s.state,s.shared,w,at);
const act=(s,a,at=START,w=world)=>E.applyCozyAction(s.state,s.shared,w,a,at);
const settle=(s,at,w=world)=>E.settleCozyState(s.state,s.shared,w,at);
let checks=0;const test=(name,fn)=>{fn();checks++;console.log('PASS',name);};
test('All seven towers use the existing distance, supply and travel quotes',()=>{
 for(const mode of ['classic','express']){
  const w={...world,mode},s=setup(w),v=view(s,START,w);
  // The map now returns visible cells only; survey the test coordinates first.
  s.state.explored=v.sanctuaries.map(t=>`${t.q},${t.r}`);
  const tiles=E.getCozyTiles(s.state,s.shared,w);
  assert.equal(v.sanctuaries.length,7);
  for(const tower of v.sanctuaries){const tile=tiles.find(t=>t.q===tower.q&&t.r===tower.r);assert(tile);assert.equal(tower.supplyCost,tile.exploreCost);assert.equal(tower.travelMs,tile.travelMs);assert.equal(tower.visitedAt,null);}
 }
});
test('Recognition charges once, arrives later and survives repeated settlement without awarding influence',()=>{
 for(const mode of ['classic','express']){
  const w={...world,mode},s=setup(w),tower=view(s,START,w).sanctuaries.sort((a,b)=>a.supplyCost-b.supplyCost)[0],copy=JSON.stringify(s);
  const sent=act(s,{type:'sanctuary_explore',sanctuaryId:tower.id},START,w),order=sent.state.orders[0];
  assert.equal(JSON.stringify(s),copy);assert.equal(sent.state.resources.supplies,s.state.resources.supplies-tower.supplyCost);assert.equal(order.arrivesAt,START+tower.travelMs);assert.equal(order.kind,'explore');
  assert.equal(sent.state.sanctuaryVisits,undefined);
  assert.equal(settle(sent,order.arrivesAt-1,w).state.sanctuaryVisits,undefined);
  const done=settle(sent,order.arrivesAt,w),control=settle(s,order.arrivesAt,w);
  assert.equal(done.state.sanctuaryVisits[tower.id],order.arrivesAt);assert.equal(done.state.orders.length,0);
  assert.deepEqual(done.state.explored,control.state.explored);assert.equal(done.state.cooperation,control.state.cooperation);
  assert.deepEqual(done.state.progression.feats,control.state.progression.feats);assert.deepEqual(view(done,order.arrivesAt,w).influence,view(control,order.arrivesAt,w).influence);
  const again=settle(done,order.arrivesAt+1,w);assert.equal(again.state.reports.filter(r=>r.title==='Torre reconhecida').length,1);
  assert.equal(again.state.sanctuaryVisits[tower.id],order.arrivesAt);
 }
});
test('Unknown, repeated and overlapping expeditions are rejected without mutating a save',()=>{
 const s=setup(),tower=view(s).sanctuaries[0];s.state.resources.supplies=10000;
 const original=JSON.stringify(s);assert.throws(()=>act(s,{type:'sanctuary_explore',sanctuaryId:'forged'}),/Torre/);assert.equal(JSON.stringify(s),original);
 const sent=act(s,{type:'sanctuary_explore',sanctuaryId:tower.id});assert.throws(()=>act(sent,{type:'sanctuary_explore',sanctuaryId:tower.id}),/exploração/);
 const done=settle(sent,sent.state.orders[0].arrivesAt);assert.throws(()=>act(done,{type:'sanctuary_explore',sanctuaryId:tower.id},done.state.settledAt),/reconhecida/);
});
test('Tower actions respect supplies, open worlds, closure and the season deadline',()=>{
 const s=setup(),tower=view(s).sanctuaries[0];s.state.resources.supplies=0;
 assert.throws(()=>act(s,{type:'sanctuary_explore',sanctuaryId:tower.id}),/suprimentos|alimento/i);
 for(const status of ['open','finalized']){const w={...world,status,startsAt:status==='open'?null:START};assert.throws(()=>act(setup(w),{type:'sanctuary_explore',sanctuaryId:tower.id},START,w),/início|terminou/);}
 const full=setup();full.state.resources.supplies=10000;assert.throws(()=>act(full,{type:'sanctuary_explore',sanctuaryId:tower.id},START+DAY*120-1),/tempo para concluir/);
});
test('A peaceful tower visit cannot alter legacy claims, deposits or an old influence model',()=>{
 const w={...world,influenceVersion:1},s=setup(w),tower=view(s,START,w).sanctuaries[0];s.state.resources.supplies=10000;
 s.shared.claims[`${tower.q},${tower.r}`]={playerId:'neighbor',cityId:'old-city',name:'Cidade preservada'};
 const sent=act(s,{type:'sanctuary_explore',sanctuaryId:tower.id},START,w),at=sent.state.orders[0].arrivesAt,done=settle(sent,at,w),control=settle(s,at,w);
 assert.deepEqual(done.shared,control.shared);assert.equal(done.state.progression,undefined);assert.deepEqual(view(done,at,w).influence,view(control,at,w).influence);
});
test('Wonder planning selects the closest eligible city without building or spending',()=>{
 const s=setup(),base=s.state.cities[0];
 const candidate={...structuredClone(base),id:'advanced',capital:false,sectors:Object.fromEntries(Object.keys(base.sectors).map(k=>[k,8]))};
 const built={...structuredClone(candidate),id:'built',wonder:true,sectors:Object.fromEntries(Object.keys(base.sectors).map(k=>[k,10]))};s.state.cities.push(built,candidate);
 const before=JSON.stringify(s),plan=wonderPlan(s.state,8000);assert.equal(plan.city.id,'advanced');assert.equal(plan.development,80);assert.equal(plan.completedSectors,0);assert.equal(plan.missingMaterials,8000-s.state.resources.materials);assert.equal(JSON.stringify(s),before);
 for(const city of s.state.cities)city.wonder=true;assert.equal(wonderPlan(s.state,8000),null);
});
test('The third constructed wonder cannot promise or award points beyond the existing two-wonder cap',()=>{
 let s=setup();s.state.resources.materials=100000;
 for(let i=0;i<3;i++){
  const city={...structuredClone(s.state.cities[0]),id:`wonder-${i}`,q:i,r:5,capital:false,wonder:false,sectors:Object.fromEntries(Object.keys(s.state.cities[0].sectors).map(k=>[k,10]))};s.state.cities.push(city);
  s=act(s,{type:'wonder',cityId:city.id});
 }
 assert.equal(view(s).influenceDetails.conquests.wonderPoints,120);
 assert(s.state.reports.find(r=>r.body.includes('teto de reconhecimento')));
});
console.log(`PASS ${checks} sanctuary and wonder scenarios.`);
