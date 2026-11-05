import {expeditionCost,expeditionTravelMs} from './exploration-route';
import type {CozyCoord,CozyState,CozyWorld} from './types';

// A persistent mobile season needs warning time even against the next hexagon.
// One campaign remains the action; distance still adds supplies and travel.
export const PLAYER_ATTACK_PREPARATION_MS=12*60*60*1000;
export function playerCampaign(state:CozyState,world:CozyWorld,target:CozyCoord){
 const travelMs=expeditionTravelMs(state,world,target);
 return {supplies:expeditionCost(state,target),preparationMs:PLAYER_ATTACK_PREPARATION_MS,arrivalMs:PLAYER_ATTACK_PREPARATION_MS+travelMs,returnMs:travelMs,totalMs:PLAYER_ATTACK_PREPARATION_MS+2*travelMs};
}
