"use client";
import {collectionRequest} from "@/lib/collection-client";
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {X,Lock} from 'lucide-react';
import {COLLECTION_PRODUCTS,type CollectionState} from '@/lib/collection';
import {crestImage} from '@/lib/cozy/heraldry';
import styles from './world-crest.module.css';
export function WorldCrestPicker({value,finish,onChange,disabled=false,fixed=false}:{value:string;finish:'plain'|'imperial';onChange:(id:string,finish:'plain'|'imperial')=>void;disabled?:boolean;fixed?:boolean}){
 const [open,setOpen]=useState(false),[data,setData]=useState<CollectionState|null>(null),[premium,setPremium]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(!open)return;const dialog=ref.current,trigger=document.activeElement;dialog?.showModal();return()=>{dialog?.close();if(trigger instanceof HTMLElement&&trigger.isConnected)trigger.focus();};},[open]);
 useEffect(()=>{if(!open)return;const controller=new AbortController();setError('');setData(null);setPremium(false);
  Promise.all([collectionRequest('/api/me/collection',{cache:'no-store',signal:controller.signal}),collectionRequest<{premium?:{active?:boolean}}>('/api/me/entitlements',{cache:'no-store',signal:controller.signal}).then(p=>p.premium?.active===true).catch(()=>false)])
   .then(([collection,active])=>{if(!controller.signal.aborted){setData(collection);setPremium(active);}}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();
 },[open,attempt]);
 const selected=COLLECTION_PRODUCTS.find(p=>p.id===value);
 return <div className={styles.root}><button type="button" className={styles.selected} data-finish={finish} disabled={disabled||fixed} onClick={()=>setOpen(true)} aria-label="Escolher brasão do reino"><img src={crestImage(value)??undefined} alt=""/><span><strong>{selected?.name??'Brasão do reino'}</strong><small>{fixed?'Fixado neste mundo':finish==='imperial'?'Acabamento imperial':'Escolher brasão'}</small></span><span aria-hidden="true">{fixed?'◆':'›'}</span></button>
 {open&&<dialog ref={ref} className={styles.dialog} aria-label="Brasão do reino" onKeyDown={e=>e.stopPropagation()} onCancel={e=>{e.preventDefault();e.stopPropagation();setOpen(false);}}><header><strong>Brasão do reino</strong><button type="button" aria-label="Fechar brasões" onClick={()=>setOpen(false)}><X size={20}/></button></header>
 {error?<div role="alert">{error}<button type="button" onClick={()=>setAttempt(n=>n+1)}>Tentar novamente</button></div>:!data?<p role="status">Consultando inventário…</p>:<><div className={styles.finishes}><button type="button" aria-pressed={finish==='plain'} onClick={()=>onChange(value,'plain')}>Padrão</button><button type="button" disabled={!premium} aria-pressed={finish==='imperial'} onClick={()=>onChange(value,'imperial')}>Imperial · Premium</button></div><div className={styles.grid}>{COLLECTION_PRODUCTS.filter(p=>p.kind==='crest').map(p=>{const owned=data.inventory.some(i=>i.id===p.id);return <button type="button" key={p.id} disabled={!owned} aria-label={p.name} aria-pressed={value===p.id} onClick={()=>{onChange(p.id,finish);setOpen(false);}}><img src={crestImage(p.id)??p.image} alt="" loading="lazy"/>{!owned&&<Lock size={13}/>}</button>;})}</div><Link href="/premium">Ver outros brasões na loja</Link></>}
 </dialog>}</div>;
}
