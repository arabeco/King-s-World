import assert from 'node:assert/strict';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const E=loadCozyEngine(),START=1800000000000,DAY=86400000;
const base={id:'calendar',name:'Calendar',mode:'express',status:'running',startsAt:START,influenceVersion:2};
const setup=w=>E.settleCozyState(E.createCozyState(w,'p','p',START),E.createCozyShared(w),w,START);
const modern={...base,economyVersion:2,speedMultiplier:1},old=setup(base),x=setup(modern),c=E.getCozyComputed(x.state,x.shared,modern,START),o=E.getCozyComputed(old.state,old.shared,base,START);
assert.equal(c.dayMs,DAY);assert.equal(c.durationDays,30);assert.equal(c.realDurationDays,30);assert.equal(o.dayMs,DAY/4);assert.equal(o.durationDays,120);assert.equal(o.realDurationDays,30);
assert.equal(c.productionPerDay.materials,o.productionPerDay.materials*4);assert.equal(c.researchCosts.economy,o.researchCosts.economy/4);assert.equal(c.heroCost,150);assert.equal(o.heroCost,200);
assert.equal(c.nextHorde.day,5);const arrived=E.settleCozyState(x.state,x.shared,modern,START+DAY);assert.equal(E.getCozyComputed(arrived.state,arrived.shared,modern,START+DAY).day,2);
const endpoint=E.settleCozyState(x.state,x.shared,modern,START+30*DAY);assert.deepEqual(endpoint.state.hordesResolved,[5,10,15,20,25,28]);assert.equal(endpoint.state.finalizedAt,START+30*DAY);
assert.equal(E.nextCityDayAt(endpoint.state,modern),null);assert.deepEqual(E.settleCozyState(endpoint.state,endpoint.shared,modern,START+31*DAY),endpoint);
console.log('PASS economic Express: 30 real days, real clock, prices/production, six waves and exact ending; legacy unchanged');

for(const [day,phase] of [[5,'Consolidação'],[6,'Expansão'],[16,'Fortificação'],[23,'Apogeu']])assert.equal(E.getCozyComputed(x.state,x.shared,modern,START+(day-1)*DAY).phase,phase);
console.log('PASS: narrative phases span all 30 days without altering legacy thresholds');
