import {clockSpeed} from './rhythm';
import {royalBonus} from './royal-profiles';
import {equipmentBonus} from './equipment';
import type {CozyCoord,CozyState,CozyWorld} from './types';
export const hexDistance=(a:CozyCoord,b:CozyCoord)=>Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r));
export function expeditionOrigin(state:CozyState,target:CozyCoord){return [...state.cities].sort((a,b)=>hexDistance(a,target)-hexDistance(b,target)||a.id.localeCompare(b.id))[0];}
export function expeditionCost(state:CozyState,target:CozyCoord){const origin=expeditionOrigin(state,target);return Math.ceil((30+Math.max(1,origin?hexDistance(origin,target):0)*8)*(1-state.research.exploration*.08));}
export function expeditionTravelMs(state:CozyState,world:CozyWorld,target:CozyCoord){
 const origin=expeditionOrigin(state,target),distance=Math.max(1,origin?hexDistance(origin,target):0),speed=clockSpeed(world);
 const explorers=state.heroes.filter(h=>h.role==='explorer'&&h.cityId!==null).length;
 const base=distance*1800000*(1-state.research.exploration*.08)*(1-royalBonus(state,'exploration'))*(1-Math.min(4,explorers)*.1)*(1-equipmentBonus(state,'travel'));
 return world.economyVersion===3?Math.round(Math.max(60000,Math.round(base))/speed):Math.max(60000,Math.round(base/speed));
}
function roundHex(q:number,r:number){const x=q,z=r,y=-x-z;let rx=Math.round(x),ry=Math.round(y),rz=Math.round(z);const dx=Math.abs(rx-x),dy=Math.abs(ry-y),dz=Math.abs(rz-z);if(dx>dy&&dx>dz)rx=-ry-rz;else if(dy>dz)ry=-rx-rz;else rz=-rx-ry;return {q:rx,r:rz};}
export function explorationPath(state:CozyState,target:CozyCoord){
 const origin=expeditionOrigin(state,target);if(!origin)return [];
 const n=hexDistance(origin,target);if(!n)return [{q:target.q,r:target.r}];
 return Array.from({length:n+1},(_,i)=>roundHex(origin.q+(target.q-origin.q)*i/n,origin.r+(target.r-origin.r)*i/n));
}
/** Reveal a one-cell corridor; never perform resource surveys or claim land. */
export function explorationCorridor(path:CozyCoord[],diagonalLimit=40){
 const cells=new Set<string>();for(const point of path)for(let q=-1;q<=1;q++)for(let r=-1;r<=1;r++){const c={q:point.q+q,r:point.r+r};if(hexDistance(point,c)<=1&&Math.abs(c.q)<=40&&Math.abs(c.r)<=40&&Math.abs(c.q+c.r)<=diagonalLimit)cells.add(`${c.q},${c.r}`);}return [...cells].sort();
}
