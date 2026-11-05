import {Shield,Swords,ArrowRight} from 'lucide-react';
import type {CozyReport} from '@/lib/cozy/types';
import {SECTORS} from '@/lib/cozy/catalog';
import CozySymbol from './CozySymbol';
import CozyArt from './CozyArt';
import styles from './cozy-battle-result.module.css';

const number=(value:number)=>value.toLocaleString('pt-BR');
function DamageBar({label,before,after,max,suffix=''}:{label:string;before:number;after:number;max:number;suffix?:string}){
 return <div className={styles.damage}>
  <div><span>{label}</span><strong><span>{number(before)}{suffix}</span><ArrowRight size={13}/>{number(after)}{suffix}</strong></div>
  <div className={styles.track} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={after} aria-valuetext={`${before}${suffix} antes, ${after}${suffix} depois`}>
   <span className={styles.previous} style={{width:`${Math.min(100,before/max*100)}%`}}/>
   <span className={styles.current} style={{width:`${Math.min(100,after/max*100)}%`}}/>
  </div>
 </div>;
}
/** Historical server snapshot: never reconstruct damage from the current kingdom. */
export default function CozyBattleResult({battle}:{battle:NonNullable<CozyReport['battle']>}){
 const lootLabel=battle.delivery==='lost'?'Recursos perdidos':battle.delivery==='return'?'Saque no retorno':'Recompensa recebida';
 return <section className={styles.result} aria-label={`Resultado em ${battle.city.name}`}>
  <header><strong>{battle.city.name}</strong><span>{battle.city.q}, {battle.city.r}</span></header>
  <div className={styles.forces}><span><Swords size={18}/>Ataque<strong>{number(battle.attackPower)}</strong></span><span><Shield size={18}/>Defesa<strong>{number(battle.defensePower)}</strong></span></div>
  <div className={styles.casualties}><CozyArt src="/icons/exercito.png" size={23}/><span>Suas baixas</span><strong>{battle.troopsLost>0?'−':''}{number(battle.troopsLost)}</strong></div>
  <div className={styles.loot} aria-label={lootLabel}><span>{lootLabel}</span><div>{(['gold','materials'] as const).map(resource=><strong key={resource} data-loss={(battle.resourceDelta[resource]??0)<0||undefined}><CozySymbol name={resource} size={23}/><span>{(battle.resourceDelta[resource]??0)>0?'+':''}{number(battle.resourceDelta[resource]??0)}</span><span className={styles.srOnly}>{resource==='gold'?'ouro':'materiais'}</span></strong>)}</div></div>
  {battle.returnsAt&&<p className={styles.returnTime}>Retorno previsto · <time dateTime={new Date(battle.returnsAt).toISOString()}>{new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(battle.returnsAt)}</time></p>}
  <DamageBar label={`Integridade de ${battle.city.name}`} before={battle.integrityBefore} after={battle.integrityAfter} max={100} suffix="%"/>
  <DamageBar label={battle.perspective==='defender'?'Sua Infraestrutura':'Infraestrutura do defensor'} before={battle.infrastructureBefore} after={battle.infrastructureAfter} max={500}/>
  {battle.buildings.length>0&&<div className={styles.buildings} aria-label="Níveis destruídos">{battle.buildings.map(hit=><div key={hit.sector}><span>{SECTORS.find(s=>s.id===hit.sector)?.name??hit.sector}</span><strong>{hit.from}<ArrowRight size={13}/>{hit.to}</strong></div>)}</div>}
 </section>;
}
