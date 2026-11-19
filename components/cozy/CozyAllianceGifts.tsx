"use client";

import {useId,useState} from "react";
import {Gift} from "lucide-react";
import {
  ALLIANCE_GIFT_PACKS,ALLIANCE_GIFT_RECEIVE_LIMIT,ALLIANCE_GIFT_RESOURCES,
} from "@/lib/cozy/alliance-gifts";
import {isUnreadReport,reportNotice,unreadAllianceGifts} from "@/lib/cozy/notices";
import type {CozyGiftResource} from "@/lib/cozy/types";
import CozySymbol from "./CozySymbol";
import {CozyNovelty,VisibleNotice} from "./CozyNovelty";
import {crownNumber,crownRemaining,type CrownPanelProps} from "./CozyCrownUI";
import styles from "./cozy-alliance.module.css";

const resources = Object.keys(ALLIANCE_GIFT_RESOURCES) as CozyGiftResource[];
const date = new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"});

export default function CozyAllianceGifts({data,act,locked,now}:CrownPanelProps) {
  const {state,allianceGifts:availability} = data;
  const id = useId();
  const [editing,setEditing] = useState(false);
  const [recipientId,setRecipientId] = useState("");
  const [resource,setResource] = useState<CozyGiftResource>("materials");
  const [amount,setAmount] = useState<number>(ALLIANCE_GIFT_PACKS[0]);
  const reports = state.reports.filter(report=>report.allianceGift);
  if (!availability && !reports.length) return null;

  const options = availability?.recipients.map(recipient=>({
    id:recipient.playerId,
    name:data.players.find(player=>player.playerId===recipient.playerId)?.playerName ?? "Aliado",
    reason:availability.sentTo.includes(recipient.playerId) ? "Já presenteado" :
      recipient.receivedLimitReached ? "Cota cheia" : "",
  })) ?? [];
  const target = options.find(option=>option.id===recipientId);
  const hasEligible = options.some(option=>!option.reason);
  const balance = Math.floor(state.resources[resource]);
  const remaining = balance-amount;
  const waitingForDay = Boolean(availability && now>=availability.resetsAt);
  const canSend = availability && target && !target.reason && remaining>=0 && !locked && !waitingForDay;
  const unseen = unreadAllianceGifts(state);
  const history = reports.filter((report,index)=>index<6 || unseen.includes(report));

  return <section aria-labelledby={id} className={`${styles.card} ${styles.gifts}`}>
    <header className={styles.row}><Gift size={22} aria-hidden="true"/><h2 id={id}>Presentes</h2></header>
    {availability && <>
      <div className={styles.giftQuota}>
        <span>Recebidos neste dia de jogo <b>{availability.received}/{ALLIANCE_GIFT_RECEIVE_LIMIT}</b></span>
        <small>Renova em {crownRemaining(availability.resetsAt,now)}</small>
      </div>
      {options.length===0 ? <p className={styles.hint}>Convide um aliado para trocar presentes.</p> : !hasEligible && !editing ?
        <p className={styles.hint}>As cotas de envio para seus aliados se renovam no próximo dia de jogo.</p> :
        <button type="button" className={styles.quiet} aria-expanded={editing} aria-controls={`${id}-form`}
          onClick={()=>setEditing(open=>!open)}>{editing ? "Fechar envio" : "Enviar presente"}</button>}
      {editing && options.length>0 && <form id={`${id}-form`} className={styles.giftForm} onSubmit={async event=>{
        event.preventDefault();
        if (!canSend || !availability || !target) return;
        if(await act({type:"alliance_gift",allianceId:availability.allianceId,day:availability.day,
          recipientId:target.id,resource,amount})) {
          setEditing(false);
          setRecipientId("");
        }
      }}>
        <label htmlFor={`${id}-recipient`}>Aliado</label>
        <select id={`${id}-recipient`} value={target ? recipientId : ""} disabled={locked} onChange={event=>setRecipientId(event.target.value)}>
          <option value="" disabled>Escolher destinatário</option>
          {options.map(option=><option value={option.id} key={option.id} disabled={Boolean(option.reason)}>
            {option.name}{option.reason ? ` · ${option.reason}` : ""}
          </option>)}
        </select>
        <fieldset><legend>Recurso</legend><div className={styles.giftOptions}>
          {resources.map(kind=><button key={kind} type="button" disabled={locked} aria-pressed={resource===kind} onClick={()=>setResource(kind)}>
            <CozySymbol name={kind} size={20}/>{kind==="materials" ? "Materiais" : "Suprimentos"}
          </button>)}
        </div></fieldset>
        <fieldset><legend>Pacote</legend><div className={styles.giftOptions}>
          {ALLIANCE_GIFT_PACKS.map(pack=><button key={pack} type="button" disabled={locked} aria-pressed={amount===pack} onClick={()=>setAmount(pack)}>{pack}</button>)}
        </div></fieldset>
        <div className={styles.giftBalance} aria-live="polite">
          <span>Seu saldo de {ALLIANCE_GIFT_RESOURCES[resource]}</span>
          <b>{crownNumber(balance)}{remaining>=0 && ` → ${crownNumber(remaining)}`}</b>
          {remaining<0 && <small>Faltam {crownNumber(-remaining)} para este pacote.</small>}
          {target?.reason && <small>{target.name} · {target.reason}</small>}
        </div>
        <button type="submit" className={styles.giftPrimary} disabled={!canSend}>Confirmar envio</button>
        <small>Um presente por aliado por dia de jogo. Entrega imediata no tesouro.</small>
      </form>}
    </>}
    {history.length>0 && <details className={styles.giftHistory}>
      <summary>Recibos de presentes {unseen.length>0&&<CozyNovelty/>}</summary>
      <ul>{history.map(report=>{
        const gift = report.allianceGift!;
        const incoming = gift.direction==="received";
        const unread = isUnreadReport(state,report,true);
        return <li key={report.id}>
          <CozySymbol name={gift.resource} size={24}/>
          <span><b>{incoming ? "+" : "−"}{crownNumber(gift.amount)} {ALLIANCE_GIFT_RESOURCES[gift.resource]} </b>
            <VisibleNotice id={unread ? reportNotice(report.id) : undefined} act={act} quiet={!incoming}/>
            <small>{incoming ? "De" : "Para"} {gift.otherPlayerName}</small></span>
          <time dateTime={new Date(report.at).toISOString()}>{date.format(report.at)}</time>
        </li>;
      })}</ul>
    </details>}
  </section>;
}
