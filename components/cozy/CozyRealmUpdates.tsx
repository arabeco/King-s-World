"use client";
import type {CozyPayload} from '@/lib/cozy/types';
import {orderSummary} from '@/lib/cozy/order-presentation';
import CozyArt from './CozyArt';
import {crownNumber,crownRemaining} from './CozyCrownUI';
import styles from './cozy-realm-updates.module.css';

export default function CozyRealmUpdates({data,now,allianceNotice,onOrders,onDefense,onReports,onCouncil,onAlliance,onCity}:{data:CozyPayload;now:number;allianceNotice:string|null;onOrders:()=>void;onDefense:()=>void;onReports:()=>void;onCouncil:()=>void;onAlliance:()=>void;onCity:(id:string)=>void}){
 const {state,computed}=data,next=[...state.orders].sort((a,b)=>a.arrivesAt-b.arrivesAt)[0];
 const attack=[...(computed.playerThreats??[])].sort((a,b)=>a.arrivesAt-b.arrivesAt)[0],horde=computed.nextHorde;
 const damaged=state.cities.filter(c=>(computed.cityLife[c.id]?.contentment??70)<35||(c.integrity??100)<75);
 const unread=state.reports.filter(report=>report.at>state.readAt);
 const finished=unread.filter(report=>['Setor concluído','Pesquisa concluída','Expedição retornou','Saque concluído'].includes(report.title));
 const highlight=finished[0]??unread.find(report=>['exploration','horde','season','portal','economy'].includes(report.kind));
 const cards=[
  {id:'orders',icon:'/icons/status-time-v1.png',label:`Ordens do reino: ${orderSummary(state.orders).label}`,title:state.orders.length?orderSummary(state.orders).label:'Sem ordens',detail:next?crownRemaining(next.arrivesAt,now):'Fila livre',action:onOrders,tone:'blue'},
  {id:'defense',icon:'/icons/action-defend.png',label:attack?`Ataque a caminho de ${attack.cityName}`:undefined,title:attack?`Ataque · ${attack.cityName}`:horde?`Horda · dia ${horde.day}`:'Fronteiras em paz',detail:attack?crownRemaining(attack.arrivesAt,now):horde?crownRemaining(horde.arrivesAt,now):'Sem ameaças',action:onDefense,tone:attack?'danger':'red'},
  ...(computed.unreadReports?[{id:'reports',icon:'/icons/nav-intel.png',label:undefined,title:finished.length?`${finished.length} ${finished.length===1?"concluída":"concluídas"}`:`${computed.unreadReports} relatos`,detail:highlight?.title??"Ver novidades do reino",action:onReports,tone:'gold'}]:[]),
  ...damaged.slice(0,1).map(city=>({id:'city',icon:'/icons/influence-society.png',label:undefined,title:city.name,detail:(computed.cityLife[city.id]?.contentment??70)<35?'Sociedade em crise':`Integridade ${city.integrity}%`,action:()=>onCity(city.id),tone:'danger'})),
  ...(computed.decree?[{id:'council',icon:'/icons/nav-intel.png',label:undefined,title:'Decisão disponível',detail:computed.decree.title,action:onCouncil,tone:'purple'}]:[]),
  ...(allianceNotice?[{id:'alliance',icon:'/icons/alliance-crest-v1.png',label:`Aliança: ${allianceNotice}`,title:'Sua aliança',detail:allianceNotice,action:onAlliance,tone:'green'}]:[]),
 ];
 return <section className={styles.rail} aria-label="Acontecimentos do reino"><div className={styles.track}>{cards.map(card=><button type="button" key={card.id} data-tone={card.tone} aria-label={card.label} onClick={card.action}><CozyArt src={card.icon} size={28}/><span><strong>{card.title}</strong><small>{card.detail}</small></span>{card.id==='defense'&&horde&&!attack&&<span className={styles.forces} aria-label={`Horda ${crownNumber(horde.power)}, defesa ${crownNumber(computed.defensePower+horde.supportPower)}`}>{crownNumber(computed.defensePower+horde.supportPower)} / {crownNumber(horde.power)}</span>}</button>)}</div>{cards.length>2&&<span className={styles.more} aria-hidden="true">•••</span>}</section>;
}
