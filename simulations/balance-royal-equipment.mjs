import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
process.env.COZY_BOT_LIBRARY='1';
const {play}=await import('./balanceamento_expresso_grupos.mjs');
const E=loadCozyEngine(),S=loadCozyEngine('settlement'),DAY=86400000,START=1800000000000;
const starters=['item-craft-ledger','item-guard-crest','item-travel-compass'];
const configs={novice_administration:{attributes:{administration:8,command:4,exploration:3},equipment:starters},novice_command:{attributes:{administration:3,command:8,exploration:4},equipment:starters},novice_exploration:{attributes:{administration:4,command:3,exploration:8},equipment:starters},starter:{attributes:{administration:5,command:5,exploration:5},equipment:starters},veteran_balanced:{attributes:{administration:8,command:8,exploration:8},equipment:['item-builder-tools','item-harvest-coffer','item-frontier-shield']},veteran_economy:{attributes:{administration:10,command:7,exploration:7},equipment:['item-builder-tools','item-granary-seal','item-steward-ledger']},veteran_command:{attributes:{administration:7,command:10,exploration:7},equipment:['item-frontier-shield','item-watch-standard','item-journey-crown']},veteran_travel:{attributes:{administration:7,command:7,exploration:10},equipment:['item-cartographer-divider','item-road-map','item-journey-crown']}};
for(const [key,c] of Object.entries(configs)){assert.equal(Object.values(c.attributes).reduce((a,b)=>a+b,0),key==='starter'||key.startsWith('novice_')?15:24);assert(Object.values(c.attributes).every(v=>v<=10));}
const focalSeat=Number(process.env.META_SEAT??0),focalProfile=process.env.META_PROFILE??'casual',coop=process.env.META_COOP!=='0',towers=process.env.META_TOWERS!=='0';
assert(['casual','diario','poor','absent'].includes(focalProfile));
const output=[];const size=Number(process.env.META_SIZE??3);assert(size>=3&&size<=5);const label=process.env.META_LABEL??'paired';assert(/^[a-z0-9-]+$/.test(label));
const modes=(process.env.META_MODES??'express').split(','),seeds=(process.env.META_SEEDS??'11').split(',').map(Number),variants=(process.env.META_VARIANTS??'starter,veteran_balanced').split(','),focuses=(process.env.META_FOCUS??'balanced').split(',');
assert(modes.every(mode=>['express','classic'].includes(mode)),'Unknown season mode');
assert(variants.every(variant=>Object.hasOwn(configs,variant)),'Unknown royal configuration');
assert(focuses.every(focus=>['balanced','infrastructure','government','military','council','conquests'].includes(focus)),'Unknown bot focus; Conquistas uses conquests');
assert(Number.isInteger(focalSeat)&&focalSeat>=0&&focalSeat<size);
for(const mode of modes)for(const seed of seeds)for(const focus of focuses)for(const variant of variants){
 const world={id:`season-${seed}`,name:'Meta paired',mode,influenceVersion:2,...(mode==='express'?{economyVersion:2}:{}),speedMultiplier:1,status:'running',startsAt:START};let shared=E.createCozyShared(world);const handles=[];
 const daily=[];
 for(let i=0;i<size;i++){
  const profile=i===focalSeat?(focalProfile==='diario'?'diario':'casual'):i===(focalSeat+2)%size?'diario':'casual',playerId='bot'+i,royal=i===focalSeat?configs[variant]:configs.starter;
  const behavior=i===focalSeat?(focalProfile==='poor'?{visitRate:.9,quality:'poor'}:focalProfile==='absent'?{visitRate:.25,actionBudget:3}:{}):{};
  const gen=play(seed,mode,profile,shared,playerId,coop,i===focalSeat?focus:'balanced',towers,royal,behavior),message=gen.next();shared=message.value.shared;handles.push({gen,message,playerId,state:message.value.state,influence:0});
 }
 const days=mode==='express'?30:120;
 for(let day=1;day<=days;day++){
  const now=START+(day-1)*DAY;shared=S.settleWorld(handles,shared,world,now);
  for(let offset=0;offset<handles.length;offset++){const h=handles[(offset+day+seed)%handles.length],message=h.gen.next({state:h.state,shared});assert(!message.done);h.message=message;h.state=message.value.state;shared=message.value.shared;}
  shared=S.settleWorld(handles,shared,world,now);
  daily.push({day,players:handles.map(h=>({id:h.playerId,score:E.getCozyComputed(h.state,shared,world,now).influence.total}))});
 }
 shared=S.settleWorld(handles,shared,world,START+days*DAY);
 const actors=handles.map(h=>{const last=h.gen.next({state:h.state,shared});assert(last.done);const r=last.value;return {playerId:h.playerId,score:r.score,influence:r.influence,seal:r.seal,actions:r.actions,cities:r.cities,hordesWon:r.hordesWon,history:r.history,failures:r.failures,resources:r.resources,research:r.research,heroes:r.heroes,council:r.council,cityLevels:r.cityLevels,visitedDays:r.visitedDays,actionTypes:r.ledger.reduce((m,a)=>(m[a.type]=(m[a.type]??0)+1,m),{}),spending:r.ledger.reduce((m,a)=>{m[a.type]??={gold:0,materials:0,supplies:0};for(const key of ['gold','materials','supplies'])m[a.type][key]+=Math.max(0,a.resourcesBefore[key]-a.resourcesAfter[key]);return m;},{})};});
 output.push({mode,seed,focus,variant,focalSeat,focalProfile,coop,towers,botPolicy:process.env.BOT_POLICY??'baseline',actors,daily});console.log(mode,seed,focus,variant,actors.map(a=>`${a.playerId}:${a.score}`).join(' '));
 await mkdir(new URL('../reports/cozy/',import.meta.url),{recursive:true});await writeFile(new URL(`../reports/cozy/royal-equipment-${label}.json`,import.meta.url),JSON.stringify({scope:'Real engine and shared world, mixed casual/daily alliance with towers, paired actor IDs and stochastic decisions; no injected resources; paired focal actor has explicit seat, behavior and configuration; no population forecast.',configs,worlds:output},null,2));
}
