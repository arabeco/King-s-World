"use client";
import {useId,useState} from 'react';
import type {CozyAction,CozyPayload,CozySector,CozyResearch} from '@/lib/cozy/types';
import {RESEARCHES,SECTORS,researchCost,upgradeCost,planningCapacity,getCozyResearchDurationMs,getCozyUpgradeDurationMs} from '@/lib/cozy/catalog';
import {orderQueued} from '@/lib/cozy/order-presentation';
import CozySymbol from './CozySymbol';
import {crownRemaining} from './CozyCrownUI';
import styles from './cozy-plans.module.css';
export default function CozyPlans({data,act,locked,now,cityId,sector,initialResearch}:{data:CozyPayload;act:(action:CozyAction)=>Promise<unknown>;locked:boolean;now:number;cityId?:string;sector?:CozySector;initialResearch?:CozyResearch}){
 const {state,world,computed}=data;
 const id=useId();
 const [research,setResearch]=useState(initialResearch??'economy');
 const [count,setCount]=useState(2);
 const [cancelFrom,setCancelFrom]=useState<string|null>(null);
 if(world.mode!=='express')return null;
 const city=state.cities.find(c=>c.id===cityId);
 const lane=state.orders.filter(o=>city?o.kind==='upgrade'&&o.cityId===city.id:o.kind==='research').sort((a,b)=>a.arrivesAt-b.arrivesAt);
 const queued=lane.filter(orderQueued),active=lane.find(o=>!orderQueued(o));
 const level=city&&sector?city.sectors[sector]+lane.filter(o=>o.sector===sector).length:state.research[research]+lane.filter(o=>o.research===research).length;
 const capacity=planningCapacity(state);
 const maximum=Math.max(0,Math.min(4,capacity-queued.length,(city?10:5)-level));
 const steps=Math.min(count,maximum);
 let cost=0,endsAt=Math.max(now,...lane.map(o=>o.arrivesAt));
 const startsAt=endsAt;
 const shadow=structuredClone(state);
 for(let i=0;i<steps;i++){
  if(city&&sector){const c=shadow.cities.find(c=>c.id===city.id)!;c.sectors[sector]=level+i;cost+=upgradeCost(state,level+i);endsAt+=getCozyUpgradeDurationMs(shadow,c,sector,computed.dayMs);}
  else{shadow.research[research]=level+i;cost+=researchCost(state,level+i);endsAt+=getCozyResearchDurationMs(shadow,research,computed.dayMs);}
 }
 const resource=city?'materials':'gold',resourceName=city?'materiais':'ouro';
 const targetName=city?SECTORS.find(s=>s.id===sector)?.name:RESEARCHES.find(r=>r.id===research)?.name;
 const activeName=active?.research?RESEARCHES.find(r=>r.id===active.research)?.name:SECTORS.find(s=>s.id===active?.sector)?.name;
 const reason=computed.readOnly?'Esta temporada está encerrada.':!computed.started?'Os planos ficam disponíveis após abrir os portões.':locked?'Aguarde a confirmação da ação.':queued.length>=capacity?'Fila completa. Aguarde uma conclusão ou cancele um plano.':steps<1?'Todos os níveis já foram concluídos ou planejados.':state.resources[resource]<cost?`Faltam ${Math.ceil(cost-state.resources[resource]).toLocaleString('pt-BR')} de ${resourceName}.`:computed.endsAt!==null&&endsAt>computed.endsAt?'Estes níveis não terminam antes do fim da temporada.':null;
 const cancelIndex=queued.findIndex(o=>o.id===cancelFrom);
 const canceled=cancelIndex<0?[]:queued.slice(cancelIndex);
 const refund=canceled.reduce((sum,o)=>sum+(o.planned?.cost[resource]??0),0);
 return <section className={styles.panel} aria-label="Planejar fila">
  <div className={styles.heading}><h3>Planejar próximos níveis</h3><span>{queued.length}/{capacity} na fila</span></div>
  {active&&<div className={styles.active}><span>Em andamento · {activeName}</span><b>{crownRemaining(active.arrivesAt,now)}</b></div>}
  {!city&&<label>Pesquisa<select aria-label="Pesquisa" value={research} disabled={locked} onChange={e=>setResearch(e.target.value as typeof research)}>{RESEARCHES.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>}
  {maximum>0&&<><label>Níveis a acrescentar<select aria-label="Níveis a acrescentar" value={steps} disabled={locked} onChange={e=>setCount(Number(e.target.value))}>{Array.from({length:maximum},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></label>
   <div className={styles.preview}><strong>{targetName} · nível {level} → {level+steps}</strong><span>{startsAt>now?`Começa em ${crownRemaining(startsAt,now)}`:'Começa agora'} · conclui em {crownRemaining(endsAt,now)}</span></div>
   <p><small>Pagamento agora</small><CozySymbol name={resource} size={22}/><strong>{cost.toLocaleString('pt-BR')}</strong></p>
   <button type="button" aria-label={`Planejar ${steps} ${steps===1?'nível':'níveis'} de ${targetName}`} aria-describedby={reason?`${id}-reason`:undefined} disabled={Boolean(reason)} onClick={()=>void act(city&&sector?{type:'plan_upgrade',cityId:city.id,sector,steps:steps as 1|2|3|4}:{type:'plan_research',research,steps:steps as 1|2|3|4})}>Planejar {steps} {steps===1?'nível':'níveis'}</button>
  </>}
  {reason&&<p id={`${id}-reason`} className={styles.reason} role="status">{reason}</p>}
  <small>{city?'1 obra por cidade':'1 pesquisa por reino'} · início automático</small>
  {queued.length>0&&<div className={styles.queue} aria-label="Níveis agendados">{queued.map(o=><div key={o.id} className={styles.row}><span><strong>{o.research?RESEARCHES.find(r=>r.id===o.research)?.name:SECTORS.find(s=>s.id===o.sector)?.name} · nível {o.planned!.expectedLevel+1}</strong><small>Começa em {crownRemaining(o.planned!.startsAt,now)}</small></span><button type="button" disabled={locked||computed.readOnly} onClick={()=>setCancelFrom(o.id)}>Cancelar daqui em diante</button></div>)}</div>}
  {cancelIndex>=0&&<div className={styles.confirm} role="group" aria-label="Confirmar cancelamento de planos"><strong>Cancelar {canceled.length} {canceled.length===1?'plano agendado':'planos agendados'}?</strong><p>A ação em andamento continua. Devolução: <CozySymbol name={resource} size={20}/><b>{refund.toLocaleString('pt-BR')}</b></p><div><button type="button" disabled={locked} onClick={()=>setCancelFrom(null)}>Manter planos</button><button type="button" disabled={locked} onClick={async()=>{if(await act({type:'cancel_plan',orderId:cancelFrom!}))setCancelFrom(null);}}>Confirmar cancelamento</button></div></div>}
 </section>;
}
