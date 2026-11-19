import assert from 'node:assert/strict';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const E=loadCozyEngine(),R=loadCozyEngine('exploration-route'),V=loadCozyEngine('map-visibility');
const now=1800000000000,world={id:'route-test',mode:'express',economyVersion:2,influenceVersion:2,status:'running',startsAt:now};
function fixture(){const state=E.createCozyState(world,'scout','Scout',now),shared=E.createCozyShared(world);state.king={profileId:'builder',nickname:'Scout',alive:true,generation:1,history:[]};Object.assign(state.cities[0],{q:-30,r:10});state.resources.supplies=100000;return {state,shared};}
for(let q=-40;q<=40;q+=5)for(let r=-40;r<=40;r+=5){
 if(Math.abs(q+r)>40)continue;const {state}=fixture(),path=R.explorationPath(state,{q,r});
 assert.equal(path.length,R.hexDistance(state.cities[0],{q,r})+1);assert.deepEqual(path.at(-1),{q,r});
 assert.equal(new Set(path.map(c=>`${c.q},${c.r}`)).size,path.length);
 for(let i=1;i<path.length;i++)assert.equal(R.hexDistance(path[i-1],path[i]),1);
 for(const id of R.explorationCorridor(path)){const [a,b]=id.split(',').map(Number);assert(Math.abs(a)<=40&&Math.abs(b)<=40&&Math.abs(a+b)<=40);assert(path.some(c=>R.hexDistance(c,{q:a,r:b})<=1));}
}
{
 const f=fixture();let target;
 for(let q=-15;q<0&&!target;q++)for(let r=10;r<20&&!target;r++){
  try{const sent=E.applyCozyAction(f.state,f.shared,world,{type:'explore',q,r},now);if(sent.state.orders.some(o=>o.explorationPath))target={q,r};}catch{}
 }
 assert(target,'A far destination may be selected directly through fog');
 const cost=R.expeditionCost(f.state,target),travel=R.expeditionTravelMs(f.state,world,target),sent=E.applyCozyAction(f.state,f.shared,world,{type:'explore',...target},now),order=sent.state.orders.find(o=>o.explorationPath);
 assert.equal(sent.state.resources.supplies,f.state.resources.supplies-cost);assert.equal(order.arrivesAt,now+travel);
 assert.throws(()=>E.applyCozyAction(sent.state,sent.shared,world,{type:'explore',q:-29,r:10,queue:true},now),/já está em andamento/);
 const early=E.settleCozyState(sent.state,sent.shared,world,order.arrivesAt-1);assert.equal(early.state.scoutedCells?.length??0,0);
 const done=E.settleCozyState(early.state,early.shared,world,order.arrivesAt),ids=R.explorationCorridor(order.explorationPath);
 assert.deepEqual(done.state.scoutedCells,ids);for(const id of ids){assert(V.knownMapCells(done.state,done.shared).has(id));assert(V.visibleTerrainCells(done.state).has(id));}
 assert.deepEqual(done.state.explored.filter(id=>!f.state.explored.includes(id)),[`${target.q},${target.r}`],'Only destination earns a survey, not each path cell');
 assert.deepEqual(done.shared.claims,sent.shared.claims,'Reconnaissance does not annex cities');assert.deepEqual(done.shared.territories,sent.shared.territories,'Reconnaissance does not annex land');
 const other=E.createCozyState(world,'other','Other',now);assert(ids.some(id=>!V.knownMapCells(other,done.shared).has(id)),'Discovery is private');
 const again=E.settleCozyState(done.state,done.shared,world,order.arrivesAt);assert.deepEqual(again,done,'No repeated survey/reward');
 assert.throws(()=>E.applyCozyAction(f.state,f.shared,world,{type:'explore',q:40,r:40},now),/coordenad|mapa/i);
}
console.log('PASS exploration route: hex adjacency, bounded corridor, direct far destination, exact quote, delayed private discovery, destination-only survey, no annexation and replay');

{
 const persistent={...world,economyVersion:3,persistent:true};
 const f=fixture();
 const targets=[{q:-29,r:10},{q:-30,r:12},{q:-33,r:10},{q:-30,r:8}];
 const send=(x,target,queue)=>E.applyCozyAction(x.state,x.shared,persistent,{type:'explore',...target,queue},now);
 const first=send(f,targets[0]);
 assert.throws(()=>send(first,targets[1]),/já está em andamento/);
 assert.throws(()=>send(first,targets[0],true),/destino já está na fila/);
 const second=send(first,targets[1],true);
 const third=send(second,targets[2],true);
 const [active,queued,last]=R.explorationQueue(third.state,now).orders;
 assert.equal(active.arrivesAt,queued.planned.startsAt);
 assert.equal(queued.arrivesAt,last.planned.startsAt);
 assert(!queued.planned.started&&!last.planned.started);
 assert.equal(third.state.resources.supplies,f.state.resources.supplies-targets.slice(0,3).reduce((sum,t)=>sum+R.expeditionCost(f.state,t),0));
 assert.throws(()=>send(third,targets[3],true),/fila de exploração está cheia/);
 const canceled=E.applyCozyAction(third.state,third.shared,persistent,{type:'cancel_plan',orderId:queued.id},now);
 assert.deepEqual(canceled.state.orders,[active]);
 assert.equal(canceled.state.resources.supplies,first.state.resources.supplies);
 assert.throws(()=>E.applyCozyAction(canceled.state,canceled.shared,persistent,{type:'cancel_plan',orderId:queued.id},now));
 const settle=(x,at)=>E.settleCozyState(x.state,x.shared,persistent,at);
 assert.equal(settle(third,active.arrivesAt-1).state.scoutedCells?.length??0,0);
 const firstArrival=settle(third,active.arrivesAt);
 assert(firstArrival.state.orders.find(order=>order.id===queued.id).planned.started);
 assert(!firstArrival.state.explored.includes(`${queued.q},${queued.r}`));
 const finished=settle(third,last.arrivesAt);
 const staged=settle(settle(firstArrival,queued.arrivesAt),last.arrivesAt);
 assert.equal(finished.state.orders.length,0);
 assert.deepEqual(finished.state.explored,staged.state.explored);
 assert.deepEqual(finished.state.resources,staged.state.resources);
 for(const {q,r} of targets.slice(0,3))assert(finished.state.explored.includes(`${q},${r}`));
 const changed=structuredClone(third);
 changed.shared.claims[`${queued.q},${queued.r}`]={playerId:f.state.playerId,cityId:f.state.cities[0].id,name:'Novo território'};
 const recovered=settle(changed,last.arrivesAt);
 assert(recovered.state.reports.some(entry=>entry.title==='Exploração cancelada'));
 assert(recovered.state.explored.includes(`${last.q},${last.r}`),'An invalid reservation leaves other departures intact');
 assert.equal(recovered.state.resources.supplies,finished.state.resources.supplies+queued.planned.cost.supplies);
 console.log('PASS exploration queue: serial reservations, offline settlement, duplicates, cap, one-time refund and independent recovery');
}
