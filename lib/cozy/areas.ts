import type {CozyCoord,CozyDeposit,CozyResourceArea,CozyShared} from './types';

// Stable districts; independent of discovery order and player camera.
export function resourceAreaId(c:CozyCoord,resource:'gold'|'materials') {
 return `${resource}:${Math.floor((c.q+40)/8)}:${Math.floor((c.r+40)/8)}`;
}
export function areaCells(c:CozyCoord,hexagonal=false):string[]{
 const q0=Math.floor((c.q+40)/8)*8-40,r0=Math.floor((c.r+40)/8)*8-40,cells:string[]=[];
 for(let q=q0;q<q0+8&&q<=40;q++)for(let r=r0;r<r0+8&&r<=40;r++)if(!hexagonal||Math.abs(q+r)<=40)cells.push(`${q},${r}`);
 return cells;
}
function newArea(c:CozyCoord,reserve:CozyDeposit,exclusive=true,hexagonal=false):CozyResourceArea {
 const id=resourceAreaId(c,reserve.resource);
 return {...(exclusive?{exclusive:true as const}:{}),id,resource:reserve.resource,cells:areaCells(c,hexagonal),reserve:{...reserve,id},owners:[],annexedAt:null};
}
/** One-time migration: retain every unreserved legacy unit, including exhausted deposits. */
export function migrateResourceAreas(shared:CozyShared){
 shared.territories??={};
 if(shared.areas)return;
 shared.areas={};
 for(const [id,deposit] of Object.entries(shared.deposits)){
  const [q,r]=id.split(',').map(Number);if(!Number.isInteger(q)||!Number.isInteger(r))continue;
  const coord={q,r},key=resourceAreaId(coord,deposit.resource),existing=shared.areas[key];
  if(!existing){shared.areas[key]=newArea(coord,deposit,false);continue;}
  existing.reserve.capacity+=deposit.capacity;existing.reserve.remaining+=deposit.remaining;
  existing.reserve.surveys=Math.max(existing.reserve.surveys,deposit.surveys);
  existing.reserve.contributors=[...new Set([...existing.reserve.contributors,...deposit.contributors])];
 }
}
export function resourceArea(shared:CozyShared,c:CozyCoord,resource:'gold'|'materials') {
 return shared.areas?.[resourceAreaId(c,resource)];
}
export function discoverResourceArea(shared:CozyShared,c:CozyCoord,reserve:CozyDeposit,hexagonal=false){
 migrateResourceAreas(shared);
 const id=resourceAreaId(c,reserve.resource);
 return shared.areas![id]??(shared.areas![id]=newArea(c,reserve,true,hexagonal));
}
export function areaAllied(shared:CozyShared,owner:string,actor:string){
 return shared.alliances.some(a=>a.members.includes(owner)&&a.members.includes(actor));
}
export function canUseArea(shared:CozyShared,area:CozyResourceArea,actor:string){
 return area.owners[0]===actor||Boolean(!area.exclusive&&area.owners.includes(actor)&&areaAllied(shared,area.owners[0],actor));
}
/** Keep legacy deposit projections synchronized; they are never additional reserves. */
export function syncAreaDeposits(shared:CozyShared,area:CozyResourceArea){
 for(const [id,d] of Object.entries(shared.deposits)){
  const [q,r]=id.split(',').map(Number);
  if(resourceAreaId({q,r},d.resource)===area.id)shared.deposits[id]={...area.reserve,id};
 }
}
