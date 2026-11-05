import assert from 'node:assert/strict';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const E=loadCozyEngine(),S=loadCozyEngine('settlement'),P=loadCozyEngine('player-combat');
const start=1800000000000;
const world={id:'multi-arrival',mode:'express',economyVersion:2,influenceVersion:2,status:'running',startsAt:start,combatMode:'competitive'};
const positions=[[-30,10],[-25,5],[-20,5],[-20,10],[-25,10]];
function setup(integrity=100){
 let shared=E.createCozyShared(world);
 const players=['a','b','c','d','target'].map((playerId,i)=>{
  const state=E.createCozyState(world,playerId,playerId,start),city=state.cities[0];
  Object.assign(city,{q:positions[i][0],r:positions[i][1],integrity:i===4?integrity:100});
  city.sectors.recruitment=4;city.sectors.economy=4;
  state.king={profileId:'builder',nickname:playerId,alive:true,generation:1,history:[],attributes:{administration:5,command:5,exploration:5}};
  state.resources={gold:350,materials:1800,supplies:500};
  state.army={militia:i===4?20:300,shooters:0,scouts:0,machinery:0};
  state.heroes=[{id:playerId+'-hero',name:'Occupier',cityId:null,role:'general'}];
  if(i!==4)state.explored.push('-25,10');
  shared.claims[`${city.q},${city.r}`]={playerId,cityId:city.id,name:city.name};
  return {playerId,state,influence:0};
 });
 const defender=players.at(-1),colony={...structuredClone(defender.state.cities[0]),id:'surviving-colony',q:-23,capital:false,integrity:100};
 defender.state.cities.push(colony);shared.claims[`${colony.q},${colony.r}`]={playerId:'target',cityId:colony.id,name:colony.name};
 for(const actor of players.slice(0,4)){
  const sent=E.applyCozyAction(actor.state,shared,world,{type:'attack_player',q:-25,r:10,conquest:true,heroId:actor.playerId+'-hero'},start);
  actor.state=sent.state;shared=sent.shared;
 }
 return {players,shared};
}
const snapshot=f=>({shared:f.shared,players:[...f.players].sort((a,b)=>a.playerId.localeCompare(b.playerId))});
for(const integrity of [100,25]){
 let expected;
 for(const order of [[0,1,2,3,4],[4,3,2,1,0],[2,4,0,3,1]]){
  const f=setup(integrity),defender=f.players.at(-1),cityId=defender.state.cities[0].id;
  assert.equal(P.incomingPlayerAttacks(f.players,defender.state,start).length,4);
  for(const actor of f.players.slice(0,4))assert.equal(P.incomingPlayerAttacks(f.players,actor.state,start).length,0,'Other attackers cannot inspect the victim route list');
  f.players=order.map(i=>f.players[i]);
  const boundary=Math.max(...f.players.flatMap(p=>p.state.orders.map(o=>o.arrivesAt)));
  f.shared=S.settleWorld(f.players,f.shared,world,boundary);
  const winner=f.shared.claims['-25,10'].playerId;
  assert.equal(winner,integrity===100?'d':'a','Equal arrivals use stable order; only one empire captures the city');
  assert.equal(f.players.flatMap(p=>p.state.cities).filter(c=>c.id===cityId).length,1);
  assert.equal(defender.state.cities.length,1);assert(defender.state.capitalSelectionPending);
  const battles=defender.state.reports.filter(r=>r.battle);
  assert.equal(battles.length,integrity===100?4:1);
  assert.equal(battles.filter(r=>r.battle.conquered).length,1);
  assert(battles.every(r=>r.battle.infrastructureAfter<=r.battle.infrastructureBefore));
  for(const actor of f.players.filter(p=>p.playerId!=='target')){
   assert.equal(actor.state.orders.length,1);assert(actor.state.orders[0].returning);
   assert.equal(actor.state.army.militia,integrity===25&&actor.playerId!=='a'?300:282,'Only resolved battles cause casualties');
   assert(Object.values(actor.state.resources).every(n=>n>=0));
  }
  const once=structuredClone(snapshot(f));f.shared=S.settleWorld(f.players,f.shared,world,boundary);assert.deepEqual(snapshot(f),once,'Same boundary never repeats damage, capture or loot');
  const cargo=f.players.reduce((sum,p)=>sum+(p.state.orders[0]?.cargo?.gold??0),0),gold=f.players.reduce((sum,p)=>sum+p.state.resources.gold,0);
  assert.equal(gold+cargo,5*350,'Combat transfers gold, never creates it');
  const armies=f.players.map(p=>[p.playerId,structuredClone(p.state.army)]),back=Math.max(...f.players.flatMap(p=>p.state.orders.map(o=>o.arrivesAt)));
  f.shared=S.settleWorld(f.players,f.shared,world,back);
  assert(f.players.every(p=>!p.state.orders.length));assert.deepEqual(f.players.map(p=>[p.playerId,p.state.army]),armies);
  assert.equal(f.players.reduce((sum,p)=>sum+p.state.resources.gold,0),5*350);
  const final=snapshot(f);if(expected)assert.deepEqual(final,expected,'Input player ordering does not change the winner, resources or reports');else expected=structuredClone(final);
 }
}
console.log('PASS simultaneous attackers: stable settlement, four warnings, private routes, one owner/capture, abort after ownership change, real casualties once, conserved gold/cargo, capital recovery and idempotent return across three player permutations');
