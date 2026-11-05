"use client";
import {Medal} from 'lucide-react';
import CozyRoyalAttributes, {type RoyalAttributesHandle} from './CozyRoyalAttributes';
import {useEffect,useRef,useState,type KeyboardEvent,type ReactNode} from 'react';
import {ROYAL_PROFILES} from '@/lib/cozy/royal-profiles';
import type {CozyPayload} from '@/lib/cozy/types';
import type {CozyCommand} from './useCozyWorld';
import styles from './cozy-royal.module.css';
import {AccountAppearance} from '../profile/AccountAppearance';
import {SovereignStats} from "../profile/SovereignStats";
import Link from 'next/link';
import {WorldEquipmentSlots} from './WorldEquipmentSlots';
import {WorldCrestPicker} from './WorldCrestPicker';
type RoyalDraft={generation:number;equipment:string[];crest:string;crestFinish:'plain'|'imperial'};
const draftKey=(data:CozyPayload)=>`kw-coronation-draft:${data.world.id}:${data.state.playerId}`;
function readDraft(data:CozyPayload):RoyalDraft|null{
 try{
  const raw=sessionStorage.getItem(draftKey(data));if(!raw||raw.length>4096)return null;
  const value=JSON.parse(raw);
  if(value?.generation!==(data.state.king?.generation??0)||!Array.isArray(value.equipment)||value.equipment.length!==3||!value.equipment.every(id=>typeof id==='string'&&id.length<=64)||typeof value.crest!=='string'||value.crest.length>64||!['plain','imperial'].includes(value.crestFinish))return null;
  return value;
 }catch{return null;}
}
function keepProfileFocus(event:KeyboardEvent<HTMLDialogElement>){
 if(event.key!=='Tab')return;
 const controls=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary,a[href],[tabindex="0"]')).filter(element=>element.getClientRects().length>0);
 const first=controls[0],last=controls[controls.length-1];
 if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
 else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
}
export default function CozyRoyalProfile({data,act,locked,feedback}:{data:CozyPayload;act:(action:CozyCommand)=>Promise<boolean>;locked:boolean;feedback?:ReactNode}){
 const king=data.state.king,active=ROYAL_PROFILES.find(p=>p.id===king?.profileId);
 const attributesRef=useRef<RoyalAttributesHandle>(null);
 const [draft]=useState(()=>readDraft(data));
 const [equipment,setEquipment]=useState<string[]>(draft?.equipment??['','','']);
 const [crest,setCrest]=useState(data.state.crestId??draft?.crest??'empire-crest-01'),[crestFinish,setCrestFinish]=useState<'plain'|'imperial'>(data.state.crestFinish??draft?.crestFinish??'plain');
 const [attributesReady,setAttributesReady]=useState(false),[submitting,setSubmitting]=useState(false);
 const [open,setOpen]=useState(false);

 const victoryInsignia = (data.account?.seals ?? 0) > 0;
 const needsChoice=!king?.profileId||!king.alive;
 const storageKey=draftKey(data),generation=king?.generation??0;
 useEffect(()=>{
  try{
   if(!needsChoice||data.computed.readOnly){sessionStorage.removeItem(storageKey);return;}
   sessionStorage.setItem(storageKey,JSON.stringify({generation,equipment,crest,crestFinish} satisfies RoyalDraft));
  }catch{/* A blocked/full storage must not prevent coronation. */}
 },[storageKey,generation,needsChoice,data.computed.readOnly,equipment,crest,crestFinish]);

 const wasChoosing=useRef(needsChoice);
 const prompted=useRef(false);
 useEffect(()=>{
  if(!prompted.current && needsChoice && !data.computed.readOnly){prompted.current=true;setOpen(true);}
 },[needsChoice,data.computed.readOnly]);
 useEffect(()=>{
  // A recovered receipt confirms through the shared retry control, outside the form.
  if(wasChoosing.current&&!needsChoice)setOpen(false);
  wasChoosing.current=needsChoice;
 },[needsChoice]);
 const dialogRef=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  if(!open)return;
  const dialog=dialogRef.current,trigger=document.activeElement;dialog?.showModal();
  return ()=>{dialog?.close();requestAnimationFrame(()=>{if(trigger instanceof HTMLElement&&trigger.isConnected&&!document.querySelector('dialog[open]'))trigger.focus({preventScroll:true});});};
 },[open]);
 if(data.state.defeat||!needsChoice&&!open)return null;
 return <section className={styles.royal} aria-label="Seu governante">
  <button className={`${styles.summary} ${needsChoice ? styles.summaryPending : ""}`} data-caption={king&&!king.alive?"Sucessão":needsChoice?"Escolher":"Perfil"} aria-label={king&&!king.alive?"Escolher sucessor":active?king!.nickname:"Escolha seu perfil de rei"} onClick={()=>setOpen(!open)} aria-expanded={open}>
   {victoryInsignia && <Medal className={styles.insigniaMarker} size={16} aria-label="Insígnia de Vitória desbloqueada"/>}
   <img src={king&&!king.alive?'/images/king-dead.jpg':active?.image??'/images/king-alive.jpg'} alt=""/>
   <span><strong>{king&&!king.alive?'O reino aguarda um sucessor':active?king!.nickname:'Escolha seu perfil de rei'}</strong><small>{king&&!king.alive?'O rei morreu. A capital e sua jornada continuam.':active?`${king?.attributes?'Atributos do reinado':active.bonus} · Reinado ${king!.generation}`:data.state.playerName}</small></span><span aria-hidden="true">{open?'−':'+'}</span>
  </button>
  {king&&!king.alive&&!open&&<span className={styles.deathBanner}>O rei morreu · escolha o sucessor</span>}
  {open&&<dialog ref={dialogRef} className={styles.body} aria-labelledby="royal-title" onKeyDown={keepProfileFocus} onCancel={e=>{e.preventDefault();setOpen(false);}} onClick={e=>{if(needsChoice || e.target!==e.currentTarget)return;const rect=e.currentTarget.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)setOpen(false);}}>
   <header className={styles.header}><h3 id="royal-title">{king&&!king.alive?"Coroar um sucessor":king?.nickname??"Seu governante"}</h3><button type="button" className={styles.close} aria-label="Fechar perfil" onClick={()=>setOpen(false)} autoFocus>×</button></header>
   <div className={styles.content}>
   <div className={styles.feedback}>{feedback}</div>
   {active&&king?.alive&&<p>{king.nickname} · {king.attributes?'Stats deste reinado':active.bonus}</p>}
   {needsChoice&&!data.computed.readOnly?<form onSubmit={async e=>{e.preventDefault();if(submitting)return;setSubmitting(true);try{if(await attributesRef.current?.save() && await act({type:'king_choose',profileId:'builder',nickname:data.state.playerName,equipment,crestId:crest,crestFinish,...attributesRef.current?.snapshot()}))setOpen(false);}finally{setSubmitting(false);}}}>
    <strong>{data.state.playerName}</strong>
    <div style={{display:"flex",alignItems:"center",gap:12,margin:"12px 0"}}><span style={{display:"block",width:64,height:64,flexShrink:0}}><AccountAppearance compact sovereignId={!needsChoice?king?.sovereignId:undefined}/></span><Link href="/profile">Preparar rei na coleção</Link></div>
    <CozyRoyalAttributes ref={attributesRef} embedded readOnly onReady={setAttributesReady}/>
    <WorldCrestPicker value={crest} finish={crestFinish} fixed={Boolean(data.state.crestId)} disabled={locked||submitting} onChange={(id,finish)=>{setCrest(id);setCrestFinish(finish);}}/>
    <WorldEquipmentSlots value={equipment} onChange={setEquipment} disabled={locked||submitting}/>
    <button className={styles.confirm} disabled={locked||submitting||!attributesReady}>{submitting?'Salvando…':king&&!king.alive?'Coroar sucessor':'Iniciar meu reinado'}</button>
   </form>:<p>Reinado {king?.generation??1}</p>}
   {!needsChoice&&king?.attributes&&<SovereignStats values={king.attributes} label="Stats fixados neste reinado"/>}
   <div className={styles.rewardRow}>
   <div className={`${styles.insignia} ${victoryInsignia ? styles.insigniaUnlocked : ''}`}>
    <Medal size={20} aria-hidden="true"/>
    <span><strong>Insígnia de Vitória</strong><small>{victoryInsignia ? 'Desbloqueada' : '1.500 de influência'}</small></span>
   </div>

   </div>
   {!!king?.history.length&&<details><summary>Reinados anteriores · {king.history.length}</summary>{king.history.map(h=><p key={h.generation}>{h.nickname} · Reinado {h.generation} · {new Date(h.diedAt).toLocaleDateString('pt-BR')} · {h.defense} de defesa contra {h.enemyPower} da horda</p>)}</details>}
   </div>
  </dialog>}
 </section>;
}
