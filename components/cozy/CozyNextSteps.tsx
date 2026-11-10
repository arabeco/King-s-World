"use client";
import {useEffect,useRef,useState} from 'react';
import {ArrowRight,ChevronRight,X} from 'lucide-react';
import type {JourneyStep,JourneyTarget} from '@/lib/cozy/kingdom-journey';
import CozyArt from './CozyArt';
import {crownRemaining} from './CozyCrownUI';
import styles from './cozy-next-steps.module.css';
export default function CozyNextSteps({steps,now,onNavigate}:{steps:JourneyStep[];now:number;onNavigate:(target:JourneyTarget)=>void}){
 const [open,setOpen]=useState(false),dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(!open)return;const node=dialog.current;node?.showModal();return()=>{node?.close();if(trigger.current?.isConnected)trigger.current.focus({preventScroll:true});};},[open]);
 const first=steps[0];if(!first)return null;
 return <><button ref={trigger} type="button" className={styles.prompt} data-tone={first.tone} aria-label={first.title} aria-haspopup="dialog" onClick={()=>setOpen(true)}><CozyArt src={first.icon} size={30}/><span><strong>{first.title}</strong>{first.readyAt&&<small>{crownRemaining(first.readyAt,now)}</small>}</span><ChevronRight size={18}/></button>
 {open&&<dialog ref={dialog} className={styles.dialog} aria-label="Próximos passos do reino" onCancel={event=>{event.preventDefault();event.stopPropagation();setOpen(false);}}>
 <header><span>Seu próximo passo</span><button type="button" aria-label="Fechar próximos passos" onClick={()=>setOpen(false)} autoFocus><X size={21}/></button></header>
 <div className={styles.body}>{steps.map((step,index)=><section key={step.id} className={styles.step} data-main={index===0}>
 <div className={styles.heading}><CozyArt src={step.icon} size={index===0?52:34}/><h3>{step.title}</h3></div>
 <p>{step.detail}</p>{step.readyAt&&<span className={styles.time}>{crownRemaining(step.readyAt,now)} · {new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(step.readyAt)}</span>}
 <button type="button" className={index===0?styles.primary:styles.secondary} onClick={()=>{setOpen(false);onNavigate(step.target);}}>{step.action}<ArrowRight size={17}/></button>
 </section>)}</div></dialog>}
 </>;
}
