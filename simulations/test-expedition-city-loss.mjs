import assert from 'node:assert/strict';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const E=loadCozyEngine(),S=loadCozyEngine('settlement'),C=loadCozyEngine('city-conquest'),R=loadCozyEngine('exploration-route'),A=loadCozyEngine('expedition-army'),P=loadCozyEngine('player-campaign');
const start=1800000000000,world={id:'expedition-edges',mode:'express',economyVersion:2,influenceVersion:2,status:'running',startsAt:start,combatMode:'competitive'};
function setup(){
 const shared=E.createCozyShared(world),players=['a','b','c'].map((id,i)=>{
  const state=E.createCozyState(world,id,id,start);state.king={profileId:'builder',nickname:id,alive:true,generation:1,history:[]};Object.assign(state.cities[0],{q:[-30,-25,-35][i],r:10});state.army={militia:i?5:100,shooters:0,scouts:0,machinery:0};state.resources={gold:1000,materials:10000,supplies:10000};
  shared.claims[`${state.cities[0].q},10`]={playerId:id,cityId:state.cities[0].id,name:state.cities[0].name};return {playerId:id,state,influence:0};
 });players[0].state.explored.push('-25,10');return {shared,players};
}
function addCity(f,player,q,id){const city={...structuredClone(player.state.cities[0]),q,id,capital:false,heroId:null,integrity:100};player.state.cities.push(city);f.shared.claims[`${q},10`]={playerId:player.playerId,cityId:id,name:city.name};return city;}
function capture(f,defender,city,at){const attacker=f.players[2];attacker.state.heroes.push({id:'occupier-'+city.id,name:'Occupier',role:'general',cityId:null});city.integrity=0;const result=C.conquerPlayerCity({attacker:attacker.state,defender:defender.state,shared:f.shared,world,cityId:city.id,heroId:'occupier-'+city.id,at,attackPower:1000,defensePower:1});attacker.state=result.attacker;defender.state=result.defender;f.shared=result.shared;return result;}
{
 const f=setup(),a=f.players[0];addCity(f,a,-32,'colony');addCity(f,a,-33,'last-city');
 const sent=E.applyCozyAction(a.state,f.shared,world,{type:'attack_player',q:-25,r:10},start);a.state=sent.state;f.shared=sent.shared;const out=a.state.orders.find(o=>o.targetPlayerId);
 capture(f,a,a.state.cities.find(c=>c.capital),start+1);assert.equal(a.state.capitalSelectionPending,true);assert.equal(a.state.army.militia,100);
 f.shared=S.settleWorld(f.players,f.shared,world,out.arrivesAt);let back=a.state.orders.find(o=>o.returning);assert(back);assert.equal(back.q,a.state.cities.find(c=>c.capital).q);assert.equal(back.arrivesAt,out.arrivesAt+out.returnTravelMs);
 const cargo=structuredClone(back.cargo),returnAt=back.arrivesAt;
 capture(f,a,a.state.cities.find(c=>c.capital),out.arrivesAt+1);back=a.state.orders.find(o=>o.returning);assert.equal(back.q,-33);assert.equal(back.arrivesAt,returnAt);assert.deepEqual(back.cargo,cargo);assert.equal(a.state.army.militia,94);
 const cArmy=f.players[2].state.army.militia;f.shared=S.settleWorld(f.players,f.shared,world,returnAt);assert.equal(a.state.army.militia,94);assert.equal(A.committedTroops(a.state),0);assert.equal(f.players[2].state.army.militia,cArmy,'Capturing the departure city never captures an unrelated returning army');
}
{
 const f=setup(),a=f.players[0],sent=E.applyCozyAction(a.state,f.shared,world,{type:'attack_player',q:-25,r:10},start);a.state=sent.state;f.shared=sent.shared;const out=a.state.orders.find(o=>o.targetPlayerId);
 f.shared=S.settleWorld(f.players,f.shared,world,out.arrivesAt);const back=a.state.orders.find(o=>o.returning);assert(back);capture(f,a,a.state.cities[0],out.arrivesAt+1);assert(a.state.defeat);assert.equal(a.state.orders.length,0);
 const gold=a.state.resources.gold;f.shared=S.settleWorld(f.players,f.shared,world,back.arrivesAt+1);assert.equal(a.state.army.militia,0);assert.equal(a.state.resources.gold,gold);assert.equal(a.state.cities.length,0,'An eliminated kingdom cannot return or resurrect through an old order');
}
{
 const f=setup(),a=f.players[0],end=start+30*86400000,travel=R.expeditionTravelMs(a.state,world,{q:-25,r:10}),sendAt=end-2*travel-P.PLAYER_ATTACK_PREPARATION_MS;
 for(const p of f.players){p.state.settledAt=sendAt;p.state.hordesResolved=[5,10,15,20,25,28];for(const city of p.state.cities)city.life={contentment:70,lastDecisionDay:null,lastSocialDay:30,unrestDays:0};}
 const before=structuredClone(f);assert.throws(()=>E.applyCozyAction(a.state,f.shared,world,{type:'attack_player',q:-25,r:10},sendAt+1),/retornar/);assert.deepEqual(f,before,'A rejected late departure changes nothing');
 const sent=E.applyCozyAction(a.state,f.shared,world,{type:'attack_player',q:-25,r:10},sendAt);a.state=sent.state;f.shared=sent.shared;const gold=a.state.resources.gold;
 f.shared=S.settleWorld(f.players,f.shared,world,end);assert.equal(a.state.orders.length,0);assert.equal(a.state.army.militia,94);assert.equal(a.state.resources.gold,gold+30);assert.equal(a.state.finalizedAt,end);
 const final=structuredClone(f);f.shared=S.settleWorld(f.players,f.shared,world,end+86400000);assert.deepEqual(f,final,'Finalization never delivers the same cargo or army twice');
}
console.log('PASS expedition edges: departure city lost outbound/return, capital replacement, preserved troop/cargo/time ownership, elimination with cargo and exact final-second delivery');
