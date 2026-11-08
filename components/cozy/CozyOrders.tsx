"use client";

import {orderMapLabel,orderQueued,orderStartsAt,orderExpectedLevel,orderProgress,orderSummary} from '@/lib/cozy/order-presentation';
import CozySymbol from "./CozySymbol";
import CozyScreenHelp from "./CozyScreenHelp";

import {useState} from "react";
import { ArrowRight } from "lucide-react";
import type { CozyOrder, CozyPayload } from "@/lib/cozy/types";
import { RESEARCHES, SECTORS } from "@/lib/cozy/catalog";
import CozyArt from "./CozyArt";
import styles from "./cozy-activity.module.css";

const orderInfo = {
  explore: { title: "Exploração", art: "action-explore.png" },
  attack: { title: "Expedição contra NPC", art: "action-attack.png" },
  collect: { title: "Coleta de recursos", art: "producao.png" },
  portal: { title: "Jornada registrada", art: "action-enter-world.png" },
  upgrade: { title: "Evolução de setor", art: "action-upgrade.png" },
  research: { title: "Pesquisa", art: "influence-government.png" },
};

function countdown(at: number, now: number) {
  const minutes = Math.ceil((at - now) / 60_000);
  if (minutes <= 0) return "Finalizando…";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)
    return `${hours} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`;
  return `${Math.floor(hours / 24)} d ${hours % 24} h`;
}

export default function CozyOrders({
  data,
  now,
  onOrder,
  onCities,
  onExplore,
  onGovernment,
}: {
  data: CozyPayload;
  now: number;
  onOrder: (order: CozyOrder) => void;
  onCities: () => void;
  onExplore: () => void;
  onGovernment:()=>void;
}) {
  const orders = [...data.state.orders].sort(
    (a, b) => a.arrivesAt - b.arrivesAt,
  );
  const summary=orderSummary(orders);
  const [filter,setFilter]=useState<'all'|'cities'|'journeys'|'research'>('all');
  const groups=[{id:'all',label:'Todas',accept:()=>true},{id:'cities',label:'Cidades',accept:(o:CozyOrder)=>o.kind==='upgrade'},{id:'journeys',label:'Viagens',accept:(o:CozyOrder)=>['explore','collect','attack','portal'].includes(o.kind)},{id:'research',label:'Pesquisa',accept:(o:CozyOrder)=>o.kind==='research'}] as const;
  const visible=orders.filter(groups.find(g=>g.id===filter)!.accept);
  return (
    <section className={styles.root} aria-label="Ordens do reino">
      <div className={`${styles.heading} ${styles.compactHeading}`}>
        <h2>
          {orders.length ? summary.label : "Nenhuma ordem em andamento"}
        </h2>
        <CozyScreenHelp screen="orders" playerId={data.state.playerId}/>
      </div>
      {orders.length>0&&<div className={styles.orderFilters} aria-label="Filtrar ordens">{groups.map(group=><button type="button" key={group.id} aria-pressed={filter===group.id} onClick={()=>setFilter(group.id)}>{group.label}<span>{orders.filter(group.accept).length}</span></button>)}</div>}
      {visible.length ? (
        <div className={styles.orderList}>
          {visible.map((order) => {
            const info = order.foundation?{title:"Fundação de cidade",art:"nav-cities.png"}:order.occupationOnly?{title:"Anexação da cidade",art:"action-enter-world.png"}:orderInfo[order.kind];
            const city = data.state.cities.find(
              (entry) => entry.id === order.cityId,
            );
            const sector = SECTORS.find((entry) => entry.id === order.sector);
            const research = RESEARCHES.find(
              (entry) => entry.id === order.research,
            );
            const title = order.foundation||order.occupationOnly||order.returning||order.targetPlayerId?orderMapLabel(order):order.sanctuaryPactId?"Desafio aos guardiões da torre":order.sanctuaryId?`Reconhecimento: ${data.computed.sanctuaries.find(t=>t.id===order.sanctuaryId)?.name??"Torre"}`:
              order.kind === "upgrade" && sector
                ? sector.name
                : order.kind === "research" && research
                  ? research.name
                  : order.kind === "collect"
                    ? `Coleta de ${order.collectResource === "gold" ? "ouro" : "materiais"}`
                    : info.title;
            const target =
              city?.name ??
              (order.kind === "research"
                ? "Pesquisa para todo o reino"
                : order.q !== undefined && order.r !== undefined
                  ? `Destino ${order.q}, ${order.r}`
                  : "Registro da temporada");
            const queued=orderQueued(order);
            const progress=orderProgress(order,now);
            const arriving = now >= order.arrivesAt;
            return (
              <article key={order.id} className={styles.order} data-next={order.id===orders[0]?.id||undefined}>
                {order.id===orders[0]?.id&&!queued&&<span className={styles.nextOrder}>Próxima conclusão</span>}
                <span className={styles.orderStatus} data-queued={queued||undefined}>{queued?"Agendada · começa automaticamente":"Em andamento"}</span>
                <div className={styles.orderHeader}>
                  <CozyArt src={`/icons/${info.art}`} size={44} />
                  <div>
                    <h3>{title}</h3>
                    {order.kind==="upgrade"&&city&&order.sector&&<span className={styles.resultLevel}>Nível {orderExpectedLevel(order,city.sectors[order.sector])} <ArrowRight size={12} aria-hidden="true"/> {orderExpectedLevel(order,city.sectors[order.sector])+1}</span>}
                    {order.kind==="research"&&order.research&&<span className={styles.resultLevel}>Nível {orderExpectedLevel(order,data.state.research[order.research])} <ArrowRight size={12} aria-hidden="true"/> {orderExpectedLevel(order,data.state.research[order.research])+1}</span>}
                    <p>{target}</p>
                    {order.returning&&<div className={styles.expeditionCargo}><span><CozySymbol name="gold" size={18}/>{order.cargo?.gold??0}</span><span><CozySymbol name="materials" size={18}/>{order.cargo?.materials??0}</span></div>}
                  </div>
                </div>
                <div className={styles.orderTime}>
                  <span>
                    <CozySymbol name="time" size={18}/>
                    {queued?"Início previsto em":arriving
                      ? "Aguardando confirmação do reino"
                      : order.returning?"Retorno em":order.targetPlayerId?"Chegada em":"Tempo restante"}
                  </span>
                  <time dateTime={new Date(queued?orderStartsAt(order):order.arrivesAt).toISOString()}>
                    {countdown(queued?orderStartsAt(order):order.arrivesAt, now)}
                  </time>
                </div>
                <div
                  className={styles.progress}
                  role="progressbar"
                  aria-label={`Andamento: ${title}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                >
                  <span style={{ width: `${progress}%` }} />
                </div>
                <p className={styles.arrivalDate}>Previsão · <time dateTime={new Date(order.arrivesAt).toISOString()}>{new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(order.arrivesAt)}</time></p>
                <button
                  className={styles.orderLink}
                  type="button"
                  onClick={() => onOrder(order)}
                  aria-label={`Ver ordem: ${title}`}
                >
                  {order.kind === "upgrade"
                    ? "Ver cidade"
                    : order.kind === "research"
                      ? "Ver pesquisa"
                      : order.kind==="portal"?"Ver registro":"Ver destino"}
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className={styles.restArt}>
          <CozyArt src={filter==='research'?'/icons/influence-government.png':filter==='journeys'?'/icons/action-explore.png':'/icons/nav-empire.png'} size={64} />
          {orders.length>0&&<><h3>{filter==='research'?'Nenhuma pesquisa em andamento':filter==='cities'?'Nenhuma obra em andamento':'Nenhuma viagem em andamento'}</h3><p>As outras ordens continuam nos seus filtros.</p><button className={styles.secondaryLink} type="button" onClick={()=>setFilter('all')}>Ver todas as ordens<ArrowRight size={15}/></button></>}
        </div>
      )}
      <div className={styles.shortcuts}>
        {filter==="research"&&<button type="button" onClick={onGovernment}><CozyArt src="/icons/influence-government.png" size={28}/>Ver pesquisas<ArrowRight size={15}/></button>}
        <button type="button" onClick={onCities}>
          <CozyArt src="/icons/nav-cities.png" size={28} />
          Cuidar das cidades
          <ArrowRight size={15} />
        </button>
        <button type="button" onClick={onExplore}>
          <CozyArt src="/icons/action-explore.png" size={28} />
          Explorar o mundo
          <ArrowRight size={15} />
        </button>
      </div>
    </section>
  );
}
