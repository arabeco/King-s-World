import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const {EQUIPMENT_EFFECTS}=loadCozyEngine('equipment');
const {kingLevelFromXp,rankXpCandidate}=loadCozyEngine('king-progression');
const roster=JSON.parse(await readFile(new URL('../public/collection/sovereigns-v2/roster.json',import.meta.url)));
for(const king of roster){assert.equal(Object.values(king.baseStats).reduce((a,b)=>a+b,0),15);assert(Object.values(king.baseStats).every(v=>v>=0&&v<=10));}
for(const stat of ['administration','command','exploration'])assert.equal(Math.max(...roster.slice(0,4).map(k=>k.baseStats[stat])),Math.max(...roster.map(k=>k.baseStats[stat])));
const items=Object.keys(EQUIPMENT_EFFECTS),maxima={materials:0,supplies:0,defense:0,travel:0};let combinations=0;
for(let a=0;a<items.length;a++)for(let b=a+1;b<items.length;b++)for(let c=b+1;c<items.length;c++){
 combinations++;for(const key of Object.keys(maxima))maxima[key]=Math.max(maxima[key],[a,b,c].reduce((s,i)=>s+(EQUIPMENT_EFFECTS[items[i]][key]??0),0));
}
assert.equal(combinations,455);assert(Object.values(maxima).every(v=>v<=.05));
assert.equal(kingLevelFromXp(0),1);assert.equal(kingLevelFromXp(25),2);assert.equal(kingLevelFromXp(2025),10);assert.equal(kingLevelFromXp(1e8),10);
assert.equal(rankXpCandidate(300,0,4,30,30),0);assert.equal(rankXpCandidate(300,0,5,5,30),0);assert.equal(rankXpCandidate(300,0,5,6,30),30);assert.equal(rankXpCandidate(300,.5,5,30,30),15);assert.equal(rankXpCandidate(300,1,5,30,30),0);
const comparisons=[];
for(const label of ['paired','focus','holdout-v2']){
 const data=JSON.parse(await readFile(new URL(`../reports/cozy/royal-equipment-${label}.json`,import.meta.url)));
 for(const base of data.worlds.filter(w=>w.variant==='starter')){
  const veteran=data.worlds.find(w=>w.mode===base.mode&&w.seed===base.seed&&w.focus===base.focus&&w.variant==='veteran_balanced');if(!veteran)continue;
  comparisons.push({run:label,mode:base.mode,seed:base.seed,focus:base.focus,players:base.actors.length,starter:base.actors[0].score,veteran:veteran.actors[0].score,delta:veteran.actors[0].score-base.actors[0].score});
 }
}
// Final score is only a lower bound for XP: live credit uses the highest score reached.
const xpExamples=[1500,1800,2200].map(influence=>({influence,expressXp:Math.floor(influence/5),normalXp:Math.floor(influence/5)*4,expressLevelAfterOneSeason:kingLevelFromXp(Math.floor(influence/5)),expressSeasonsToLevel10:Math.ceil(2025/Math.floor(influence/5))}));
await writeFile(new URL('../reports/cozy/king-equipment-audit.json',import.meta.url),JSON.stringify({scope:'Local engine bot samples, not a population victory-rate estimate. Rank XP remains an uncredited candidate.',kings:roster.length,combinations,maxima,xpExamples,comparisons},null,2));
console.log('PASS 22 equal king budgets, free specialization coverage, 455 loadouts, XP boundaries and rank candidate gates',JSON.stringify({maxima,xpExamples}));
