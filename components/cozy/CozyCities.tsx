"use client";



import {useState} from "react";
import CozySymbol from "./CozySymbol";

import { ChevronDown, ChevronRight, Hammer } from "lucide-react";
import { CITY_TYPES, SECTORS, getCityAppearance } from "@/lib/cozy/catalog";
import type { CozyCity, CozyPayload, CozySector } from "@/lib/cozy/types";
import styles from "./cozy-cities.module.css";
import CozyArt from "./CozyArt";
import CozyMapArt from "./CozyMapArt";
import {CozyNovelty} from "./CozyNovelty";
import {cityNotice,isNewNotice} from "@/lib/cozy/notices";
import {orderQueued,orderStartsAt} from "@/lib/cozy/order-presentation";

type Props = { data: CozyPayload; now: number; onCity: (id: string) => void };
const sectors: Record<CozySector, { art: string; label: string }> = {
  administration: { art: "/buildings/palacio.png", label: "Admin." },
  economy: { art: "/buildings/fazenda.png", label: "Economia" },
  society: { art: "/buildings/habitacao.png", label: "Sociedade" },
  recruitment: { art: "/buildings/quartel.png", label: "Recrut." },
  defense: { art: "/icons/building-wall.png", label: "Defesa" },
};
const number = (value: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(
    Math.floor(value),
  );
const remaining = (at: number, now: number) => {
  const minutes = Math.max(0, Math.ceil((at - now) / 60_000));
  if (!minutes) return "Concluindo…";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours < 24
    ? `${hours} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`
    : `${Math.floor(hours / 24)} d ${hours % 24} h`;
};

function CityCard({ city, data, now, onCity, showAvailability }: Props & { city: CozyCity;showAvailability?:boolean }) {
  const orders = data.state.orders.filter(entry=>entry.kind==="upgrade" && entry.cityId===city.id);
  const active = orders.find(order=>!orderQueued(order));
  const waiting = orders.filter(orderQueued).sort((a,b)=>orderStartsAt(a)-orderStartsAt(b));
  const order = active ?? waiting[0];
  const appearance = getCityAppearance(city);
  const workName = SECTORS.find((sector) => sector.id === order?.sector)?.name;
  const complete = SECTORS.every(({id})=>city.sectors[id]>=10);
  const work = order ?
    <span className={styles.work}><CozySymbol name="time" size={18}/>{workName} · {active ? remaining(active.arrivesAt,now) : `Começa em ${remaining(orderStartsAt(order),now)}`}
      {waiting.length>0 && <small>· {waiting.length} na fila</small>}</span> :
    showAvailability ? <span className={styles.work}><Hammer size={15}/>{complete ? "Setores completos" : "Obra livre"}</span> : null;
  const decision = data.computed.cityLife[city.id]?.decision;
  const unseen = Boolean(data.world.persistent && decision && isNewNotice(data.state,cityNotice(decision.id)));
  return (
    <button
      type="button"
      className={styles.cityCard}
      data-city-class={city.capital?"capital":city.cityClass??"neutral"}
      onClick={() => onCity(city.id)}
      aria-label={`Ver cidade ${city.name}`}
      aria-description={unseen ? "Decisão local nova" : undefined}
    >
      <span className={styles.cityTop}>
        <span className={styles.cityArt}>
          <CozyMapArt name={appearance.art} size={50}/>
        </span>
        <span className={styles.cityIdentity}>
          <span className={styles.cityHeading}>
            <strong title={city.name}>{city.name}</strong>
            {unseen&&<CozyNovelty/>}
            <span className={styles.cityKind} aria-label={`${city.capital ? "Capital" : "Colônia"}, coordenadas ${city.q}, ${city.r}`}>
              {city.capital?"Capital":city.cityClass&&city.cityClass!=="neutral"?CITY_TYPES[city.cityClass]:"Sem tipo"} · {city.q}, {city.r}
            </span>
          </span>
          {data.computed.cityLife[city.id]&&data.computed.cityLife[city.id].contentment<60&&<small className={styles.cityAlert}>{data.computed.cityLife[city.id].status}</small>}
          {(city.integrity??100)<100&&<small className={styles.cityAlert}>Estruturas {city.integrity}%</small>}
        </span>
        <span className={styles.cityCredit} aria-label={`Influência de infraestrutura: ${data.computed.influenceDetails.cities[city.id]??0} pontos`}>
          <CozyArt src="/icons/influence-infrastructure.png" size={19}/>
          {number(data.computed.influenceDetails.cities[city.id]??0)}
        </span>
        <ChevronRight size={18} className={styles.chevron} aria-hidden="true" />
      </span>
      <span
        className={styles.sectorStrip}
        aria-label={`Níveis dos setores de ${city.name}`}
      >
        {SECTORS.map((sector) => (
          <span
            className={styles.sector}
            data-city-sector={sector.id}
            data-upgrading={active?.sector === sector.id || undefined}
            key={sector.id}
            aria-label={`${sector.name}: nível ${city.sectors[sector.id]} de 10`}
          >
            <CozyArt src={sectors[sector.id].art} size={36} />
            <strong className={styles.levelNumber}>{city.sectors[sector.id]}</strong>
          </span>
        ))}
      </span>
      {work && !data.computed.readOnly && <span className={styles.cardFoot}>{work}</span>}
    </button>
  );
}

function CityList(props: Props & {cities?:CozyCity[];showAvailability?:boolean}) {
  if (!props.data.state.cities.length)
    return (
      <p className={styles.empty}>{props.data.state.defeat?'Você não possui mais cidades neste mundo. Os relatos e o ranking continuam disponíveis.':'As cidades do seu reino aparecerão aqui.'}</p>
    );
  const cities = props.cities ?? props.data.state.cities;
  if (!cities.length) return <p className={styles.empty}>Nenhuma cidade com obra livre agora.</p>;
  return (
    <div className={styles.cityList}>
      {cities.map((city) => (
        <CityCard key={city.id} {...props} city={city} />
      ))}
    </div>
  );
}

export function CityCollection(props: Props) {
  return (
    <section className={styles.collection} aria-label="Cidades do reino">
      <header className={styles.heading}>
        <div>
          <h2>Suas cidades</h2>
        </div>
        
        <span className={styles.count}>
          {props.data.state.cities.length}
          <small> / 10</small>
        </span>
      </header>
      <CityList {...props} />
    </section>
  );
}

export function InfrastructureSummary(props: Props) {
  const { computed,state,world } = props.data;
  const [onlyFree,setOnlyFree] = useState(false);
  const paused = computed.readOnly || !computed.started;
  const showAvailability = Boolean(world.persistent && !paused);
  const occupied = new Set(state.orders.filter(order=>order.kind==="upgrade").map(order=>order.cityId));
  const freeCities = state.cities.filter(city=>!occupied.has(city.id)&&SECTORS.some(({id})=>city.sectors[id]<10));
  return (
    <section className={styles.collection} aria-label="Cidades do reino">
      
      <header className={styles.heading}>
        <div>
          <h2>Cidades</h2>
        </div>
        <span className={styles.count}>{props.data.state.cities.length}<small> / 10</small></span>
      </header>
      {showAvailability&&<div className={styles.workFilters} role="group" aria-label="Filtrar cidades por obra">
        <button type="button" aria-pressed={!onlyFree} onClick={()=>setOnlyFree(false)}>Todas</button>
        <button type="button" aria-pressed={onlyFree} onClick={()=>setOnlyFree(true)}>Obras livres <b>{freeCities.length}</b></button>
      </div>}
      <CityList {...props} cities={showAvailability&&onlyFree?freeCities:state.cities} showAvailability={showAvailability}/>
      <details
        className={styles.production}
        aria-label="Produção de todas as cidades"
      >
        <summary>
          Produção do reino
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <div className={styles.productionValues}>
          <span>
            <CozySymbol name="materials" size={27}/>
            <span>
              <strong>
                {!paused && "+"}
                {number(computed.productionPerDay.materials)}
              </strong>{" "}
              materiais
            </span>
          </span>
          <span>
            <CozySymbol name="supplies" size={27}/>
            <span>
              <strong>
                {!paused && "+"}
                {number(computed.productionPerDay.supplies)}
              </strong>{" "}
              suprimentos
            </span>
          </span>
        </div>
        <p>
          {computed.readOnly
            ? "Produção encerrada. Valores de capacidade por dia de jogo."
            : !computed.started
              ? "Produção começa quando a temporada abrir. Valores por dia de jogo."
              : "Total por dia de jogo, compartilhado entre suas cidades."}
        </p>
      </details>
    </section>
  );
}
