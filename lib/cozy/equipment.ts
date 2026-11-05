import type {CozyState} from './types';
export type EquipmentEffect='materials'|'supplies'|'defense'|'travel';
export const EQUIPMENT_EFFECTS:Record<string,Partial<Record<EquipmentEffect,number>>>={
 'item-craft-ledger':{materials:.01},'item-guard-crest':{defense:.01},'item-travel-compass':{travel:.01},'item-seed-sack':{supplies:.01},'item-master-hammer':{materials:.01},'item-watch-standard':{defense:.015},'item-road-map':{travel:.015},'item-granary-seal':{materials:.01,supplies:.005},'item-patrol-horn':{defense:.01,travel:.005},'item-steward-ledger':{materials:.005,supplies:.01},'item-cartographer-divider':{travel:.02},'item-frontier-shield':{defense:.02},'item-builder-tools':{materials:.02},'item-harvest-coffer':{supplies:.02},'item-journey-crown':{defense:.01,travel:.01}
};
export function equipmentBonus(state:CozyState,effect:EquipmentEffect){if(!state.king?.alive)return 0;return Math.min(.1,[...new Set(state.king.equipment??[])].slice(0,3).reduce((sum,id)=>sum+(EQUIPMENT_EFFECTS[id]?.[effect]??0),0));}
export function equipmentDescription(id:string){const names={materials:'Materiais',supplies:'Suprimentos',defense:'Defesa',travel:'Tempo de viagem'};return Object.entries(EQUIPMENT_EFFECTS[id]??{}).map(([key,value])=>`${key==='travel'?'−':'+'}${Math.round(value*1000)/10}% ${names[key as EquipmentEffect]}`).join(' · ');}
