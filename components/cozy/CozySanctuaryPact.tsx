import CozySanctuaryDefense from "./CozySanctuaryDefense";
import {useState} from "react";
import {CheckCircle2,X} from "lucide-react";
import {SANCTUARY_PACTS,canUsePact,canManagePact,pactTotals,pactFunded,pactEffectiveUntil} from "@/lib/cozy/sanctuary-pacts";
import type {CozyAllianceProjectKind,CozyResources} from "@/lib/cozy/types";
import CozyArt from "./CozyArt";
import CozyBonus from "./CozyBonus";
import CozySymbol from "./CozySymbol";
import {CrownButton,CrownProgress,crownNumber as number,crownRemaining as remaining,type CrownPanelProps} from "./CozyCrownUI";
import styles from "./cozy-sanctuary.module.css";

const labels={gold:"ouro",materials:"materiais",supplies:"suprimentos"};
export default function CozySanctuaryPact({data,act,locked,now,sanctuaryId}:CrownPanelProps&{sanctuaryId:string}){
 const {state,shared,computed}=data;
 const leader=shared.alliances.some(a=>a.id===state.allianceId&&a.founderId===state.playerId&&a.members.includes(state.playerId));
 const [scope,setScope]=useState<"solo"|"alliance">(leader?"alliance":"solo");
 const [kind,setKind]=useState<CozyAllianceProjectKind>("defense"),[cancelId,setCancelId]=useState<string|null>(null);
 const tower=computed.sanctuaries.find(t=>t.id===sanctuaryId)!;
 const visited=state.sanctuaryVisits?.[sanctuaryId]!==undefined;
 const pacts=(shared.sanctuaryPacts??[]).filter(p=>canUsePact(state,shared,p)&&p.canceledAt===undefined&&(p.completedAt===null||pactEffectiveUntil(p)>now));
 const defeated=(shared.sanctuaryPacts??[]).filter(p=>p.sanctuaryId===sanctuaryId&&p.endedAt!==undefined&&canUsePact(state,shared,p)).at(-1);
 const here=pacts.filter(p=>p.sanctuaryId===sanctuaryId),definition=SANCTUARY_PACTS[kind];
 const blocked=locked||computed.readOnly||!computed.started;
 const conflict=pacts.some(p=>scope==="solo"?p.allianceId===null&&p.ownerPlayerId===state.playerId:p.allianceId===state.allianceId&&p.allianceId!==null);
 const startReason=computed.endsAt!==null&&now+tower.travelMs>=computed.endsAt?"Não há tempo para concluir o desafio nesta temporada.":!visited?"Reconheça esta torre para iniciar uma sintonia.":scope==="alliance"&&!leader?"Só o líder inicia o pacto da aliança.":conflict?"Há um pacto pendente ou ativo neste escopo. Conclua, cancele ou aguarde o prazo.":"";
 const form=<div className={styles.pactForm}>
   <div className={styles.pactKinds} role="group" aria-label="Quem participa">
    <button type="button" disabled={blocked} aria-label="Meu reino" aria-pressed={scope==="solo"} onClick={()=>setScope("solo")}><CozyArt src="/icons/nav-empire.png" size={30}/>Meu reino</button>
    <button type="button" disabled={blocked||!leader} aria-label="Minha aliança" aria-pressed={scope==="alliance"} onClick={()=>setScope("alliance")}><CozySymbol name="alliance" size={30}/>Aliança</button>
   </div>
   <div className={styles.pactKinds} role="group" aria-label="Benefício da sintonia">{(["defense","provisions"] as const).map(value=><button type="button" key={value} aria-label={value==="defense"?"Defesa":"Produção de suprimentos"} aria-pressed={kind===value} onClick={()=>setKind(value)}><CozyBonus kind={value} value={SANCTUARY_PACTS[value].bonus} size={30}/></button>)}</div>
   <div className={styles.compactStats}>
    <span aria-label={`Guardiões: ${number(tower.guardianPower)} de poder`}><CozyArt src="/icons/action-attack.png" size={24}/>{number(tower.guardianPower)}</span>
    <span aria-label={`Duração máxima: ${definition.days} dias de jogo`}><CozySymbol name="time" size={22}/>{definition.days} d</span>
   </div>
   <div className={styles.pactCost}>{(Object.keys(labels) as (keyof CozyResources)[]).filter(r=>definition.cost[r]>0).map(r=><span key={r} aria-label={`${number(definition.cost[r])} ${labels[r]}`}><CozySymbol name={r} size={24}/>{number(definition.cost[r])}</span>)}</div>
   <span className={styles.riskTag}><CozyArt src="/icons/action-defend.png" size={20}/>Hordas podem interromper o bônus</span>
   <CrownButton disabled={blocked||!!startReason} onClick={()=>void act({type:"sanctuary_pact_start",sanctuaryId,kind,scope})}>Iniciar pacto {scope==="solo"?"do reino":"da aliança"}</CrownButton>
   {startReason&&<p className={styles.reason}>{startReason}</p>}
 </div>;
 return <details className={styles.pactRoot} data-tower-pact={sanctuaryId}>
  <summary>Sintonia da torre <span>{here.some(p=>p.completedAt!==null)?"Benefício ativo":here.some(p=>p.guardian&&pactFunded(p))?"Guardiões pendentes":here.length?"Metas em preparação":"Preparar pacto"}</span></summary>
  {here.map(pact=>{
   const def=SANCTUARY_PACTS[pact.kind],totals=pactTotals(pact),complete=pact.completedAt!==null;
   const challengeReason=blocked?"Aguarde a confirmação ou o início da temporada.":!visited?"Reconheça esta torre para enviar o exército.":!pactFunded(pact)?"Complete as reservas do pacto.":computed.armyPower<=0?"Recrute tropas para o desafio.":state.orders.some(o=>o.kind==="attack")?"Conclua a investida atual antes de enviar outra.":state.resources.supplies<tower.supplyCost?`Faltam ${number(Math.ceil(tower.supplyCost-state.resources.supplies))} suprimentos para o envio.`:computed.endsAt!==null&&now+tower.travelMs>=computed.endsAt?"Não há tempo para chegar antes do fim da temporada.":"";

   return <section key={pact.id} className={styles.pact} aria-label={`Pacto ${pact.allianceId?"da aliança":"do reino"}: ${def.name}`}>
    <CozyBonus kind={pact.kind} value={def.bonus} size={38}/>
    <span className={styles.scopeTag}>{pact.allianceId?<CozySymbol name="alliance" size={22}/>:<CozyArt src="/icons/nav-empire.png" size={22}/>} {pact.allianceId?"Aliança":"Meu reino"}</span>
    {complete?<><p className={styles.visited}><CozySymbol name="time" size={22}/>{remaining(pactEffectiveUntil(pact),now)}<CheckCircle2 size={17}/></p><CozySanctuaryDefense pact={pact} data={data} act={act} locked={locked} now={now}/></>:<>
     {(Object.keys(labels) as (keyof CozyResources)[]).filter(r=>def.cost[r]>0).map(resource=>{
      const left=def.cost[resource]-totals[resource],owned=Math.floor(state.resources[resource]);
      return <div className={styles.pactResource} key={resource}>
       <div className={styles.pactMeta} aria-label={labels[resource]}><CozySymbol name={resource} size={28}/><strong>{number(totals[resource])}/{number(def.cost[resource])}</strong></div>
       <CrownProgress value={totals[resource]} max={def.cost[resource]} label={`Meta da torre: ${labels[resource]}`}/>
       {left>0?<><small>Disponível: {number(owned)}</small><div className={styles.pactAmounts}>{([50,100,"max"] as const).map(amount=>{
        const value=Math.min(left,amount==="max"?owned:amount);
        return <button key={amount} type="button" disabled={blocked||!visited||value<=0||owned<value} onClick={()=>void act({type:"sanctuary_pact_contribute",pactId:pact.id,resource,amount})} aria-label={`Contribuir ${amount==="max"?"máximo":value} de ${labels[resource]} na torre`}><CozySymbol name={resource} size={20}/>{amount==="max"?"Máx. ":""}{number(Math.max(0,value))}</button>;
       })}</div></>:<small className={styles.visited}>Meta atendida</small>}
      </div>;
     })}
     {pact.guardian&&<div className={styles.guardian} aria-label="Desafio aos guardiões">
      <strong>{pactFunded(pact)?"Guardiões aguardando":"Prepare as reservas para o desafio"}</strong>
      <div className={styles.powerCompare}>
       <span><CozyArt src="/icons/resource-troops.png" size={32}/><small>Seu exército</small><b>{number(computed.armyPower)}</b></span>
       <span><CozyArt src="/icons/action-attack.png" size={32}/><small>Guardiões</small><b>{number(pact.guardian.power)}</b></span>
      </div>
      <span className={styles.riskTag}><CozyArt src="/icons/status-warning.png" size={20}/>Perdas possíveis</span>
      {pact.guardian.attempts.some(a=>!a.outcome)?<p className={styles.visited}><CozySymbol name="time" size={20}/>Expedição aos guardiões · {remaining(pact.guardian.attempts.find(a=>!a.outcome)!.arrivesAt,now)}</p>:<>
       <CrownButton disabled={!!challengeReason} onClick={()=>void act({type:"sanctuary_pact_challenge",pactId:pact.id})} aria-label="Enviar exército aos guardiões">Enfrentar<span className={styles.quote}><CozySymbol name="supplies" size={22}/>{number(tower.supplyCost)}<CozySymbol name="time" size={18}/>{remaining(now+tower.travelMs,now)}</span></CrownButton>
       {challengeReason&&<p className={styles.reason}>{challengeReason}</p>}
      </>}
      {pact.guardian.attempts.filter(a=>a.outcome).slice(-1).map(a=><div key={a.orderId} className={styles.battleResult} aria-label={`Último confronto: ${a.outcome}. ${a.losses??0} tropas perdidas.`}><CozyArt src={a.outcome==="won"?"/icons/status-success.png":"/icons/status-warning.png"} size={23}/><span>{a.outcome==="lost"?"Repelido":a.outcome==="won"?"Vitória":"Cancelado"}</span><CozyArt src="/icons/resource-troops.png" size={23}/><b>{a.losses?`-${number(a.losses)}`:"0"}</b></div>)}
     </div>}
     {!visited&&<p className={styles.reason}>Reconheça esta torre para contribuir.</p>}
     {canManagePact(state,shared,pact)&&(cancelId===pact.id?<div className={styles.pactCancel}><p>Devolver as reservas?</p><CrownButton disabled={blocked} onClick={()=>void act({type:"sanctuary_pact_cancel",pactId:pact.id}).then(ok=>{if(ok)setCancelId(null);})} aria-label="Confirmar cancelamento"><CheckCircle2 size={17}/>Devolver</CrownButton><CrownButton quiet onClick={()=>setCancelId(null)} aria-label="Manter pacto">Manter</CrownButton></div>:<button className={styles.locate} type="button" disabled={blocked} onClick={()=>setCancelId(pact.id)} aria-label="Cancelar e devolver reservas"><X size={16}/>Cancelar</button>)}
    </>}
   </section>;
  })}
  {defeated&&<CozySanctuaryDefense pact={defeated} data={data} act={act} locked={locked} now={now}/>}
  {here.length?<details className={styles.otherPact}><summary>Preparar outra sintonia</summary>{form}</details>:form}
 </details>;
}
