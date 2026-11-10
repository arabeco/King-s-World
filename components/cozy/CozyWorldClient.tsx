"use client";

import {AccountAppearance} from "../profile/AccountAppearance";
import {activeRoyalProfile} from "@/lib/cozy/royal-profiles";
import CozySymbol from "./CozySymbol";
import {seasonDisplay} from "@/lib/cozy/season-display";
import {kingdomJourney,type JourneyTarget} from "@/lib/cozy/kingdom-journey";
import CozyNextSteps from "./CozyNextSteps";
import CozyRealmUpdates from "./CozyRealmUpdates";
import {WorldLoadingScreen} from "../world-loading-screen";
import CozyAlliance from "./CozyAlliance";
import {WorldEquipmentSlots} from "./WorldEquipmentSlots";
import {COLLECTION_PRODUCTS} from "@/lib/collection";
import {SovereignStats} from "../profile/SovereignStats";
import CozyRoyalProfile from "./CozyRoyalProfile";
import CozyScreenHelp from "./CozyScreenHelp";
import {CozyHelpAnchor} from "./CozyHelpAnchor";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { isNativeApp } from "@/lib/native-auth";
import CozyMap from "./CozyMap";
import CozyArt from "./CozyArt";
import CozyCityInterior, {type CozyCityEntry} from "./CozyCityInterior";
import CozyOrders from "./CozyOrders";
import CozyTreasury from "./CozyTreasury";
import CozyReports from "./CozyReports";
import CozyMilitary from "./CozyMilitary";
import HordeCard from "./CozyHordeWarning";
import CozyGovernment from "./CozyGovernment";
import CozyCouncil from "./CozyCouncil";
import CozyAchievements from "./CozyAchievements";
import { commandFeedback } from "./cozy-feedback";
import CozyRealmPanorama from "./CozyRealmPanorama";
import { CityCollection, InfrastructureSummary } from "./CozyCities";
import game from "./cozy-game.module.css";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Crown,
  Flag,
  LoaderCircle,
  Plus,
  RefreshCw,
  Shield,
  Trophy,
  X,
} from "lucide-react";
import type { CozyOrder, CozyPayload, CozyResearch, CozyResources } from "@/lib/cozy/types";
import { getCityDevelopment } from "@/lib/cozy/catalog";
import { useCozyWorld, type CozyCommand } from "./useCozyWorld";
import styles from "./cozy.module.css";

type Screen = "crown" | "cities" | "map" | "alliance" | "reports";
type CrownPanel =
  "infrastructure" | "military" | "government" | "council" | "achievements";
type ActionHandler = (action: CozyCommand) => Promise<boolean>;
type PanelProps = {
  data: CozyPayload;
  act: ActionHandler;
  locked: boolean;
  now: number;
};
const number = (value: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(
    Math.floor(value || 0),
  );
const date = (value: number) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
const remaining = (at: number, now: number) => {
  const minutes = Math.max(0, Math.ceil((at - now) / 60_000));
  if (minutes === 0) return "Chegando…";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)
    return `${hours} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`;
  return `${Math.floor(hours / 24)} d ${hours % 24} h`;
};
const panels = [
  {
    id: "infrastructure",
    title: "Infraestrutura",
    sub: "Cidades e produção",
    image: "/icons/influence-infrastructure.png",
  },
  {
    id: "military",
    title: "Militar",
    sub: "Recrutar tropas",
    image: "/icons/influence-military.png",
  },
  {
    id: "government",
    title: "Governo",
    sub: "Heróis e pesquisas",
    image: "/icons/influence-government.png",
  },
  {
    id: "council",
    title: "Conselho",
    sub: "Decisões do reino",
    image: "/icons/nav-intel.png",
  },
  {
    id: "achievements",
    title: "Conquistas",
    sub: "Feitos e vitória",
    image: "/icons/influence-legacy.png",
  },
] as const;
const influenceNames = {
  infrastructure: "Infraestrutura",
  government: "Governo",
  military: "Militar",
  society: "Conselho",
  legacy: "Conquistas",
};

const influenceDestinations:Record<keyof typeof influenceNames,CrownPanel>={infrastructure:'infrastructure',government:'government',military:'military',society:'council',legacy:'achievements'};

function ActionButton({
  children,
  onClick,
  disabled,
  quiet = false,
  title,
  className = "",
  ariaLabel,
  ariaDescribedBy,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  quiet?: boolean;
  title?: string;
  className?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
}) {
  return (
    <button
      type="button"
      className={`${quiet ? styles.secondaryButton : styles.button} ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
    >
      {children}
    </button>
  );
}
function Empty({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className={styles.empty}>
      {icon}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}
function Heading({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className={styles.sectionHeading}>
      <div>
        {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}
function Progress({
  value,
  max,
  label,
  tone = "green",
}: {
  value: number;
  max: number;
  label: string;
  tone?: "green" | "gold";
}) {
  return (
    <div
      className={`${styles.progress} ${tone === "gold" ? styles.progressGold : ""}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
    >
      <span
        style={{
          width: `${Math.min(100, Math.max(0, (value / Math.max(1, max)) * 100))}%`,
        }}
      />
    </div>
  );
}
type GameOverlay =
  CrownPanel | "orders" | "defense" | "influence" | "menu" | "resources" | "royalProfile";

function influenceSources(area:CrownPanel,{state,computed}:CozyPayload): [string,number|string][] {
  const d=computed.influenceDetails;
  if(area==="infrastructure")return state.cities.map(c=>[c.name,d.cities[c.id]??0]);
  if(area==="achievements")return [["Marcos",d.conquests.missions],["Maravilhas",d.conquests.wonderPoints],...(d.conquests.cooperation?[["Cooperação",d.conquests.cooperation] as [string,number]]:[])];
  if(area==="government")return d.model==="legacy"?[["Heróis em função",d.government.heroes]]:[["Heróis",d.government.heroes],["Pesquisas",d.government.research]];
  if(area==="military"){
    if(d.model==="legacy")return [["Tropas e muralhas",Math.floor(d.military.capacity/6)],["Pesquisa militar",state.research.military*15]];
    const victories=Math.floor(Math.min(6,state.hordesWon)/6*(state.progression?.balance?.militaryVictoryMax??0));
    return [["Preparo",computed.influence.military-victories],["Hordas vencidas",victories]];
  }
  if(d.model==="legacy")return [["Satisfação",Math.round(state.satisfaction)+"%"],["Sociedade",state.cities.reduce((n,c)=>n+c.sectors.society,0)+" níveis"]];
  const sources=state.progression?.council.sources;
  const caps=state.progression?.balance?.councilSourceCaps;
  const rows:[string,number|string][]=sources&&caps?[["Decretos",`${sources.decree}/${caps.decree}`],["Cidades",`${sources.local}/${caps.local}`],["Constância",`${sources.stable}/${caps.stable}`]]:[["Mérito",d.council.merit]];
  return [...rows,["Estabilidade",Math.round(d.council.stability*100)+"%"]];
}

function GameSheet({
  title,
  art,
  citySurface = false,
  darkSurface = false,
  crownTone,
  score,
  sourceData,
  onClose,
  children,
}: {
  title: string;
  art?: string;
  citySurface?: boolean;
  darkSurface?: boolean;
  crownTone?: CrownPanel;
  score?: number;
  sourceData?: CozyPayload;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [sourcesOpen,setSourcesOpen]=useState(false);
  const [helpAnchor,setHelpAnchor]=useState<HTMLSpanElement|null>(null);
  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement;
    if (crownTone) dialog?.show();
    else dialog?.showModal();
    return () => {
      if (dialog?.open) dialog.close();
      requestAnimationFrame(() => {
        if (
          trigger instanceof HTMLElement &&
          trigger.isConnected &&
          !document.querySelector("dialog[open]")
        ) {
          trigger.focus({ preventScroll: true });
        }
      });
    };
  }, [crownTone]);
  return (
    <dialog
      ref={ref}
      className={`${game.sheet} ${citySurface ? game.citySheet : ""} ${crownTone || citySurface ? game.crownSheet : ""} ${darkSurface?game.darkSheet:""}`}
      data-crown-tone={crownTone}
      aria-label={title}
      onKeyDown={(event) => {
        if (crownTone && event.target instanceof Element && event.target.closest("dialog") === event.currentTarget && event.key === "Escape" && !event.defaultPrevented) {
          event.preventDefault();
          onClose();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose();
      }}
    >
      <header className={game.sheetHeader}>
        {crownTone && score!==undefined ? <div className={game.areaHeading}>
          {art&&<CozyArt src={art} size={28}/>}
          <div className={game.areaMeter}><div><strong>{title}</strong><b key={score}>{score}<small>/500</small></b></div>
            <progress className={game.areaInfluence} value={score} max={500} aria-label={`Influência de ${title}`}/>
          </div>
          <button type="button" className={game.sourcesToggle} aria-label="Fontes de influência" aria-expanded={sourcesOpen} aria-controls="area-sources" onClick={()=>setSourcesOpen(!sourcesOpen)}><ChevronRight size={17}/></button>
        </div> : <span>{art?<CozyArt src={art} size={28}/>:<Crown size={16}/>} {title}</span>}
        <span className={game.sheetHelp} ref={setHelpAnchor}/>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar painel"
          autoFocus
        >
          <X size={22} />
        </button>
      </header>
      {crownTone && sourceData && <dl className={game.areaSources} id="area-sources" hidden={!sourcesOpen}>{sourcesOpen&&influenceSources(crownTone,sourceData).map(([label,value],index)=><div key={index}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
      <CozyHelpAnchor.Provider value={helpAnchor}><div className={`${game.sheetBody} ${styles.gamePanel}`}>{children}</div></CozyHelpAnchor.Provider>
    </dialog>
  );
}

export function CozyWorldClient({ worldId }: { worldId: string }) {
  const {
    payload: data,
    loading,
    refreshing,
    pending,
    error,
    uncertain,
    clock,
    refresh,
    act,
    retryCommand,
    clearError,
    lastAction,
  } = useCozyWorld(worldId);
  const router = useRouter();
  const [treasuryResource,setTreasuryResource]=useState<keyof CozyResources>("materials");
  const [screen, setScreen] = useState<Screen>("crown");
  const [governmentTab, setGovernmentTab] = useState<"heroes" | "research">(
    "heroes",
  );
  const [achievementEntry,setAchievementEntry]=useState<"Conquistas"|"Vitória"|"Ranking"|undefined>();
  const [panel, setPanel] = useState<GameOverlay | null>(null);

  const [cityId, setCityId] = useState<string | null>(null);
  const [cityEntry, setCityEntry] = useState<CozyCityEntry>("sectors");
  const [cityVisit, setCityVisit] = useState(0);
  const [governmentResearch, setGovernmentResearch] = useState<CozyResearch | undefined>();
  const [mapTarget, setMapTarget] = useState<{ q: number; r: number } | null>(
    null,
  );
  const [dismissedAction, setDismissedAction] = useState<string | null>(null);
  useEffect(() => {
    if (!lastAction) return;
    const timer = window.setTimeout(
      () => setDismissedAction(lastAction.requestId),
      4000,
    );
    return () => window.clearTimeout(timer);
  }, [lastAction]);
  const cityView = useRef<HTMLDivElement>(null);
  const fullView = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const heading = (
      screen === "cities" ? cityView.current : fullView.current
    )?.querySelector("h2");
    if (heading && !document.querySelector("dialog[open]")) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }, [screen, cityId]);
  const back = useRef<() => void>(() => {});
  back.current = () => {
    const dialogs =
      document.querySelectorAll<HTMLDialogElement>("dialog[open]");
    const dialog = dialogs[dialogs.length - 1];
    if (dialog) {
      const cancel = new Event("cancel", { cancelable: true });
      if (dialog.dispatchEvent(cancel)) dialog.close();
    } else if (screen === "cities" && cityId) setCityId(null);
    else if (screen !== "crown") setScreen("crown");
    else router.push("/lobby");
  };
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let disposed = false;
    let remove: (() => Promise<void>) | undefined;
    if (isNativeApp()) {
      void import("@capacitor/app").then(async ({ App }) => {
        if (disposed) return;
        const listener = await App.addListener("backButton", () =>
          back.current(),
        );
        if (disposed) await listener.remove();
        else remove = () => listener.remove();
      });
    }
    return () => {
      disposed = true;
      document.body.style.overflow = previous;
      void remove?.();
    };
  }, []);

  if (!data)
    return (
      <div className={`${styles.root} ${game.root}`}>
        <div className={game.loading}>
          <Crown size={40} />
          <h1>KING’S WORLD</h1>
          {loading ? (
<WorldLoadingScreen />
          ) : (
            <>
              <p role="alert">
                {error || "Não foi possível carregar o reino."}
              </p>
              <ActionButton
                onClick={() => void refresh()}
                disabled={refreshing}
              >
                Tentar novamente
              </ActionButton>
              <Link href="/lobby">Voltar aos mundos</Link>
            </>
          )}
        </div>
      </div>
    );

  const { state, computed, world } = data;
  const royalPortrait = activeRoyalProfile(state)?.image;
  const locked =
    pending || Boolean(uncertain) || computed.readOnly || !computed.started;
  const group=data.shared.alliances.find(a=>a.id===state.allianceId);
  const invitationCount=state.allianceId?0:data.shared.alliances.filter(a=>a.invitations?.includes(state.playerId)).length;
  const helpCount=data.shared.support.filter(s=>s.allianceId===group?.id&&s.arrivesAt>clock&&s.supporterId===null&&s.requesterId!==state.playerId).length;
  const entryCount=group?.founderId===state.playerId?group.requests?.length??0:0;
  const projectNotice=state.reports.some(r=>r.kind==='alliance'&&r.title==='Projeto da aliança concluído'&&r.at>state.readAt);
  const allianceNotice=invitationCount?`${invitationCount} convite${invitationCount>1?'s':''} de aliança`:helpCount?`${helpCount} pedido${helpCount>1?'s':''} de ajuda`:entryCount?`${entryCount} pedido${entryCount>1?'s':''} de entrada`:projectNotice?'Projeto concluído':null;
  const props: PanelProps = { data, act, locked, now: clock };
  const city =
    state.cities.find((entry) => entry.id === cityId) || state.cities[0];
  const canStart = (data as CozyPayload & { canStart?: boolean }).canStart;

  const wonderReady = state.cities.some(
    (entry) => getCityDevelopment(entry) >= 100 && !entry.wonder,
  );
  const journey=kingdomJourney(data,clock);
  const calendar=seasonDisplay(computed.day,computed.durationDays,computed.realDurationDays);
  const navigate = (next: Screen) => {
    setPanel(null);
    setScreen(next);
    if (next === "cities") setCityId(null);
    if (next === "map") setMapTarget(null);
  };
  const openTreasury=(resource:keyof CozyResources)=>{setTreasuryResource(resource);setPanel("resources");};
  const openCity = (id: string, entry: CozyCityEntry = "sectors") => {
    setCityId(id);
    setCityEntry(entry);
    setCityVisit(visit => visit + 1);
    setPanel(null);
    setScreen("cities");
  };
  const openOrder = (order: CozyOrder) => {
    if (order.kind === "upgrade" && order.cityId) {
      openCity(order.cityId, order.sector ?? "sectors");
    } else if (order.kind === "portal") {
      setPanel("achievements");
    } else if (order.kind === "research") {
      setGovernmentResearch(order.research);
      setGovernmentTab("research");
      setPanel("government");
    } else {
      setMapTarget({ q: order.q ?? 0, r: order.r ?? 0 });
      setPanel(null);
      setScreen("map");
    }
  };
  const followJourney=(target:JourneyTarget)=>{
    if(target.kind==='city')openCity(target.cityId,target.entry);
    else if(target.kind==='map')navigate('map');
    else if(target.kind==='reports')navigate('reports');
    else if(target.kind==='achievements'){setAchievementEntry(target.tab);setPanel('achievements');}
    else if(target.kind==='research'){setGovernmentTab('research');setGovernmentResearch(target.research);setPanel('government');}
    else setPanel(target.kind);
  };
  const overlayTitles: Record<GameOverlay, string> = {
    royalProfile: "Perfil do reinado",
    infrastructure: "Infraestrutura",
    military: "Militar",
    government: "Governo",
    council: "Conselho",
    achievements: "Conquistas",
    orders: "Ordens do reino",
    defense: "Defesa do reino",
    influence: "Influência",
    menu: "Seu mundo",
    resources: "Tesouro do reino",
  };
  const overlayArt =
    panels.find((entry) => entry.id === panel)?.image ??
    (
      {
        orders: "/icons/action-upgrade.png",
        defense: "/icons/action-defend.png",
        influence: "/icons/influencia.png",
        menu: "/icons/nav-empire.png",
        resources: "/icons/producao.png",
      } as Record<string, string>
    )[panel ?? ""];
  const showConfirmation = Boolean(
    lastAction &&
    lastAction.requestId !== dismissedAction &&
    !error &&
    !pending &&
    !uncertain,
  );
  const hasFeedback = error || uncertain || showConfirmation;
  const feedback = (
    <>
      {showConfirmation && lastAction && (
        <div
          className={game.confirmation}
          role="status"
          aria-label="Ação confirmada"
        >
          <CozyArt src="/icons/status-success.png" size={32} />
          <span>{commandFeedback(lastAction.action, data)}</span>
          <button
            type="button"
            onClick={() => setDismissedAction(lastAction.requestId)}
            aria-label="Fechar confirmação"
          >
            <X size={17} />
          </button>
        </div>
      )}
      {error && (
        <div className={`${styles.error} ${styles.syncError}`} role="alert">
          <span>{error}</span>
          {!uncertain&&<button type="button" className={styles.syncRetry} onClick={()=>void refresh()} disabled={refreshing||pending}>{refreshing?"Sincronizando…":"Tentar sincronizar"}</button>}
          {!uncertain && (
            <button
              type="button"
              className={styles.iconButton}
              onClick={clearError}
              aria-label="Fechar aviso"
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}
      {uncertain && (
        <div className={styles.notice}>
          <p>Conexão interrompida. Confira se sua ordem chegou ao reino.</p>
          <ActionButton onClick={() => void retryCommand()} disabled={pending}>
            <RefreshCw size={16} />
            Confirmar resultado
          </ActionButton>
        </div>
      )}
    </>
  );

  return (
    <div className={`${styles.root} ${game.root}`}>
      <div className={game.frame}>
        <header className={game.hud}>
          <div className={game.realmBar}>
            <button type="button" className={game.accountPortrait} onClick={()=>setPanel("royalProfile")} aria-label="Perfil do reinado" aria-haspopup="dialog">
              <span className={game.crownSeal}><AccountAppearance compact sovereignId={state.king?.sovereignId} fallback={royalPortrait??"/icons/nav-empire.png"}/></span>
            </button>
            <button type="button" className={game.realmBadge} onClick={()=>setPanel("menu")} aria-label="Menu do reino">
              <span>
                <strong>{world.name}</strong>
                <small>
                  {state.defeat&&state.finalizedAt===null
                    ? `Império derrotado · Dia ${calendar.day} / ${calendar.duration}`
                    : computed.readOnly
                    ? "Temporada encerrada"
                    : computed.started
                      ? `Dia ${calendar.day} / ${calendar.duration} · ${world.mode === "express" ? world.economyVersion===3?"Expresso ×4" : "Expresso" : "Clássico"}`
                      : "Aguardando abertura"}
                </small>
              </span>
            </button>
            <span className={game.hudHelp}>
              {(!panel||panels.some(area=>area.id===panel))&&<CozyScreenHelp key={panel??(screen==="cities"&&cityId?"city":screen)} screen={(panel as CrownPanel|null)??(screen==="cities"&&cityId?"city":screen)} playerId={state.playerId} enabled={Boolean(state.king?.profileId)} inHeader={false}/>}
            </span>
            <button
              type="button"
              className={game.influenceBadge}
              onClick={() => setPanel("influence")}
              aria-label={`Influência: ${number(computed.influence.total)} de 2500`}
            >
              <CozyArt src="/icons/influencia.png" size={26} priority />
              <strong>{number(computed.influence.total)}</strong>
              <span>Influência</span>
            </button>
          </div>
          <button
            type="button"
            className={game.resources}
            onClick={() => openTreasury("materials")}
            aria-label="Tesouro do reino"
          >
            <span>
              <CozySymbol name="gold" size={29}/>
              <span>
                <small>Ouro</small>
                <strong>{number(state.resources.gold)}</strong>
              </span>
            </span>
            <span>
              <CozySymbol name="materials" size={29}/>
              <span>
                <small>Materiais</small>
                <strong>{number(state.resources.materials)}</strong>
              </span>
            </span>
            <span>
              <CozySymbol name="supplies" size={29}/>
              <span>
                <small>Suprimentos</small>
                <strong>{number(state.resources.supplies)}</strong>
              </span>
            </span>
            <span title={`${state.cities.length} cidades`}><CozyArt src="/icons/nav-cities.png" size={24}/><strong>{state.cities.length}</strong></span>
          </button>
        </header>

        <main id="cozy-main" className={game.playfield} hidden={panels.some(area => area.id === panel)}>
          {!panel && hasFeedback && !(screen==="alliance"&&showConfirmation) && (
            <div className={game.feedback}>{feedback}</div>
          )}
          {screen === "crown" && (
            <section className={game.kingdom} aria-label="Seu reino">
              {state.defeat&&<section className={game.defeatSummary} aria-label="Fim do império"><CozyArt src="/icons/action-defend.png" size={50}/><h2>Seu império foi derrotado</h2><p>{state.finalizedAt!==null?'O resultado da temporada está registrado.':'O mundo continua. Seu resultado será fechado no fim da temporada.'}</p><button type="button" className="primary-button" onClick={()=>navigate('reports')}>Ver relatos</button><button type="button" onClick={()=>setPanel('achievements')}>Ver ranking</button><Link href="/lobby">Voltar ao lobby</Link></section>}
              {!state.defeat&&state.capitalSelectionPending&&<button type="button" className="primary-button" onClick={()=>navigate('cities')}>Escolher nova capital</button>}
              {!state.defeat&&<CozyRealmPanorama cities={state.cities} tiles={data.tiles} owner={state.playerId} royal={<CozyRoyalProfile key={`${state.playerId}:${state.king?.generation??0}:${state.king?.alive??false}`} data={data} act={act} locked={pending||Boolean(uncertain)||computed.readOnly} feedback={feedback} />} />}
              {!state.defeat&&<CozyRealmUpdates data={data} now={clock} allianceNotice={allianceNotice} onOrders={()=>setPanel("orders")} onDefense={()=>setPanel("defense")} onReports={()=>navigate("reports")} onCouncil={()=>setPanel("council")} onAlliance={()=>navigate("alliance")} onCity={id=>openCity(id,"decisions")}/>}


              <div className={game.cityDock}>
                {!state.defeat&&<>
                {!computed.started && !computed.readOnly ? (
                  <div className={game.seasonPrompt}>
                    <span>
                      {canStart
                        ? "Seu mundo está pronto."
                        : "Aguardando o criador abrir os portões."}
                    </span>
                    {canStart && (
                      <ActionButton
                        onClick={() => void act({ type: "start_world" })}
                        disabled={pending || Boolean(uncertain)}
                      >
                        <Flag size={17} />
                        Abrir os portões
                      </ActionButton>
                    )}
                  </div>
                ) : (
                  <CozyNextSteps steps={journey} now={clock} onNavigate={followJourney}/>
                )}
                </>}
                <div className={game.seals} aria-label="Comandos da Coroa">
                  {panels.map(({id,title,image})=>{
                    const scoreKey = id === "council" ? "society" : id === "achievements" ? "legacy" : id;
                    const score = computed.influence[scoreKey];
                    return <button type="button" key={id} data-command={id} aria-label={title} aria-haspopup="dialog" onClick={()=>{if(id==="government")setGovernmentTab("heroes");if(id==="achievements")setAchievementEntry(undefined);setPanel(id);}}>
                      <CozyArt src={image} size={36} priority/>
                      <span><strong>{title}</strong><b key={score}>{score}<small>/500</small></b></span>
                      {((id==="infrastructure"&&wonderReady)||(id==="council"&&computed.decree)||(id==="achievements"&&!!computed.sanctuaryThreats?.length))&&<i aria-label="Atenção"/>}
                    </button>;
                  })}
                  <button type="button" className={game.influenceTrack} aria-label={`Detalhes da influência: ${computed.influence.total} de 2500`} onClick={()=>setPanel("influence")}>
                    <span>Influência</span><span className={game.victoryTrack}><progress value={computed.influence.total} max={2500}/><i title="Selo de Vitória · 1.500" aria-label="Meta de vitória: 1500">◆</i></span><strong>{number(computed.influence.total)} / 2.500</strong>
                  </button>
                </div>
              </div>
            </section>
          )}
          {screen === "cities" && (
            <div
              ref={cityView}
              className={`${game.fullPanel} ${game.citySurface} ${styles.gamePanel}`}
              key={cityId || "city-list"}
            >
              {cityId && city && city.id===cityId ? (
                <section aria-label={`Cidade ${city.name}`}>
                  <button
                    type="button"
                    className={game.cityBack}
                    onClick={() => setCityId(null)}
                  >
                    <ArrowLeft size={18} />
                    <span className={game.backCaption}>Voltar</span>
                  </button>
                  <CozyCityInterior
                    key={`${cityId}:${cityVisit}`}
                    {...props}
                    cityId={cityId}
                    initialEntry={cityEntry}
                    feedback={feedback}
                    onGovernment={() => {
                      setGovernmentTab("heroes");
                      setPanel("government");
                    }}
                  />
                </section>
              ) : (
                <CityCollection data={data} now={clock} onCity={openCity} />
              )}
            </div>
          )}
          {screen === "map" && (
            <CozyMap
              key={`${data.world.id}:${data.state.playerId}`}
              {...props}
              feedback={feedback}
              onCity={openCity}
              initialTarget={mapTarget}
            />
          )}
          {(screen === "alliance" || screen === "reports") && (
            <div
              ref={fullView}
              className={`${game.fullPanel} ${game.citySurface} ${styles.gamePanel} ${styles.companion}`}
              key={screen}
            >
              {screen === "alliance" ? (
                <>{showConfirmation&&<div className={game.allianceFeedbackInline}>{feedback}</div>}<CozyAlliance {...props} /></>
              ) : (
                <CozyReports
                  data={data}
                  act={act}
                  busy={pending || Boolean(uncertain)}
                  onFollowUp={(target,report)=>{
                    if(target==='world'){navigate('map');if(report?.battle)setMapTarget({q:report.battle.city.q,r:report.battle.city.r});return;}
                    if(target==='alliance'){navigate('alliance');return;}
                    if(target==='treasury'){openTreasury('materials');return;}
                    if(target==='government'){setGovernmentResearch(undefined);setGovernmentTab('research');}
                    setPanel(target==='cities'?'infrastructure':target);
                  }}
                />
              )}
            </div>
          )}
        </main>

        <nav className={game.navigation} aria-label="Áreas do reino">
          {(
            [
              ["crown", "Coroa", "/icons/nav-empire.png"],
              ["cities", "Cidades", "/icons/nav-cities.png"],
              ["map", "Mundo", "/icons/nav-world.png"],
              ["alliance", "Aliança", "/icons/alliance-crest-v1.png"],
              ["reports", "Relatos", "/icons/nav-intel.png"],
            ] as const
          ).map(([id, label, art]) => (
            <button
              type="button"
              key={id}
              aria-label={label}
              onClick={() => navigate(id)}
              aria-current={screen === id ? "page" : undefined}
            >
              <CozyArt src={art} size={32} priority />
              <span>{label}</span>
              {id === "reports" && computed.unreadReports > 0 && (
                <small>
                  {computed.unreadReports > 9 ? "9+" : computed.unreadReports}
                </small>
              )}
            </button>
          ))}
          <span
            className={game.syncState}
            role="status"
            aria-label={
              pending
                ? "Registrando ordem"
                : refreshing
                  ? "Sincronizando reino"
                  : "Reino sincronizado"
            }
          >
            {(pending || refreshing) && (
              <LoaderCircle size={11} className={styles.spin} />
            )}
          </span>
        </nav>

        {panel && (
          <GameSheet
            key={panel}
            darkSurface={panel==='defense'}
            title={overlayTitles[panel]}
            art={overlayArt}
            sourceData={data}
            score={panel === "council" ? computed.influence.society :
              panel === "achievements" ? computed.influence.legacy :
              panel === "government" || panel === "military" || panel === "infrastructure" ? computed.influence[panel] : undefined}
            citySurface={
              panel === "infrastructure" ||
              panel === "orders" ||
              panel === "influence" ||
              panel === "resources"
            }
            crownTone={
              panels.some((entry) => entry.id === panel)
                ? (panel as CrownPanel)
                : undefined
            }
            onClose={() => setPanel(null)}
          >
            {(error||uncertain||(showConfirmation&&panel!=="resources"&&panel!=="orders"&&panel!=="defense")) && (
              <div className={game.sheetFeedback}>{feedback}</div>
            )}
            {panel === "royalProfile" && (
              <ReignProfile data={data} />
            )}
            {panel === "infrastructure" && (
              <InfrastructureSummary
                data={data}
                now={clock}
                onCity={openCity}
              />
            )}
            {panel === "military" && (
              <CozyMilitary
                {...props}
                onOrders={()=>setPanel('orders')}
                onThreat={()=>setPanel('defense')}
                onResources={()=>openTreasury("materials")}
                onCities={()=>navigate("cities")}
                onAlliance={()=>navigate("alliance")}
                onCity={id => openCity(id,(state.cities.find(city=>city.id===id)?.integrity??100)<100?"decisions":"defense")}
                onResearch={research => {
                  setGovernmentResearch(research);
                  setGovernmentTab("research");
                  setPanel("government");
                }}
              />
            )}
            {panel === "government" && (
              <CozyGovernment {...props} onResources={()=>openTreasury("gold")} initialTab={governmentTab} initialResearch={governmentResearch} onCity={id=>openCity(id,"decisions")} />
            )}
            {panel === "council" && <CozyCouncil {...props} onCity={id=>openCity(id,"decisions")} />}
            {panel === "achievements" && (
              <CozyAchievements
                {...props}
                initialTab={achievementEntry??(state.defeat?'Ranking':'Conquistas')}
                onWonderCity={id=>openCity(id,"decisions")}
                onTower={(q,r)=>{setMapTarget({q,r});setPanel(null);setScreen("map");}}
                onCities={() => navigate("cities")}
                onAlliance={() => navigate("alliance")}
                onQuest={id=>{
                  if(id==="city")navigate("cities");
                  else if(id==="exploration"||id==="expansion")navigate("map");
                  else if(id==="research"){setGovernmentResearch(undefined);setGovernmentTab("research");setPanel("government");}
                  else if(id==="defense")setPanel("military");
                  else if(id==="council")setPanel("council");
                }}
              />
            )}
            {panel === "defense" && (
              <HordeCard {...props} onMilitary={()=>setPanel("military")} onCity={id=>openCity(id,'defense')} onThreatCity={id=>openCity(id,'decisions')} onAlliance={() => navigate("alliance")} />
            )}
            {panel === "orders" && (
              <CozyOrders
                data={data}
                now={clock}
                onOrder={openOrder}
                onCities={() => navigate("cities")}
                onExplore={() => navigate("map")}
                onGovernment={()=>{setGovernmentResearch(undefined);setGovernmentTab("research");setPanel("government");}}
              />
            )}
            {panel === "influence" && (
              <>
                <CozyScreenHelp screen="influence" playerId={state.playerId}/>
                <Heading
                  eyebrow="A força do seu reino"
                  title={`${number(computed.influence.total)} / 2.500`}
                />
                <span className={styles.eyebrow}><Trophy size={16}/> Selo · 1.500</span>
                <div className={game.influenceList}>
                  {Object.entries(influenceNames).map(([id, name]) => (
                    <button type="button" key={id} className={game.influenceArea} aria-label={`Abrir progresso de ${name}`} onClick={()=>setPanel(influenceDestinations[id as keyof typeof influenceNames])}>
                      <div>
                        <span>{name}</span>
                        <strong>
                          {number(
                            computed.influence[
                              id as keyof typeof influenceNames
                            ],
                          )}{" "}
                          / 500
                        </strong>
                      </div>
                      <Progress
                        value={
                          computed.influence[id as keyof typeof influenceNames]
                        }
                        max={500}
                        label={name}
                      />
                      <ArrowRight size={16} aria-hidden="true"/>
                    </button>
                  ))}
                </div>
                <ActionButton onClick={() => setPanel("achievements")}>
                  <Trophy size={16} />
                  Ver conquistas
                </ActionButton>
              </>
            )}
            {panel === "resources" && (
              <CozyTreasury
                initialResource={treasuryResource}
                data={data}
                onResearch={()=>{setGovernmentResearch(undefined);setGovernmentTab("research");setPanel("government");}}
                onRecruit={()=>setPanel("military")}
                onProduction={() => setPanel("infrastructure")}
                onExplore={() => navigate("map")}
                onGovernment={() => {
                  setGovernmentTab("heroes");
                  setPanel("government");
                }}
              />
            )}
            {panel === "menu" && (
              <>
                <Heading eyebrow="KING’S WORLD" title={world.name} />
                <WorldEquipmentSlots value={state.king?.equipment??[]}/>
                <p className={styles.intro}>
                  {world.mode === "express"
                    ? `Expresso · ${computed.realDurationDays} dias reais, ${computed.durationDays} dias de jogo.`
                    : "Clássico · 120 dias de jogo."}
                </p>
                <div className={game.menuActions}>
                  <ActionButton
                    quiet
                    onClick={() => void refresh()}
                    disabled={refreshing || pending}
                  >
                    <RefreshCw size={17} />
                    Sincronizar reino
                  </ActionButton>
                  <Link href="/lobby" className={styles.secondaryButton}>
                    <ArrowLeft size={17} />
                    Voltar aos mundos
                  </Link>
                </div>
                <details><summary>Como jogar</summary>
                <ol className={game.guideList}>
                  <li>
                    <strong>Cuide da sua cidade.</strong> Evolua setores e
                    prepare o exército para as hordas.
                  </li>
                  <li>
                    <strong>Escute o Conselho.</strong> Suas decisões moldam o
                    reino.
                  </li>
                  <li>
                    <strong>Explore o mundo.</strong> Encontre recursos, cidades
                    e aliados.
                  </li>
                  <li>
                    <strong>Construa seu legado.</strong> Some Influência e
                    alcance 1.500 de influência.
                  </li>
                </ol></details>
              </>
            )}
          </GameSheet>
        )}
      </div>
    </div>
  );
}

function ReignProfile({data}: {data: CozyPayload}) {
  const {state}=data;
  const king=state.king;
  const sovereign=COLLECTION_PRODUCTS.find(product=>product.kind==="king"&&product.id===king?.sovereignId);
  const portrait=sovereign?.body??activeRoyalProfile(state)?.image??"/icons/nav-empire.png";

  return (
    <section className={game.reignProfile} aria-label="Seu rei neste mundo">
      <header>
        <img src={portrait} alt="" />
        <div>
          <h3>{king?.nickname??state.playerName}</h3>
          {sovereign&&<p>{sovereign.name}</p>}
          <small>{king?.profileId?`Reinado ${king.generation}`:"Aguardando coroação"}</small>
          {king?.profileId&&!king.alive&&<small>Reinado encerrado</small>}
        </div>
      </header>
      {king?.attributes&&<SovereignStats values={king.attributes} label="Atributos deste reinado" />}
      {king?.profileId&&<WorldEquipmentSlots value={king.equipment??[]} />}
      <Link href="/lobby" className="primary-button"><ArrowLeft size={18}/>Voltar ao lobby</Link>
    </section>
  );
}

function Ranking({ data }: { data: CozyPayload }) {
  const players = [...data.players].sort(
    (a, b) => b.influence - a.influence || a.playerId.localeCompare(b.playerId),
  );
  return (
    <div className={styles.ranking}>
      <Heading
        eyebrow={
          data.computed.readOnly
            ? "Resultado da temporada"
            : "O mundo, até aqui"
        }
        title="Ranking da temporada"
      />
      <div className={styles.rankList}>
        {players.map((player, index) => (
          <div
            key={player.playerId}
            className={
              player.playerId === data.state.playerId ? styles.rankSelf : ""
            }
          >
            <span className={styles.rankNumber}>
              {index === 0 ? (
                <Crown size={18} />
              ) : (
                String(index + 1).padStart(2, "0")
              )}
            </span>
            <div>
              <strong>
                {player.playerName}
                {player.playerId === data.state.playerId && (
                  <small> você</small>
                )}
              </strong>
              <small>
                {player.cities} cidades
                {player.portalCrossedAt ? " · Selo de Vitória" : ""}
              </small>
            </div>
            <span>
              {number(player.influence)}
              <small>Influência</small>
            </span>
          </div>
        ))}
      </div>
      <p className={styles.footnote}>
        Alcançar 1.500 de influência garante o Selo de Vitória. O maior placar ao fim da
        temporada recebe o troféu do primeiro lugar.
      </p>
    </div>
  );
}


export default CozyWorldClient;
