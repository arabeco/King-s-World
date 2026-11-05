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
