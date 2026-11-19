import {getCozyResearchDurationMs,planningCapacity,researchCost} from './catalog';
import type {CozyOrder,CozyResearch,CozyState} from './types';

/** The phase belongs to the order, not to the tile currently underneath it. */
export function orderMapLabel(order:CozyOrder):string {
 if(order.miniMission)return order.miniMission.title;
 if(order.riteExpedition)return 'Expedição do Rito';
 if(order.tradeRoute)return 'Caravana comercial';
 if(order.returning)return 'Retorno do exército';
 if(order.foundation)return 'Fundação de cidade';
 if(order.occupationOnly)return 'Anexação da cidade';
 if(order.targetPlayerId)return 'Ataque a outro império';
 if(order.sanctuaryPactId)return 'Desafio aos guardiões';
 if(order.sanctuaryId)return 'Reconhecimento da torre';
 return {explore:'Exploração',attack:'Ataque ao NPC',collect:'Coleta',portal:'Travessia do Portal',upgrade:'Evolução de setor',research:'Pesquisa'}[order.kind];
}

export const orderQueued=(order:CozyOrder)=>Boolean(order.planned&&!order.planned.started);
export const orderStartsAt=(order:CozyOrder)=>order.planned?.startsAt??order.createdAt;
export const orderExpectedLevel=(order:CozyOrder,current:number)=>order.planned?.expectedLevel??current;
export function researchQueueQuote(state:CozyState,research:CozyResearch,dayMs:number,now:number){
 const lane=state.orders.filter(order=>order.kind==="research");
 const queued=lane.filter(orderQueued).length;
 const level=state.research[research]+lane.filter(order=>order.research===research).length;
 const startsAt=Math.max(now,...lane.map(order=>order.arrivesAt));
 const duration=getCozyResearchDurationMs(state,research,dayMs,level);
 return {level,startsAt,duration,arrivesAt:startsAt+duration,cost:researchCost(state,level),full:queued>=planningCapacity(state)};
}
export function orderProgress(order:CozyOrder,now:number){
 if(orderQueued(order))return 0;
 return Math.max(0,Math.min(100,Math.floor(100*(now-orderStartsAt(order))/Math.max(1,order.arrivesAt-orderStartsAt(order)))));
}
export function orderSummary(orders:CozyOrder[]){
 const queued=orders.filter(orderQueued).length,active=orders.length-queued;
 return {active,queued,label:orders.length?[active?`${active} ${active===1?'ativa':'ativas'}`:'',queued?`${queued} na fila`:''].filter(Boolean).join(' · '):'Sem ordens'};
}
