'use client';
import {useEffect,useRef,useState} from 'react';
import {miniMissionOffer} from '@/lib/cozy/mini-missions';
import type {CozyPayload} from '@/lib/cozy/types';
import type {CozyCommand} from './useCozyWorld';
import {CrownButton,CrownCost,crownRemaining} from './CozyCrownUI';
import CozyArt from './CozyArt';
import CozyScene from './CozyScene';
import styles from './cozy-mini-mission.module.css';

export default function CozyMiniMission({data,now,locked,act}:{data:CozyPayload;now:number;locked:boolean;act:(action:CozyCommand)=>Promise<boolean>}){
 const [open,setOpen]=useState<string|null>(null),dialog=useRef<HTMLDialogElement>(null);
 const offer=miniMissionOffer(data.state,data.world,now);
 const active=data.state.orders.find(order=>order.miniMission);
 useEffect(()=>{if(!offer||open!==offer.id)return;const node=dialog.current;node?.showModal();return()=>{if(node?.open)node.close();};},[open,offer?.id]);
 if(active)return <div className={styles.active}><CozyArt src="/icons/action-attack.png" size={28}/><span>{active.miniMission!.title}<small>Retorno em {crownRemaining(active.arrivesAt,now)}</small></span></div>;
 if(!offer)return null;
 const busy=data.state.orders.some(order=>order.kind==='attack');
 const enough=data.state.resources.supplies>=offer.suppliesCost;
 const canSend=!locked&&!busy&&enough&&data.computed.armyPower>0;
 const submit=async(accept:boolean)=>{if(await act({type:'mini_mission',id:offer.id,accept}))setOpen(null);};
 return <><button className={styles.prompt} type="button" aria-haspopup="dialog" onClick={()=>setOpen(offer.id)}><CozyArt src="/icons/action-attack.png" size={30}/><span><strong>{offer.title}</strong><small>Encontro disponível · {crownRemaining(offer.expiresAt,now)}</small></span><b>›</b></button>
 {open===offer.id&&<dialog ref={dialog} className={styles.dialog} aria-label={offer.title} onCancel={e=>{e.preventDefault();e.stopPropagation();setOpen(null);}}>
 <header><span>Encontro opcional</span><button type="button" aria-label="Fechar" onClick={()=>setOpen(null)}>×</button></header>
 <div className={styles.body}>
 <div className={styles.story}>
   <CozyScene src="/images/cenas-cozy/expedicao.jpg" />
   <h2>{offer.title}</h2><p>{offer.description}</p>
 </div>
 <p>{offer.enemy} · poder {offer.enemyPower}</p>
 <div className={styles.comparison}><span>Seu exército <strong>{data.computed.armyPower}</strong></span><span>{data.computed.armyPower>=offer.enemyPower?'Força suficiente agora':'Reforce seu exército'}</span></div>
 <p>Recompensa se vencer</p><div className={styles.costs}>{offer.reward.gold>0&&<CrownCost kind="gold" amount={offer.reward.gold}/ >}{offer.reward.materials>0&&<CrownCost kind="materials" amount={offer.reward.materials}/ >}{offer.reward.supplies>0&&<CrownCost kind="supplies" amount={offer.reward.supplies}/>}</div>
 <p>Custo: <CrownCost kind="supplies" amount={offer.suppliesCost}/> · retorno em {crownRemaining(now+Math.round(data.computed.dayMs*.5),now)}</p>
 <small>Baixas por tipo de tropa: 6% na vitória ou 20% na derrota, arredondadas para baixo. A força é conferida no retorno. Se não escolher, o encontro termina sem prejuízo.</small>
 {busy&&<p>O exército está em outra missão.</p>}{!enough&&<p>Suprimentos insuficientes.</p>}{data.computed.armyPower<=0&&<p>Recrute tropas para partir.</p>}
 <div className={styles.actions}><CrownButton quiet disabled={locked} onClick={()=>void submit(false)}>Recusar</CrownButton><CrownButton disabled={!canSend} onClick={()=>void submit(true)}>Enviar exército</CrownButton></div></div></dialog>}</>;
}
