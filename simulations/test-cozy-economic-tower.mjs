import assert from 'node:assert/strict';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const E=loadCozyEngine(),START=1800000000000,DAY=86400000;
const w={id:'economic-tower',name:'Tower',mode:'express',economyVersion:2,speedMultiplier:1,status:'running',startsAt:START,influenceVersion:2};
let shared=E.createCozyShared(w);const states={};
for(const id of ['a','b']){const x=E.settleCozyState(E.createCozyState(w,id,id,START),shared,w,START);shared=x.shared;states[id]=x.state;states[id].resources={gold:1e6,materials:1e6,supplies:1e6};states[id].army.machinery=10000;}
const act=(id,action,at)=>{const x=E.applyCozyAction(states[id],shared,w,action,at);states[id]=x.state;shared=x.shared;};
const settle=(id,at)=>{const x=E.settleCozyState(states[id],shared,w,at);states[id]=x.state;shared=x.shared;};
act('a',{type:'alliance_create',name:'Guardiões'},START);act('b',{type:'alliance_join',allianceId:states.a.allianceId},START);
const tower=E.getCozyComputed(states.a,shared,w,START).sanctuaries[0];act('a',{type:'sanctuary_explore',sanctuaryId:tower.id},START);let at=states.a.orders.find(o=>o.sanctuaryId===tower.id).arrivesAt;settle('a',at);
act('a',{type:'sanctuary_pact_start',sanctuaryId:tower.id,kind:'defense',scope:'alliance'},at);const pactId=shared.sanctuaryPacts[0].id;
for(const resource of ['materials','supplies'])act('a',{type:'sanctuary_pact_contribute',pactId,resource,amount:'max'},at);
act('a',{type:'sanctuary_pact_challenge',pactId},at);at=states.a.orders.find(o=>o.sanctuaryPactId===pactId).arrivesAt;settle('a',at);
const pact=shared.sanctuaryPacts[0];assert(pact.completedAt);assert(pact.raids.waves.length>0);const wave=pact.raids.waves[0];assert([5,10,15,20,25,28].includes(wave.day));assert.equal(wave.arrivesAt,START+(wave.day-1)*DAY);
act('b',{type:'sanctuary_pact_defend',pactId,waveDay:wave.day},at);assert(shared.sanctuaryPacts[0].raids.waves[0].defenders.some(d=>d.playerId==='b'));
settle('a',wave.arrivesAt);assert.equal(shared.sanctuaryPacts[0].raids.waves[0].outcome,'won');
const before=structuredClone(shared);settle('a',wave.arrivesAt);assert.deepEqual(shared,before);
console.log('PASS economic tower: paid exploration, group funding, guardians, real-calendar wave, allied defense and idempotent outcome (prefunded unit fixture, not economy proof)');
