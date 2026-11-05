import type {CozyCoord} from './types';

/** Six districts around the world, with an explicit 37-cell footprint each. */
export const WORLD_SANCTUARIES=Array.from({length:6},(_,index)=>{
 const [q,r]=[[22,0],[0,22],[-22,22],[-22,0],[0,-22],[22,-22]][index];
 const cells:CozyCoord[]=[];
 for(let dq=-3;dq<=3;dq++)for(let dr=-3;dr<=3;dr++)if(Math.max(Math.abs(dq),Math.abs(dr),Math.abs(dq+dr))<=3)cells.push({q:q+dq,r:r+dr});
 return {id:`sanctuary-${index+1}`,name:`Santuário ${index+1}`,q,r,cells};
});
export const CENTRAL_SANCTUARY={id:'sanctuary-central',name:'Coração do Mundo',q:0,r:0,cells:[] as CozyCoord[]};
for(let q=-3;q<=3;q++)for(let r=-3;r<=3;r++)if(Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r))<=3)CENTRAL_SANCTUARY.cells.push({q,r});
export const ALL_SANCTUARIES=[CENTRAL_SANCTUARY,...WORLD_SANCTUARIES];
export const sanctuaryAt=(c:CozyCoord)=>ALL_SANCTUARIES.find(s=>s.cells.some(t=>t.q===c.q&&t.r===c.r));
