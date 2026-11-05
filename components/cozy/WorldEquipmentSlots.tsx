"use client";
import {collectionRequest} from "@/lib/collection-client";
import {useEffect,useRef,useState} from "react";
import {Package,X} from "lucide-react";
import {COLLECTION_PRODUCTS,EQUIPMENT_RARITY_LABELS,type CollectionState} from "@/lib/collection";
import {equipmentDescription} from "@/lib/cozy/equipment";
import styles from "./world-equipment.module.css";
export function WorldEquipmentSlots({value,onChange,disabled=false}:{value:string[];onChange?:(items:string[])=>void;disabled?:boolean}){
 const [slot,setSlot]=useState<number|null>(null),[data,setData]=useState<CollectionState|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(slot===null)return;const dialog=ref.current,trigger=document.activeElement;dialog?.showModal();return()=>{dialog?.close();if(trigger instanceof HTMLElement&&trigger.isConnected)trigger.focus();};},[slot]);
 useEffect(()=>{if(slot===null||!onChange)return;const controller=new AbortController();setError('');setData(null);collectionRequest('/api/me/collection',{cache:'no-store',signal:controller.signal}).then(payload=>{if(!controller.signal.aborted)setData(payload);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[slot,attempt,onChange]);
 const ids=[value[0]??'',value[1]??'',value[2]??''];
 function choose(id:string){if(slot===null||!onChange)return;const next=[...ids];next[slot]=id;onChange(next);setSlot(null);}
 const items=COLLECTION_PRODUCTS.filter(p=>p.kind==='equipment'&&data?.inventory.some(i=>i.id===p.id));
 return <section className={styles.root} aria-label="Equipamentos deste mundo"><h4>{onChange?'Levar para este mundo':'Equipamentos deste mundo'}</h4><div className={styles.slots}>{ids.map((id,i)=>{const item=COLLECTION_PRODUCTS.find(p=>p.id===id);return <button type="button" disabled={disabled} key={i} aria-label={`${onChange?'Escolher equipamento do':'Ver equipamento do'} slot ${i+1}`} onClick={()=>setSlot(i)}>{item?<img src={item.image} alt={item.name}/>:<Package size={26}/>}<small>{item?.name??`Slot ${i+1}`}</small></button>;})}</div>
 {slot!==null&&<dialog ref={ref} className={styles.dialog} aria-label={onChange?`Escolher item do slot ${slot+1}`:`Equipamento do slot ${slot+1}`} onKeyDown={e=>e.stopPropagation()} onCancel={e=>{e.preventDefault();e.stopPropagation();setSlot(null);}}><header><strong>{onChange?`Inventário · slot ${slot+1}`:'Equipamento'}</strong><button type="button" aria-label="Fechar inventário" onClick={()=>setSlot(null)}><X size={19}/></button></header>{!onChange?<p>{COLLECTION_PRODUCTS.find(p=>p.id===ids[slot])?.name??'Slot vazio'}<br/>{equipmentDescription(ids[slot])}</p>:<>{error&&<div><p role="alert">{error}</p><button type="button" onClick={()=>setAttempt(n=>n+1)}>Tentar novamente</button></div>}{!data&&!error&&<p role="status">Consultando inventário…</p>}<div className={styles.items}>{items.map(item=><button key={item.id} data-rarity={item.rarity} type="button" disabled={ids.some((id,i)=>i!==slot&&id===item.id)} aria-pressed={ids[slot]===item.id} onClick={()=>choose(item.id)}><img src={item.image} alt=""/><span><strong>{item.name}</strong><small>{EQUIPMENT_RARITY_LABELS[item.rarity??'common']}</small><small>{equipmentDescription(item.id)}</small></span></button>)}</div><button type="button" className={styles.empty} onClick={()=>choose('')}>Deixar slot vazio</button></>}</dialog>}
 </section>;
}
