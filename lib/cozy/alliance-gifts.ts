import type {CozyGiftResource,CozyState} from "./types";

export const ALLIANCE_GIFT_PACKS = [50,100] as const;
export const ALLIANCE_GIFT_RECEIVE_LIMIT = 3;
export const ALLIANCE_GIFT_RESOURCES: Record<CozyGiftResource,string> = {
  materials:"materiais",
  supplies:"suprimentos",
};

export function allianceGiftUsage(state: CozyState, day: number) {
  return state.allianceGiftDay?.day===day ? state.allianceGiftDay : {day,sentTo:[],received:0};
}

export function canReceiveAllianceGift(state: CozyState) {
  return !state.founding && !state.defeat && state.finalizedAt===null && state.cities.length>0;
}
