"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {COLLECTION_PRODUCTS,kingLevel,type CollectionState} from '@/lib/collection';
import styles from './lobby.module.css';

export default function LobbyAccountBanner({username}:{username:string}){
 const [data,setData]=useState<CollectionState|null>(null);
 useEffect(()=>{const controller=new AbortController();fetch('/api/me/collection',{cache:'no-store',signal:controller.signal}).then(async r=>{if(!r.ok)return;const d=await r.json();if(!controller.signal.aborted)setData(d);}).catch(()=>{});return()=>controller.abort();},[]);
 const king=COLLECTION_PRODUCTS.find(p=>p.id===data?.selectedId),owned=data?.inventory.find(p=>p.id===data.selectedId);
 return <header className={styles.account}>
  <Link href="/profile" className={styles.identity} aria-label="Abrir meu perfil"><img src={king?.image??'/icons/nav-profile.png'} width={62} height={62} alt=""/><span><strong>{username}</strong><small>{king?`${king.name} · Nível ${kingLevel(owned?.xp??0)}`:'Seu soberano'}</small></span><span aria-hidden="true">›</span></Link>

 </header>;
}
