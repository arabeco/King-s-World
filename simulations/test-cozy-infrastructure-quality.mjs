import assert from 'node:assert/strict';import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const E=loadCozyEngine(),P=loadCozyEngine('progression'),START=1800000000000,w={id:'quality',name:'Quality',mode:'express',economyVersion:2,status:'running',startsAt:START,influenceVersion:2};
const fresh=()=>E.createCozyState(w,'p','p',START),score=s=>P.zeroInfluence(s,s.progression.militaryBaseline,0).infrastructure;
const s=fresh();assert.equal(score(s),0);for(const k of Object.keys(s.cities[0].sectors))s.cities[0].sectors[k]=10;assert.equal(score(s),150);
for(let i=1;i<10;i++)s.cities.push({...structuredClone(s.cities[0]),id:'c'+i,capital:false});assert.equal(score(s),500);const four=structuredClone(s);four.cities=four.cities.slice(0,4);assert.equal(score(four),370);
const prior=structuredClone(four);prior.progression.balance.infrastructureWeights=[100,80,65,55,45,40,35,30,25,25];assert.equal(score(prior),300);delete prior.progression.balance.infrastructureWeights;assert.equal(score(prior),300,'Missing snapshot retains previous ranked weights');
const old=structuredClone(s);delete old.progression.balance.infrastructureRanked;assert.equal(score(old),500);old.cities=old.cities.slice(0,1);assert.equal(score(old),50);
let seed=814;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
for(let n=0;n<100;n++){
 const sample=fresh();for(let i=1;i<1+Math.floor(rand()*9);i++)sample.cities.push({...structuredClone(sample.cities[0]),id:'x'+i,capital:false});
 for(const c of sample.cities)for(const k of Object.keys(c.sectors))c.sectors[k]=1+Math.floor(rand()*10);
 const untouched=structuredClone(sample),before=score(sample);assert.deepEqual(sample,untouched);const copy=structuredClone(sample),c=copy.cities[Math.floor(rand()*copy.cities.length)],k=Object.keys(c.sectors)[Math.floor(rand()*5)];c.sectors[k]=Math.min(10,c.sectors[k]+1);assert(score(copy)>=before);const reversed=structuredClone(sample);reversed.cities.reverse();assert.equal(score(reversed),before);assert(before<=500);if(sample.cities.length<10){const added=structuredClone(sample);added.cities.push({...structuredClone(sample.cities[0]),id:'extra',capital:false});assert(score(added)>=before);}
}
console.log('PASS ranked infrastructure: zero baseline, quality milestones, ten-city ceiling, historical model, monotonic upgrades and order independence');

const ceiling=structuredClone(s);ceiling.heroes=ceiling.cities.map((city,i)=>{city.heroId='h'+i;city.life={contentment:100,lastDecisionDay:null};return {id:city.heroId,name:'Hero',role:'engineer',cityId:city.id};});
for(const research of Object.keys(ceiling.research))ceiling.research[research]=5;
ceiling.hordesWon=6;ceiling.progression.council.merit=500;ceiling.quests=E.QUESTS.map(q=>q.id);ceiling.progression.feats.wonders=['site-a','site-b'];ceiling.progression.feats.supports=Array.from({length:7},(_,i)=>'support'+i);
assert.equal(P.zeroInfluence(ceiling,ceiling.progression.militaryBaseline+27000,0).total,2500);
console.log('PASS: full synthetic achievement state still reaches 2500; not a proof of economic attainability');

const modern=fresh(),historical=structuredClone(modern);delete historical.progression.balance.constructionGrowth;
for(let level=0;level<10;level++){assert.equal(E.upgradeCost(historical,level),Math.round(150*1.42**level));assert.equal(E.upgradeCost(modern,level),Math.round(150*1.36**level));if(level>0){assert(E.upgradeCost(modern,level)>E.upgradeCost(modern,level-1));assert(E.upgradeCost(modern,level)<E.upgradeCost(historical,level));}}
const shared=E.createCozyShared(w);P.bindWorldBalance(shared,[historical],true);assert.equal(shared.progressionBalance.constructionGrowth,undefined,'Old world does not acquire the new cost curve');
console.log('PASS construction costs: increasing curve, full level range and historical world pricing preserved');
