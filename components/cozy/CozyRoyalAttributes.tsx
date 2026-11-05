"use client";
import {collectionRequest} from "@/lib/collection-client";
import {forwardRef,useEffect,useImperativeHandle,useState} from "react";
import {SovereignStats,type SovereignStatValues} from "../profile/SovereignStats";
import styles from "./cozy-royal-attributes.module.css";
type ReadyStats={kingId:string;revision:number;available:number;attributes:SovereignStatValues};
export type RoyalAttributesHandle={save:()=>Promise<boolean>;snapshot:()=>{kingId:string;statRevision:number}|null};
const CozyRoyalAttributes=forwardRef<RoyalAttributesHandle,{overview?:boolean;embedded?:boolean;readOnly?:boolean;onReady?:(ready:boolean)=>void}>(function CozyRoyalAttributes({onReady},ref){
 const [stats,setStats]=useState<ReadyStats|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{const controller=new AbortController();setError('');setStats(null);onReady?.(false);collectionRequest<ReadyStats>('/api/me/royal-attributes',{cache:'no-store',signal:controller.signal}).then(data=>{if(controller.signal.aborted)return;setStats(data);onReady?.(true);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[attempt,onReady]);
 useImperativeHandle(ref,()=>({save:async()=>Boolean(stats)&&!error,snapshot:()=>stats?{kingId:stats.kingId,statRevision:stats.revision}:null}));
 return <section className={styles.root} aria-label="Atributos do rei"><header><strong>Stats do rei</strong>{stats&&<span>{stats.available} {stats.available===1?'ponto livre':'pontos livres'}</span>}</header>{stats&&<SovereignStats values={stats.attributes} label="Stats para este reinado"/>}{error&&<><p role="alert">{error}</p><button type="button" onClick={()=>setAttempt(n=>n+1)}>Tentar novamente</button></>}</section>;
});
export default CozyRoyalAttributes;
