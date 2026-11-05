import assert from 'node:assert/strict';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const E=loadCozyEngine(),C=loadCozyEngine('council-context');
const START=1800000000000,DAY=86400000;
const world={id:'context',name:'Context',mode:'classic',status:'running',startsAt:START,influenceVersion:2};
const setup=(w=world)=>{
 const save=E.settleCozyState(E.createCozyState(w,'player','Reino',START),E.createCozyShared(w),w,START);
 save.state.counselors=['helena','ines'];return save;
};
const view=(save,at=START,w=world)=>E.getCozyComputed(save.state,save.shared,w,at);
const colony=(save,id,contentment,integrity=100,unrestDays=0)=>{
 const city={...structuredClone(save.state.cities[0]),id,name:id,capital:false,heroId:null,q:save.state.cities[0].q+save.state.cities.length+2,integrity,life:{contentment,unrestDays,lastDecisionDay:null,lastSocialDay:1}};
 save.state.cities.push(city);save.shared.claims[`${city.q},${city.r}`]={playerId:save.state.playerId,cityId:id,name:id};return city;
};
let checks=0;const test=(name,fn)=>{fn();checks++;console.log('PASS',name);};
test('Government prioritizes a colony close to separation over a damaged capital without mutating city order',()=>{
 const save=setup();save.state.cities[0].integrity=40;
 colony(save,'Cidade triste',15,100,1);const urgent=colony(save,'Cidade perto da ruptura',25,100,5);
 const before=JSON.stringify(save);assert.equal(C.realmCareCity(save.state).id,urgent.id);assert.equal(JSON.stringify(save),before);
 save.state.cities.forEach(city=>city.life.contentment=70);assert.equal(C.realmCareCity(save.state).capital,true);
 save.state.cities[0].integrity=100;assert.equal(C.realmCareCity(save.state),undefined);
});
test('Crisis and repair themes preserve decree identity, option IDs and every canonical numeric effect',()=>{
 const save=setup(),base=view(save).decree;const before=JSON.stringify(save);
 assert.equal(base.title,'As portas da cidade');assert.equal(JSON.stringify(save),before);
 save.state.cities[0].life.contentment=20;
 const crisis=view(save).decree;assert.equal(crisis.title,'As cidades pedem uma resposta');assert(crisis.body.includes(save.state.cities[0].name));
 assert.equal(crisis.id,base.id);assert.deepEqual(crisis.options.map(o=>[o.id,o.effects,o.resolution]),base.options.map(o=>[o.id,o.effects,o.resolution]));
 save.state.cities[0].life.contentment=70;save.state.cities[0].integrity=50;
 const repairs=view(save).decree;assert.equal(repairs.title,'Reerguer as estruturas');assert.equal(repairs.id,base.id);
 assert.deepEqual(repairs.options.map(o=>[o.id,o.effects,o.resolution]),base.options.map(o=>[o.id,o.effects,o.resolution]));
});
test('Horde preparation uses the existing decree interval and never invents another wave or extra decree',()=>{
 const save=setup(),at16=START+15*DAY,at17=START+16*DAY;
 const earlier=view(save,at16).decree,later=view(save,at17).decree;
 assert.notEqual(earlier.title,'Os vigias avistaram a horda');assert.equal(later.title,'Os vigias avistaram a horda');assert(later.body.includes('20'));
 assert.equal(later.id,earlier.id);assert.deepEqual(later.options.map(o=>[o.id,o.effects]),earlier.options.map(o=>[o.id,o.effects]));
 save.state.hordesResolved.push(20);assert.notEqual(view(save,at17).decree.title,'Os vigias avistaram a horda');
 save.state.cities[0].life.contentment=20;assert.equal(view(save,at17).decree.title,'As cidades pedem uma resposta');
});
test('Signing a contextual decree applies exactly its preview once and context changes cannot reopen it',()=>{
 let save=setup();save.state.cities[0].life.contentment=20;
 const d=view(save).decree,choice=d.options.find(o=>o.id==='care'),before=structuredClone(save.state);
 save=E.applyCozyAction(save.state,save.shared,world,{type:'decree',decreeId:d.id,optionId:choice.id},START);
 assert.equal(save.state.resources.materials,before.resources.materials+choice.effects.materials);
 assert.equal(save.state.cities[0].life.contentment,before.cities[0].life.contentment+choice.effects.localSatisfaction[before.cities[0].id]);
 assert.equal(save.state.cities[0].integrity??100,before.cities[0].integrity??100);
 assert.equal(view(save).decree,null);save.state.cities[0].integrity=40;assert.equal(view(save).decree,null);
 assert.throws(()=>E.applyCozyAction(save.state,save.shared,world,{type:'decree',decreeId:d.id,optionId:choice.id},START),/decreto|decisão/i);
});
test('Historical seasons retain their previous topic even when a city is in crisis',()=>{
 const w={...world,influenceVersion:1},save=setup(w);save.state.cities[0].life.contentment=20;
 assert.equal(view(save,START,w).decree.title,'As portas da cidade');
 assert.equal(view(save,START+16*DAY,w).decree.title,'Uma promessa à praça');
});
console.log(`PASS ${checks} council-context scenarios (no balance calibration).`);
