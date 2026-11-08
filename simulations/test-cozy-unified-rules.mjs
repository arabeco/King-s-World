import assert from 'node:assert/strict';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const E=loadCozyEngine(),P=loadCozyEngine('progression'),C=loadCozyEngine('catalog'),R=loadCozyEngine('exploration-route'),V=loadCozyEngine('player-campaign'),at=1800000000000,DAY=86400000;
const normal={id:'one-rule-set',mode:'classic',economyVersion:3,influenceVersion:2,status:'running',startsAt:at},express={...normal,mode:'express'};
const a=E.createCozyState(normal,'p','Player',at),b=E.createCozyState(express,'p','Player',at),shared=E.createCozyShared(normal);
assert.deepEqual(a.progression.balance,b.progression.balance);assert.deepEqual(a.progression.balance,P.unifiedProgressionBalance());
assert.equal(E.getCozyComputed(a,shared,normal,at).influence.total,0);
for(const cityCount of [1,3,10])for(const level of [0,1,5,10]){
 const state=structuredClone(a);state.cities=Array.from({length:cityCount},(_,i)=>({...structuredClone(a.cities[0]),id:'city'+i,q:a.cities[0].q+i,capital:i===0,sectors:{administration:level,economy:level,society:level,recruitment:level,defense:level}}));
 state.heroes=Array.from({length:10},(_,i)=>({id:'hero'+i,name:'Hero',role:'general',cityId:null}));state.research={military:level%6,economy:level%6,fortification:level%6,exploration:level%6};state.army.militia=500+level*100;state.hordesWon=3;
 const x=E.getCozyComputed(state,shared,normal,at),y=E.getCozyComputed(state,shared,express,at);
 assert.deepEqual(x.influence,y.influence);assert.equal(x.influence.infrastructure,cityCount*level*5);
 for(const city of state.cities)assert.equal(P.infrastructureContribution(state,city),level*5);
 assert.deepEqual(x.researchCosts,y.researchCosts);assert.deepEqual(x.upgradeCosts,y.upgradeCosts);assert.equal(x.heroCost,y.heroCost);assert.deepEqual(x.productionPerDay,y.productionPerDay);
}
const ca=E.getCozyComputed(a,shared,normal,at),cb=E.getCozyComputed(b,shared,express,at);
assert.equal(ca.durationDays,120);assert.equal(cb.durationDays,120);assert.equal(cb.realDurationDays,30);assert.equal(ca.realDurationDays,120);assert.equal(cb.dayMs*4,ca.dayMs);assert.equal(E.getCozyComputed(b,shared,{...express,speedMultiplier:2},at).realDurationDays,30,'v3 always runs x4; legacy speed settings cannot make it x2');
for(const sector of C.SECTORS)assert.equal(C.getCozyUpgradeDurationMs(a,a.cities[0],sector.id,ca.dayMs),C.getCozyUpgradeDurationMs(b,b.cities[0],sector.id,cb.dayMs)*4);
for(const elapsed of [DAY,5*DAY,19*DAY]){
 const x=E.settleCozyState(a,shared,normal,at+elapsed),y=E.settleCozyState(b,shared,express,at+elapsed/4);
 const cx=E.getCozyComputed(x.state,x.shared,normal,at+elapsed),cy=E.getCozyComputed(y.state,y.shared,express,at+elapsed/4);
 assert.deepEqual(x.state.resources,y.state.resources);assert.deepEqual(cx.influence,cy.influence);assert.equal(cx.day,cy.day);assert.equal(x.state.hordesWon,y.state.hordesWon);
}
const target={q:a.cities[0].q+3,r:a.cities[0].r};assert.equal(R.expeditionCost(a,target),R.expeditionCost(b,target));assert.equal(R.expeditionTravelMs(a,normal,target),R.expeditionTravelMs(b,express,target)*4);
assert.equal(V.playerCampaign(a,normal,target).preparationMs,V.playerCampaign(b,express,target).preparationMs*4);
for(const source of ['decree:one','local:one','stable:one']){P.councilCredit(a,source,8);P.councilCredit(b,source,8);assert.deepEqual(a.progression.council,b.progression.council);}
console.log('PASS one influence/economy rule set: +1 infrastructure per level, 50 per city, 500 per area, identical costs/rewards/council, and real production/travel/buildings/hordes pass at x4 chronological equivalence.');
