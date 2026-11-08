import assert from 'node:assert/strict';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const E=loadCozyEngine(),at=1800000000000,DAY=86400000;
const world=(mode='classic')=>({id:'decision-context',mode,economyVersion:3,influenceVersion:2,status:'running',startsAt:at});
const setup=(id='p',mode='classic',day=1)=>{
 const w=world(mode),now=at+(day-1)*DAY/(mode==='express'?4:1);
 let save=E.settleCozyState(E.createCozyState(w,id,id,at),E.createCozyShared(w),w,now);
 save.state.resources={gold:1000,materials:1000,supplies:1000};return {...save,w,now};
};
const view=s=>E.getCozyComputed(s.state,s.shared,s.w,s.now);
let checks=0;
for(const mode of ['classic','express']){
 const s=setup('same',mode),other={...structuredClone(s.state.cities[0]),id:'colony',capital:false,q:s.state.cities[0].q+1,life:{contentment:70,lastDecisionDay:null}};s.state.cities.push(other);
 const d=view(s).decree,option=d.options.find(o=>o.id==='invest');assert.deepEqual(option.cost,{materials:300});
 const before=structuredClone(s.state);const result=E.applyCozyAction(s.state,s.shared,s.w,{type:'decree',decreeId:d.id,optionId:option.id},s.now);
 assert.equal(result.state.resources.gold,before.resources.gold+60);assert.equal(result.state.resources.materials,before.resources.materials-300);
 assert.equal(result.state.cities[0].life.contentment,70);assert.equal(result.state.cities[1].life.contentment,70);
 assert.throws(()=>E.applyCozyAction(result.state,result.shared,s.w,{type:'decree',decreeId:d.id,optionId:option.id},s.now),/mudou|assinado/);
 const poor=structuredClone(s);poor.state.resources.materials=299;assert.throws(()=>E.applyCozyAction(poor.state,poor.shared,poor.w,{type:'decree',decreeId:d.id,optionId:option.id},poor.now),/mais materiais/);assert.equal(poor.state.resources.materials,299);
 const aided=E.applyCozyAction(s.state,s.shared,s.w,{type:'decree',decreeId:d.id,optionId:'care'},s.now);assert(aided.state.cities.every(c=>c.life.contentment===76));
 s.state.cities[1].integrity=40;const repair=view(s).decree;assert.match(repair.id,/rebuilding/);
 const repaired=E.applyCozyAction(s.state,s.shared,s.w,{type:'decree',decreeId:repair.id,optionId:'invest'},s.now);assert.equal(repaired.state.cities[1].integrity,60);assert.equal(repaired.state.cities[0].integrity??100,100);assert.deepEqual(repaired.state.cities[1].sectors,s.state.cities[1].sectors,'Repair never restores destroyed levels');
 s.state.cities[1].life.contentment=20;assert.match(view(s).decree.id,/unrest/,'Society takes priority over rebuilding and trade');checks+=7;
}
const localKinds=new Set();let localWins=0,localLosses=0,councilWins=0,councilLosses=0;
for(let i=0;i<24;i++){
 for(let day=1;day<=5;day++){
  const s=setup('local'+i,'classic',day),city=s.state.cities[0],d=view(s).cityLife[city.id].decision;localKinds.add(d.id.split(':').at(-1));
  if(!d.options.some(o=>o.chance))continue;
  const option=d.options.find(o=>o.chance),before=structuredClone(s.state);
  const result=E.applyCozyAction(s.state,s.shared,s.w,{type:'city_decision',cityId:city.id,decisionId:d.id,optionId:option.id},s.now);
  assert.equal(result.state.resources.supplies,before.resources.supplies-option.cost.supplies);
  const gained=result.state.resources.gold-before.resources.gold;assert(gained===0||gained===20);gained?localWins++:localLosses++;
  assert.equal(result.state.cities[0].life.lastDecisionDay,day);
  assert.throws(()=>E.applyCozyAction(result.state,result.shared,s.w,{type:'city_decision',cityId:city.id,decisionId:d.id,optionId:option.id},s.now),/resolvida|mudou/);
  const rerun=E.applyCozyAction(s.state,s.shared,s.w,{type:'city_decision',cityId:city.id,decisionId:d.id,optionId:option.id},s.now);assert.deepEqual(rerun,result,'Same risk receipt cannot reroll the outcome');checks++;
 }
 const s=setup('council'+i,'classic',4),d=view(s).decree,option=d.options.find(o=>o.id==='risk');assert(option);
 const result=E.applyCozyAction(s.state,s.shared,s.w,{type:'decree',decreeId:d.id,optionId:'risk'},s.now);
 assert.equal(result.state.resources.supplies,s.state.resources.supplies-200);const gain=result.state.resources.gold-s.state.resources.gold+25;assert(gain===0||gain===95);gain?councilWins++:councilLosses++;checks++;
}
assert(localWins&&localLosses&&councilWins&&councilLosses);assert(localKinds.size>=5);
// Local trade affects the local budget, but does not directly mint governance merit.
const trade=setup('trade','classic',1);trade.state.resources.gold=0;const city=trade.state.cities[0],decision=view(trade).cityLife[city.id].decision;
const swapped=E.applyCozyAction(trade.state,trade.shared,trade.w,{type:'city_decision',cityId:city.id,decisionId:decision.id,optionId:'sell-stone'},trade.now);
assert.equal(swapped.state.resources.gold,16);assert.equal(swapped.state.resources.materials,900);assert.equal(swapped.state.progression.council.merit,0);
// Match the whole displayed quote across both clocks, not just its final influence.
for(let day=1;day<=12;day++){
 const a=setup('parity','classic',day),b=setup('parity','express',day);
 assert.deepEqual(view(a).decree,view(b).decree);
 assert.deepEqual(view(a).cityLife[a.state.cities[0].id].decision,view(b).cityLife[b.state.cities[0].id].decision);checks+=2;
}
const production=setup('production','classic',7),capital=production.state.cities[0];
capital.life.productionEffect={bonus:8,endsAt:production.now+3*DAY};
assert(!view(production).decree.options.some(o=>o.effects.productionBonus),'Do not sell an empire buff when every city already has a stronger effect');
production.state.cities.push({...structuredClone(capital),id:'without-buff',capital:false,q:capital.q+1,life:{contentment:70,lastDecisionDay:null}});
const decree=view(production).decree,care=decree.options.find(o=>o.id==='care');assert.equal(care.effects.productionBonus,5);
const improved=E.applyCozyAction(production.state,production.shared,production.w,{type:'decree',decreeId:decree.id,optionId:'care'},production.now);
assert.equal(improved.state.cities[0].life.productionEffect.bonus,8);assert.equal(improved.state.cities[1].life.productionEffect.bonus,5);checks++;
const minor=setup('minor');minor.state.cities[0].integrity=96;
const minorRepair=view(minor).cityLife[minor.state.cities[0].id].decision;
assert(!minorRepair.options.some(o=>o.id==='repair'),'Do not sell a repair that the free salvage option fully covers');
assert.equal(minorRepair.options.find(o=>o.id==='volunteers').cost.supplies,7);
assert.equal(view(minor).decree.options.find(o=>o.id==='invest').cost.materials,18,'Realm repair cost follows the actual damage, not the number of healthy cities');checks+=3;
const civic=setup('advisors'),pragmatic=structuredClone(civic);pragmatic.state.counselors[0]='tomas';
const civilCare=view(civic).decree.options.find(o=>o.id==='care'),pragmaticCare=view(pragmatic).decree.options.find(o=>o.id==='care');
assert(civilCare.effects.satisfaction>pragmaticCare.effects.satisfaction);assert(pragmaticCare.effects.materials>civilCare.effects.materials);assert.deepEqual(civilCare.cost,pragmaticCare.cost);checks++;
console.log(`PASS ${checks} smart decision cases: contextual emergencies, small local exchanges, realm effects, both clocks, exact costs, insufficient funds, deterministic successes/failures, no reroll or duplicate payment, preserved levels and no direct trade influence.`);
