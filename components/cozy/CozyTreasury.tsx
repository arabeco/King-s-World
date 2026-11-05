"use client";

import CozyBonus from "./CozyBonus";
import CozySymbol from "./CozySymbol";
import CozyScreenHelp from "./CozyScreenHelp";

import {useRef,useState,type KeyboardEvent} from 'react';
import {ArrowRight,Sparkles} from 'lucide-react';
import type {CozyPayload,CozyResources} from '@/lib/cozy/types';
import styles from './cozy-activity.module.css';

const number=(value:number)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(Math.floor(value));
const resourceKeys=['gold','materials','supplies'] as const;
const labels={gold:'Ouro',materials:'Materiais',supplies:'Suprimentos'};
function ResourceArt({kind,size=36}:{kind:keyof CozyResources;size?:number}){
 return <CozySymbol name={kind} size={size}/>;
}
export default function CozyTreasury({data,onProduction,onExplore,onGovernment,onResearch,onRecruit,initialResource='materials'}:{
 initialResource?:keyof CozyResources;data:CozyPayload;onProduction:()=>void;onExplore:()=>void;onGovernment:()=>void;onResearch:()=>void;onRecruit:()=>void;
}){
 const [selected,setSelected]=useState<keyof CozyResources>(initialResource);
 const refs=useRef<(HTMLButtonElement|null)[]>([]);
 const {state,computed}=data,paused=computed.readOnly||!computed.started;
 const dayHours=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(computed.dayMs/3600000);
 const rate=selected==='gold'?0:computed.productionPerDay[selected];
 const hourly=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(rate*3600000/computed.dayMs);
 function move(event:KeyboardEvent<HTMLButtonElement>,index:number){
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?2:(index+(event.key==='ArrowRight'?1:2))%3;
  setSelected(resourceKeys[next]);refs.current[next]?.focus();
 }
 return <section className={styles.root} aria-label="Recursos do reino">
  <CozyScreenHelp screen="resources" playerId={state.playerId}/>
  <div className={styles.resourcePicker} role="tablist" aria-label="Recurso do tesouro">
   {resourceKeys.map((kind,index)=><button key={kind} ref={node=>{refs.current[index]=node;}} role="tab" id={`treasury-${kind}-tab`} aria-controls={`treasury-${kind}`} aria-selected={selected===kind} aria-label={labels[kind]} aria-describedby={`treasury-${kind}-balance`} tabIndex={selected===kind?0:-1} onClick={()=>setSelected(kind)} onKeyDown={event=>move(event,index)}><ResourceArt kind={kind} size={27}/><span>{labels[kind]}</span><strong id={`treasury-${kind}-balance`}>{number(state.resources[kind])}</strong></button>)}
  </div>
  <div role="tabpanel" id={`treasury-${selected}`} aria-labelledby={`treasury-${selected}-tab`}>
   <article className={styles.resource} data-resource={selected}>
    <div className={styles.resourceHeader}><ResourceArt kind={selected} size={42}/><div><span>{labels[selected]} disponíveis</span><strong>{number(state.resources[selected])}</strong></div><span className={styles.source}>{selected==='gold'?'Encontrado no mundo':paused?'Produção pausada':<>+{number(rate)}<small>por dia de jogo</small></>}</span></div>
    {selected!=='gold'&&!paused&&<div className={styles.income}><CozySymbol name="time" size={18}/><span>Ritmo atual: <strong>+{hourly} por hora real</strong></span></div>}
    {selected==='supplies'&&computed.sanctuaryBonuses.provisions>0&&!paused&&<CozyBonus kind="provisions" value={computed.sanctuaryBonuses.provisions}/>}
    {selected==='gold'?<><button className={styles.orderLink} type="button" onClick={onGovernment}>Usar ouro no Governo<ArrowRight size={16}/></button><button className={styles.secondaryLink} type="button" onClick={onResearch}>Ver pesquisas<ArrowRight size={15}/></button><button className={styles.secondaryLink} type="button" onClick={onExplore}>Buscar ouro no mundo<ArrowRight size={15}/></button></>:selected==='materials'?<><button className={styles.orderLink} type="button" onClick={onProduction}>Ver produção das cidades<ArrowRight size={16}/></button><button className={styles.secondaryLink} type="button" onClick={onRecruit}>{computed.readOnly?'Ver exército':'Recrutar tropas'}<ArrowRight size={15}/></button></>:<>{computed.allianceSupplyBonus>0&&!paused&&<div className={styles.income}><Sparkles size={15}/><span>Bônus da aliança de <strong>+{Math.round(computed.allianceSupplyBonus*100)}%</strong> incluído no ritmo acima.</span></div>}<button className={styles.orderLink} type="button" onClick={onExplore}>Explorar por recursos<ArrowRight size={16}/></button><button className={styles.secondaryLink} type="button" onClick={onProduction}>Ver produção de suprimentos<ArrowRight size={15}/></button></>}
   </article>
  </div>
  <p className={styles.timeNote}><CozySymbol name="time" size={18}/><span>{computed.readOnly?'Produção encerrada':!computed.started?'Aguardando abertura':<>1 dia de jogo · <strong>{dayHours} h reais</strong></>}</span></p>
 </section>;
}
