"use client";
import {useState} from 'react';
import CozySymbol from "./CozySymbol";
import CozyArt from './CozyArt';
import type {CozyResources} from '@/lib/cozy/types';
import styles from './decision-effects.module.css';

export type DecisionEffect={key:string;label:string;value:string;icon:string;negative?:boolean;resource?:keyof CozyResources};
const resources={gold:{label:'Ouro',icon:'/icons/resource-gold-v1.png'},materials:{label:'Materiais',icon:'/icons/resource-materials.png'},supplies:{label:'Suprimentos',icon:'/icons/resource-supplies.png'}};
export function resourceEffects(values:Partial<CozyResources>,cost=false):DecisionEffect[]{
 return (['gold','materials','supplies'] as const).filter(key=>values[key]).map(key=>({key:(cost?'cost-':'reward-')+key,resource:key,...resources[key],value:`${cost||values[key]!<0?'−':'+'}${Math.abs(values[key]!).toLocaleString('pt-BR')}`,negative:cost||values[key]!<0}));
}
export default function DecisionEffects({items,label='Efeitos previstos',flow=false}:{items:DecisionEffect[];label?:string;flow?:boolean}){
 const [help,setHelp]=useState<string|null>(null);
 return <div className={styles.wrap}><div className={styles.effects} aria-label={label}>{items.map((item,index)=><span key={item.key} className={styles.item}>{flow&&index>0&&items[index-1].key.startsWith('cost-')&&!item.key.startsWith('cost-')&&<span className={styles.arrow} aria-hidden="true">→</span>}<button type="button" data-negative={item.negative||undefined} aria-label={`${item.label}: ${item.value}`} aria-pressed={help===item.key} onClick={()=>setHelp(help===item.key?null:item.key)}>{item.resource?<CozySymbol name={item.resource} size={23}/>:<CozyArt src={item.icon} size={23}/>}<b>{item.value}</b></button></span>)}</div>{help&&<small className={styles.help} role="status">{items.find(item=>item.key===help)?.label}</small>}</div>;
}
