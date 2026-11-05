"use client";



import CozySymbol from "./CozySymbol";

import { ChevronDown, ChevronRight } from "lucide-react";
import { CITY_TYPES, SECTORS, getCityAppearance } from "@/lib/cozy/catalog";
import type { CozyCity, CozyPayload, CozySector } from "@/lib/cozy/types";
import styles from "./cozy-cities.module.css";
import CozyArt from "./CozyArt";
import CozyMapArt from "./CozyMapArt";

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

function CityCard({ city, data, now, onCity }: Props & { city: CozyCity }) {
  const order = data.state.orders.find(
    (entry) => entry.kind === "upgrade" && entry.cityId === city.id,
  );
  const appearance = getCityAppearance(city);
  const workName = SECTORS.find((sector) => sector.id === order?.sector)?.name;
  return (
    <button
      type="button"
      className={styles.cityCard}
      data-city-class={city.capital?"capital":city.cityClass??"neutral"}
      onClick={() => onCity(city.id)}
      aria-label={`Ver cidade ${city.name}`}
    >
      <span className={styles.cityTop}>
        <span className={styles.cityArt}>
          <CozyMapArt name={appearance.art} size={50}/>
        </span>
        <span className={styles.cityIdentity}>
          <span className={styles.cityHeading}>
            <strong title={city.name}>{city.name}</strong>
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
            data-upgrading={order?.sector === sector.id || undefined}
            key={sector.id}
            aria-label={`${sector.name}: nível ${city.sectors[sector.id]} de 10`}
          >
            <CozyArt src={sectors[sector.id].art} size={36} />
            <strong className={styles.levelNumber}>{city.sectors[sector.id]}</strong>
          </span>
        ))}
      </span>
      {order && !data.computed.readOnly && <span className={styles.cardFoot}>
        <span className={styles.work}><CozySymbol name="time" size={18}/>{workName} · {remaining(order.arrivesAt,now)}</span>
      </span>}
    </button>
  );
}

function CityList(props: Props) {
  if (!props.data.state.cities.length)
    return (
      <p className={styles.empty}>{props.data.state.defeat?'Você não possui mais cidades neste mundo. Os relatos e o ranking continuam disponíveis.':'As cidades do seu reino aparecerão aqui.'}</p>
    );
  return (
    <div className={styles.cityList}>
      {props.data.state.cities.map((city) => (
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
  const { computed } = props.data;
  const paused = computed.readOnly || !computed.started;
  return (
    <section className={styles.collection} aria-label="Cidades do reino">
      
      <header className={styles.heading}>
        <div>
          <h2>Cidades</h2>
        </div>
        <span className={styles.count}>{props.data.state.cities.length}<small> / 10</small></span>
      </header>
      <CityList {...props} />
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
