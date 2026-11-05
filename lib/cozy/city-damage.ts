import type {CozyBuildingDamage,CozyCity,CozySector,CozyState} from './types';
const priority:CozySector[]=['defense','economy','recruitment','administration','society'];
/** Initial damage calibration: losing by more removes 1–3 built levels, never below zero. */
export function damageCityBuildings(state:CozyState,city:CozyCity,defense:number,attack:number):CozyBuildingDamage[]{
 if(!Number.isFinite(defense)||!Number.isFinite(attack)||attack<=0||defense>=attack)return [];
 const budget=Math.min(3,Math.max(1,Math.ceil((attack-Math.max(0,defense))/attack*3)));
 const targets=priority.filter(sector=>city.sectors[sector]>0).sort((a,b)=>city.sectors[b]-city.sectors[a]||priority.indexOf(a)-priority.indexOf(b)).slice(0,budget);
 const damage=targets.map(sector=>{const from=city.sectors[sector];city.sectors[sector]=Math.max(0,from-1);return {sector,from,to:city.sectors[sector]};});
 for(const hit of damage)for(const order of state.orders){
  // Preserve prepaid work and timing, but show/execute the new actual result level.
  if(order.kind==='upgrade'&&order.cityId===city.id&&order.sector===hit.sector&&order.planned)
   order.planned.expectedLevel=Math.max(0,order.planned.expectedLevel-(hit.from-hit.to));
 }
 return damage;
}
