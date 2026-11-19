import {getCozyUpgradeDurationMs, planningCapacity, SECTORS, upgradeCost} from "./catalog";
import type {CozyCity, CozySector, CozyState} from "./types";

export type CityWork = {sector:CozySector; level:number};

export function cityWorksLane(state:CozyState, cityId:string, now:number) {
  const orders=state.orders.filter(order=>order.kind==="upgrade"&&order.cityId===cityId);
  const waiting=orders.filter(order=>order.planned&&!order.planned.started).length;
  return {
    orders,
    startsAt:Math.max(now,...orders.map(order=>order.arrivesAt)),
    slots:Math.max(0,planningCapacity(state)-waiting+(orders.length===0?1:0)),
  };
}

export function cityWorkQuote(state:CozyState, city:CozyCity, sector:CozySector, level:number, dayMs:number) {
  const projected={...city,sectors:{...city.sectors,[sector]:level}};
  return {materials:upgradeCost(state,level),duration:getCozyUpgradeDurationMs(state,projected,sector,dayMs)};
}

/** A single set of diverse improvements. The player can still plan any sector separately. */
export function cityWorksPreview(state:CozyState, city:CozyCity, dayMs:number, now:number) {
  const lane=cityWorksLane(state,city.id,now);
  const available=SECTORS.filter(({id})=>city.sectors[id]<10&&!lane.orders.some(order=>order.sector===id))
    .sort((a,b)=>city.sectors[a.id]-city.sectors[b.id]);
  const works:CityWork[]=[];
  let materials=0,arrivesAt=lane.startsAt;
  for(const {id:sector} of available.slice(0,lane.slots)){
    const level=city.sectors[sector],quote=cityWorkQuote(state,city,sector,level,dayMs);
    if(materials+quote.materials>state.resources.materials) break;
    works.push({sector,level});
    materials+=quote.materials;
    arrivesAt+=quote.duration;
  }
  return {works,materials,arrivesAt};
}
