import {ALLIANCE_PROJECTS,allianceBonus,projectTotals} from "./alliances";
import {ALL_SANCTUARIES} from "./landmarks";
import type {CozyAction,CozyAllianceProjectKind,CozySanctuaryPact,CozyShared,CozyState} from "./types";

/** Functional values reuse existing projects; final balance remains separate. */
export const SANCTUARY_PACTS={
  defense:{...ALLIANCE_PROJECTS.defense,name:"Sintonia de defesa"},
  provisions:{...ALLIANCE_PROJECTS.provisions,name:"Sintonia de abastecimento"},
} as const;
export class SanctuaryPactError extends Error {}
function requireRule(value:unknown,message:string):asserts value {if(!value)throw new SanctuaryPactError(message);}
export const pactTotals=(pact:CozySanctuaryPact)=>projectTotals(pact);
export function pactFunded(pact:CozySanctuaryPact){const totals=pactTotals(pact),cost=SANCTUARY_PACTS[pact.kind].cost;return (['gold','materials','supplies'] as const).every(r=>totals[r]>=cost[r]);}
export const pactEffectiveUntil=(pact:CozySanctuaryPact)=>Math.min(pact.until??0,pact.endedAt??Infinity);
export function activateSanctuaryPact(pact:CozySanctuaryPact,at:number,dayMs:number,endsAt:number,waves:{day:number;arrivesAt:number;power:number}[]=[]){
 pact.completedAt=at;pact.until=Math.min(endsAt,at+SANCTUARY_PACTS[pact.kind].days*dayMs);
 if(pact.raids)pact.raids.waves=waves.filter(w=>w.arrivesAt>at&&w.arrivesAt<pact.until!).map(w=>({...w,defenders:[]}));
}
export function canUsePact(state:CozyState,shared:CozyShared,pact:CozySanctuaryPact){
  return pact.allianceId===null?pact.ownerPlayerId===state.playerId:
    state.allianceId===pact.allianceId&&shared.alliances.some(a=>a.id===pact.allianceId&&a.members.includes(state.playerId));
}
export function canManagePact(state:CozyState,shared:CozyShared,pact:CozySanctuaryPact){
  return pact.allianceId===null?pact.ownerPlayerId===state.playerId:
    canUsePact(state,shared,pact)&&shared.alliances.some(a=>a.id===pact.allianceId&&a.founderId===state.playerId);
}
export function cancelOrphanedPacts(shared:CozyShared,at:number){
  for(const pact of shared.sanctuaryPacts??[])if(pact.allianceId&&!shared.alliances.some(a=>a.id===pact.allianceId)&&pact.completedAt===null&&pact.canceledAt===undefined)pact.canceledAt=at;
}
export function cancelUnfinishedPacts(shared:CozyShared,at:number){
  for(const pact of shared.sanctuaryPacts??[])if(pact.completedAt===null&&pact.canceledAt===undefined)pact.canceledAt=at;
}
export function sanctuaryBonus(state:CozyState,kind:CozyAllianceProjectKind,at:number){
  return state.sanctuaryBenefits?.some(b=>b.kind===kind&&b.from<=at&&at<b.until&&(b.allianceId===null?b.ownerPlayerId===state.playerId:b.allianceId===state.allianceId))?SANCTUARY_PACTS[kind].bonus:0;
}
export function realmSupportBonus(state:CozyState,kind:CozyAllianceProjectKind,at:number){
 const project=allianceBonus(state,kind,at),tower=sanctuaryBonus(state,kind,at);
 const modern=state.sanctuaryBenefits?.some(b=>b.supportRules===2&&b.kind===kind&&b.from<=at&&at<b.until&&(b.allianceId===null?b.ownerPlayerId===state.playerId:b.allianceId===state.allianceId));
 return modern?Math.min(.15,project+tower):Math.max(project,tower);
}
export function syncSanctuaryPacts(state:CozyState,shared:CozyShared,at:number,onReport:(title:string,body:string,refund?:boolean)=>void){
  const pacts=shared.sanctuaryPacts??[];
  state.sanctuaryBenefits=pacts.filter(p=>p.completedAt!==null&&p.until!==null&&p.canceledAt===undefined&&canUsePact(state,shared,p)).map(p=>({supportRules:p.supportRules,pactId:p.id,allianceId:p.allianceId,ownerPlayerId:p.ownerPlayerId,kind:p.kind,from:p.completedAt!,until:pactEffectiveUntil(p)}));
  for(const pact of pacts){
    const mine=pact.contributions[state.playerId];
    if(!mine||state.sanctuaryPactReceipts?.[pact.id])continue;
    if(pact.canceledAt!==undefined&&pact.canceledAt<=at){
      for(const resource of ['gold','materials','supplies'] as const)state.resources[resource]+=mine[resource]??0;
      (state.sanctuaryPactReceipts??={})[pact.id]='refunded';
      onReport('Recursos da torre devolvidos','A sintonia foi cancelada antes da conclusão. Sua reserva foi devolvida uma única vez.',true);
    }else if(pact.completedAt!==null&&pact.completedAt<=at){
      (state.sanctuaryPactReceipts??={})[pact.id]='completed';
      onReport('Sintonia da torre concluída',`${SANCTUARY_PACTS[pact.kind].name} foi ativada até o prazo registrado para o pacto. Sua contribuição foi utilizada e registrada, sem pontos de influência.`);
    }
  }
}
export function applySanctuaryPactAction(state:CozyState,shared:CozyShared,action:CozyAction,now:number,dayMs:number,endsAt:number,nextId:(prefix:string)=>string,guardianPower?:number){
  if(action.type==='sanctuary_pact_start'){
    requireRule(ALL_SANCTUARIES.some(t=>t.id===action.sanctuaryId),'Torre não encontrada.');
    requireRule(state.sanctuaryVisits?.[action.sanctuaryId]!==undefined,'Reconheça a torre antes de iniciar uma sintonia.');
    requireRule(Object.hasOwn(SANCTUARY_PACTS,action.kind)&&['solo','alliance'].includes(action.scope),'Escolha uma sintonia e um escopo válidos.');
    const group=action.scope==='alliance'?shared.alliances.find(a=>a.id===state.allianceId&&a.members.includes(state.playerId)):null;
    requireRule(action.scope==='solo'||group?.founderId===state.playerId,'Só o líder pode iniciar uma sintonia da aliança.');
    const allianceId=group?.id??null;
    requireRule(!(shared.sanctuaryPacts??[]).some(p=>(allianceId?p.allianceId===allianceId:p.allianceId===null&&p.ownerPlayerId===state.playerId)&&p.canceledAt===undefined&&(p.completedAt===null||pactEffectiveUntil(p)>now)),'Conclua, cancele ou aguarde o pacto atual deste escopo.');
    (shared.sanctuaryPacts??=[]).push({id:nextId('sanctuary-pact'),supportRules:2,sanctuaryId:action.sanctuaryId,ownerPlayerId:state.playerId,allianceId,kind:action.kind,createdAt:now,contributions:{},completedAt:null,until:null,...(guardianPower!==undefined?{guardian:{power:guardianPower,attempts:[]},raids:{version:1,waves:[]}}:{})});return;
  }
  if(action.type!=='sanctuary_pact_contribute'&&action.type!=='sanctuary_pact_cancel')throw new SanctuaryPactError('Ação de sintonia inválida.');
  const pact=shared.sanctuaryPacts?.find(p=>p.id===action.pactId);
  requireRule(pact&&canUsePact(state,shared,pact)&&pact.completedAt===null&&pact.canceledAt===undefined,'Esta sintonia não está disponível para o seu reino.');
  if(action.type==='sanctuary_pact_cancel'){
    requireRule(canManagePact(state,shared,pact),'Só o responsável pode cancelar esta sintonia.');pact.canceledAt=now;return;
  }
  requireRule(state.sanctuaryVisits?.[pact.sanctuaryId]!==undefined,'Reconheça esta torre antes de contribuir.');
  requireRule(['gold','materials','supplies'].includes(action.resource)&&[50,100,'max'].includes(action.amount),'Escolha uma contribuição válida.');
  const cost=SANCTUARY_PACTS[pact.kind].cost,remaining=cost[action.resource]-pactTotals(pact)[action.resource];
  const amount=Math.min(remaining,action.amount==='max'?Math.floor(state.resources[action.resource]):action.amount);
  requireRule(amount>0&&Number.isFinite(amount)&&state.resources[action.resource]>=amount,'Recursos insuficientes ou meta desse recurso já atendida.');
  state.resources[action.resource]-=amount;
  const mine=(pact.contributions[state.playerId]??={});mine[action.resource]=(mine[action.resource]??0)+amount;
  if(pactFunded(pact)&&!pact.guardian)activateSanctuaryPact(pact,now,dayMs,endsAt);
}
