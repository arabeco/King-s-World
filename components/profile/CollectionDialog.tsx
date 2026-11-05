"use client";
import {useEffect,useId,useRef,type ReactNode} from 'react';
import {X} from 'lucide-react';
import styles from './collection-hub.module.css';

export function CollectionDialog({title,label,busy=false,onClose,children}:{title:string;label?:string;busy?:boolean;onClose:()=>void;children:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null),titleId=useId();
 useEffect(()=>{
  const dialog=ref.current,trigger=document.activeElement;dialog?.showModal();
  return()=>{dialog?.close();if(trigger instanceof HTMLElement&&trigger.isConnected&&!trigger.matches(':disabled'))trigger.focus({preventScroll:true});};
 },[]);
 return <dialog ref={ref} className={styles.confirm} aria-label={label} aria-labelledby={label?undefined:titleId} aria-busy={busy} onCancel={event=>{event.preventDefault();if(!busy)onClose();}} onKeyDown={event=>{
  if(event.key!=='Tab')return;
  const controls=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),[tabindex="0"]')).filter(el=>el.getClientRects().length>0);
  if(!controls.length){event.preventDefault();event.currentTarget.focus();return;}
  const first=controls[0],last=controls[controls.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 }}>
  <header className={styles.dialogHeading}><h2 id={titleId}>{title}</h2><button type="button" disabled={busy} aria-label="Fechar janela" onClick={onClose}><X size={20}/></button></header>
  {children}
 </dialog>;
}
