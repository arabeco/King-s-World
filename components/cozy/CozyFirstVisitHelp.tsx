import {useContext,useEffect,useRef,useState} from "react";
import {createPortal} from 'react-dom';
import {CozyHelpAnchor} from './CozyHelpAnchor';
import {Info,X,ArrowRight} from "lucide-react";
import CozyArt from "./CozyArt";
import styles from "./cozy-help.module.css";
const seenThisSession=new Set<string>();

export default function CozyFirstVisitHelp({helpId,enabled,title,steps,compact=true,inHeader=false}:{
 helpId:string;enabled:boolean;title:string;compact?:boolean;inHeader?:boolean;steps:{art:string;title:string;text:string}[];
}){
 const [open,setOpen]=useState(false),[step,setStep]=useState(0);
 const anchor=useContext(CozyHelpAnchor);
 const placeholder=useRef<HTMLSpanElement>(null);
 const [fallback,setFallback]=useState<HTMLElement|null>(null);
 useEffect(()=>{
  if(!inHeader||anchor)return;
  const scope=placeholder.current?.closest('section,article,dialog');
  setFallback(scope?.querySelector<HTMLElement>('header')??null);
 },[inHeader,anchor]);
 const dialog=useRef<HTMLDialogElement>(null),checked=useRef<string|null>(null);
 const key=`kw-screen-help:v1:${helpId}`;
 useEffect(()=>{
  if(!enabled||checked.current===key)return;
  checked.current=key;
  if(seenThisSession.has(key))return;
  try{if(localStorage.getItem(key)==="seen")return;}catch{/* Help still works with unavailable storage. */}
  setStep(0);setOpen(true);
 },[enabled,key]);
 useEffect(()=>{
  if(!open)return;
  const target=document.activeElement,node=dialog.current;
  node?.showModal();
  return()=>{if(node?.open)node.close();if(target instanceof HTMLElement&&target.isConnected)target.focus({preventScroll:true});};
 },[open]);
 const close=()=>{seenThisSession.add(key);try{localStorage.setItem(key,"seen");}catch{/* Optional preference. */}setOpen(false);};
 const current=steps[step];
 const trigger=<button type="button" className={styles.trigger} data-compact={compact||undefined} title={title} aria-label={title} onClick={()=>{setStep(0);setOpen(true);}}><Info size={17}/>{!compact&&"Ajuda"}</button>;
 return <>
  {inHeader&&(anchor||fallback)?createPortal(trigger,(anchor||fallback)!):<span ref={placeholder}>{trigger}</span>}
  {open&&<dialog ref={dialog} className={styles.dialog} aria-label={title} onCancel={event=>{event.preventDefault();event.stopPropagation();close();}}>
   <header><span>{title}</span><button type="button" aria-label="Fechar ajuda" onClick={close}><X size={20}/></button></header>
   <div className={styles.body}>
    <CozyArt src={current.art} size={88}/>
    <h3>{current.title}</h3><p>{current.text}</p>
    <div className={styles.dots} aria-label={`Passo ${step+1} de ${steps.length}`}>{steps.map((_,index)=><span key={index} data-current={index===step}/>)}</div>
   </div>
   <footer>{step<steps.length-1&&<button type="button" className={styles.skip} onClick={close}>Pular</button>}<button type="button" className={styles.next} autoFocus onClick={()=>step<steps.length-1?setStep(index=>Math.min(steps.length-1,index+1)):close()}>{step<steps.length-1?"Próximo":"Entendi"}<ArrowRight size={17}/></button></footer>
  </dialog>}
 </>;
}
