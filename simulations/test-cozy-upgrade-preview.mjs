import assert from 'node:assert/strict';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const E=loadCozyEngine(),{cityUpgradePreview}=loadCozyEngine('upgrade-preview'),now=1800000000000;
let checks=0;
for(const mode of ['classic','express'])for(const integrity of [0,55,100])for(const rank of [false,true]){
 const world={id:'preview-'+mode,mode,economyVersion:2,influenceVersion:2,status:'running',startsAt:now};
 const state=E.createCozyState(world,'player','Player',now),shared=E.createCozyShared(world);
 state.research={economy:3,military:2,exploration:1,fortification:4};state.army.militia=200;
 const city=state.cities[0];city.sectors={administration:3,economy:3,society:3,recruitment:3,defense:3};city.integrity=integrity;
 city.life={contentment:70,lastDecisionDay:null,productionEffect:{bonus:5,endsAt:now+1000}};
 const second={...structuredClone(city),id:'colony',capital:false,cityClass:'bastiao',sectors:{...city.sectors,economy:rank?2:4}};state.cities.push(second);
 for(const target of state.cities)for(const sector of Object.keys(target.sectors)){
  const computed=E.getCozyComputed(state,shared,world,now),input=structuredClone(state),preview=cityUpgradePreview({state,computed},target.id,sector);
  assert(preview);assert.deepEqual(state,input,'A preview cannot mutate game state');
  const next=structuredClone(state);next.cities.find(c=>c.id===target.id).sectors[sector]++;
  const expected=E.getCozyComputed(next,shared,world,now);
  assert.equal(preview.influenceAfter,expected.influence.total,`${mode} ${integrity} ${rank} ${target.id} ${sector}`);
  for(const metric of preview.metrics){
   const actual=metric.key==='materials'?expected.cityLife[target.id].production.materials:metric.key==='supplies'?expected.cityLife[target.id].production.supplies:metric.key==='capacity'?expected.armyCapacity:metric.key==='walls'?expected.fortificationPower:null;
   if(actual!==null)assert(Math.abs(actual-metric.after)<1e-7);
  }
  checks++;
 }
 city.sectors.defense=10;assert.equal(cityUpgradePreview({state,computed:E.getCozyComputed(state,shared,world,now)},city.id,'defense'),null);
}
const world={id:'first-session',mode:'express',economyVersion:2,influenceVersion:2,status:'running',startsAt:now};
let state=E.createCozyState(world,'first','First',now),shared=E.createCozyShared(world);
for(const action of [{type:'upgrade',cityId:state.cities[0].id,sector:'administration'},{type:'hire',role:'engineer'},{type:'research',research:'economy'},{type:'recruit',troop:'militia',amount:5}])({state,shared}=E.applyCozyAction(state,shared,world,action,now));
const decision=E.getCozyComputed(state,shared,world,now).decree;
({state,shared}=E.applyCozyAction(state,shared,world,{type:'decree',decreeId:decision.id,optionId:'care'},now));
const tile=E.getCozyTiles(state,shared,world,now).find(t=>t.ownerId!==state.playerId&&t.exploreCost>0&&t.exploreCost<=state.resources.supplies);
assert(tile);({state,shared}=E.applyCozyAction(state,shared,world,{type:'explore',q:tile.q,r:tile.r},now));
assert(state.orders.some(o=>o.kind==='explore'));assert(state.orders.some(o=>o.kind==='upgrade'));assert(state.orders.some(o=>o.kind==='research'));assert.equal(state.heroes.length,1);assert.equal(state.decreesSigned.length,1);
console.log(`PASS ${checks} upgrade previews match actual engine results across both economies, damaged cities, level caps and infrastructure reordering; a first Express session affords building, hero, research, troops, decree and exploration.`);
