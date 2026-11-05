import assert from 'node:assert/strict';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const E=loadCozyEngine(),A=loadCozyEngine('alliances');
const START=1800000000000,DAY=86400000;
const world={id:'alliance-tests',name:'Cinco reinos',mode:'classic',status:'running',startsAt:START,influenceVersion:2};
function realm(w=world){
 let shared=E.createCozyShared(w);const states={};
 for(let i=1;i<=7;i++){const s=E.settleCozyState(E.createCozyState(w,`p${i}`,`Reino ${i}`,START),shared,w,START);shared=s.shared;states[`p${i}`]=s.state;states[`p${i}`].resources={gold:5000,materials:5000,supplies:5000};}
 return {w,states,get shared(){return shared;},act(id,action,at=START){const s=E.applyCozyAction(states[id],shared,w,action,at);states[id]=s.state;shared=s.shared;return s;},settle(id,at=START){const s=E.settleCozyState(states[id],shared,w,at);states[id]=s.state;shared=s.shared;return s;},view(id,at=START){return E.getCozyComputed(states[id],shared,w,at);}};
}
const create=r=>{r.act('p1',{type:'alliance_create',name:'Guardiões'});return r.states.p1.allianceId;};
function finish(r,kind='defense',id='p1',at=START){r.act('p1',{type:'alliance_project_start',kind},at);const p=r.shared.allianceProjects.at(-1);for(const resource of ['gold','materials','supplies'])if(A.ALLIANCE_PROJECTS[kind].cost[resource])r.act(id,{type:'alliance_project_contribute',projectId:p.id,resource,amount:'max'},at);return r.shared.allianceProjects.at(-1);}
let checks=0;function test(name,fn){fn();checks++;console.log('PASS',name);}
test('Five members are enforced without ejecting an existing oversized group',()=>{
 const r=realm(),id=create(r);for(let i=2;i<=5;i++)r.act(`p${i}`,{type:'alliance_join',allianceId:id});
 assert.throws(()=>r.act('p6',{type:'alliance_join',allianceId:id}),/5 membros/);
 assert.equal(r.shared.alliances[0].members.length,5);
 r.shared.alliances[0].members.push('p6');r.states.p6.allianceId=id;r.settle('p1');assert.equal(r.shared.alliances[0].members.length,6);
 assert.throws(()=>r.act('p7',{type:'alliance_join',allianceId:id}),/5 membros/);
 r.act('p6',{type:'alliance_leave'});assert.equal(r.shared.alliances[0].members.length,5);
});
test('Approval requires a request, leader consent and player acceptance',()=>{
 const r=realm(),id=create(r);r.act('p1',{type:'alliance_settings',admission:'approval'});
 assert.throws(()=>r.act('p2',{type:'alliance_join',allianceId:id}),/pedido|convite/);
 r.act('p2',{type:'alliance_request',allianceId:id});assert.equal(r.states.p2.allianceId,null);
 assert.throws(()=>r.act('p2',{type:'alliance_request',allianceId:id}),/pendente/);
 r.act('p1',{type:'alliance_respond',playerId:'p2',accept:true});assert.equal(r.states.p2.allianceId,null);
 r.act('p2',{type:'alliance_join',allianceId:id});assert.equal(r.states.p2.allianceId,id);assert.deepEqual(r.shared.alliances[0].requests,[]);assert.deepEqual(r.shared.alliances[0].invitations,[]);
 assert.throws(()=>r.act('p2',{type:'alliance_settings',admission:'open'}),/líder/);
 assert.throws(()=>r.act('p2',{type:'alliance_project_start',kind:'defense'}),/líder/);
});
test('Invites target available world players and accepting the last slot cannot overbook',()=>{
 const r=realm(),id=create(r);for(let i=2;i<=4;i++)r.act(`p${i}`,{type:'alliance_join',allianceId:id});
 assert.throws(()=>r.act('p1',{type:'alliance_invite',playerId:'foreign-world'}),/deste mundo/);
 r.act('p2',{type:'alliance_invite',playerId:'p5'});r.act('p1',{type:'alliance_invite',playerId:'p6'});
 assert.throws(()=>r.act('p1',{type:'alliance_invite',playerId:'p5'}),/já recebeu/);
 r.act('p5',{type:'alliance_join',allianceId:id});assert.throws(()=>r.act('p6',{type:'alliance_join',allianceId:id}),/5 membros/);
 r.act('p6',{type:'alliance_decline',allianceId:id});assert(!r.shared.alliances[0].invitations.includes('p6'));
});
test('A player can cancel a pending request and creating a group clears other pending entries',()=>{
 const r=realm(),id=create(r);r.act('p1',{type:'alliance_settings',admission:'approval'});
 r.act('p2',{type:'alliance_request',allianceId:id});r.act('p2',{type:'alliance_decline',allianceId:id});assert.equal(r.shared.alliances[0].requests.length,0);
 r.act('p1',{type:'alliance_invite',playerId:'p2'});r.act('p2',{type:'alliance_create',name:'Outra aliança'});assert.equal(r.shared.alliances[0].invitations.length,0);
});
test('Contributions reserve only missing quantities and completion credits actual participants once',()=>{
 const r=realm(),id=create(r);r.act('p2',{type:'alliance_join',allianceId:id});r.act('p1',{type:'alliance_project_start',kind:'defense'});let p=r.shared.allianceProjects[0];
 const before=r.states.p2.resources.materials;r.act('p2',{type:'alliance_project_contribute',projectId:p.id,resource:'materials',amount:'max'});assert.equal(before-r.states.p2.resources.materials,600);assert.equal(r.view('p2').influence.legacy,0);
 r.act('p1',{type:'alliance_project_contribute',projectId:p.id,resource:'supplies',amount:'max'});p=r.shared.allianceProjects[0];assert.equal(p.completedAt,START);
 r.settle('p2');assert.deepEqual(r.states.p2.progression.feats.projects,[p.id]);assert.equal(r.view('p2').influence.legacy,12);
 assert.equal(r.view('p1').influence.legacy,12);r.settle('p2');assert.equal(r.view('p2').influence.legacy,12);
 assert.throws(()=>r.act('p2',{type:'alliance_project_contribute',projectId:p.id,resource:'materials',amount:50}),/concluído/);
 assert.throws(()=>r.act('p1',{type:'alliance_project_start',kind:'defense'}),/ativo/);
});
test('Unfunded targets and malformed or foreign contributions cannot mint credit or spend resources',()=>{
 const r=realm();create(r);r.act('p1',{type:'alliance_project_start',kind:'provisions'});const p=r.shared.allianceProjects[0],before=structuredClone(r.states.p1.resources);
 assert.throws(()=>r.act('p2',{type:'alliance_project_contribute',projectId:p.id,resource:'gold',amount:50}),/aliança/);
 for(const amount of [-50,NaN,Infinity,1e12,'50'])assert.throws(()=>r.act('p1',{type:'alliance_project_contribute',projectId:p.id,resource:'gold',amount}),/válida/);
 assert.throws(()=>r.act('p1',{type:'alliance_project_contribute',projectId:p.id,resource:'__proto__',amount:50}),/válida/);
 assert.throws(()=>r.act('p1',{type:'alliance_project_contribute',projectId:p.id,resource:'supplies',amount:'max'}),/meta/);
 assert.deepEqual(r.states.p1.resources,before);assert.equal(r.view('p1').influence.legacy,0);
});
test('Dissolution refunds each reserved contribution once, including former members',()=>{
 const r=realm(),id=create(r);r.act('p2',{type:'alliance_join',allianceId:id});r.act('p1',{type:'alliance_project_start',kind:'defense'});const p=r.shared.allianceProjects[0];
 const before=r.states.p2.resources.materials;r.act('p2',{type:'alliance_project_contribute',projectId:p.id,resource:'materials',amount:100});r.act('p2',{type:'alliance_leave'});assert.equal(r.states.p2.resources.materials,before-100);
 r.act('p1',{type:'alliance_leave'});r.settle('p2');assert.equal(r.states.p2.resources.materials,before);r.settle('p2');assert.equal(r.states.p2.resources.materials,before);assert.equal(r.view('p2').influence.legacy,0);
});
test('Collective defense is real, nonstacking and ends on departure; personal contribution remains',()=>{
 const r=realm(),id=create(r);r.act('p2',{type:'alliance_join',allianceId:id});const before=r.view('p2'),p=finish(r,'defense','p2');r.settle('p2');
 const active=r.view('p2');assert(active.allianceDefenseBonus>0);assert.equal(active.defensePower,Math.floor(before.defensePower*1.1));assert.equal(active.influence.military,before.influence.military);
 r.settle('p1');assert.equal(r.view('p1').allianceDefenseBonus,active.allianceDefenseBonus);
 r.act('p2',{type:'alliance_leave'});assert.equal(r.view('p2').defensePower,before.defensePower);assert.deepEqual(r.states.p2.progression.feats.projects,[p.id]);
});
test('The project defense changes a real horde outcome and records each battle once',()=>{
 const r=realm();create(r);r.states.p1.army.militia=75;r.states.p3.army.militia=75;
 const at=START+18*DAY;finish(r,'defense','p1',at);r.settle('p1',START+19*DAY);r.settle('p3',START+19*DAY);
 assert.equal(r.states.p1.hordesWon,1);assert.equal(r.states.p3.hordesWon,0);
 const battle=r.shared.allianceBattles[0];assert.equal(battle.won,true);assert.equal(battle.defense,82);assert.equal(battle.enemyPower,80);
 r.settle('p1',START+19*DAY);assert.equal(r.shared.allianceBattles.length,1);
});
test('Shared battle damage uses the lost city identity and its actual remaining integrity',()=>{
 const r=realm();create(r);const capital=r.states.p1.cities[0],colony={...structuredClone(capital),id:'last-colony',q:capital.q+2,capital:false,integrity:20};
 r.states.p1.cities.push(colony);r.shared.claims[`${colony.q},${colony.r}`]={playerId:'p1',cityId:colony.id,name:colony.name};r.states.p1.army.militia=0;
 r.settle('p1',START+19*DAY);const battle=r.shared.allianceBattles[0];assert.equal(battle.won,false);assert.equal(battle.damage.city,capital.name);assert.equal(battle.damage.integrityLost,20);assert.equal(battle.damage.lost,true);
});
test('Supply production settles exact project start/end boundaries in both season rhythms',()=>{
 for(const mode of ['classic','express']){
  const w={...world,mode},d=DAY/(mode==='express'?4:1),r=realm(w);create(r);const base=r.view('p1').productionPerDay.supplies;
  const start=START+d/2;finish(r,'provisions','p1',start);const after=r.states.p1.resources.supplies;
  r.settle('p1',start+8*d);assert(Math.abs(r.states.p1.resources.supplies-after-base*(7*1.1+1))<1e-6);
  assert.equal(r.view('p1',start+8*d).allianceSupplyBonus,0);
 }
});
test('New members receive an active collective benefit without unearned personal credit',()=>{
 const r=realm(),id=create(r);finish(r);r.act('p2',{type:'alliance_join',allianceId:id});assert(r.view('p2').allianceDefenseBonus>0);assert.equal(r.view('p2').influence.legacy,0);
});
test('A former contributor retains completion credit while outside the group, without its active bonus',()=>{
 const r=realm(),id=create(r);r.act('p2',{type:'alliance_join',allianceId:id});r.act('p1',{type:'alliance_project_start',kind:'defense'});const p=r.shared.allianceProjects[0];
 r.act('p2',{type:'alliance_project_contribute',projectId:p.id,resource:'materials',amount:'max'});r.act('p2',{type:'alliance_leave'});
 r.act('p1',{type:'alliance_project_contribute',projectId:p.id,resource:'supplies',amount:'max'});r.settle('p2');assert.equal(r.view('p2').influence.legacy,12);assert.equal(r.view('p2').allianceDefenseBonus,0);
});
test('Project funding remains frozen before start and after the season closes',()=>{
 const open={...world,status:'open',startsAt:null};assert.throws(()=>E.applyCozyAction(E.createCozyState(open,'waiting','Esperando',START),E.createCozyShared(open),open,{type:'alliance_project_start',kind:'defense'},START),/Aguarde/);
 const r=realm();create(r);const p=finish(r);r.settle('p1',START+120*DAY);
 assert.throws(()=>r.act('p1',{type:'alliance_project_start',kind:'provisions'},START+120*DAY),/terminou/);
 assert.equal(r.states.p1.allianceProjectReceipts[p.id],'completed');
});
console.log(`PASS ${checks} alliance scenarios.`);
