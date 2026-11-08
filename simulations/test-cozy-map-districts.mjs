import assert from 'node:assert/strict';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const E=loadCozyEngine(),A=loadCozyEngine('areas'),M=loadCozyEngine('map-presentation'),O=loadCozyEngine('npc-occupation'),at=1800000000000;
assert(A.areaCells({q:35,r:5},true).every(id=>{const [q,r]=id.split(',').map(Number);return Math.abs(q+r)<=40;}),'New districts cannot annex land outside the hexagonal world');
assert.equal(O.npcOccupation(25,100).canAnnex,true);assert.equal(O.npcOccupation(26,100).canAnnex,false);assert.equal(O.npcOccupation(0,100).control,0);
for(const seed of ['a','b','c']){
 const world={id:'district-'+seed,mode:'classic',economyVersion:3,influenceVersion:2,status:'running',startsAt:at};
 const state=E.createCozyState(world,'p','Player',at),shared=E.createCozyShared(world);
 state.explored=Array.from({length:81},(_,q)=>Array.from({length:81},(_,r)=>`${q-40},${r-40}`)).flat();
 const tiles=E.getCozyTiles(state,shared,world),old=E.getCozyTiles(state,shared,{...world,economyVersion:2});
 assert(tiles.filter(t=>t.kind==='abandoned').length<old.filter(t=>t.kind==='abandoned').length/5,'Abandoned settlements must be rarer in new maps');
 const districts=new Map();for(const t of tiles.filter(t=>t.kind==='gold'||t.kind==='materials')){const id=`${Math.floor((t.q+40)/8)},${Math.floor((t.r+40)/8)}`;const values=districts.get(id)??new Set();values.add(t.kind);districts.set(id,values);}
 assert([...districts.values()].every(types=>types.size===1),'Resource areas cannot alternate gold and materials on every hex');
 const resource=tiles.find(t=>t.kind==='gold');assert(resource);const anchors=new Set([resource.id]);
 const district=tiles.filter(t=>t.kind==='gold'&&Math.floor((t.q+40)/8)===Math.floor((resource.q+40)/8)&&Math.floor((t.r+40)/8)===Math.floor((resource.r+40)/8));
 assert.equal(district.filter(t=>M.hasMapMarker(t,anchors,null)).length,1);
 assert.equal(tiles.filter(t=>t.kind==='plain'||!t.revealed).filter(t=>M.hasMapMarker(t,anchors,null)).length,0);
 console.log('PASS',seed,'large single-resource districts, scarce abandoned cities, one marker per district and no symbols on plain or fog cells.');
}
