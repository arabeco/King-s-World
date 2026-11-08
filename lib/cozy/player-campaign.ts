import {expeditionCost,expeditionTravelMs} from './exploration-route';
import type {CozyCoord,CozyState,CozyWorld} from './types';

// A persistent mobile season needs warning time even against the next hexagon.
// One campaign remains the action; distance still adds supplies and travel.
export const PLAYER_ATTACK_PREPARATION_MS=12*60*60*1000;
export function playerCampaign(state:CozyState,world:CozyWorld,target:CozyCoord){
 const travelMs=expeditionTravelMs(state,world,target);
 const preparationMs=PLAYER_ATTACK_PREPARATION_MS/(world.economyVersion===3&&world.mode==='express'?4:1);
 return {supplies:expeditionCost(state,target),preparationMs,arrivalMs:preparationMs+travelMs,returnMs:travelMs,totalMs:preparationMs+2*travelMs};
}
