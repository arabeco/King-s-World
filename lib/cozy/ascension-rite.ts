import {ASCENSION_MINIMUM} from "./ascension-preview";
import type {CozyState} from "./types";

export const ASCENSION_PROOFS = ["expedition","provisions","council"] as const;
export type AscensionProof = typeof ASCENSION_PROOFS[number];
export const ASCENSION_PROOFS_REQUIRED = 2;
export const ASCENSION_PROOF_LABELS: Record<AscensionProof,string> = {
  expedition:"Abrir caminho",provisions:"Equipar a Travessia",council:"Reunir o Conselho",
};

export const RITE = {
  expedition:{enemyPower:600,supplies:180,days:.5},
  provisions:{materials:600,supplies:240},
  council:{minimumTrust:70,trustBonus:5,repair:10},
} as const;

export function completedAscensionProofs(state:CozyState) {
  return ASCENSION_PROOFS.filter(proof=>{
    const completed=state.ascensionProofs?.[proof];
    return typeof completed==="number" && Number.isSafeInteger(completed) && completed>=state.createdAt && completed<=state.settledAt;
  });
}

export function riteCouncilCities(state:CozyState) {
  return state.cities.filter(city=>city.heroId&&
    state.heroes.some(hero=>hero.id===city.heroId&&hero.cityId===city.id)&&
    (city.life?.contentment??state.satisfaction)>=RITE.council.minimumTrust);
}

export function riteAvailable(state:CozyState,influence:number) {
  return Boolean(state.king?.alive&&!state.founding&&!state.defeat&&state.cities.length&&
    state.finalizedAt===null&&influence>=ASCENSION_MINIMUM);
}
