import assert from 'node:assert/strict';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const E=loadCozyEngine(),S=loadCozyEngine('settlement'),P=loadCozyEngine('player-campaign'),R=loadCozyEngine('exploration-route');
const now=1800000000000,world={id:'one-army',mode:'express',economyVersion:2,influenceVersion:2,status:'running',startsAt:now,combatMode:'competitive'};
function setup(){const shared=E.createCozyShared(world),players=['a','b'].map((id,i)=>{
 const state=E.createCozyState(world,id,id,now);state.king={profileId:'builder',nickname:id,alive:true,generation:1,history:[],attributes:{administration:5,command:10,exploration:5}};Object.assign(state.cities[0],{q:-30+i*5,r:10});state.army={militia:100,shooters:0,scouts:0,machinery:0};state.resources={gold:1000,materials:10000,supplies:10000};state.explored.push(i?'-30,10':'-25,10');shared.claims[`${state.cities[0].q},10`]={playerId:id,cityId:state.cities[0].id,name:state.cities[0].name};return {playerId:id,state,influence:0};
 });return {shared,players};}
{
 const f=setup(),a=f.players[0],target={q:-25,r:10};
 const base=P.playerCampaign(a.state,world,target);
 a.state.research.exploration=5;a.state.king.attributes.exploration=10;
 a.state.king.equipment=['item-road-map','item-cartographer-divider','item-travel-compass'];
 for(let i=0;i<4;i++){
  const city=i===0?a.state.cities[0]:{...structuredClone(a.state.cities[0]),id:'exploration-city-'+i,capital:false,q:-30-i};
  if(i)a.state.cities.push(city);city.heroId='explorer-'+i;
  a.state.heroes.push({id:city.heroId,name:'Explorer',role:'explorer',cityId:city.id});
 }
 const boosted=P.playerCampaign(a.state,world,target),travel=R.expeditionTravelMs(a.state,world,target);
 assert(travel<base.returnMs);assert.equal(boosted.preparationMs,12*3600000);
 assert.equal(boosted.arrivalMs,12*3600000+travel);assert.equal(boosted.totalMs,12*3600000+2*travel);
 assert(boosted.arrivalMs>12*3600000,'Travel bonuses cannot remove the response window');
 assert.equal(boosted.supplies,R.expeditionCost(a.state,target));
 const gold=a.state.resources.gold,supplies=a.state.resources.supplies;
 const sent=E.applyCozyAction(a.state,f.shared,world,{type:'attack_player',...target},now),order=sent.state.orders.find(o=>o.targetPlayerId);
 assert.equal(order.arrivesAt,now+boosted.arrivalMs);assert.equal(order.returnTravelMs,boosted.returnMs);
 assert.equal(sent.state.resources.supplies,supplies-boosted.supplies);assert.equal(sent.state.resources.gold,gold);
 assert.equal(R.expeditionTravelMs(a.state,world,target),travel,'Preparation belongs to PvP only, not exploration');
}
{
 const f=setup(),a=f.players[0],b=f.players[1];a.state.research.military=5;
 for(let i=0;i<10;i++){const city=i===0?a.state.cities[0]:{...structuredClone(a.state.cities[0]),id:'assigned-'+i,capital:false,r:i};if(i)a.state.cities.push(city);city.heroId='g'+i;a.state.heroes.push({id:'g'+i,role:'general',name:'General',cityId:city.id});}
 const before=E.getCozyComputed(a.state,f.shared,world,now);assert.equal(before.armyPower,280,'Ten generals still use the existing five-general cap');assert.equal(before.playerAttackPower,308,'Research, general cap and command each enter once');
 a.state.hordesWon=6;a.state.progression.council.merit=500;a.state.quests=['city'];const higher=E.getCozyComputed(a.state,f.shared,world,now);assert(higher.influence.total>before.influence.total);assert.equal(higher.playerAttackPower,before.playerAttackPower);assert.equal(higher.defensePower,before.defensePower,'Influence is never a second power multiplier');
 b.state.cities[0].sectors.defense=3;const fortified=E.getCozyComputed(b.state,f.shared,world,now);assert(fortified.defensePower>fortified.playerAttackPower,'Fortifications give the defender an advantage without using total influence');
 const sent=E.applyCozyAction(a.state,f.shared,world,{type:'attack_player',q:-25,r:10,amount:1},now);a.state=sent.state;f.shared=sent.shared;assert.equal(a.state.army.militia,100);assert.equal(a.state.orders[0].expeditionArmy,undefined);assert.equal(a.state.orders[0].abstractAttack,true);assert.equal(E.getCozyComputed(a.state,f.shared,world,now).defensePower,higher.defensePower);
 f.shared=S.settleWorld(f.players,f.shared,world,a.state.orders[0].arrivesAt);assert.equal(a.state.reports.find(r=>r.battle).battle.attackPower,308);assert.equal(a.state.army.militia,94,'The whole army participates regardless of an injected amount');
}
{
 const f=setup();for(const p of f.players){const target=p.playerId==='a'?{q:-25,r:10}:{q:-30,r:10};const sent=E.applyCozyAction(p.state,f.shared,world,{type:'attack_player',...target},now);p.state=sent.state;f.shared=sent.shared;assert.equal(p.state.army.militia,100);}
 const boundary=Math.max(...f.players.flatMap(p=>p.state.orders.map(o=>o.arrivesAt)));f.shared=S.settleWorld(f.players,f.shared,world,boundary);
 for(const p of f.players){assert(p.state.army.militia<100&&p.state.army.militia>0);assert.equal(p.state.reports.filter(r=>r.battle).length,2);assert.equal(p.state.orders.filter(o=>o.returning).length,1);}
 const armies=f.players.map(p=>p.state.army.militia),back=Math.max(...f.players.flatMap(p=>p.state.orders.map(o=>o.arrivesAt)));f.shared=S.settleWorld(f.players,f.shared,world,back);assert.deepEqual(f.players.map(p=>p.state.army.militia),armies,'Cross-attacks cannot recreate casualties on return');
}
for(const returning of [false,true]){
 const f=setup(),a=f.players[0];a.state.army.militia=3;
 const legacy={id:'old',kind:'attack',createdAt:now,arrivesAt:now+3600000,q:returning?-30:-25,r:10,expeditionArmy:{militia:94,shooters:0,scouts:0,machinery:0},expeditionOrigin:{q:returning?-25:-30,r:10},returnTravelMs:3600000,...(returning?{returning:true,cargo:{gold:10,materials:20}}:{targetPlayerId:'b',targetCityId:f.players[1].state.cities[0].id})};a.state.orders.push(legacy);
 const before=E.getCozyComputed(a.state,f.shared,world,now).influence.military;
 f.shared=S.settleWorld(f.players,f.shared,world,now);assert.equal(a.state.army.militia,97);assert.equal(a.state.orders[0].expeditionArmy,undefined);assert.equal(a.state.orders[0].abstractAttack,true);assert.equal(E.getCozyComputed(a.state,f.shared,world,now).influence.military,before);
 const restored=structuredClone(f);f.shared=S.settleWorld(f.players,f.shared,world,now);assert.deepEqual(f,restored,'Migration restores the old reserved army exactly once');
 const gold=a.state.resources.gold;f.shared=S.settleWorld(f.players,f.shared,world,now+7200000);assert(a.state.army.militia<=97);assert.equal(a.state.orders.length,0);if(returning){assert.equal(a.state.army.militia,97);assert.equal(a.state.resources.gold,gold+10);}
}
console.log('PASS single-army combat: full army, unchanged defense, no amount selection, one application of king/research/general bonuses, influence excluded, fortification advantage, crossed attacks and old-save migration without duplication');
