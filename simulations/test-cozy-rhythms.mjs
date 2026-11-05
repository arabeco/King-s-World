import assert from 'node:assert/strict';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const E=loadCozyEngine(),START=1800000000000,DAY=86400000;
const outcomes=[];
for(const speed of [1,2,4]) {
 const w={id:'rhythm-proof',name:'Rhythm',mode:speed===1?'classic':'express',speedMultiplier:speed,influenceVersion:2,status:'running',startsAt:START};
 let x=E.settleCozyState(E.createCozyState(w,'p','p',START),E.createCozyShared(w),w,START);
 x=E.applyCozyAction(x.state,x.shared,w,{type:'research',research:'economy'},START);
 const arrival=x.state.orders.find(o=>o.kind==='research').arrivesAt;
 const bulk=E.settleCozyState(x.state,x.shared,w,START+4*DAY/speed);
 let daily=x;for(let day=1;day<=4;day++)daily=E.settleCozyState(daily.state,daily.shared,w,START+day*DAY/speed);
 assert.deepEqual(bulk.state.resources,daily.state.resources);assert.deepEqual(bulk.state.research,daily.state.research);assert.deepEqual(bulk.state.progression,daily.state.progression);const c=E.getCozyComputed(bulk.state,bulk.shared,w,START+4*DAY/speed);
 assert.equal(c.realDurationDays,120/speed);
 outcomes.push({resources:bulk.state.resources,research:bulk.state.research,influence:c.influence,arrivalGameDays:(arrival-START)/DAY*speed});
}
assert.deepEqual(outcomes[0],outcomes[1]);assert.deepEqual(outcomes[0],outcomes[2]);
console.log('PASS 1x/2x/4x: research duration, production, influence, reported duration and offline/daily equivalence');
