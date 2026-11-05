import {kingLevelFromXp} from "./cozy/king-progression";
import products from "./collection-catalog.json";
import {PLAY_GEM_PRODUCTS} from '../supabase/functions/_shared/play-gems';
export const COLLECTION_PRODUCTS=products;
export type CollectionSeasonReward={worldId:string;worldName:string;gems:number;productIds:string[];awardedAt:string;place?:number;participants?:number;rarity?:string;participationGems?:number;victoryGems?:number;placementGems?:number;conversionGems?:number;kingXp?:Record<string,number>;xpPercent?:number;rulesVersion?:number};
export type CollectionState={seasonRewards?:CollectionSeasonReward[];gems:number;gemDebt?:number;selectedId:string;inventory:{id:string;xp:number;source:string;added?:{administration:number;command:number;exploration:number};statRevision?:number}[]};
export function kingLevel(xp:number){return kingLevelFromXp(xp);}
export const GEM_PACKS=Object.values(PLAY_GEM_PRODUCTS);
export const EQUIPMENT_RARITY_LABELS:Record<string,string>={common:'Comum',uncommon:'Incomum',rare:'Raro',epic:'Épico'};

export function effectiveKingStats(product:typeof COLLECTION_PRODUCTS[number],owned?:CollectionState['inventory'][number]){const base=product.baseStats??{administration:0,command:0,exploration:0};return {administration:base.administration+(owned?.added?.administration??0),command:base.command+(owned?.added?.command??0),exploration:base.exploration+(owned?.added?.exploration??0)};}
