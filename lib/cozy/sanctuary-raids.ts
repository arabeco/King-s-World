import {ALL_SANCTUARIES} from './landmarks';
import {canUsePact,pactEffectiveUntil} from './sanctuary-pacts';
import type {CozyShared,CozyState,CozySanctuaryPact,CozySanctuaryThreat} from './types';

/** Confirmed support follows existing help: fixed power, no troop travel or casualties. */
export function resolveSanctuaryRaids(shared:CozyShared,at:number){
 for(const pact of shared.sanctuaryPacts??[]){
  if(pact.completedAt===null||pact.canceledAt!==undefined)continue;
  for(const wave of pact.raids?.waves??[]){
   if(wave.outcome||wave.arrivesAt>at)continue;
   const group=pact.allianceId?shared.alliances.find(a=>a.id===pact.allianceId):null;
   wave.recipients=[...new Set([...(pact.allianceId?group?.members??[]:[pact.ownerPlayerId]),...wave.defenders.map(d=>d.playerId)])];
   wave.defense=wave.defenders.filter(d=>d.at<wave.arrivesAt).reduce((sum,d)=>sum+d.power,0);
   wave.resolvedAt=wave.arrivesAt;
   if(wave.arrivesAt<=pact.completedAt||wave.arrivesAt>=pactEffectiveUntil(pact)||(pact.allianceId&&!group)){
    wave.outcome='canceled';continue;
   }
   wave.outcome=wave.defense>=wave.power?'won':'lost';
   if(wave.outcome==='lost')pact.endedAt=wave.arrivesAt;
  }
 }
}
export function nextSanctuaryRaidAt(shared:CozyShared,now:number){
 const dates=(shared.sanctuaryPacts??[]).flatMap(p=>p.completedAt!==null&&p.canceledAt===undefined?(p.raids?.waves??[]).filter(w=>!w.outcome&&w.arrivesAt<=now).map(w=>w.arrivesAt):[]);
 return dates.length?Math.min(...dates):Infinity;
}
export function sanctuaryThreats(state:CozyState,shared:CozyShared,now:number,dayMs:number,offer:number,enabled:boolean):CozySanctuaryThreat[]{
 return (shared.sanctuaryPacts??[]).filter(p=>p.completedAt!==null&&p.canceledAt===undefined&&canUsePact(state,shared,p)&&pactEffectiveUntil(p)>now).flatMap(p=>(p.raids?.waves??[]).filter(w=>!w.outcome&&w.arrivesAt>now).map(w=>{
  const mine=w.defenders.find(d=>d.playerId===state.playerId);
  const other=(shared.sanctuaryPacts??[]).some(other=>other.id!==p.id&&other.raids?.waves.some(v=>v.day===w.day&&v.defenders.some(d=>d.playerId===state.playerId)));
  const availableAt=state.supportSentAt===null?now:state.supportSentAt+dayMs;
  const reason=!enabled?'As ações estão indisponíveis.':mine?'Seu apoio já está confirmado.':other?'Você já protege outra torre nesta onda.':availableAt>now?(availableAt>=w.arrivesAt?'Seu próximo apoio só ficará disponível após esta horda.':'Aguarde o intervalo entre apoios.'):'';
  return {pactId:p.id,day:w.day,arrivesAt:w.arrivesAt,power:w.power,defense:w.defenders.reduce((sum,d)=>sum+d.power,0),pledgedPower:mine?.power??0,offer,availableAt,canDefend:!reason,reason};
 }));
}
export function syncSanctuaryRaidReports(state:CozyState,shared:CozyShared,at:number,onReport:(at:number,title:string,body:string,positive:boolean)=>void){
 for(const pact of shared.sanctuaryPacts??[])for(const wave of pact.raids?.waves??[]){
  if(!wave.outcome||wave.resolvedAt===undefined||wave.resolvedAt>at||!wave.recipients?.includes(state.playerId))continue;
  const receipt=`${pact.id}:${wave.day}`;
  if(state.sanctuaryRaidReceipts?.includes(receipt))continue;
  (state.sanctuaryRaidReceipts??=[]).push(receipt);
  const name=ALL_SANCTUARIES.find(t=>t.id===pact.sanctuaryId)?.name??'Torre';
  const outcome=wave.outcome==='won'?'Torre protegida':wave.outcome==='lost'?'Sintonia interrompida pela horda':'Defesa da torre encerrada';
  const effect=wave.outcome==='won'?'O bônus mantém seu prazo original.':wave.outcome==='lost'?'O bônus desta sintonia terminou nesta chegada. Os recursos já utilizados não são devolvidos.':'Este apoio não foi usado em combate.';
  onReport(wave.resolvedAt,outcome,`${name} · horda do dia ${wave.day}: ${wave.defense??0} de defesa confirmada contra ${wave.power}. ${effect} Nenhuma tropa perdida ou cidade danificada neste confronto. Não concede influência.`,wave.outcome!=='lost');
 }
}
