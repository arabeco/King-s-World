// Controlled 30-window stress test, not a simulation of an entire campaign.
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const E=loadCozyEngine(),M=loadCozyEngine('mini-missions');
const start=1800000000000,world={id:'balance-audit',name:'Vale',mode:'express',economyVersion:3,influenceVersion:2,status:'running',startsAt:start,persistent:true};
for(const scenario of [{name:'aceita tudo sem reforço',level:1,army:25},{name:'casual cuidadoso',level:1,army:25,careful:true,recruit:true},{name:'preparado cuidadoso',level:5,army:200,careful:true,recruit:true}]){
 let state=E.createCozyState(world,scenario.name,scenario.name,start),shared=E.createCozyShared(world);
 for(const key of Object.keys(state.cities[0].sectors))state.cities[0].sectors[key]=scenario.level;
 state.army.militia=scenario.army;
 let victories=0,defeats=0,skipped=0,recruited=0,gold=0,materials=0,supplies=0;
 for(let day=0;day<30;day++){
  const now=start+day*M.MISSION_WINDOW_MS;({state,shared}=E.settleCozyState(state,shared,world,now));
  if(scenario.recruit&&day%3===0){
   const computed=E.getCozyComputed(state,shared,world,now);
   const amount=Math.min(10,computed.armyCapacity-state.army.militia,Math.floor(state.resources.materials/computed.troopCosts.militia));
   if(amount>0){({state,shared}=E.applyCozyAction(state,shared,world,{type:'recruit',troop:'militia',amount},now));recruited+=amount;}
  }
  const offer=M.miniMissionOffer(state,world,now);if(!offer||state.army.militia===0)continue;
  if(scenario.careful&&E.getCozyComputed(state,shared,world,now).armyPower<offer.enemyPower){skipped++;continue;}
  if(state.resources.supplies<offer.suppliesCost){skipped++;continue;}
  ({state,shared}=E.applyCozyAction(state,shared,world,{type:'mini_mission',id:offer.id,accept:true},now));
  const order=state.orders.find(o=>o.miniMission);({state,shared}=E.settleCozyState(state,shared,world,order.arrivesAt));
  const result=state.reports.find(r=>r.miniMission&&r.at===order.arrivesAt).miniMission;
  if(result.won){victories++;gold+=offer.reward.gold;materials+=offer.reward.materials;supplies+=offer.reward.supplies;}else defeats++;
 }
 console.log(JSON.stringify({scenario:scenario.name,victories,defeats,skipped,recruited,militiaRemaining:state.army.militia,rewardGold:gold,rewardMaterials:materials,rewardSupplies:supplies,suppliesSpent:(victories+defeats)*30}));
}
