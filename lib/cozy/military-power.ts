import type {CozyCity,CozyState} from './types';
import {TROOPS} from './catalog';
import {royalBonus} from './royal-profiles';
import {realmSupportBonus} from './sanctuary-pacts';
import {equipmentBonus} from './equipment';

/** Shared by combat resolution and purchase previews; bonuses are applied once. */
export function armyPower(state:CozyState){
 const generals=state.heroes.filter(hero=>hero.role==='general'&&hero.cityId!==null).length;
 return Math.floor(TROOPS.reduce((sum,troop)=>sum+state.army[troop.id]*troop.power,0)*(1+state.research.military*.2)*(1+Math.min(5,generals)*.08));
}
export function cityWallLevels(city:CozyCity){
 return city.sectors.defense*(city.integrity??100)/100*(!city.capital&&city.cityClass==='bastiao'?1.05:1);
}
export function wallPower(state:CozyState){
 return Math.floor(state.cities.reduce((sum,city)=>sum+cityWallLevels(city),0)*18*(1+state.research.fortification*.15));
}
export function defensePower(state:CozyState,at:number){
 return Math.floor((armyPower(state)+wallPower(state))*(1+royalBonus(state,'command'))*(1+realmSupportBonus(state,'defense',at))*(1+equipmentBonus(state,'defense')));
}
