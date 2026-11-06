import type {CozyPayload,CozyTroop} from './types';
import {armyPower,defensePower,wallPower} from './military-power';
import {empireArmy} from './expedition-army';
import {hasZeroProgression,zeroInfluence} from './progression';

/** Immediate purchase result, with current bonuses. No future horde win is credited. */
export function recruitPreview(data:CozyPayload,troop:CozyTroop,quantity:number,at:number){
 const {state,computed}=data;
 const next={...state,army:{...state.army,[troop]:state.army[troop]+Math.max(0,Math.floor(quantity))}};
 const power=armyPower(next),defense=defensePower(next,at),walls=wallPower(next);
 const military=hasZeroProgression(next)?zeroInfluence(next,armyPower({...next,army:empireArmy(next)}),walls).military:
  Math.min(500,Math.floor((power+walls)/6)+next.research.military*15);
 const horde=computed.nextHorde;
 return {power,defense,military,militaryGain:military-computed.influence.military,defenseGain:defense-computed.defensePower,
  shortfall:horde?Math.max(0,horde.power-defense-horde.supportPower):0};
}

/** Smallest affordable lot covering the known horde. A null result means it cannot cover it. */
export function hordeRecruitment(data:CozyPayload,troop:CozyTroop,maxUnits:number,at:number){
 const limit=Math.max(0,Math.floor(maxUnits));
 if(!data.computed.nextHorde||recruitPreview(data,troop,0,at).shortfall===0)return 0;
 if(recruitPreview(data,troop,limit,at).shortfall>0)return null;
 let low=1,high=limit;
 while(low<high){const mid=Math.floor((low+high)/2);if(recruitPreview(data,troop,mid,at).shortfall===0)high=mid;else low=mid+1;}
 return low;
}
