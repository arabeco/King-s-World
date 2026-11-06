import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const directory=new URL('../reports/cozy/',import.meta.url);
const read=async label=>(JSON.parse(await readFile(new URL(`royal-equipment-${label}.json`,directory),'utf8'))).worlds;
const old=[...await read('military-value-baseline'),...await read('military-value-holdout-old')];
const current=[...await read('military-value-verified-75'),...await read('military-value-verified-holdout-75')];
assert.equal(old.length,30);assert.equal(current.length,30,'Wait for all five seeds and six focuses');
const key=w=>[w.mode,w.seed,w.focus,w.variant,w.focalSeat,w.focalProfile].join('/');
assert.deepEqual(old.map(key).sort(),current.map(key).sort());
for(const world of current)for(const actor of world.actors){assert.equal(actor.balance.militaryDivisor,75);assert.equal(actor.balance.materialsProductionMultiplier,4);assert.equal(actor.balance.suppliesProductionMultiplier,1);assert(actor.score>=0&&actor.score<=2500);}
const median=values=>{const sorted=values.toSorted((a,b)=>a-b);return (sorted[Math.floor((sorted.length-1)/2)]+sorted[Math.ceil((sorted.length-1)/2)])/2;};
const summary=worlds=>{
 const actors=worlds.flatMap(w=>w.actors);
 return {worldCases:worlds.length,seedCount:new Set(worlds.map(w=>w.seed)).size,correlatedActorTrajectories:actors.length,
  seals:actors.filter(a=>a.seal).length,medianScore:median(actors.map(a=>a.score)),medianMaterials:median(actors.map(a=>a.resources.materials)),medianSupplies:median(actors.map(a=>a.resources.supplies)),
  focuses:Object.fromEntries([...new Set(worlds.map(w=>w.focus))].map(focus=>{const focal=worlds.filter(w=>w.focus===focus).map(w=>w.actors[w.focalSeat]);return [focus,{scores:focal.map(a=>a.score),medianScore:median(focal.map(a=>a.score)),medianAreas:Object.fromEntries(['infrastructure','government','military','society','legacy'].map(area=>[area,median(focal.map(a=>a.influence[area]))]))}];}))};
};
const report={scope:'Five seeds; six focal policies in mixed five-player worlds with alliances and towers, real engine and no injected resources. Same seats/visit draws. Other actors recur across focuses, so these are correlated trajectories, not a population forecast or evidence of a precise 65% real-player win rate.',
 baseline:{militaryDivisor:90,materialsMultiplier:4,suppliesMultiplier:4,...summary(old)},current:{militaryDivisor:75,materialsMultiplier:4,suppliesMultiplier:1,...summary(current)},
 caveats:['Earlier exploratory reports requesting divisor 60 or 75 used a stale bot override of 90; do not treat those as military curve experiments. The verified reports assert the actual actor balance.',
 'Production reduction to materials multiplier 3 was rejected because it reduced expansion and military-specialist results. Materials remain unchanged.',
 'Existing worlds retain their saved balance; new Express worlds receive the calibration. Classic remains unchanged.',
 'Horde estimates are current defense, including current ally support. Benefits, troops and support can change before arrival.']};
await writeFile(new URL('military-calibration-summary.json',directory),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
