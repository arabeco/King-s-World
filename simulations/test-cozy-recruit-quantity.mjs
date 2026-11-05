import assert from 'node:assert/strict';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const E=loadCozyEngine(),at=1800000000000,world={id:'recruit-quantity',name:'Recruitment',mode:'express',economyVersion:2,influenceVersion:2,status:'running',startsAt:at};
const initial=E.settleCozyState(E.createCozyState(world,'p','King',at),E.createCozyShared(world),world,at);
const computed=E.getCozyComputed(initial.state,initial.shared,world,at),cost=computed.troopCosts.militia;
const recruit=amount=>E.applyCozyAction(initial.state,initial.shared,world,{type:'recruit',troop:'militia',amount},at);
for(const amount of [1,2,3,5,7]){
 const result=recruit(amount);assert.equal(result.state.army.militia-initial.state.army.militia,amount);assert.equal(initial.state.resources.materials-result.state.resources.materials,amount*cost);
}
for(const amount of [0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'2',null,{},1000000])assert.throws(()=>recruit(amount));
assert.equal(initial.state.army.militia,25,'Rejected requests never mutate caller state');
const full=recruit('max'),expected=Math.min(computed.armyCapacity-initial.state.army.militia,Math.floor(initial.state.resources.materials/cost));assert.equal(full.state.army.militia,initial.state.army.militia+expected);assert.equal(initial.state.resources.materials-full.state.resources.materials,expected*cost);
const poor=structuredClone(initial);poor.state.resources.materials=cost*2;assert.throws(()=>E.applyCozyAction(poor.state,poor.shared,world,{type:'recruit',troop:'militia',amount:3},at));assert.equal(poor.state.resources.materials,cost*2);
console.log('PASS recruitment: exact quantities 1/2/3/5/7, exact costs, integer validation, resource/capacity bounds, max and immutable failure');
