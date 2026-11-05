import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const output=ts.transpileModule(readFileSync(new URL('../lib/cozy/map-presentation.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const exports={};vm.runInNewContext(output,{exports,Set,Map});
const tile=(id,q,r,kind,revealed=true,remaining=100)=>({id,q,r,kind,revealed,ownerId:null,deposit:{remaining}});
const visible=tile('visible',0,0,'gold'),hidden=tile('hidden',1,0,'gold',false),spent=tile('spent',2,0,'gold',true,0),occupied={...tile('city',0,1,'gold'),ownerId:'other'},other=tile('materials',1,1,'materials');
const input=[visible,hidden,spent,occupied,other],before=JSON.stringify(input);
const regions=exports.resourceRegions(input);
assert.equal(regions.length,2);
assert.deepEqual(JSON.parse(JSON.stringify(regions.flatMap(r=>r.cells.map(c=>c.id)).sort())),['materials','visible']);
assert.equal(JSON.stringify(input),before,'Cartography cannot alter reserves or ownership');
assert.equal(exports.resourceRegions([spent]).length,0,'Exhaustion removes resource presentation');
assert.equal((exports.borderPath([{q:0,r:0},{q:1,r:0}]).match(/M/g)||[]).length,10,'Shared political edge is hidden');
for(const coord of [{q:-40,r:-40},{q:40,r:40},{q:12,r:-23}]){const roundTrip=exports.mapCoord(exports.mapPoint(coord));assert(Math.abs(roundTrip.q-coord.q)<1e-8&&Math.abs(roundTrip.r-coord.r)<1e-8);}
console.log('PASS Map fog, depletion, ownership, shared edges and camera coordinate conversions');

const landmarks={};vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../lib/cozy/landmarks.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:landmarks});
assert.equal(landmarks.WORLD_SANCTUARIES.length,6);assert.equal(landmarks.ALL_SANCTUARIES.length,7);
assert(landmarks.ALL_SANCTUARIES.every(s=>s.cells.length===37));
const footprints=landmarks.ALL_SANCTUARIES.flatMap(s=>s.cells.map(c=>`${c.q},${c.r}`));assert.equal(new Set(footprints).size,7*37);
const radii=landmarks.WORLD_SANCTUARIES.map(s=>{const p=exports.mapPoint(s);return Math.hypot(p.x,p.y/exports.MAP_GROUND_Y);});assert(Math.max(...radii)-Math.min(...radii)<1e-7);
console.log('PASS Six equal-distance outer sanctuaries plus distinct center; 259 unique reserved cells');

const assets=JSON.parse(readFileSync(new URL('../lib/cozy/map-assets.json',import.meta.url),'utf8'));
for(const name of ['construction','cityConstruction','cityConstructionStage1','cityConstructionStage2','cityConstructionStage3','cityCompleted','gold','time','alliance','uiMaterials','uiSupplies']){
 const art=assets[name],png=readFileSync(new URL(`../public${art.src}`,import.meta.url));
 assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),art.width);assert.equal(png.readUInt32BE(20),art.height);assert.equal(png[25],6,'Construction art must retain RGBA transparency');
 const [l,t,r,b]=art.bounds;assert(l>=0&&t>=0&&r<=art.width&&b<=art.height&&r>l&&b>t);
}
console.log('PASS Medieval city/worksite PNG dimensions, alpha format and non-destructive crop bounds');

const catalog={};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../lib/cozy/catalog.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:catalog});
const sectorIds=['administration','economy','society','recruitment','defense'];
const makeCity=(total,capital=false)=>({capital,sectors:Object.fromEntries(sectorIds.map((id,i)=>[id,Math.max(0,Math.min(10,total-i*10))]))});
for(const [total,expected] of [[0,1],[16,1],[17,2],[33,2],[34,3],[50,3]]){
 const city=makeCity(total),before=JSON.stringify(city),look=catalog.getCityAppearance(city);
 assert.equal(look.stage,expected,`Completed levels ${total}`);
 assert.equal(look.development,total*2);
 assert(assets[look.art]);assert.equal(JSON.stringify(city),before,'Appearance never mutates a save');
}
assert.equal(catalog.getCityAppearance(makeCity(5,true)).art,'settlementSmall','A new capital is inhabited');
assert.equal(catalog.getCityAppearance(makeCity(50,true)).art,'settlementLarge','Developed capital is a large city');
assert.equal(catalog.getCityAppearance(makeCity(50)).art,'settlementLarge');
for(const name of ['cityConstructionStage1','cityConstructionStage2','cityConstructionStage3'])assert.deepEqual(assets[name].bounds,assets.cityCompleted.bounds,'All construction stages keep the same framing');
console.log('PASS City evolution boundaries, initial capital, finished city and immutable legacy presentation');

const engine=loadCozyEngine(),start=1800000000000;
const world={id:'city-art-test',name:'City art',mode:'classic',status:'running',startsAt:start,influenceVersion:2};
for(const total of [16,33]){
 const state=engine.createCozyState(world,'city-art-player','Rei',start),shared=engine.createCozyShared(world);
 state.cities[0].sectors=makeCity(total).sectors;state.resources.materials=1000000;
 const city=state.cities[0],sector=sectorIds.find(id=>city.sectors[id]<10),initial=catalog.getCityAppearance(city);
 const ordered=engine.applyCozyAction(state,shared,world,{type:'upgrade',cityId:city.id,sector},start);
 assert.equal(catalog.getCityAppearance(ordered.state.cities[0]).stage,initial.stage,'Ordering does not advance the art');
 const arrival=ordered.state.orders.find(o=>o.kind==='upgrade').arrivesAt;
 const before=engine.settleCozyState(ordered.state,ordered.shared,world,arrival-1);
 assert.equal(catalog.getCityAppearance(before.state.cities[0]).stage,initial.stage,'A pending upgrade keeps the current stage');
 const finished=engine.settleCozyState(before.state,before.shared,world,arrival);
 assert.equal(catalog.getCityAppearance(finished.state.cities[0]).stage,initial.stage+1,'Server completion advances the stage');
 assert.equal(catalog.getCityAppearance(JSON.parse(JSON.stringify(finished.state.cities[0]))).stage,initial.stage+1,'Reload retains the completed appearance');
}
console.log('PASS Actual engine upgrade arrivals advance all three visual boundaries only on completion');

const navigation=loadCozyEngine('map-navigation');
const mine={...tile('capital',0,0,'city'),ownerId:'me',cityId:'capital',name:'Vila Áurea',distance:0};
const a={...tile('gold-a',1,0,'gold'),name:'Veio dourado',clue:'Reserva',distance:1,deposit:{remaining:500,resource:'gold'},area:{id:'gold-area',cells:['1,0','2,0'],owners:['me'],canCollect:true,canAnnex:false}};
const b={...a,id:'gold-b',q:2,distance:2};
const fog={...tile('secret',5,0,'gold',false),name:'Segredo proibido',clue:'Nome secreto',distance:5};
const exhausted={...a,id:'spent',q:3,distance:3,deposit:{remaining:0,resource:'gold'}};
const journey={id:'trip',kind:'explore',q:5,r:0,createdAt:1,arrivesAt:100};
const mapData={tiles:[fog,b,mine,a,exhausted],state:{playerId:'me',allianceId:'alliance',orders:[journey]},players:[{playerId:'friend',playerName:'Companheiro',allianceId:'alliance'}]};
const original=JSON.stringify(mapData);
const resources=navigation.mapDestinations(mapData,'resources');assert.equal(resources.length,1);assert.equal(resources[0].accesses,2);assert.equal(resources[0].tile.id,'gold-a');assert.equal(resources[0].tile.deposit.remaining,500,'Grouping never multiplies a reserve');
assert.equal(navigation.mapDestinations(mapData,'cities','vila aurea').length,1,'Search ignores accents');
assert.equal(navigation.mapDestinations(mapData,'resources','2,0')[0].tile.id,'gold-b','Coordinates can select another access in the area');
assert.equal(navigation.mapDestinations(mapData,'journeys').length,1);assert.equal(navigation.mapDestinations(mapData,'journeys','segredo').length,0,'Search cannot disclose a hidden name');
assert.equal(navigation.mapDestinations({...mapData,state:{...mapData.state,orders:[]}},'all').some(d=>d.tile.id==='secret'),false,'Unknown points are not indexed');
assert.equal(navigation.mapOwnership({...a,ownerId:'friend'},mapData),'Aliado · Companheiro');
assert.equal(navigation.mapOwnership({...fog,ownerId:'friend'},mapData),'Sob a névoa');
assert.match(navigation.mapAreaAccess(exhausted,'me'),/esgotada/);
assert.equal(JSON.stringify(mapData),original,'Destination navigation is read-only');
assert.deepEqual(navigation.readMapCamera('{"center":{"q":2,"r":-4},"scale":1}'),{center:{q:2,r:-4},scale:1});
for(const invalid of ['bad','null','{"center":{"q":500,"r":0},"scale":1}','{"center":{"q":0,"r":0},"scale":99}'])assert.equal(navigation.readMapCamera(invalid),null);
assert.deepEqual(navigation.journeyOrigin([{q:0,r:0},{q:8,r:2}],{q:9,r:2}),{q:8,r:2});
console.log('PASS Known-destination search, fog privacy, single reserves, access labels, camera validation and indicative routes');

assert.equal(navigation.mapCaption('Vila do Rio'),'Vila do Rio');
assert.equal(Array.from(navigation.mapCaption('Um nome de cidade extremamente longo')).length,16);
assert.equal(navigation.mapCaption('👑'.repeat(20)).includes('�'),false);
console.log('PASS Compact map captions keep short names and Unicode intact');

assert.equal(navigation.readMapCamera('{"center":{"q":0.5,"r":-0.25},"scale":1}').center.q,0.5);
for(let q=-4;q<=4;q++)for(let r=-4;r<=4;r++){
 const center=exports.mapPoint({q,r});
 for(let angle=0;angle<360;angle+=5){
  const a=angle*Math.PI/180,at={x:center.x+23*Math.cos(a),y:center.y+23*Math.sin(a)*exports.MAP_GROUND_Y};
  const hit=exports.roundMapCoord(exports.mapCoord(at));
  assert.equal(hit.q,q);assert.equal(hit.r,r);
 }
}
console.log('PASS 5832 hex interior taps and fractional camera persistence');

const identities=loadCozyEngine('map-identity');
const ownerIds=Array.from({length:20},(_,i)=>`stress-player-${i}`);
assert.equal(new Set(ownerIds.map(id=>identities.mapIdentity(id).code)).size,20);
for(const id of ownerIds){assert.match(identities.mapIdentity(id).code,/^[A-Z0-9]{4}$/);}
console.log('PASS Stable monochrome identity codes for the 20-player stress roster');

assert.equal(navigation.mapAreaAccess({...a,area:{...a.area,owners:['me','friend']}},'me'),'Área compartilhada · coleta liberada');
assert.equal(navigation.mapAreaAccess({...a,area:{...a.area,owners:['friend','me']}},'me'),'Área compartilhada · coleta liberada');
console.log('PASS Shared reserve label does not depend on owner ordering');

// Points either side of a visible shared edge must resolve to the correct hex.
for(const [dq,dr] of [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]]) {
 const neighbor=exports.mapPoint({q:dq,r:dr});
 for(const fraction of [.49,.51]) {
  const hit=exports.roundMapCoord(exports.mapCoord({x:neighbor.x*fraction,y:neighbor.y*fraction}));
  assert.deepEqual([hit.q,hit.r],fraction<.5?[0,0]:[dq,dr]);
 }
}

// Discovery must not be inferred from public ownership or the location of a tower.
{
 const E=loadCozyEngine(),world={id:'fog-regression',name:'Fog',mode:'classic',status:'running',startsAt:1800000000000};
 const state=E.createCozyState(world,'viewer','Viewer',world.startsAt),shared=E.createCozyShared(world);
 state.cities[0].q=16;state.cities[0].r=0;state.explored=[];
 shared.claims['17,0']={playerId:'stranger',cityId:'secret',name:'Hidden city'};
 shared.claims['-30,0']={playerId:'distant',cityId:'distant',name:'Distant city'};
 shared.territories={'17,0':'stranger'};
 let cells=E.getCozyTiles(state,shared,world);
 const hidden=cells.find(t=>t.id==='17,0');
 assert.equal(hidden.revealed,false);assert.equal(hidden.kind,'unknown');
 assert.equal(hidden.terrainVisible,true,'Visible landscape does not grant a survey or ownership');
 assert.equal(hidden.ownerId,null);assert.equal(hidden.cityId,null);assert.equal(hidden.territoryOwnerId,null);
 assert.equal(cells.some(t=>t.id==='-30,0'),false);
 assert.deepEqual([...new Set(cells.filter(t=>t.landmarkId).map(t=>t.landmarkId))],['sanctuary-1']);
 state.explored.push('17,0','-22,0');
 cells=E.getCozyTiles(state,shared,world);
 assert.equal(cells.find(t=>t.id==='17,0').name,'Hidden city');
 assert.ok(cells.some(t=>t.landmarkId==='sanctuary-4'));
 state.cities[0].q=38;state.cities[0].r=38;
 cells=E.getCozyTiles(state,shared,world);
 assert.ok(cells.some(t=>t.landmarkId==='sanctuary-4'),'Explored towers stay known away from cities');
 assert.ok(!cells.some(t=>t.landmarkId==='sanctuary-central'),'The central tower is not globally revealed');
 console.log('PASS Fog hides distant towers and foreign claims; nearby and explored towers remain visible');
}

{
 const {visibleTerrainCells}=loadCozyEngine('map-visibility');
 const state={cities:[{q:0,r:0}],explored:['20,20']};
 const before=JSON.stringify(state),sight=visibleTerrainCells(state);
 assert.ok(sight.has('4,0'));assert.ok(!sight.has('5,0'));
 assert.ok(sight.has('22,20'));assert.ok(!sight.has('23,20'));
 assert.equal(JSON.stringify(state),before,'Sight must not claim land or spend an exploration');
 console.log('PASS Landscape sight around cities and explored locations is independent of ownership and surveys');
}

{
 const fresh=engine.createCozyState(world,'border','Reino',start);
 const shared=engine.createCozyShared(world);
 assert.equal(engine.worldDiagonalLimit(fresh,shared),40);
 assert.throws(()=>engine.applyCozyAction(fresh,shared,world,{type:'explore',q:35,r:35},start),/ponto válido/);
 shared.claims['35,35']={playerId:'old',cityId:'old',name:'Capital antiga'};
 assert.equal(engine.worldDiagonalLimit(fresh,shared),70,'Earlier holdings remain inside the map');
 fresh.explored.push('35,35');
 assert.ok(engine.getCozyTiles(fresh,shared,world).some(t=>t.id==='35,35'&&t.ownerId==='old'));
 console.log('PASS hex world rejects new corner orders and retains historical holdings');
}
