import type {CozyState} from './types';
/** Upgrade old reserved-army saves once. A campaign reserves time, not a second army. */
export function restoreAbstractArmy(state:CozyState){
 for(const order of state.orders)if(order.expeditionArmy){
  for(const troop of ['militia','shooters','scouts','machinery'] as const)state.army[troop]+=order.expeditionArmy[troop];
  delete order.expeditionArmy;order.abstractAttack=true;
 }
}
export function empireArmy(state:CozyState){
 const army={...state.army};for(const order of state.orders)if(order.expeditionArmy)for(const troop of ['militia','shooters','scouts','machinery'] as const)army[troop]+=order.expeditionArmy[troop];return army;
}
export const committedTroops=(state:CozyState)=>state.orders.reduce((sum,o)=>sum+Object.values(o.expeditionArmy??{}).reduce((n,v)=>n+v,0),0);

/** Losing the departure city changes the home marker, never ownership, cargo or the reserved return time. */
export function retargetArmyReturns(state:CozyState){
 const home=state.cities.find(c=>c.capital)??[...state.cities].sort((a,b)=>a.id.localeCompare(b.id))[0];
 if(!home)return;
 for(const order of state.orders)if(order.returning&&!state.cities.some(c=>c.q===order.q&&c.r===order.r)){
  order.q=home.q;order.r=home.r;
 }
}
