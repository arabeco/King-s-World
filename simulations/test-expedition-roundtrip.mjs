import assert from 'node:assert/strict';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const E=loadCozyEngine(),S=loadCozyEngine('settlement'),A=loadCozyEngine('expedition-army'),R=loadCozyEngine('exploration-route'),L=loadCozyEngine('battle-reward'),C=loadCozyEngine('player-campaign');
const now=1800000000000,world={id:'roundtrip',mode:'express',economyVersion:2,influenceVersion:2,status:'running',startsAt:now,combatMode:'competitive'};
function fixture(){
 const shared=E.createCozyShared(world),players=['a','b'].map((id,i)=>{
  const state=E.createCozyState(world,id,id,now);state.king={profileId:'builder',nickname:id,alive:true,generation:1,history:[]};
  Object.assign(state.cities[0],{q:-30+i*5,r:10});state.cities[0].sectors.defense=3;state.cities[0].sectors.recruitment=10;
  state.army={militia:i?5:100,shooters:0,scouts:0,machinery:0};state.resources={gold:1000,materials:10000,supplies:1000};
  shared.claims[`${state.cities[0].q},10`]={playerId:id,cityId:state.cities[0].id,name:state.cities[0].name};return {playerId:id,state,influence:0};
 });players[0].state.explored.push('-25,10');return {shared,players};
}
const action={type:'attack_player',q:-25,r:10};
{
 const f=fixture(),a=f.players[0],b=f.players[1],before=E.getCozyComputed(a.state,f.shared,world,now),supplies=a.state.resources.supplies;
 const quote=R.expeditionCost(a.state,action),travel=R.expeditionTravelMs(a.state,world,action);
 assert(R.expeditionCost(a.state,{q:-20,r:10})>quote);assert(R.expeditionTravelMs(a.state,world,{q:-20,r:10})>travel);
 const sent=E.applyCozyAction(a.state,f.shared,world,action,now);a.state=sent.state;f.shared=sent.shared;const out=a.state.orders.find(o=>o.targetPlayerId);
 assert.equal(a.state.resources.supplies,supplies-quote);assert.equal(out.arrivesAt,now+travel+C.PLAYER_ATTACK_PREPARATION_MS);assert.equal(out.returnTravelMs,travel);
 assert.equal(a.state.army.militia,100);assert.equal(A.committedTroops(a.state),0);assert.equal(A.empireArmy(a.state).militia,100);
 const away=E.getCozyComputed(a.state,f.shared,world,now);assert.equal(away.defensePower,before.defensePower);assert.equal(away.influence.military,before.influence.military,'Sending an army is not a loss of military influence');
 assert.throws(()=>E.applyCozyAction(a.state,f.shared,world,action,now),/andamento/);
 const bStock=structuredClone(b.state.resources),aGold=a.state.resources.gold,defenderInfrastructure=E.getCozyComputed(b.state,f.shared,world,now).influence.infrastructure;
 f.shared=S.settleWorld(f.players,f.shared,world,out.arrivesAt);const back=a.state.orders.find(o=>o.returning);assert(back);
 assert.equal(back.createdAt,out.arrivesAt);assert.equal(back.arrivesAt,out.arrivesAt+travel);assert.deepEqual(back.expeditionOrigin,{q:-25,r:10});assert.equal(back.q,-30);
 assert.equal(back.expeditionArmy,undefined);assert.equal(a.state.army.militia,94);assert.equal(A.committedTroops(a.state),0);
 assert.equal(back.cargo.gold,30);assert.equal(back.cargo.materials,120);assert.equal(a.state.resources.gold,aGold);assert.equal(b.state.resources.gold,bStock.gold-30);
 assert(a.state.reports.some(r=>r.body.includes('Saque em transporte')));assert(b.state.reports.some(r=>r.body.includes('Edifícios:')));
 const attackReport=a.state.reports.find(r=>r.battle),defenseReport=b.state.reports.find(r=>r.battle);
 assert.equal(attackReport.battle.troopsLost,6);assert.equal(attackReport.battle.delivery,'return');assert.equal(attackReport.battle.returnsAt,back.arrivesAt);assert.equal(attackReport.battle.resourceDelta.gold,30);
 assert.equal(defenseReport.battle.resourceDelta.gold,-30);assert.equal(defenseReport.battle.perspective,'defender');assert.equal(defenseReport.battle.infrastructureBefore,defenderInfrastructure);assert(defenseReport.battle.infrastructureAfter<defenseReport.battle.infrastructureBefore);
 assert.throws(()=>E.applyCozyAction(a.state,f.shared,world,action,out.arrivesAt),/andamento/);
 // Home recruits coexist with the surviving expedition; the return never overwrites them.
 a.state.army.militia+=3;
 f.shared=S.settleWorld(f.players,f.shared,world,back.arrivesAt-1);assert.equal(a.state.army.militia,97);
 f.shared=S.settleWorld(f.players,f.shared,world,back.arrivesAt);assert.equal(a.state.army.militia,97);assert.equal(a.state.resources.gold,aGold+30);assert.equal(A.committedTroops(a.state),0);
 const complete=structuredClone(f);f.shared=S.settleWorld(f.players,f.shared,world,back.arrivesAt);assert.deepEqual(f,complete,'No repeat return, cargo or troops');
 assert.deepEqual(a.state.reports.find(r=>r.battle).battle,attackReport.battle,'Historical numbers are unchanged after cargo delivery');
 assert.equal(E.applyCozyAction(a.state,f.shared,world,action,back.arrivesAt).state.army.militia,97,'New attack preserves the single army');
}
{
 const f=fixture(),a=f.players[0];a.state.army.militia=E.getCozyComputed(a.state,f.shared,world,now).armyCapacity;
 const sent=E.applyCozyAction(a.state,f.shared,world,action,now);assert.throws(()=>E.applyCozyAction(sent.state,sent.shared,world,{type:'recruit',troop:'militia',amount:1},now),/capacidade|vagas|lotado|completo/i);
}
{
 const f=fixture(),a=f.players[0],b=f.players[1];a.state.army.militia=1;b.state.army.militia=1000;const sent=E.applyCozyAction(a.state,f.shared,world,action,now);a.state=sent.state;f.shared=sent.shared;
 const at=a.state.orders.find(o=>o.targetPlayerId).arrivesAt,bGold=b.state.resources.gold;
 f.shared=S.settleWorld(f.players,f.shared,world,at);assert.equal(a.state.army.militia,0,'A losing one-unit raid cannot round its casualties to zero');assert.equal(b.state.resources.gold,bGold+30);assert.equal(a.state.resources.gold,970);
 assert.equal(a.state.reports.find(r=>r.battle).battle.resourceDelta.gold,-30);assert.equal(b.state.reports.find(r=>r.battle).battle.delivery,'credited');assert.equal(b.state.reports.find(r=>r.battle).battle.resourceDelta.gold,30);
}
for(const [gold,materials,expected] of [[0,0,{gold:0,materials:0}],[24,24,{gold:0,materials:0}],[100,500,{gold:4,materials:20}],[10000,10000,{gold:30,materials:120}]]){
 const f=fixture(),s=f.players[0].state;s.resources.gold=gold;s.resources.materials=materials;const loot=L.takeBattleLoot(s);assert.deepEqual(loot,expected);assert.equal(s.resources.gold+loot.gold,gold);assert.equal(s.resources.materials+loot.materials,materials);
}
{
 const f=fixture(),a=f.players[0],sent=E.applyCozyAction(a.state,f.shared,world,action,now);a.state=sent.state;f.shared=sent.shared;const out=a.state.orders.find(o=>o.targetPlayerId),bulk=structuredClone(f);
 f.shared=S.settleWorld(f.players,f.shared,world,out.arrivesAt);f.shared=S.settleWorld(f.players,f.shared,world,out.arrivesAt+out.returnTravelMs);
 bulk.shared=S.settleWorld(bulk.players,bulk.shared,world,out.arrivesAt+out.returnTravelMs);assert.deepEqual(bulk,f,'Offline catch-up resolves both combat and return exactly once');
}
console.log('PASS expedition roundtrip: distance, single army, unchanged home defense, stable influence, capacity, casualties, cargo conservation, return-only availability, replay and losing one-unit raid');
