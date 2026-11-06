import type {CozyPayload} from './types';

/** Current power comparison, not a promise about bonuses or troops at arrival. */
export function hordeForecast(computed:CozyPayload['computed'],now:number){
 const horde=computed.nextHorde;
 const defense=computed.defensePower+(horde?.supportPower??0);
 const gap=horde?Math.max(0,horde.power-defense):0;
 return {horde,defense,gap,ready:gap===0,urgent:Boolean(horde&&gap>0&&horde.arrivesAt-now<=computed.dayMs*2)};
}
