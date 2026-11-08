/** Provisional threshold, identical in Normal and Express; unrelated to citizen happiness. */
export const NPC_OCCUPATION_THRESHOLD=25;
export function npcOccupation(remaining:number,initial:number){
 const control=initial>0?Math.min(100,Math.max(0,remaining/initial*100)):0;
 return {control,threshold:NPC_OCCUPATION_THRESHOLD,canAnnex:control<=NPC_OCCUPATION_THRESHOLD,remaining,initial};
}
