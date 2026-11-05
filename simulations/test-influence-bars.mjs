import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const E=loadCozyEngine(),P=loadCozyEngine('progression'),START=1800000000000;
const w={id:'bar-audit',name:'Audit',mode:'classic',status:'running',startsAt:START,influenceVersion:2};
const s=E.createCozyState(w,'p','p',START);delete s.progression.balance;s.progression.council.merit=400;
const council=[];
for(const trust of [0,35,42,49,56,63,70,100]){
 s.cities[0].life={contentment:trust,lastDecisionDay:null};
 const score=P.zeroInfluence(s,0,0);const expected=Math.round(400*Math.max(0,Math.min(1,(trust-35)/35)));
 assert.equal(score.society,expected);council.push({trust,merit:400,influence:score.society});
}
const military=[];const base=s.progression.militaryBaseline;
s.cities[0].life.contentment=100;
s.cities.push({...structuredClone(s.cities[0]),id:'second',capital:false,life:{contentment:0,lastDecisionDay:null}});
assert.equal(P.zeroInfluence(s,base,0).society,200,'Average local clipped factors, not raw trust');
for(const earned of [0,5,6,600,1500,2999,3000,6000]){
 const score=P.zeroInfluence(s,base+earned,0);assert.equal(score.military,Math.min(500,Math.floor(earned/6)));military.push({earned,influence:score.military});
}
await writeFile(new URL('../reports/cozy/influence-bars.json',import.meta.url),JSON.stringify({council,military},null,2));
console.log('PASS: actual Council trust curve and Military baseline, step and cap boundaries');
