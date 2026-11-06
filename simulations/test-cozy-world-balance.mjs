import assert from 'node:assert/strict';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const E=loadCozyEngine(),P=loadCozyEngine('progression'),w={id:'weights',name:'Weights',mode:'classic',status:'running',startsAt:1800000000000,influenceVersion:2};
const state=E.createCozyState(w,'old','old',w.startsAt);state.progression.balance.militaryDivisor=12;
const shared=E.createCozyShared(w),before=structuredClone(state);const profile=P.bindWorldBalance(shared,[state]);assert.equal(profile.militaryDivisor,12);assert.deepEqual(state,before);profile.militaryDivisor=24;assert.equal(state.progression.balance.militaryDivisor,12);
assert.equal(P.bindWorldBalance(shared,[]).militaryDivisor,24,'Pinned world profile survives later initialization');
const historical=structuredClone(state);delete historical.progression.balance;const legacy=E.createCozyShared(w);assert.equal(P.bindWorldBalance(legacy,[historical]),null);assert.equal(P.bindWorldBalance(legacy,[]),null);
const fresh=E.createCozyShared(w);assert.equal(P.bindWorldBalance(fresh,[],true).militaryDivisor,75);assert.equal(fresh.progressionBalance.expressEconomy,true);
console.log('PASS: per-world weights pinned, historical and parameterless profiles preserved, inputs not mutated and new-world economy selected');
process.env.COZY_BOT_LIBRARY='1';
const {play}=await import('./balanceamento_expresso_grupos.mjs');
for(const mode of ['classic','express']){
 const world={...w,id:'season-55',mode,...(mode==='express'?{economyVersion:2}:{})};
 const bot=play(55,mode,'casual',E.createCozyShared(world),'bot0',true,'balanced',true);
 assert.deepEqual(bot.next().value.state.progression.balance,P.newProgressionBalance(mode==='express'),'Simulation must inherit the real new-world balance instead of silently resetting military weights');
 bot.return();
}
console.log('PASS simulation and live engine start with identical saved world parameters in Normal and Express');
