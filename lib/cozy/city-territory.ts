import type {CozyCity,CozyCoord,CozyShared,CozyState} from './types';
import {areaAllied} from './areas';
import {sanctuaryAt} from './landmarks';
const key=(c:CozyCoord)=>`${c.q},${c.r}`;
const coord=(id:string)=>{const [q,r]=id.split(',').map(Number);return {q,r};};
const distance=(a:CozyCoord,b:CozyCoord)=>Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r));
export function nearestTerritoryCity(state:CozyState,point:CozyCoord){
 return [...state.cities].sort((a,b)=>distance(a,point)-distance(b,point)||a.id.localeCompare(b.id))[0];
}
/** Attribute old land once; founding another city never silently moves an existing district. */
export function bindCityTerritories(state:CozyState,shared:CozyShared){
 shared.territoryCities??={};
 const cities=new Set(state.cities.map(c=>c.id));
 for(const [id,owner] of Object.entries(shared.territories??{})){
  if(owner!==state.playerId||shared.claims[id])continue;
  const current=shared.territoryCities[id];
  if(current?.playerId===owner&&cities.has(current.cityId))continue;
  const city=nearestTerritoryCity(state,coord(id));if(city)shared.territoryCities[id]={playerId:owner,cityId:city.id};
 }
 for(const area of Object.values(shared.areas??{})){
  if(!area.owners.includes(state.playerId))continue;
  area.ownerCities??={};if(cities.has(area.ownerCities[state.playerId]))continue;
  const cells=area.cells.map(coord);const center=cells.length?{q:cells.reduce((n,c)=>n+c.q,0)/cells.length,r:cells.reduce((n,c)=>n+c.r,0)/cells.length}:null;
  const city=center&&nearestTerritoryCity(state,center);if(city)area.ownerCities[state.playerId]=city.id;
 }
}
export function cityTerritoryCells(state:CozyState,shared:CozyShared,cityId:string){
 const city=state.cities.find(c=>c.id===cityId);if(!city)return [];
 const cities=new Set(state.cities.map(c=>c.id));
 const cells=Object.entries(shared.territories??{}).filter(([id,owner])=>{
  if(owner!==state.playerId||shared.claims[id])return false;
  const link=shared.territoryCities?.[id];
  const assigned=link?.playerId===owner&&cities.has(link.cityId)?link.cityId:nearestTerritoryCity(state,coord(id))?.id;
  return assigned===cityId;
 }).map(([id])=>id);
 return [...new Set([key(city),...cells])].sort();
}
/** Release only this city's domain and its own resource access. Caravans already sent remain valid. */
export function releaseCityTerritory(state:CozyState,shared:CozyShared,city:CozyCity){
 bindCityTerritories(state,shared);
 const territory=cityTerritoryCells(state,shared,city.id),resourceAreas:string[]=[];
 for(const id of territory){
  if(shared.territories?.[id]===state.playerId)delete shared.territories[id];
  if(shared.territoryCities?.[id]?.playerId===state.playerId)delete shared.territoryCities[id];
 }
 for(const area of Object.values(shared.areas??{}))if(area.ownerCities?.[state.playerId]===city.id){
  area.owners=area.owners.filter(id=>id!==state.playerId);delete area.ownerCities[state.playerId];resourceAreas.push(area.id);
 }
 state.knownTerritories=[...new Set([...(state.knownTerritories??[]),...territory])].sort();
 return {territory,resourceAreas:resourceAreas.sort()};
}
/** Reconquest restores free land only. Never overwrite another empire, city, or monument. */
export function restoreCityTerritory(state:CozyState,shared:CozyShared,city:CozyCity,lost:{territory?:string[];resourceAreas?:string[]}){
 shared.territories??={};shared.territoryCities??={};
 for(const id of lost.territory??[]){
  if(id===key(city)||shared.territories[id]||shared.claims[id]||shared.independentCities?.[id]||sanctuaryAt(coord(id)))continue;
  if(Object.values(shared.areas??{}).some(area=>area.cells.includes(id)&&area.owners.length&&!area.owners.includes(state.playerId)&&!areaAllied(shared,area.owners[0],state.playerId)))continue;
  shared.territories[id]=state.playerId;shared.territoryCities[id]={playerId:state.playerId,cityId:city.id};
 }
 for(const id of lost.resourceAreas??[]){
  const area=shared.areas?.[id];if(!area||area.owners.length)continue;
  // A reserve now inside another empire's land cannot be claimed through an old city receipt.
  if(area.cells.some(cell=>{const owner=shared.claims[cell]?.playerId??shared.territories?.[cell];return owner&&owner!==state.playerId;}))continue;
  area.owners=[state.playerId];(area.ownerCities??={})[state.playerId]=city.id;
 }
}
