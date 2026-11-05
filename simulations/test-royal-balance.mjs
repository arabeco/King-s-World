import assert from 'node:assert/strict';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const engine=loadCozyEngine(),now=1800000000000,day=86400000;
for(const mode of ['classic','express']){
 const world={id:'balance',name:'Teste',mode,status:'running',startsAt:now,influenceVersion:2,...(mode==='express'?{economyVersion:2}: {})};
 const base=engine.createCozyState(world,'player','Rei',now),shared=engine.createCozyShared(world);
 const character=attrs=>{const s=structuredClone(base);s.king={profileId:'builder',nickname:'Rei',alive:true,generation:1,history:[],attributes:attrs};return s;};
 const novice=character({administration:5,command:5,exploration:5}),veteran=character({administration:8,command:8,exploration:8});
 const a=engine.getCozyComputed(novice,shared,world,now),b=engine.getCozyComputed(veteran,shared,world,now);
 assert(Math.abs(b.productionPerDay.materials/a.productionPerDay.materials-1.08/1.05)<1e-8);
 assert(b.defensePower>=a.defensePower&&b.defensePower<=Math.ceil(a.defensePower*1.08/1.05));
 const ta=engine.getCozyTiles(novice,shared,world).find(t=>t.distance>=3),tb=engine.getCozyTiles(veteran,shared,world).find(t=>t.id===ta.id);
 assert(tb.travelMs<=ta.travelMs&&tb.travelMs>=ta.travelMs*.95);
 const end=now+day*3,sa=engine.settleCozyState(novice,shared,world,end),sb=engine.settleCozyState(veteran,shared,world,end);
 assert(sb.state.resources.materials>sa.state.resources.materials);
 const midway=engine.settleCozyState(veteran,shared,world,now+day);
 const resumed=engine.settleCozyState(midway.state,midway.shared,world,end);
 assert(Math.abs(resumed.state.resources.materials-sb.state.resources.materials)<1e-6,'Offline production must match incremental settlement');
 assert.deepEqual(engine.getCozyComputed(novice,shared,world,now).influence,engine.getCozyComputed(veteran,shared,world,now).influence);
 console.log(`PASS ${mode}: novo 5/5/5 vs veterano 8/8/8; produção +${((b.productionPerDay.materials/a.productionPerDay.materials-1)*100).toFixed(2)}%, defesa ${a.defensePower}→${b.defensePower}, viagem ${ta.travelMs}→${tb.travelMs} ms`);
}
