"use client";



import { useState } from "react";
import Image from "next/image";
import CozySymbol from "./CozySymbol";
import { ArrowRight, ChevronDown, Feather } from "lucide-react";
import { COUNSELORS } from "@/lib/cozy/catalog";
import type {CozyDecree} from '@/lib/cozy/types';
import CozyArt from "./CozyArt";
import DecisionEffects,{resourceEffects,type DecisionEffect} from "./DecisionEffects";
import { CrownPanel, type CrownPanelProps } from "./CozyCrownUI";
import styles from "./cozy-council.module.css";

const PORTRAITS: Record<string,string> = {
  helena:"/herois/hero-helena-draven.jpg", tomas:"/herois/hero-tomas-ferrocorte.jpg",
  ines:"/herois/hero-maelis-verdan.jpg", bento:"/herois/hero-boris-ardheim.jpg",
};

export default function CozyCouncil({ data, act, locked, onCity }: CrownPanelProps & {onCity:(id:string)=>void}) {
  const { state, computed } = data;
  const [seat,setSeat]=useState<0|1|null>(null);
  const decree = computed.decree;
  const [choice, setChoice] = useState<{ decreeId: string; optionId: string } | null>(null);
  const chosen = decree && choice?.decreeId === decree.id ? decree.options.find(option => option.id === choice.optionId) : undefined;
  const zeroModel=computed.influenceDetails.model==='zero-v1';
  const trust=zeroModel?Math.round(state.cities.reduce((sum,city)=>sum+(computed.cityLife[city.id]?.contentment??state.satisfaction),0)/Math.max(1,state.cities.length)):Math.round(state.satisfaction);
  const care=state.cities.filter(city=>(computed.cityLife[city.id]?.contentment??state.satisfaction)<60).sort((a,b)=>(computed.cityLife[a.id]?.contentment??state.satisfaction)-(computed.cityLife[b.id]?.contentment??state.satisfaction));
  const critical=care.filter(city=>(computed.cityLife[city.id]?.contentment??state.satisfaction)<35);
  const author = COUNSELORS.find((person) => person.id === decree?.counselorId);
  const trustEffect=(effects:CozyDecree['options'][number]['effects'])=>{
    const signed=(n:number)=>`${n>0?'+':''}${n}`;
    if(!effects.localSatisfaction)return `${signed(effects.satisfaction)}`;
    const deltas=Object.values(effects.localSatisfaction),min=Math.min(...deltas),max=Math.max(...deltas);
    return min===0&&max===0?"0":`${min===max?signed(min):`${signed(min)} a ${signed(max)}`}`;
  };

  const affordable=(option:CozyDecree['options'][number])=>Object.entries(option.cost??{}).every(([resource,cost])=>state.resources[resource as keyof typeof state.resources]>=cost);
  const effectsList=(effects:CozyDecree['options'][number]['effects']):DecisionEffect[]=>[
    ...resourceEffects({materials:effects.materials,gold:effects.gold,supplies:effects.supplies}),
    ...(Object.values(effects.localSatisfaction??{realm:effects.satisfaction}).some(Boolean)?[{key:'trust',label:'Confiança nas cidades',icon:'/icons/influence-society.png',value:trustEffect(effects),negative:effects.satisfaction<0}]:[]),
    ...(effects.integrityRestore?[{key:'integrity',label:'Até estes pontos de integridade em cada cidade; não restaura níveis destruídos',icon:'/icons/building-wall.png',value:`+${effects.integrityRestore}%`}]:[]),
    ...(effects.productionBonus?[{key:'production',label:'Eficiência-base nas cidades por 2 dias de jogo; um bônus mais forte é preservado',icon:'/icons/building-production.png',value:`+${effects.productionBonus}%`}]:[]),
  ];
  return (
    <CrownPanel tone="council">
      
      <section aria-label="Assentos do conselho" className={styles.seatRack}>
        {([0,1] as const).map(slot=>{
          const current=COUNSELORS.find(person=>person.id===state.counselors[slot]);
          const label=slot===0?"Política":"Vida do povo";
          return <button type="button" key={slot} aria-expanded={seat===slot} onClick={()=>setSeat(seat===slot?null:slot)}>
            {current&&<span className={styles.counselorPortrait}><CozyArt src={PORTRAITS[current.id]} size={52}/></span>}
            <span><small>{label}</small><strong>{current?.name??"+"}</strong></span><ChevronDown size={15}/>
          </button>;
        })}
      </section>
      {seat!==null&&<div className={styles.seatPicker} aria-label="Escolher conselheiro">
        {COUNSELORS.filter(person=>person.seat===(seat===0?"political":"internal")).map(person=><button key={person.id} type="button" disabled={locked} aria-pressed={state.counselors[seat]===person.id} onClick={async()=>{if(person.id===state.counselors[seat]||await act({type:"counselor",slot:seat,counselorId:person.id}))setSeat(null);}}><span className={styles.counselorPortrait}><CozyArt src={PORTRAITS[person.id]} size={52}/></span><span><strong>{person.name}</strong><small>{person.moral}</small></span></button>)}
      </div>}
      <article
        className={styles.decision}
        aria-labelledby="council-decision-title"
      >
        <header className={styles.scene} data-empty={!decree || undefined}>
          <Image
            src="/images/conselho.jpg"
            alt=""
            fill
            sizes="(max-width: 700px) 100vw, 600px"
            className={styles.sceneArt}
          />
          <div className={styles.sceneTop}>
            {decree&&<span className={styles.eyebrow}>Dia {decree.day}</span>}
            <span
              className={styles.contentment}
              aria-label={`${zeroModel?'Confiança média das cidades':'Satisfação'} ${trust}%`}
            >
              <CozyArt src="/icons/influence-society.png" size={25} />
              {trust}%
            </span>
          </div>
          <div className={styles.sceneTitle}>
            <h2 id="council-decision-title">{decree?.title ?? (computed.readOnly?"Temporada encerrada":!computed.started?"Decisões após a abertura":"O Conselho está em dia")}
            </h2>
          </div>
        </header>

        {decree ? (
          <div className={styles.decreeBody}>
            <div className={styles.author}>
              <span>{author?.name ?? "Seu Conselho"}</span>
              {author && <span>{author.moral}</span>}
            </div>
            <p className={styles.story}>{decree.body}</p>
            <div className={styles.options}>
              {decree.options.map((option) => (
                <div key={option.id} className={styles.optionFrame} data-selected={chosen?.id===option.id}>
                  <button type="button" className={styles.option} disabled={locked||!affordable(option)} aria-pressed={chosen?.id===option.id}
                    onClick={() => {setChoice({ decreeId: decree.id, optionId: option.id });}}>
                    <span className={styles.optionCopy}><strong>{option.label}</strong></span>
                    <span className={styles.choiceDot} aria-hidden="true" />
                  </button>
                  <DecisionEffects flow items={[...resourceEffects(option.cost??{},true),...effectsList(option.effects)]} label="Consequências previstas"/>
                  {option.resolution==='chance'&&<div className={styles.venture}><details><summary>{option.successPercent}% de sucesso</summary><small>O custo é gasto também se falhar.</small></details><span>Se falhar</span><DecisionEffects items={effectsList(option.failure)} label="Se falhar"/></div>}
                  {!affordable(option)&&<small className={styles.riskFailure}>Reserva insuficiente</small>}
                </div>
              ))}
            </div>
            {chosen&&!state.progression?.balance?.unifiedRules && <p className={styles.choiceNote}>{chosen.description}</p>}
            <button className={styles.signDecree} disabled={locked || !chosen || !affordable(chosen)}
              onClick={() => chosen && void act({ type: "decree", decreeId: decree.id, optionId: chosen.id })}>
              <Feather size={16}/> Assinar
            </button>
          </div>
        ) : null}
      </article>
      {care.length>0&&computed.started&&!computed.readOnly&&<section className={styles.cityCare} aria-label="Cidades que precisam de cuidado"><div><CozyArt src="/icons/influence-society.png" size={31}/><span><strong>{critical.length?`${critical.length} ${critical.length===1?'cidade em crise':'cidades em crise'}`:`${care.length} ${care.length===1?'cidade em tensão':'cidades em tensão'}`}</strong></span></div><p>{care[0].name} · confiança {computed.cityLife[care[0].id]?.contentment??state.satisfaction}%</p><button type="button" onClick={()=>onCity(care[0].id)}>Cuidar de {care[0].name}<ArrowRight size={15}/></button></section>}

    </CrownPanel>
  );
}
