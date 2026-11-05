"use client";



import { useState } from "react";
import Image from "next/image";
import CozySymbol from "./CozySymbol";
import { ArrowRight, ChevronDown, Feather } from "lucide-react";
import { COUNSELORS } from "@/lib/cozy/catalog";
import type {CozyDecree} from '@/lib/cozy/types';
import CozyArt from "./CozyArt";
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
  const [effectHelp,setEffectHelp]=useState<{key:string;label:string}|null>(null);
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
            <h2 id="council-decision-title">{decree?.title ?? (computed.readOnly?"Temporada encerrada":!computed.started?"Decisões após a abertura":"Nenhum decreto pendente")}
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
                  <button type="button" className={styles.option} disabled={locked} aria-pressed={chosen?.id===option.id}
                    onClick={() => {setEffectHelp(null);setChoice({ decreeId: decree.id, optionId: option.id });}}>
                    <span className={styles.optionCopy}><strong>{option.label}</strong></span>
                    <span className={styles.choiceDot} aria-hidden="true" />
                  </button>
                  <div className={styles.effects} aria-label="Consequências previstas">
                    {option.resolution==="chance"&&<small>{option.successPercent}% de sucesso</small>}
                    <button type="button" aria-label={`+${option.effects.materials} materiais`} onClick={()=>setEffectHelp({key:option.id,label:"Materiais"})}><CozySymbol name="materials" size={22}/>+{option.effects.materials}</button>
                    <button type="button" aria-label={`${trustEffect(option.effects)} de confiança`} onClick={()=>setEffectHelp({key:option.id,label:"Confiança nas cidades"})}><CozyArt src="/icons/influence-society.png" size={22}/>{trustEffect(option.effects)}</button>
                  </div>
                  {option.resolution==="chance"&&<small className={styles.riskFailure}>Se falhar: 0 materiais · {trustEffect(option.failure)} de confiança</small>}
                  {effectHelp?.key===option.id&&<small className={styles.effectHelp} role="status">{effectHelp.label}</small>}
                </div>
              ))}
            </div>
            {chosen && <p className={styles.choiceNote}>{chosen.description}</p>}
            <button className={styles.signDecree} disabled={locked || !chosen}
              onClick={() => chosen && void act({ type: "decree", decreeId: decree.id, optionId: chosen.id })}>
              <Feather size={16}/> Assinar
            </button>
          </div>
        ) : null}
      </article>
      {care.length>0&&computed.started&&!computed.readOnly&&<section className={styles.cityCare} aria-label="Cidades que precisam de cuidado"><div><CozyArt src="/icons/influence-society.png" size={31}/><span><strong>{critical.length?`${critical.length} ${critical.length===1?'cidade em crise':'cidades em crise'}`:`${care.length} ${care.length===1?'cidade em tensão':'cidades em tensão'}`}</strong><small>Sociedade é cuidada dentro de cada cidade.</small></span></div><p>{care[0].name} · confiança {computed.cityLife[care[0].id]?.contentment??state.satisfaction}%</p><button type="button" onClick={()=>onCity(care[0].id)}>Cuidar de {care[0].name}<ArrowRight size={15}/></button></section>}

    </CrownPanel>
  );
}
