import type {CozyPayload} from './types';
import {INFLUENCE_REFERENCE_DATA} from './influence-reference-data';
export type InfluenceReference={low:number;high:number;progress:number;samples:number;model:string};
function sameRules(a:unknown,b:unknown):boolean{
 if(a===b)return true;
 if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 const left=a as Record<string,unknown>,right=b as Record<string,unknown>;
 return Object.keys(left).length===Object.keys(right).length&&Object.keys(left).every(key=>Object.prototype.hasOwnProperty.call(right,key)&&sameRules(left[key],right[key]));
}
/** A descriptive simulated band. It never contributes points or changes game rules. */
export function influenceReference(data:Pick<CozyPayload,'state'|'computed'|'world'>,now:number):InfluenceReference|null{
 const {state,computed,world}=data;
 if(!state.progression||!computed.started||world.startsAt===null||computed.endsAt===null||!Number.isFinite(now)||computed.endsAt<=world.startsAt)return null;
 const model=state.progression.balance?.unifiedRules?'unified-v3':state.progression.balance?.expressEconomy?'economic-v2':'classic-v2';
 const reference=INFLUENCE_REFERENCE_DATA.models[model];
 if(!sameRules(reference.balance,state.progression.balance))return null;
 const progress=Math.max(0,Math.min(1,(now-world.startsAt)/(computed.endsAt-world.startsAt)));
 const upper=reference.knots.findIndex(knot=>knot.progress>=progress);
 const right=reference.knots[upper<0?reference.knots.length-1:upper],left=reference.knots[Math.max(0,upper-1)];
 const factor=right.progress===left.progress?0:(progress-left.progress)/(right.progress-left.progress);
 const low=Math.max(0,Math.min(2500,Math.round(left.low+(right.low-left.low)*factor)));
 const high=Math.max(low,Math.min(2500,Math.round(left.high+(right.high-left.high)*factor)));
 return {low,high,progress,samples:reference.samples,model};
}
