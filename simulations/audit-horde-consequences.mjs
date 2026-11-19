// Diagnostic only: exercise the existing seasonal combat without enabling it in Cozy.
import assert from 'node:assert/strict';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';

const engine = loadCozyEngine();
const start = 1_800_000_000_000;
const world = {id:'audit-horde',name:'Auditoria',mode:'express',economyVersion:2,
  influenceVersion:2,status:'running',startsAt:start};

for (const [militia,wall] of [[0,0], [25,1], [100,3], [300,5]]) {
  let state = engine.createCozyState(world,`player-${militia}`,'Teste',start);
  let shared = engine.createCozyShared(world);
  state.army = {militia,shooters:0,scouts:0,machinery:0};
  // A built city makes the change in infrastructure visible in the result.
  state.cities[0].sectors = {administration:5,economy:5,society:5,recruitment:5,defense:wall};
  ({state,shared} = engine.settleCozyState(state,shared,world,start));
  const before = engine.getCozyComputed(state,shared,world,start);
  const horde = before.nextHorde;
  assert(horde, 'The control scenario must have a scheduled horde');
  ({state,shared} = engine.settleCozyState(state,shared,world,horde.arrivesAt));
  const after = engine.getCozyComputed(state,shared,world,horde.arrivesAt);
  const report = state.reports.find(item => item.kind === 'horde');
  assert(report, 'The existing combat must record the outcome');
  console.log(JSON.stringify({militia,wall,defense:before.defensePower,enemy:horde.power,
    won:before.defensePower>=horde.power,troopsAfter:state.army.militia,
    integrity:state.cities[0].integrity,
    infrastructureBefore:before.influence.infrastructure,
    infrastructureAfter:after.influence.infrastructure,report:report.body}));
}
