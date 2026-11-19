import type {CozyCity,CozyWorld} from "./types";
import type {AscensionProof} from "./ascension-rite";

export const ASCENSION_MEDALS = [
  {id:"bronze",label:"Bronze",min:1500,rarity:"common"},
  {id:"silver",label:"Prata",min:1800,rarity:"uncommon"},
  {id:"gold",label:"Ouro",min:2100,rarity:"rare"},
  {id:"legendary",label:"Lendária",min:2500,rarity:"epic"},
] as const;

export const ASCENSION_MINIMUM = ASCENSION_MEDALS[0].min;
export type AscensionMedal = (typeof ASCENSION_MEDALS)[number];

export const ASCENSION_MEDAL_ART = {
  bronze: "/rewards/ascensao/medalha-bronze.png",
  silver: "/rewards/ascensao/medalha-prata.png",
  gold: "/rewards/ascensao/medalha-ouro.png",
  legendary: "/rewards/ascensao/medalha-lendaria.png",
} satisfies Record<AscensionMedal["id"],string>;

export function ascensionStanding(current: number, savedPeak?: number) {
  const peak = Math.max(current,savedPeak ?? 0);
  const medal = ASCENSION_MEDALS.reduce<AscensionMedal>((last,tier)=>peak>=tier.min ? tier : last,ASCENSION_MEDALS[0]);
  return {current,peak,medal,missing:Math.max(0,ASCENSION_MINIMUM-current)};
}

export function ascensionRewardAmounts(mode: CozyWorld["mode"], rarityComplete: boolean, gemDebt = 0) {
  const baseGems = mode==="express" ? 15 : 60;
  const conversionGems = rarityComplete ? 2 : 0;
  const totalGems = baseGems+conversionGems;
  const refundOffset = Math.min(totalGems,gemDebt);
  return {baseGems,conversionGems,totalGems,refundOffset,creditedGems:totalGems-refundOffset,bonusXp:0};
}

export type CozyAscensionPreview = {
  standing: ReturnType<typeof ascensionStanding>;
  sovereign: {level:number;xp:number;availablePoints:number} | null;
  rewards: ReturnType<typeof ascensionRewardAmounts> & {
    equipment: {id:string;name:string;image?:string;effect:string} | null;
  };
  archive: {
    worldName: string;
    sovereign: string;
    foundedAt: number;
    cities: {id:string;name:string;capital:boolean}[];
    milestones: number;
    wonders: number;
  };
};

/** Quote confirmed by the player and attached only by a validated world close. */
export type CozyAscensionConfirmation = {
  medal: AscensionMedal["id"];
  equipmentId: string | null;
  creditedGems: number;
  refundOffset: number;
};

export type CozyAscensionReceipt = {
  id: string;
  worldName: string;
  mode: CozyWorld["mode"];
  sovereign: string;
  sovereignId: string | null;
  foundedAt: number;
  completedAt: number;
  score: number;
  peak: number;
  medal: AscensionMedal["id"];
  cities: Pick<CozyCity,"id"|"name"|"capital"|"sectors">[];
  milestones: string[];
  wonders: string[];
  proofs?: Partial<Record<AscensionProof,number>>;
  rewards: Omit<ReturnType<typeof ascensionRewardAmounts>,"bonusXp"> & {equipmentId:string|null};
};

export type CozyAscensionHistory = {
  receipts: CozyAscensionReceipt[];
  medals: Partial<Record<AscensionMedal["id"],number>>;
  nextCursor: string | null;
};
