import {hexDistance} from './exploration-route';
import type {CozyCoord,CozyShared,CozyState} from './types';

// Provisional construction investment; the same cost and game-time apply in both modes.
export const CITY_FOUNDATION_COST={materials:1500,supplies:250} as const;
export const CITY_FOUNDATION_DAYS=.25;
export function foundationSite(state:CozyState,shared:CozyShared,coord:CozyCoord){
 const key=`${coord.q},${coord.r}`;
 if(state.cities.length>=10)return 'Seu reino já tem dez cidades.';
 if(shared.claims[key]||shared.independentCities?.[key])return 'Este local já tem uma cidade.';
 if(shared.territories?.[key]&&shared.territories[key]!==state.playerId)return 'Este território pertence a outro império.';
 if(Object.keys(shared.claims).some(key=>{const [q,r]=key.split(',').map(Number);return hexDistance({q,r},coord)<3;}))return 'Escolha um local a pelo menos 3 hexágonos de outra cidade.';
 return null;
}
