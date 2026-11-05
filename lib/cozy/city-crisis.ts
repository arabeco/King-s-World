import {releaseCityTerritory} from './city-territory';
import type {CozyCity,CozyShared,CozyState} from './types';
export const SOCIAL_RUPTURE_DAYS=7;
export function citySocialStatus(city:CozyCity){
 const trust=city.life?.contentment??70,days=city.life?.unrestDays??0;
 return trust>=60?'Estável':trust>=35?'Em tensão':days>=3?'Movimento separatista':'Em crise';
}
export function releaseCity(state:CozyState,shared:CozyShared,city:CozyCity,at:number,reason:'separation'|'horde'){
 // The original capital is permanent in Cozy; competitive defeat needs its own lifecycle.
 if(city.capital||state.cities.length<=1)return false;
 const id=`${city.q},${city.r}`;
 if(shared.claims[id]?.playerId!==state.playerId)return false;
 shared.independentCities??={};
 const domain=releaseCityTerritory(state,shared,city);
 shared.independentCities[id]={...domain,city:structuredClone({...city,heroId:null}),formerOwnerId:state.playerId,at,reason};
 state.cities=state.cities.filter(c=>c.id!==city.id);
 // A former administration cannot keep earning stability while the city is independent.
 // Preserve episode history and self-inflicted debt so reconquest cannot reset either.
 if(state.progression)delete state.progression.council.careSince[id];
 for(const hero of state.heroes)if(hero.cityId===city.id)hero.cityId=null;
 for(const order of state.orders)if(order.cityId===city.id&&order.planned&&!order.planned.started)
  for(const resource of ['gold','materials','supplies'] as const)state.resources[resource]+=order.planned.cost[resource]??0;
 state.orders=state.orders.filter(order=>order.cityId!==city.id);
 if(!state.explored.includes(id))state.explored.push(id);
 delete shared.claims[id];
 if(shared.territories?.[id]===state.playerId)delete shared.territories[id];
 return true;
}
