import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const E=loadCozyEngine(),S=loadCozyEngine('settlement'),R=loadCozyEngine('exploration-route'),P=loadCozyEngine('player-campaign');
const start=1800000000000,day=86400000,rows=[];
for(const distance of [1,5,15]){
 const world={id:`distance-${distance}`,mode:'express',economyVersion:2,influenceVersion:2,status:'running',startsAt:start,combatMode:'competitive'};
 let shared=E.createCozyShared(world);const players=['a','b'].map((id,i)=>{
  const state=E.createCozyState(world,id,id,start);state.king={profileId:'builder',nickname:id,alive:true,generation:1,history:[],attributes:{administration:5,command:5,exploration:5}};
  Object.assign(state.cities[0],{q:-30+i*distance,r:10});state.cities[0].sectors.defense=i?3:0;state.cities[0].sectors.economy=i?5:0;
  state.army={militia:i?10:1000,shooters:0,scouts:0,machinery:0};state.resources={gold:10000,materials:100000,supplies:10000};
  shared.claims[`${state.cities[0].q},10`]={playerId:id,cityId:state.cities[0].id,name:state.cities[0].name};return {playerId:id,state,influence:0};
 });const a=players[0],b=players[1],target={q:b.state.cities[0].q,r:10};a.state.explored.push(`${target.q},${target.r}`);
 const quote=R.expeditionCost(a.state,target),travel=R.expeditionTravelMs(a.state,world,target),unitCost=E.getCozyComputed(a.state,shared,world,start).troopCosts.militia,infraBefore=E.getCozyComputed(b.state,shared,world,start).influence.infrastructure;
 const campaign=P.playerCampaign(a.state,world,target);
 let now=start,attacks=0;
 while(now+campaign.totalMs<=start+3*day){
  const sent=E.applyCozyAction(a.state,shared,world,{type:'attack_player',...target},now);a.state=sent.state;shared=sent.shared;
  const arrival=a.state.orders.find(o=>o.targetPlayerId).arrivesAt;shared=S.settleWorld(players,shared,world,arrival);const back=a.state.orders.find(o=>o.returning);assert(back);now=back.arrivesAt;shared=S.settleWorld(players,shared,world,now);attacks++;
 }
 assert(attacks>0);assert(a.state.army.militia<1000);assert(b.state.cities[0].sectors.defense<3);assert(b.state.cities[0].sectors.economy<5);
 assert(E.getCozyComputed(b.state,shared,world,now).influence.infrastructure<infraBefore);
 rows.push({distance,suppliesPerTrip:quote,windowHours:72,roundtripHours:campaign.totalMs/3600000,arrivalHours:campaign.arrivalMs/3600000,completedAttacks:attacks,suppliesSpent:attacks*quote,troopsLost:1000-a.state.army.militia,replacementMaterialsAtInitialUnitCost:(1000-a.state.army.militia)*unitCost,defenderInfrastructureBefore:infraBefore,defenderInfrastructureAfter:E.getCozyComputed(b.state,shared,world,now).influence.infrastructure});
}
assert(rows[0].completedAttacks>rows[1].completedAttacks&&rows[1].completedAttacks>rows[2].completedAttacks);
assert(rows[0].suppliesPerTrip<rows[1].suppliesPerTrip&&rows[1].suppliesPerTrip<rows[2].suppliesPerTrip);
await writeFile(new URL('../reports/cozy/pvp-distance-cost.json',import.meta.url),JSON.stringify({scope:'Prefunded isolated 72h stress fixture; actual engine and settlement, no recruitment; not economic attainability or full multiplayer balance proof',rows},null,2));
console.log('PASS distance/attrition/city infrastructure stress',JSON.stringify(rows));
