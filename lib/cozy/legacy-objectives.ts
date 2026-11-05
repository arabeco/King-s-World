import {getCityDevelopment, SECTORS} from "./catalog";
import type {CozyState} from "./types";

/** Guide to an existing rule, without reserving resources or inventing another construction gate. */
export function wonderPlan(state: CozyState, cost: number) {
  const city = [...state.cities].filter(c=>!c.wonder).sort((a,b)=>getCityDevelopment(b)-getCityDevelopment(a)||a.id.localeCompare(b.id))[0];
  if(!city) return null;
  return {city,development:getCityDevelopment(city),completedSectors:SECTORS.filter(s=>city.sectors[s.id]>=10).length,
    missingMaterials:Math.max(0,Math.ceil(cost-state.resources.materials))};
}
