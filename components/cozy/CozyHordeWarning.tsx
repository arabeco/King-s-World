"use client";
import {ArrowRight,Shield,Swords} from 'lucide-react';
import type {CozyPayload} from '@/lib/cozy/types';
import {hordeForecast} from '@/lib/cozy/horde-forecast';
import CozyArt from './CozyArt';
import CozySymbol from './CozySymbol';
import {crownNumber as number,crownRemaining} from './CozyCrownUI';
import styles from './cozy-horde-warning.module.css';

export default function CozyHordeWarning({data,now,onAlliance,onCity,onThreatCity,onMilitary}:{data:CozyPayload;now:number;onAlliance:()=>void;onCity:(id:string)=>void;onThreatCity:(id:string)=>void;onMilitary:()=>void}){
 const {computed,state}=data,attacks=computed.playerThreats??[];
 const {horde,defense,gap}=hordeForecast(computed,now);
 const city=[...state.cities].sort((a,b)=>(a.integrity??100)-(b.integrity??100)||a.sectors.defense-b.sectors.defense||a.id.localeCompare(b.id))[0];
 return <section className={styles.warning} aria-label="Aviso de horda">
  {attacks.length>0&&<section aria-label="Ataques de jogadores">{attacks.map(attack=><button className={styles.city} type="button" key={attack.orderId} aria-label={`Preparar ${attack.cityName} contra ${attack.attackerName}`} onClick={()=>onThreatCity(attack.cityId)}><CozyArt src="/icons/action-attack.png" size={30}/><span><strong>{attack.cityName} sob ataque</strong><small>{attack.attackerName} · {crownRemaining(attack.arrivesAt,now)}</small></span><ArrowRight size={17}/></button>)}</section>}
  {horde?<>
   <header><CozyArt src="/icons/action-defend.png" size={48}/><div><h3>Horda · dia {horde.day}</h3><span><CozySymbol name="time" size={18}/>{crownRemaining(horde.arrivesAt,now)} até a chegada</span></div></header>
   <div className={styles.comparison} aria-label="Comparação de forças"><div><Swords size={22}/><span>Força da horda</span><strong>{number(horde.power)}</strong></div><b aria-hidden="true">×</b><div><Shield size={22}/><span>Sua defesa total</span><strong>{number(defense)}</strong></div></div>
   <div className={styles.forecast} data-ready={gap===0} role="status"><strong>{gap>0?`Faltam ${number(gap)} de defesa`:'Defesa suficiente hoje'}</strong><progress aria-label="Preparo para a horda" value={Math.min(defense,horde.power)} max={horde.power}/><small>{gap>0?'Derrota pode causar baixas e dano às cidades.':'Mantenha essa força até a chegada.'}</small></div>
   {horde.supportPower>0&&<small className={styles.note}>Apoio aliado incluído: +{number(horde.supportPower)}</small>}
   <button type="button" className="primary-button" onClick={onMilitary}><Swords size={20}/>Preparar tropas<ArrowRight size={18}/></button>
   <div className={styles.alternatives}>{city&&<button type="button" onClick={()=>onCity(city.id)}><CozyArt src="/icons/building-wall.png" size={23}/>Fortificar cidade</button>}<button type="button" onClick={onAlliance}><CozySymbol name="alliance" size={22}/>Pedir apoio</button></div>
   <small className={styles.note}>Defesa automática · resultado em Relatos.<br/>Bônus e apoio podem mudar até a chegada.</small>
  </>:<p>{computed.readOnly?'Temporada encerrada.':'Nenhuma horda pendente.'}</p>}
 </section>;
}
