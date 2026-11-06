"use client";


import {expeditionCost,expeditionTravelMs,explorationPath,explorationCorridor} from "@/lib/cozy/exploration-route";
import {orderMapLabel} from '@/lib/cozy/order-presentation';
import {playerCampaign} from '@/lib/cozy/player-campaign';
import CozyMapEmblem from "./CozyMapEmblem";
import CozySymbol from "./CozySymbol";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowDownToLine,
  Castle,
  ChevronLeft,
  ChevronRight,
  Compass,
  Crown,
  Flag,
  Landmark,
  MapPin,
  ScrollText,
  Search,
  Shield,
  Sparkles,
  Sprout,
  Swords,
  X,
} from "lucide-react";
import type { CozyPayload, CozyTile } from "@/lib/cozy/types";
import type { CozyCommand } from "./useCozyWorld";
import CozySanctuaryCard from "./CozySanctuaryCard";
import {getCityAppearance} from "@/lib/cozy/catalog";
import {mapDestinations,mapOwnership,mapAreaAccess,readMapCamera,type MapFilter} from "@/lib/cozy/map-navigation";
import CozyMapScene from "./CozyMapScene";
import CozyMapArt from "./CozyMapArt";
import base from "./cozy.module.css";
import mapStyles from "./cozy-map.module.css";

const styles = { ...base, ...mapStyles };
type Props = {
  data: CozyPayload;
  act: (action: CozyCommand) => Promise<boolean>;
  locked: boolean;
  now: number;
  onCity: (id: string) => void;
  feedback?: ReactNode;
  initialTarget?: { q: number; r: number } | null;
};
const number = (value: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(
    Math.floor(value || 0),
  );
const remaining = (at: number, now: number) => {
  const minutes = Math.max(0, Math.ceil((at - now) / 60_000));
  if (!minutes) return "Chegando…";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours < 24
    ? `${hours} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`
    : `${Math.floor(hours / 24)} d ${hours % 24} h`;
};
function ActionButton({
  children,
  onClick,
  disabled,
  quiet = false,
  blockedReason,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  quiet?: boolean;
  blockedReason?: string;
}) {
  const [explanationVisible,setExplanationVisible]=useState(false);
  return (
    <>
    <button
      type="button"
      className={`${quiet ? styles.secondaryButton : styles.button} ${blockedReason?styles.blockedAction:""}`}
      data-map-action={quiet ? "secondary" : "primary"}
      onClick={()=>blockedReason?setExplanationVisible(true):onClick()}
      disabled={disabled&&!blockedReason}
      aria-disabled={disabled||undefined}
      data-blocked={disabled||undefined}
    >
      {children}
    </button>
    {explanationVisible&&blockedReason&&<p className={styles.inlineNotice} role="status">{blockedReason}</p>}
    </>
  );
}
function ResourceCost({
  amount,
  kind,
}: {
  amount: number;
  kind: "supplies" | "gold" | "materials";
}) {
  return (
    <span className={styles.cost}>
      <CozySymbol name={kind} size={22}/>
      {number(amount)}
      <span className={styles.srOnly}>
        {" "}
        {kind === "gold"
          ? "ouro"
          : kind === "supplies"
            ? "suprimentos"
            : "materiais"}
      </span>
    </span>
  );
}
function Progress({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label: string;
}) {
  return (
    <div
      className={styles.progress}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
    >
      <span
        style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }}
      />
    </div>
  );
}

function MapSheet({
  children,
  title,
  closeLabel,
  onClose,
  restoreFocus,
  compact = false,
}: {
  children: ReactNode;
  title: string;
  closeLabel: string;
  onClose: () => void;
  restoreFocus?: () => void;
  compact?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const trigger = document.activeElement;
    if (compact) dialog.show();
    else dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      requestAnimationFrame(() => {
        if (document.querySelector("dialog[open]")) return;
        if (restoreFocus) restoreFocus();
        else if (trigger instanceof HTMLElement && trigger.isConnected)
          trigger.focus({ preventScroll: true });
      });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`${styles.sheet} ${compact ? styles.compactSheet : ""}`}
      aria-label={title}
      onKeyDown={(event) => { if (compact && event.key === "Escape") { event.preventDefault(); onClose(); } }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.target === event.currentTarget &&
          (event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom)
        )
          onClose();
      }}
    >
      <header className={styles.sheetHeader}>
        <h2>{title}</h2>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label={closeLabel}
          autoFocus
        >
          <X size={21} />
        </button>
      </header>
      <div className={`${styles.sheetBody} ${base.gamePanel} ${base.companion}`}>{children}</div>
    </dialog>
  );
}

export default function CozyMap({
  data,
  act,
  locked,
  now,
  onCity,
  feedback,
  initialTarget,
}: Props) {
  const capital =
    data.state.cities.find((city) => city.capital) || data.state.cities[0];
  const [center, setCenter] = useState(
    initialTarget ?? {
      q: capital?.q || 0,
      r: capital?.r || 0,
    },
  );
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    initialTarget
      ? (data.tiles.find(
          (tile) => tile.q === initialTarget.q && tile.r === initialTarget.r,
        )?.id ?? null)
      : null,
  );
  const [candidates,setCandidates]=useState<CozyTile[]>([]);
  const [view, setView] = useState<"territory" | "unknown" | "locate" | "choose" | "empires" | null>(() =>
    initialTarget &&
    data.tiles.some(
      (tile) => tile.q === initialTarget.q && tile.r === initialTarget.r,
    )
      ? "territory"
      : null,
  );
  const [zoom, setZoom] = useState(.65);
  const [cameraReady, setCameraReady] = useState(false);
  const cameraKey = `kw-cozy-map:${data.world.id}:${data.state.playerId}`;
  useEffect(() => {
    if (initialTarget) {
      setCenter(initialTarget);
      setZoom(1);
      setSelectedId(data.tiles.find(tile=>tile.q===initialTarget.q&&tile.r===initialTarget.r)?.id??null);
      setView("territory");
    } else {
      try {
        const saved = readMapCamera(localStorage.getItem(cameraKey));
        if (saved) { setCenter(saved.center); setZoom(saved.scale); }
      } catch { /* View preferences are optional. */ }
    }
    setCameraReady(true);
  }, [cameraKey, initialTarget]);
  useEffect(() => {
    if (!cameraReady) return;
    try { localStorage.setItem(cameraKey, JSON.stringify({center,scale:zoom})); } catch { /* Optional. */ }
  }, [cameraReady, cameraKey, center, zoom]);
  const [heroId, setHeroId] = useState("");
  const [mapFilter, setMapFilter] = useState<MapFilter>("all");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(24);
  useEffect(() => { setVisibleCount(24); }, [mapFilter, search]);
  const [coords, setCoords] = useState("");
  const [coordError, setCoordError] = useState("");

  const mapRef = useRef<HTMLElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const lastFeedback = useRef("");
  useEffect(() => {
    const content = feedbackRef.current?.textContent || "";
    if (content && content !== lastFeedback.current)
      feedbackRef.current?.parentElement?.scrollTo({ top: 0 });
    lastFeedback.current = content;
  }, [feedback, view]);
  const [unknownCoord,setUnknownCoord]=useState<{q:number;r:number}|null>(null);
  const selected = data.tiles.find((tile) => tile.id === selectedId);
  const campaign=selected?playerCampaign(data.state,data.world,selected):null;
  const campaignTooLate=Boolean(campaign&&data.computed.endsAt!==null&&now+campaign.totalMs>data.computed.endsAt);
  const selectedTower = data.computed.sanctuaries.find(tower=>tower.id===selected?.landmarkId);
  const selectedCity = data.state.cities.find(city=>city.id===selected?.cityId);
  const freeHeroes = data.state.heroes.filter(
    (hero) =>
      !hero.cityId &&
      !data.state.orders.some((order) => order.heroId === hero.id),
  );
  const selectedHero =
    freeHeroes.find((hero) => hero.id === heroId)?.id ||
    freeHeroes[0]?.id ||
    "";
  const tileIcon = (tile: CozyTile) => {
    if (!tile.revealed) return <span>?</span>;
    const ownCity = data.state.cities.find(city => city.id === tile.cityId);
    const name = tile.kind === "city" ? (ownCity ? getCityAppearance(ownCity).art : "city") : tile.kind === "gold" ? "mine" : tile.kind === "materials" ? "materials" : tile.kind === "abandoned" ? "abandoned" : tile.kind === "npc" ? "npc" : tile.kind === "ruin" ? "ruin" : tile.kind === "portal" ? "landmark" : null;
    return name ? <CozyMapArt name={name} size={30} /> : <span>{tile.revealed ? "·" : "?"}</span>;
  };
  const tileOrder = selected
    ? data.state.orders.find(
        (order) => order.q === selected.q && order.r === selected.r,
      )
    : undefined;
  const exploration = data.state.orders.find(order=>order.kind==="explore");
  const exploring = Boolean(exploration);
  const explorationBlocked = !locked&&exploration ? `Exploração em andamento · ${remaining(exploration.arrivesAt,now)} restantes. Aguarde a chegada para enviar outra.` : undefined;
  const attacking = data.state.orders.some((order) => order.kind === "attack");
  const collecting = data.state.orders.some(
    (order) => order.kind === "collect",
  );
  const select = (tile: CozyTile) => {
    setUnknownCoord(null);
    setSelectedId(tile.id);
    setCenter({ q: tile.q, r: tile.r });
    setView("territory");
  };
  const matching = useMemo(() => mapDestinations(data,mapFilter,search), [data,mapFilter,search]);
  return (
    <section
      ref={mapRef}
      className={styles.worldMap}
      aria-label="Mapa do mundo"
    >
      <header className={styles.toolbar}>
        <div>
          <span>MUNDO</span>
          <strong>
            <Compass size={15} /> {Math.round(center.q)}, {Math.round(center.r)}
          </strong>
        </div>
        <button
          type="button"
          onClick={() => {
            setCenter({ q: capital?.q || 0, r: capital?.r || 0 });
            setSelectedId(null);
          }}
          aria-label="Centralizar na capital"
        >
          <Crown size={19} />
          <span>Capital</span>
        </button>
        <button type="button" onClick={() => setView("locate")}>
          <Search size={19} />
          <span>Localizar</span>
        </button>
        
      </header>
      <CozyMapScene data={data} center={center} onCenter={setCenter} onSelect={select} onUnknown={coord=>{setSelectedId(null);setUnknownCoord(coord);setView("unknown");}} onEmpires={()=>setView("empires")} onChoose={tiles=>{setCandidates(tiles);setView("choose");}} selectedId={selectedId} unknownCoord={view==="unknown"?unknownCoord:null} selectionOpen={view==="territory"||view==="unknown"} scale={zoom} onScaleChange={setZoom} now={now}/>
      {view==="empires"&&<MapSheet title="Reinos conhecidos" closeLabel="Fechar reinos" onClose={()=>setView(null)}><div className={styles.discoveryList}>{Array.from(new Set(data.tiles.filter(t=>t.revealed).flatMap(t=>(t.ownerId??t.territoryOwnerId)?[t.ownerId??t.territoryOwnerId!]:[]))).sort().map(id=>{const tile=data.tiles.find(t=>t.revealed&&t.ownerId===id&&t.kind==='city')??data.tiles.find(t=>t.revealed&&t.territoryOwnerId===id)!;const player=data.players.find(p=>p.playerId===id);return <button key={id} data-map-realm={id} onClick={()=>{setCenter(tile);setZoom(.55);setSelectedId(null);setView(null);}}><CozyMapEmblem ownerId={id} crest={data.shared.realmCrests?.[id]}/><span><strong>{player?.playerName??'Outro reino'}</strong><small>{mapOwnership(tile,data)}</small></span><ChevronRight size={18}/></button>;})}</div></MapSheet>}
      {view==="choose"&&<MapSheet title="Escolher cidade" closeLabel="Fechar cidades próximas" onClose={()=>setView(null)}><div className={styles.discoveryList}>{candidates.map(tile=><button key={tile.id} onClick={()=>select(tile)} data-map-choice={tile.id}>{tile.ownerId&&<CozyMapEmblem ownerId={tile.ownerId} crest={data.shared.realmCrests?.[tile.ownerId]}/>}<span><strong>{tile.name}</strong><small>{mapOwnership(tile,data)}</small></span><small>{tile.q}, {tile.r}</small></button>)}</div></MapSheet>}
      {view === "unknown" && unknownCoord && <MapSheet compact title="Território desconhecido" closeLabel="Fechar território" onClose={()=>setView(null)}>
        <div className={styles.selectedTileBody}><div className={styles.ownership}>{unknownCoord.q}, {unknownCoord.r}</div><span>{explorationCorridor(explorationPath(data.state,unknownCoord),data.computed.worldDiagonalLimit??40).filter(id=>!data.tiles.some(t=>t.id===id&&t.revealed)).length} hexágonos novos · caminho e arredores</span><ActionButton blockedReason={explorationBlocked} disabled={locked||exploring||!data.state.cities.length||data.state.resources.supplies<expeditionCost(data.state,unknownCoord)} onClick={()=>void act({type:'explore',...unknownCoord})}><Compass size={16}/>Explorar caminho<span className={styles.actionQuote}><ResourceCost amount={expeditionCost(data.state,unknownCoord)} kind="supplies"/><CozySymbol name="time" size={18}/>{remaining(now+expeditionTravelMs(data.state,data.world,unknownCoord),now)}</span></ActionButton></div>
      </MapSheet>}
      {view === "territory" && selected && (
        <MapSheet
          compact
          title={selected.name}
          closeLabel="Fechar território"
          onClose={() => setView(null)}
          restoreFocus={() =>
            mapRef.current
              ?.querySelector<HTMLButtonElement>(
                "[data-cozy-tile][aria-selected='true']",
              )
              ?.focus({ preventScroll: true })
          }
        >
          <div ref={feedbackRef}>{feedback}</div>
          <div className={styles.selectedTileArt}>
            {selectedCity?<CozyMapArt name={getCityAppearance(selectedCity).art} size={160}/>:<img
              src={selected.landmarkId ? (selected.landmarkId==="sanctuary-central"?"/landmarks/observatory-study-v1.png":"/landmarks/sanctuary-district-v1.png") : `/images/${selected.kind === "portal" ? "portal-closed.jpg" : selected.kind === "city" ? "capital.jpg" : selected.kind === "npc" ? "territory-hostile.jpg" : selected.kind === "gold" || selected.kind === "materials" ? "treasure.jpg" : selected.revealed ? "territory-known-empty.jpg" : "territory-unknown.jpg"}`}
              alt=""
            />}
            <div>
              <span className={styles.eyebrow}>
                {selected.q}, {selected.r}
              </span>

            </div>
          </div>
          <div className={styles.selectedTileBody}>
            <div className={styles.ownership} aria-label="Território e acesso">
              <span>{selected.revealed&&(selected.ownerId??selected.territoryOwnerId)&&<CozyMapEmblem ownerId={(selected.ownerId??selected.territoryOwnerId)!} crest={data.shared.realmCrests?.[(selected.ownerId??selected.territoryOwnerId)!]}/>} {mapOwnership(selected,data)}</span>
              {selected.revealed&&selected.area&&selected.area.owners.length>1&&<span aria-label="Impérios que compartilham a reserva">{selected.area.owners.map(id=><span key={id} title={data.players.find(p=>p.playerId===id)?.playerName??'Outro reino'}><CozyMapEmblem ownerId={id} crest={data.shared.realmCrests?.[id]}/><span className={styles.srOnly}>{data.players.find(p=>p.playerId===id)?.playerName??'Outro reino'}</span></span>)}</span>}
              {mapAreaAccess(selected,data.state.playerId)&&<strong>{mapAreaAccess(selected,data.state.playerId)}</strong>}
            </div>
            {selected.kind!=="city"&&!selectedTower&&<details className={styles.tileInfo}><summary>ⓘ Detalhes</summary><p>{selected.clue}</p></details>}
            {selectedTower&&<CozySanctuaryCard tower={selectedTower} data={data} act={act} locked={locked} now={now}/>}
            {selected.power !== null && selected.power > 0 && (
              <div className={styles.inlineNotice}>
                <Shield size={16} />
                Defesa da aldeia: {number(selected.power)}
              </div>
            )}
            {selected.power!==null&&selected.attackable&&<div className={styles.combatQuote}><span>Seu ataque <strong>{number(data.computed.armyPower)}</strong></span><span>Mínimo para iniciar ocupação <strong>{number(selected.combat?.occupationRequired??Math.ceil(selected.power*1.25))}</strong></span><small>O combate pode causar perdas. A margem de ocupação usa a força na chegada, antes das baixas.</small><span><CozySymbol name="time" size={18}/>{remaining(now+selected.travelMs,now)} até a chegada</span></div>}
            {tileOrder && (
              <div className={styles.inlineNotice}>
                <CozySymbol name="time" size={18}/>
                {orderMapLabel(tileOrder)} ·{" "}
                {remaining(tileOrder.arrivesAt, now)}
              </div>
            )}
            {!selected.revealed && (
              <div className={styles.mapActionBlock}>
                <ActionButton
                  blockedReason={explorationBlocked}
                  disabled={
                    locked ||
                    exploring ||
                    data.state.resources.supplies < selected.exploreCost
                  }
                  onClick={() =>
                    void act({
                      type: "explore",
                      q: selected.q,
                      r: selected.r,
                    })
                  }
                >
                  <Compass size={16} />
                  <span>Explorar caminho</span>
                  <span className={styles.actionQuote}><ResourceCost amount={selected.exploreCost} kind="supplies"/><span><CozySymbol name="time" size={18}/>{remaining(now+selected.travelMs,now)}</span></span>
                </ActionButton>
                {exploring && (
                  <small role="status">{explorationBlocked}</small>
                )}
              </div>
            )}
            {!selected.revealed && selected.attackable && (
              <details className={`${styles.mapActionBlock} ${styles.tileInfo}`}>
                <summary><Swords size={16}/> Investida militar</summary>
                <p>
                  A pista indica uma aldeia. Você pode atacar antes de revelar,
                  mas a resistência é desconhecida e o combate pode causar
                  perdas.
                </p>
                <ActionButton
                  quiet
                  disabled={locked || attacking || data.computed.armyPower <= 0}
                  onClick={() =>
                    void act({
                      type: "attack",
                      q: selected.q,
                      r: selected.r,
                      conquest: false,
                    })
                  }
                >
                  <Swords size={16} />
                  Atacar sem explorar
                </ActionButton>
              </details>
            )}
            {selected.kind === "city" &&
              selected.ownerId === data.state.playerId &&
              selected.cityId && (
                <ActionButton onClick={() => onCity(selected.cityId!)}>
                  <Castle size={16} />
                  Cuidar da cidade
                </ActionButton>
              )}
            {selected.kind === "city" &&
              selected.ownerId !== data.state.playerId && (
                data.world.combatMode==='competitive'&&!selected.reservedSlot&&!data.shared.alliances.some(a=>a.members.includes(data.state.playerId)&&a.members.includes(selected.ownerId!))?<div className={styles.mapActionBlock} aria-label="Ataque a cidade de jogador">
                  <strong>{selected.name}</strong>
                  <span><CozySymbol name="supplies" size={20}/>{number(campaign?.supplies??selected.exploreCost)} · <CozySymbol name="time" size={18}/>Chegada {remaining(now+(campaign?.arrivalMs??selected.travelMs),now)} · Volta {remaining(now+(campaign?.totalMs??selected.travelMs*2),now)}</span>
                  <ActionButton disabled={locked||attacking||campaignTooLate||data.computed.armyPower<=0||data.state.resources.supplies<(campaign?.supplies??selected.exploreCost)} onClick={()=>void act({type:'attack_player',q:selected.q,r:selected.r})}><Swords size={16}/>Atacar estruturas</ActionButton>
                  <label htmlFor="player-conquest-hero">Herói para ocupar</label><select id="player-conquest-hero" value={selectedHero} disabled={locked||!freeHeroes.length} onChange={event=>setHeroId(event.target.value)}>{!freeHeroes.length&&<option value="">Nenhum herói livre</option>}{freeHeroes.map(hero=><option value={hero.id} key={hero.id}>{hero.name}</option>)}</select>
                  <ActionButton disabled={locked||attacking||campaignTooLate||!selectedHero||data.state.cities.length>=10||data.computed.armyPower<=0||data.state.resources.supplies<(campaign?.supplies??selected.exploreCost)} onClick={()=>void act({type:'attack_player',q:selected.q,r:selected.r,conquest:true,heroId:selectedHero})}><Flag size={16}/>Atacar e tentar ocupar</ActionButton>
                  {campaignTooLate&&<small>Não há tempo para concluir a investida antes do fim da temporada.</small>}
                  <details><summary>Condições de ocupação</summary><p>A chegada inclui 12 horas de preparação e o deslocamento. A investida só libera outro ataque após a volta. Seu exército continua defendendo o reino. O vencedor recebe saque limitado dos recursos do perdedor. Ocupar exige integridade zerada, 25% de margem sobre a defesa e um herói livre. Pode exigir várias investidas. Aliados não podem ser atacados.</p></details>
                </div>:<div className={styles.inlineNotice}>
                  <CozySymbol name="alliance" size={18}/>
                  {selected.reservedSlot ? "Este reino poderá receber um novo jogador." : "Um reino vizinho. Jogadores cooperam e não atacam uns aos outros."}
                </div>
              )}
            {selected.revealed &&
              ["npc", "abandoned"].includes(selected.kind) &&
              !selected.ownerId && (
                <div className={styles.mapActionBlock}>
                  <h4>
                    {selected.kind === "npc"
                      ? "Um encontro com NPCs"
                      : "Cidade independente ou abandonada"}
                  </h4>
                  <p>
                    Ataques podem causar perdas. O exército responde no momento
                    da chegada.
                  </p>
                  <small>
                    <CozySymbol name="time" size={18}/>
                    {remaining(now + selected.travelMs, now)} de preparação e
                    chegada
                  </small>
                  <ActionButton
                    quiet
                    disabled={
                      locked || attacking || data.computed.armyPower <= 0
                    }
                    onClick={() =>
                      void act({
                        type: "attack",
                        q: selected.q,
                        r: selected.r,
                        conquest: false,
                      })
                    }
                  >
                    <Swords size={16} />
                    Atacar e saquear
                  </ActionButton>
                  <div className={styles.divider} />
                  <label htmlFor="conquest-hero">
                    Herói para a nova cidade
                  </label>
                  <select
                    id="conquest-hero"
                    value={selectedHero}
                    disabled={locked || !freeHeroes.length}
                    onChange={(event) => setHeroId(event.target.value)}
                  >
                    {!freeHeroes.length && (
                      <option value="">Contrate ou libere um herói</option>
                    )}
                    {freeHeroes.map((hero) => (
                      <option value={hero.id} key={hero.id}>
                        {hero.name}
                      </option>
                    ))}
                  </select>
                  <ActionButton
                    disabled={
                      locked ||
                      attacking ||
                      !selectedHero ||
                      data.state.cities.length >= 10 ||
                      data.computed.armyPower <= 0
                    }
                    onClick={() =>
                      void act(
                        selected.kind === "abandoned"
                          ? {
                              type: "annex",
                              q: selected.q,
                              r: selected.r,
                              heroId: selectedHero,
                            }
                          : {
                              type: "attack",
                              q: selected.q,
                              r: selected.r,
                              conquest: true,
                              heroId: selectedHero,
                            },
                      )
                    }
                  >
                    <Flag size={16} />
                    {selected.kind === "abandoned"
                      ? "Anexar cidade"
                      : "Conquistar cidade"}
                  </ActionButton>
                  <small>
                    Exige herói livre e força com margem suficiente. Limite de
                    10 cidades.
                  </small>
                </div>
              )}
            {selected.deposit && (
              <div className={styles.mapActionBlock}>
                <div className={styles.row}>
                  <h4>Reserva da área</h4>
                  <CozySymbol name={selected.deposit.resource} size={24}/>
                </div>
                <p>
                  Os pontos desta área usam a mesma reserva. Anexe para coletar; aliados podem compartilhar o acesso. O território permanece após o esgotamento.
                </p>
                <Progress
                  value={selected.deposit.surveys}
                  max={3}
                  label="Exploração da área de recursos"
                />
                <small>
                  {Math.min(3, selected.deposit.surveys)}/3 etapas exploradas
                </small>
                <div className={styles.row}>
                  <span>Reserva disponível</span>
                  <strong>{number(selected.deposit.remaining)}</strong>
                </div>
                {selected.area && <p>{selected.area.owners.length ? `Impérios registrados: ${selected.area.owners.map(id=>data.players.find(p=>p.playerId===id)?.playerName??id).join(", ")}.` : "Área ainda não anexada."}</p>}
                {selected.area&&selected.area.owners.includes(data.state.playerId)&&!selected.area.canCollect&&<p>O acesso compartilhado exige uma aliança vigente com o primeiro anexante.</p>}
                {selected.area?.canAnnex && <ActionButton disabled={locked} onClick={()=>void act({type:"area_annex",q:selected.q,r:selected.r})}><Flag size={16}/>{selected.area.owners.length ? "Compartilhar em aliança" : "Anexar área"}</ActionButton>}
                {selected.deposit.surveys < 3 ? (
                  <ActionButton
                    disabled={
                      locked ||
                      exploring ||
                      data.state.resources.supplies < selected.exploreCost
                    }
                    onClick={() =>
                      void act({
                        type: "explore",
                        q: selected.q,
                        r: selected.r,
                      })
                    }
                  >
                    <Compass size={16} />
                    Explorar mais um trecho{" "}
                    <ResourceCost
                      amount={selected.exploreCost}
                      kind="supplies"
                    />
                    <span className={styles.actionQuote}><CozySymbol name="time" size={18}/>{remaining(now+selected.travelMs,now)}</span>
                  </ActionButton>
                ) : (
                  <ActionButton
                    disabled={
                      locked || collecting || selected.deposit.remaining <= 0 || !selected.area?.canCollect
                    }
                    onClick={() =>
                      void act({
                        type: "collect",
                        q: selected.q,
                        r: selected.r,
                      })
                    }
                  >
                    <ArrowDownToLine size={16} />
                    {selected.deposit.remaining <= 0
                      ? "Depósito esgotado"
                      : "Iniciar coleta"}
                  </ActionButton>
                )}
              </div>
            )}
            {selected.kind === "portal" && (
              <div className={styles.mapActionBlock}>
                <p>Um marco antigo do mundo. O Selo de Vitória é conquistado ao alcançar 1.500 de influência.</p>
              </div>
            )}
          </div>
        </MapSheet>
      )}
      {view === "locate" && (
        <MapSheet
          title="Localizar no mundo"
          closeLabel="Fechar localização"
          onClose={() => setView(null)}
        >
          <div className={styles.destinationSearch}>
            <label htmlFor="map-search">Buscar destino conhecido</label>
            <div><Search size={17}/><input id="map-search" type="search" placeholder="Cidade, recurso ou coordenadas" value={search} maxLength={80} onChange={event=>setSearch(event.target.value)}/></div>
          </div>
          <details className={styles.coordinateDetails}>
            <summary><MapPin size={16}/>Ir por coordenadas</summary>
          <form
            className={styles.coordinateForm}
            onSubmit={(event) => {
              event.preventDefault();
              const values = coords
                .trim()
                .split(/[ ,:;]+/)
                .map(Number);
              if (
                values.length !== 2 ||
                !values.every(
                  (value) => Number.isInteger(value) && Math.abs(value) <= 40,
                )
              ) {
                setCoordError(
                  "Use duas coordenadas entre -40 e 40. Exemplo: 0, 0.",
                );
                return;
              }
              setCenter({ q: values[0], r: values[1] });
              setCoordError("");
              setView(null);
            }}
          >
            <label htmlFor="map-coordinate">Coordenadas</label>
            <div>
              <input
                id="map-coordinate"
                placeholder="q, r"
                value={coords}
                onChange={(event) => {setCoords(event.target.value);setCoordError("");}}
                maxLength={12}
                aria-describedby={coordError ? "coordinate-error" : undefined}
              />
              <button type="submit" className={styles.button}>
                <MapPin size={17} /> Ir
              </button>
            </div>
            {coordError && (
              <p id="coordinate-error" role="alert">
                {coordError}
              </p>
            )}
          </form>
          </details>
          <div className={styles.filters} aria-label="Filtrar territórios">
            {(
              [
                ["all", "Todas"],
                ["cities", "Cidades"],
                ["resources", "Recursos"],
                ["discoveries", "Reveladas"],
                ["journeys", "Viagens"],
              ] as const
            ).map(([id, label]) => (
              <button
                type="button"
                key={id}
                aria-pressed={mapFilter === id}
                onClick={() => setMapFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className={styles.listCaption}>
            {matching.length} destinos · mais próximos primeiro
          </p>
          <div className={styles.discoveryList}>
            {matching.slice(0,visibleCount).map(({tile,accesses,orders}) => (
              <button
                type="button"
                key={tile.id}
                data-map-destination={tile.id}
                data-map-accesses={accesses}
                onClick={() => select(tile)}
                aria-label={`${tile.revealed?tile.name:"Exploração em andamento"}, ${tile.q}, ${tile.r}`}
              >
                <span className={styles.discoveryIcon}>{tile.revealed&&(tile.ownerId??tile.territoryOwnerId)?<CozyMapEmblem ownerId={(tile.ownerId??tile.territoryOwnerId)!} crest={data.shared.realmCrests?.[(tile.ownerId??tile.territoryOwnerId)!]}/>:tileIcon(tile)}</span>
                <span>
                  <strong>{tile.revealed?tile.name:"Exploração em andamento"}</strong>
                  <small>{accesses>1?`${accesses} acessos conhecidos · uma reserva`:tile.revealed?mapOwnership(tile,data):"Destino ainda não revelado"}</small>
                  {tile.deposit&&tile.revealed&&<small>{mapAreaAccess(tile,data.state.playerId)} · {number(tile.deposit.remaining)} restantes</small>}
                  {orders.length>0&&<small className={styles.journeyLabel}><CozySymbol name="time" size={18}/>{orderMapLabel([...orders].sort((a,b)=>a.arrivesAt-b.arrivesAt)[0])} · {remaining(Math.min(...orders.map(o=>o.arrivesAt)),now)}</small>}
                </span>
                <small>
                  {tile.q},{tile.r}
                  <ChevronRight size={14} />
                </small>
              </button>
            ))}
          </div>
          {matching.length>visibleCount&&<button type="button" className={styles.moreDestinations} onClick={()=>setVisibleCount(count=>count+24)}>Mostrar mais destinos · {matching.length-visibleCount}</button>}
          {!matching.length&&<div className={styles.noDestinations}><CozyMapArt name={mapFilter==="journeys"?"time":"ruin"} size={48}/><p>{search?"Nenhum destino conhecido corresponde à busca.":mapFilter==="journeys"?"Nenhuma viagem em andamento.":"Explore as pistas do mapa para encontrar novas áreas."}</p>{search&&<button type="button" onClick={()=>setSearch("")}>Limpar busca</button>}</div>}
        </MapSheet>
      )}
    </section>
  );
}

