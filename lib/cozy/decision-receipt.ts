import type {CozyResources} from './types';
/** Explicit gross cost and reward, including a paid venture that returned nothing. */
export function decisionReceipt(cost:Partial<CozyResources>,reward:Partial<CozyResources>){
 const labels={gold:'ouro',materials:'materiais',supplies:'suprimentos'};
 return (['gold','materials','supplies'] as const).flatMap(key=>[
  ...(cost[key]?[`−${cost[key]} ${labels[key]}`]:[]),
  ...(reward[key]?[`+${reward[key]} ${labels[key]}`]:[]),
 ]).join(' · ');
}
