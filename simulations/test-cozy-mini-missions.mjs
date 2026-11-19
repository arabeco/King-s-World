import assert from 'node:assert/strict';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const E=loadCozyEngine(),{miniMissionOffer,MISSION_WINDOW_MS}=loadCozyEngine('mini-missions');
const {settleWorld}=loadCozyEngine('settlement');
const start=1800000000000;
const world={id:'mini',name:'Vale',mode:'express',economyVersion:3,influenceVersion:2,status:'running',startsAt:start,persistent:true};
function setup(){return {state:E.createCozyState(world,'player','Teste',start),shared:E.createCozyShared(world)};}
{
 let {state,shared}=setup();
 const offer=miniMissionOffer(state,world,start);assert(offer);
 const army=structuredClone(state.army),cities=structuredClone(state.cities);
 ({state,shared}=E.settleCozyState(state,shared,world,start+30*MISSION_WINDOW_MS));
 assert.deepEqual(state.army,army);assert.deepEqual(state.cities.map(c=>c.sectors),cities.map(c=>c.sectors));
 assert.equal(state.orders.filter(o=>o.miniMission).length,0);
 assert.equal(miniMissionOffer(state,world,start+30*MISSION_WINDOW_MS).cycle,30);
}
{
 let {state,shared}=setup();const offer=miniMissionOffer(state,world,start);
 const before=structuredClone(state.resources);
 ({state,shared}=E.applyCozyAction(state,shared,world,{type:'mini_mission',id:offer.id,accept:false},start));
 assert.equal(miniMissionOffer(state,world,start),null);assert.deepEqual(state.resources,before);
 assert.throws(()=>E.applyCozyAction(state,shared,world,{type:'mini_mission',id:offer.id,accept:true},start));
 assert(miniMissionOffer(state,world,start+MISSION_WINDOW_MS));
}
for(const [militia,won] of [[10,false],[500,true]]){
 let {state,shared}=setup();state.army={militia,shooters:0,scouts:0,machinery:0};
 const offer=miniMissionOffer(state,world,start),before=state.resources.supplies;
 ({state,shared}=E.applyCozyAction(state,shared,world,{type:'mini_mission',id:offer.id,accept:true},start));
 assert.equal(state.resources.supplies,before-offer.suppliesCost);
 const order=state.orders.find(o=>o.miniMission);assert(order);
 assert.throws(()=>E.applyCozyAction(state,shared,world,{type:'mini_mission',id:offer.id,accept:true},start));
 const first=E.settleCozyState(state,shared,world,order.arrivesAt);
 assert.equal(first.state.orders.some(o=>o.miniMission),false);
 const report=first.state.reports.find(r=>r.kind==='combat'&&r.title.includes(offer.title));
 assert.equal(report.positive,won);assert(first.state.army.militia<militia);
 assert.deepEqual(E.settleCozyState(first.state,first.shared,world,order.arrivesAt),first);
 if(won)assert(first.state.resources.gold>=state.resources.gold+offer.reward.gold);
}
{
 const {state,shared}=setup(),offer=miniMissionOffer(state,world,start);
 assert.throws(()=>E.applyCozyAction(state,shared,world,{type:'mini_mission',id:'mission:999',accept:true},start));
 state.resources.supplies=0;
 assert.throws(()=>E.applyCozyAction(state,shared,world,{type:'mini_mission',id:offer.id,accept:true},start));
 state.resources.supplies=100;
 state.orders.push({id:'busy',kind:'attack',createdAt:start,arrivesAt:start+1000});
 assert.throws(()=>E.applyCozyAction(state,shared,world,{type:'mini_mission',id:offer.id,accept:true},start));
}
{
 let {state,shared}=setup();state.army.militia=500;
 const offer=miniMissionOffer(state,world,start);
 ({state,shared}=E.applyCozyAction(state,shared,world,{type:'mini_mission',id:offer.id,accept:true},start));
 const arrival=state.orders.find(o=>o.miniMission).arrivesAt;
 const other=E.createCozyState(world,'other','Outro',start);
 const players=[{playerId:state.playerId,state,influence:0},{playerId:other.playerId,state:other,influence:0}];
 shared=settleWorld(players,shared,world,arrival);
 assert.equal(players[0].state.reports.filter(r=>r.kind==='combat'&&r.title.includes(offer.title)).length,1);
 assert.equal(players[1].state.reports.filter(r=>r.kind==='combat'&&r.title.includes(offer.title)).length,0);
 const next=settleWorld(players,shared,world,arrival);
 assert.deepEqual(next,shared);
 assert.equal(players[0].state.reports.filter(r=>r.kind==='combat'&&r.title.includes(offer.title)).length,1);
}
console.log('PASS mini missões: expiração segura, recusa, custo, exército ocupado, vitória, derrota e resolução única');
