import assert from 'node:assert/strict';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const E=loadCozyEngine(),{orderMapLabel}=loadCozyEngine('order-presentation'),S=loadCozyEngine('settlement'),F=loadCozyEngine('city-foundation'),at=1800000000000;
for(const mode of ['classic','express']){
 const world={id:'foundation',mode,economyVersion:3,influenceVersion:2,status:'running',startsAt:at};
 let shared=E.createCozyShared(world),state=E.createCozyState(world,'a','A',at);({state,shared}=E.settleCozyState(state,shared,world,at));
 state.resources={gold:10000,materials:10000,supplies:10000};state.explored=E.getCozyTiles(state,shared,world).map(t=>t.id);
 ({state,shared}=E.applyCozyAction(state,shared,world,{type:'hire',role:'general'},at));const hero=state.heroes[0];
 const target=E.getCozyTiles(state,shared,world).find(t=>t.foundation?.canFound);assert(target);
 const action={type:'found_city',q:target.q,r:target.r,heroId:hero.id},before=structuredClone(state);
 const sent=E.applyCozyAction(state,shared,world,action,at),order=sent.state.orders.find(o=>o.foundation);assert(order);assert.equal(orderMapLabel(order),'Fundação de cidade');
 assert.equal(before.resources.materials-sent.state.resources.materials,target.foundation.materials);assert.equal(before.resources.supplies-sent.state.resources.supplies,target.foundation.supplies);assert.equal(sent.state.cities.length,1);assert.equal(sent.state.heroes[0].cityId,null);
 assert.throws(()=>E.applyCozyAction(sent.state,sent.shared,world,action,at),/reservado|andamento/);
 const result=E.settleCozyState(sent.state,sent.shared,world,order.arrivesAt),city=result.state.cities.find(c=>!c.capital);
 assert(city);assert.equal(Object.values(city.sectors).reduce((n,v)=>n+v,0),0);assert.equal(result.state.heroes[0].cityId,city.id);assert(!city.cityClass);
 assert.equal(E.getCozyComputed(result.state,result.shared,world,order.arrivesAt).influence.infrastructure,0,'Foundation does not grant free building influence');
 assert.deepEqual(E.settleCozyState(result.state,result.shared,world,order.arrivesAt),result);
 assert.throws(()=>E.applyCozyAction(result.state,result.shared,world,action,order.arrivesAt),/livre|cidade/);
 const blocked=structuredClone(shared);blocked.claims[target.id]={playerId:'other',cityId:'other-city',name:'Other'};
 const canceled=E.settleCozyState(sent.state,{...sent.shared,claims:blocked.claims},world,order.arrivesAt);
 assert.equal(canceled.state.cities.length,1);assert.equal(canceled.state.heroes[0].cityId,null);assert(canceled.state.reports.some(r=>r.title==='Fundação interrompida'));assert(canceled.state.resources.materials>=before.resources.materials);
 assert(F.foundationSite(state,shared,state.cities[0]));
 console.log('PASS',mode,'foundation quotes exact cost/time, waits for arrival, starts at level zero, reserves a free hero, retains open type choice, refunds construction after a competing claim and settles once.');
}
