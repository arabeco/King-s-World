import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const E=loadCozyEngine(),S=loadCozyEngine('settlement'),P=loadCozyEngine('player-campaign'),hour=3600000,start=1800000000000,rows=[];
for(const distance of [1,5,15])for(const troops of [100,150,300,500])for(const responseHours of [24,48,72])for(const veteran of [false,true]){
 const world={id:'campaign-balance',mode:'express',economyVersion:2,influenceVersion:2,status:'running',startsAt:start,combatMode:'competitive'};let shared=E.createCozyShared(world);
 const players=['a','b'].map((id,i)=>{const state=E.createCozyState(world,id,id,start);Object.assign(state.cities[0],{q:-30+(i?distance:0),r:10});for(const sector of Object.keys(state.cities[0].sectors))state.cities[0].sectors[sector]=5;
  state.army={militia:i?100:troops,shooters:0,scouts:0,machinery:0};state.research.military=3;state.research.fortification=3;state.king={profileId:'builder',nickname:id,alive:true,generation:1,history:[],attributes:{administration:5,command:!i&&veteran?10:5,exploration:5},equipment:!i&&veteran?['item-frontier-shield','item-builder-tools','item-road-map']:[]};return {playerId:id,state,influence:0};});
 const a=players[0],b=players[1],target={...structuredClone(b.state.cities[0]),id:'target',capital:false,q:b.state.cities[0].q+1,heroId:null};b.state.cities.push(target);
 a.state.cities.push({...structuredClone(a.state.cities[0]),id:'attacker-colony',capital:false,q:-31,heroId:null});
 a.state.heroes=[{id:'occupier',name:'Occupier',role:'general',cityId:null}];a.state.explored.push(`${target.q},${target.r}`);
 for(const p of players)for(const city of p.state.cities)shared.claims[`${city.q},${city.r}`]={playerId:p.playerId,cityId:city.id,name:city.name};
 const quote=P.playerCampaign(a.state,world,target);let attacks=0,defenderVisits=0,repairs=0,captureAt=null;
 for(let t=0;t<=7*24;t++){
  const now=start+t*hour;shared=S.settleWorld(players,shared,world,now);
  if(!b.state.cities.some(c=>c.id===target.id)){captureAt??=now-start;break;}
  if(t>0&&t%responseHours===0){defenderVisits++;const c=E.getCozyComputed(b.state,shared,world,now),decision=c.cityLife[target.id]?.decision;
   if(decision){const choice=decision.options.find(o=>o.id==='repair'&&b.state.resources.materials>=120)??decision.options.find(o=>o.id==='volunteers')??decision.options[0];if(choice){const result=E.applyCozyAction(b.state,shared,world,{type:'city_decision',cityId:target.id,decisionId:decision.id,optionId:choice.id},now);b.state=result.state;shared=result.shared;repairs++;}}
   const latest=E.getCozyComputed(b.state,shared,world,now);if(Object.values(b.state.army).reduce((s,n)=>s+n,0)<latest.armyCapacity&&b.state.resources.materials>=latest.troopCosts.militia){const result=E.applyCozyAction(b.state,shared,world,{type:'recruit',troop:'militia',amount:'max'},now);b.state=result.state;shared=result.shared;}
  }
  if(!a.state.orders.some(o=>o.kind==='attack')&&a.state.army.militia>0&&a.state.resources.supplies>=quote.supplies){const result=E.applyCozyAction(a.state,shared,world,{type:'attack_player',q:target.q,r:target.r,conquest:true,heroId:'occupier'},now);a.state=result.state;shared=result.shared;attacks++;}
  for(const p of players){assert(Object.values(p.state.resources).every(n=>Number.isFinite(n)&&n>=0));assert(Object.values(p.state.army).every(n=>Number.isSafeInteger(n)&&n>=0));}
 }
 rows.push({distanceToCapital:distance,targetDistance:distance+1,troops,veteran,responseHours,firstWarningHours:quote.arrivalMs/hour,attacks,defenderVisits,repairs,capturedHours:captureAt===null?null:captureAt/hour,attackerTroops:a.state.army.militia,defenderTroops:b.state.army.militia,integrity:b.state.cities.find(c=>c.id===target.id)?.integrity??0});
}
assert(rows.every(r=>r.firstWarningHours>=12));
const summaries=[24,48,72].map(responseHours=>{const cases=rows.filter(r=>r.responseHours===responseHours),captured=cases.filter(r=>r.capturedHours!==null);return {responseHours,cases:cases.length,captures:captured.length,fastestCaptureHours:captured.length?Math.min(...captured.map(r=>r.capturedHours)):null};});
await writeFile(new URL('../reports/cozy/player-campaign-balance.json',import.meta.url),JSON.stringify({scope:'72 deterministic midgame combat fixtures, legal army/city levels and starting resource stocks, real production/repairs/recruitment/settlement; not a season economy or population forecast',summaries,rows},null,2));
console.log('PASS campaign response stress',JSON.stringify(summaries));
