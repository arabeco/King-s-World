import assert from 'node:assert/strict';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const E=loadCozyEngine(),{recruitPreview,hordeRecruitment}=loadCozyEngine('recruit-preview'),at=1800000000000;
let checks=0;
for(const mode of ['classic','express'])for(const research of [0,3,5])for(const integrity of [25,100])for(const command of [0,10]){
 const world={id:`preview-${mode}`,mode,economyVersion:2,influenceVersion:2,status:'running',startsAt:at};
 const initial=E.settleCozyState(E.createCozyState(world,'p','King',at),E.createCozyShared(world),world,at);
 const state=initial.state,shared=initial.shared;
 state.research.military=research;state.research.fortification=research;
 state.resources.materials=1e7;state.king={alive:true,attributes:{administration:5,command,exploration:5}};
 state.cities[0].integrity=integrity;state.cities[0].sectors.defense=3;state.cities[0].sectors.recruitment=10;
 // An assigned general, equipment, damaged walls, and king bonuses must all be counted exactly once.
 state.heroes.push({id:'general',role:'general',cityId:state.cities[0].id});state.cities[0].heroId='general';
 const computed=E.getCozyComputed(state,shared,world,at),data={state,shared,computed,world};
 for(const troop of ['militia',...(research>=3?['shooters','scouts','machinery']:[])])for(const quantity of [1,5,50]){
  const before=structuredClone(state),preview=recruitPreview(data,troop,quantity,at);
  assert.deepEqual(state,before,'Preview must not spend resources or mutate saved state');
  const result=E.applyCozyAction(state,shared,world,{type:'recruit',troop,amount:quantity},at);
  const expected=E.getCozyComputed(result.state,result.shared,world,at);
  assert.equal(preview.power,expected.armyPower);
  assert.equal(preview.defense,expected.defensePower);
  assert.equal(preview.military,expected.influence.military);
  assert.equal(preview.militaryGain,expected.influence.military-computed.influence.military);
  const lot=hordeRecruitment(data,troop,200,at);
  if(lot!==null&&lot>0){assert.equal(recruitPreview(data,troop,lot,at).shortfall,0);assert(recruitPreview(data,troop,lot-1,at).shortfall>0,'Recommendation must be the smallest sufficient lot');}
  checks++;
 }
 assert.equal(hordeRecruitment({...data,computed:{...computed,nextHorde:{...computed.nextHorde,power:1e9}}},'militia',200,at),null,'Never promise an unaffordable defense');
 assert.equal(hordeRecruitment({...data,computed:{...computed,nextHorde:null}},'militia',200,at),0);
}
console.log(`PASS ${checks} recruitment previews match actual purchases; suggested horde lots are minimal, bonuses are not duplicated, and no future victory is credited.`);
