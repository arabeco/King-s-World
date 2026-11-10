"use client";
import {useId} from 'react';
import type {InfluenceReference} from '@/lib/cozy/influence-reference';
import styles from './cozy-influence-track.module.css';
const number=(value:number)=>Math.round(value).toLocaleString('pt-BR');
export default function CozyInfluenceTrack({score,reference,onOpen}:{score:number;reference:InfluenceReference|null;onOpen:()=>void}){
 const id=useId();
 return <button type="button" className={styles.button} data-influence-track aria-label={`Detalhes da influência: ${score} de 2500`} aria-describedby={reference?id:undefined} onClick={onOpen}>
 <span>Influência</span><span className={styles.track}>
 {reference&&reference.high>0&&<><span className={styles.ghost} data-reference="ghost" style={{width:`${reference.high/25}%`}} aria-hidden="true"/><span className={styles.band} data-reference="band" style={{left:`${reference.low/25}%`,width:`${(reference.high-reference.low)/25}%`}} aria-hidden="true"/></>}
 <progress aria-label="Sua influência atual" value={Math.max(0,Math.min(2500,score))} max={2500}/>
 <i title="Selo de Vitória · 1.500" aria-label="Meta de vitória: 1500">◆</i></span><strong>{number(score)} / 2.500</strong>
 {reference&&<span id={id} className={styles.srOnly}>Faixa de referência simulada neste período: {number(reference.low)} a {number(reference.high)}. Toque para entender a referência.</span>}
 </button>;
}
export function InfluenceReferenceDetails({reference}:{reference:InfluenceReference|null}){
 if(!reference)return null;
 return <section className={styles.explanation} aria-label="Referência de evolução">
 <div><span className={styles.swatch} aria-hidden="true"/><strong>Referência do período</strong><b>{number(reference.low)}–{number(reference.high)}</b></div>
 <p>A faixa cinza vem de simulações. Não é uma média dos jogadores nem uma meta: sua evolução pode acontecer em saltos.</p>
 <details><summary>Como é calculada</summary><p>Amostra de {reference.samples} trajetórias de bots, com rotinas diferentes, com e sem aliança. Não inclui disputas entre jogadores. A referência acompanha o tempo da temporada. Ela não altera sua influência, a meta de 1.500 ou suas recompensas.</p></details>
 </section>;
}
