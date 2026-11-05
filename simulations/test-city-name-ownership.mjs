import assert from 'node:assert/strict';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const E=loadCozyEngine(),at=1800000000000,world={id:'city-names',name:'City names',mode:'classic',status:'running',startsAt:at,influenceVersion:2};
let saved=E.settleCozyState(E.createCozyState(world,'p','King',at),E.createCozyShared(world),world,at);
saved=E.applyCozyAction(saved.state,saved.shared,world,{type:'king_choose',profileId:'builder',nickname:'King'},at);
const city=saved.state.cities[0];const rename=name=>E.applyCozyAction(saved.state,saved.shared,world,{type:'rename_city',cityId:city.id,name},at);
assert.throws(()=>rename('x'));assert.throws(()=>rename(city.name));assert(!saved.state.cities[0].renamedBy);
saved=rename('Vale do Sol');assert.equal(saved.shared.claims[`${city.q},${city.r}`].name,'Vale do Sol');assert.deepEqual(saved.state.cities[0].renamedBy,['p']);assert.throws(()=>rename('Outro nome'),/já escolheu/);
// A successor in the same empire cannot reset the owner's entitlement.
saved.state.king.alive=false;saved=E.applyCozyAction(saved.state,saved.shared,world,{type:'king_choose',profileId:'builder',nickname:'Successor'},at);assert.throws(()=>rename('Successor name'),/já escolheu/);
// A new owner has their own choice; returning owners retain their previous receipt.
saved.state.playerId='q';saved.shared.claims[`${city.q},${city.r}`].playerId='q';saved=rename('Porto Real');assert.deepEqual(saved.state.cities[0].renamedBy,['p','q']);saved.state.playerId='p';assert.throws(()=>rename('Return name'),/já escolheu/);
console.log('PASS city names: once per empire owner, invalid/no-op names preserve choice, shared claim synchronized, succession cannot reset and new owners retain their own choice');
