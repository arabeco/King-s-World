"use client";

import {orderQueued,orderStartsAt,researchQueueQuote} from '@/lib/cozy/order-presentation';
import {TRADE_ROUTE_TRIPS} from '@/lib/cozy/frontier-renewal';
import {realmCareCity} from "@/lib/cozy/council-context";



import CozySymbol from "./CozySymbol";
import CozyScene from "./CozyScene";
import CozyPlans from './CozyPlans';

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Image from "next/image";
import { ArrowRight, BookOpen, Check, Users, X } from "lucide-react";
import type { CozyHeroRole, CozyResearch } from "@/lib/cozy/types";
import { HERO_ROLES, RESEARCHES, getCozyResearchDurationMs } from "@/lib/cozy/catalog";
import {usesMobileReviewRules} from "@/lib/cozy/progression";
import CozyArt from "./CozyArt";
import {heroPortraits} from "./cozy-portraits";
import {
  CrownButton,
  CrownCost,
  CrownPanel,
  CrownProgress,
  crownRemaining,
  type CrownPanelProps,
} from "./CozyCrownUI";
import styles from "./cozy-government.module.css";

const roleEffect: Record<CozyHeroRole, string> = {
  general: "+8% de poder · até 40% no reino",
  engineer: "Obras 25% mais rápidas na cidade",
  administrator: "+15% de produção na cidade",
  explorer: "Viagens 10% mais rápidas · até 40%",
  sage: "Pesquisas 15% mais rápidas · até 60%",
};
const researchArt: Record<CozyResearch, string> = {
  economy: "/icons/building-production.png",
  military: "/icons/influence-military.png",
  exploration: "/icons/action-explore.png",
  fortification: "/icons/building-wall.png",
};

const heroBadge: Record<CozyHeroRole, {icon:string;value:string;label:string}> = {
  general:{icon:researchArt.military,value:"+8%",label:"Poder"},
  engineer:{icon:"/buildings/palacio.png",value:"−25%",label:"Obras"},
  administrator:{icon:researchArt.economy,value:"+15%",label:"Produção"},
  explorer:{icon:researchArt.exploration,value:"−10%",label:"Viagens"},
  sage:{icon:"/icons/building-government.png",value:"−15%",label:"Pesquisa"},
};
const researchBadge: Record<CozyResearch, {perLevel:number;label:string}> = {
  economy:{perLevel:8,label:"Produção"}, military:{perLevel:20,label:"Poder"},
  exploration:{perLevel:-8,label:"Exploração"}, fortification:{perLevel:15,label:"Muralhas"},
};
function GovernmentDetail({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const dialog=ref.current!,trigger=document.activeElement;
    dialog.showModal();
    return ()=>{dialog.close();if(trigger instanceof HTMLElement&&trigger.isConnected)trigger.focus({preventScroll:true});};
  },[]);
  return <dialog ref={ref} className={styles.detailDialog} aria-label={title} onCancel={e=>{e.preventDefault();onClose();}}>
    <header><h2>{title}</h2><button type="button" aria-label="Fechar detalhes do governo" onClick={onClose}><X size={21}/></button></header>
    <div className={styles.detailBody}>{children}</div>
  </dialog>;
}

export default function CozyGovernment({
  data,
  act,
  locked,
  now,
  initialTab = "heroes",
  initialResearch,
  onCity,onResources,
}: CrownPanelProps & { initialTab?: "heroes" | "research"; initialResearch?: CozyResearch; onCity: (id:string)=>void;onResources:()=>void }) {
  const [tab, setTab] = useState<"heroes" | "research">(initialTab);
  const [picker,setPicker]=useState(false);
  const [member,setMember]=useState<string|null>(null);
  const [tradeTrips,setTradeTrips]=useState<(typeof TRADE_ROUTE_TRIPS)[number]>(1);
  const [confirmTradeCancel,setConfirmTradeCancel]=useState<string|null>(null);
  const heroTab = useRef<HTMLButtonElement>(null);
  const researchTab = useRef<HTMLButtonElement>(null);
  const [detail,setDetail]=useState<{kind:"hero";id:CozyHeroRole}|{kind:"research";id:CozyResearch}|null>({kind:"research",id:initialResearch??"economy"});
  useEffect(()=>{if(initialTab==="research"&&initialResearch){setTab("research");setDetail({kind:"research",id:initialResearch});}},[initialTab,initialResearch]);
  function moveTab(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? "heroes"
        : event.key === "End"
          ? "research"
          : tab === "heroes"
            ? "research"
            : "heroes";
    setTab(next);
    (next === "heroes" ? heroTab : researchTab).current?.focus();
  }
  const { state, computed } = data;
  const researchOrders = state.orders.filter(entry => entry.kind === "research");
  const order = researchOrders.find(entry => !orderQueued(entry));
  const queuedResearch = researchOrders.filter(orderQueued).length;
  const canPlanResearch = data.world.mode==="express" || data.world.economyVersion===3;
  const showDirectQueue = data.world.persistent && canPlanResearch;
  const full = state.heroes.length >= 10;
  const heroPoints = usesMobileReviewRules(state) ? 30 : 0;
  const poor = state.resources.gold < computed.heroCost;
  const trade = computed.tradeRoute;
  const tradeOrders = state.orders.filter(order=>order.tradeRoute).sort((a,b)=>a.arrivesAt-b.arrivesAt);
  const nextTrade = tradeOrders[0];
  const queuedTrades = tradeOrders.filter(orderQueued);
  const tradeSpend = (trade?.supplies ?? 0)*tradeTrips;
  const tradeReturns = (trade?.gold ?? 0)*tradeTrips;
  const cancelTrade = queuedTrades[0];
  const researchChoices=[...RESEARCHES].sort((a,b)=>Number(b.id===order?.research)-Number(a.id===order?.research));
  const needsCare=realmCareCity(state);
  const detailHero=detail?.kind==="hero"?HERO_ROLES.find(role=>role.id===detail.id):undefined;
  const detailResearch=detail?.kind==="research"?RESEARCHES.find(research=>research.id===detail.id):undefined;
  return (
    <CrownPanel tone="government">
      {trade && <details className={styles.realmStatus} open={(!full && poor) || tradeOrders.length>0}>
        <summary>Caravana comercial</summary>
        {nextTrade ? <div className={styles.tradePlan}>
          <span><CrownCost kind="gold" amount={tradeOrders.reduce((sum,order)=>sum+(order.cargo?.gold??0),0)}/> a caminho</span>
          <small>{orderQueued(nextTrade) ? `Parte em ${crownRemaining(orderStartsAt(nextTrade),now)}` :
            `Volta em ${crownRemaining(nextTrade.arrivesAt,now)}`}{queuedTrades.length>0 && ` · ${queuedTrades.length} na fila`}</small>
          {cancelTrade && (confirmTradeCancel===cancelTrade.id ? <div className={styles.tradePlan} role="group" aria-label="Cancelar caravanas">
            <small>Retornam {queuedTrades.length*trade.supplies} suprimentos das viagens que ainda não partiram.</small>
            <CrownButton disabled={locked} onClick={async()=>{
              if(await act({type:"cancel_plan",orderId:cancelTrade.id}))setConfirmTradeCancel(null);
            }}>Confirmar cancelamento</CrownButton>
            <CrownButton quiet onClick={()=>setConfirmTradeCancel(null)}>Manter viagens</CrownButton>
          </div> : <CrownButton quiet disabled={locked} onClick={()=>setConfirmTradeCancel(cancelTrade.id)}>Cancelar viagens na fila</CrownButton>)}
        </div> : <div className={styles.tradePlan}>
          <div role="group" aria-label="Quantidade de viagens" className={styles.tradeChoices}>
            {TRADE_ROUTE_TRIPS.map(trips=><button type="button" key={trips} aria-pressed={tradeTrips===trips}
              onClick={()=>setTradeTrips(trips)}>{trips} {trips===1 ? "viagem" : "viagens"}</button>)}
          </div>
          <span><CrownCost kind="supplies" amount={tradeSpend}/> → <CrownCost kind="gold" amount={tradeReturns}/></span>
          <small>{trade.nextAt>now ? `Disponível em ${crownRemaining(trade.nextAt,now)}` :
            `Primeira volta em ${crownRemaining(now+trade.durationMs,now)}${tradeTrips>1 ?
              ` · última em ${crownRemaining(now+trade.durationMs+(tradeTrips-1)*trade.intervalMs,now)}` : ""}`}</small>
          <CrownButton disabled={locked || trade.nextAt>now || state.resources.supplies<tradeSpend}
            onClick={()=>void act({type:"trade_route",trips:tradeTrips})}>{tradeTrips===1 ? "Enviar caravana" : `Reservar ${tradeTrips} viagens`}</CrownButton>
          {state.resources.supplies<tradeSpend&&<small>Faltam {Math.ceil(tradeSpend-state.resources.supplies)} suprimentos.</small>}
        </div>}
      </details>}
      
      <aside className={styles.realmStatus} data-care={!!needsCare || undefined} aria-label="Estado do reino"><CozyArt src={needsCare?"/icons/status-warning.png":"/icons/status-success.png"} size={26}/><div><strong>{Object.values(computed.cityLife).some(c=>c.contentment<35)?"Crise no reino":needsCare?"Cidades precisam de reparos":"Reino estável"}</strong>{needsCare&&<p>{`${Object.values(computed.cityLife).filter(c=>c.contentment<35).length} cidades em crise · ${state.cities.filter(c=>(c.integrity??100)<100).length} com estruturas danificadas.`}</p>}{needsCare&&<button type="button" className={styles.cityLink} onClick={()=>onCity(needsCare.id)}>Cuidar de {needsCare.name}<ArrowRight size={14}/></button>}</div></aside>

      <div className={styles.tabs} role="tablist" aria-label="Governo">
        <button
          ref={heroTab}
          type="button"
          role="tab"
          aria-label="Heróis"
          id="government-heroes-tab"
          aria-controls="government-heroes"
          aria-selected={tab === "heroes"}
          tabIndex={tab === "heroes" ? 0 : -1}
          onKeyDown={moveTab}
          onClick={() => setTab("heroes")}
        >
          <Users size={16} aria-hidden="true" />
          Heróis<span>{state.heroes.length}/10</span>
        </button>
        <button
          ref={researchTab}
          type="button"
          role="tab"
          aria-label="Pesquisas"
          id="government-research-tab"
          aria-controls="government-research"
          aria-selected={tab === "research"}
          tabIndex={tab === "research" ? 0 : -1}
          onKeyDown={moveTab}
          onClick={() => setTab("research")}
        >
          <BookOpen size={16} aria-hidden="true" />
          Pesquisas{order && <i aria-hidden="true" />}
        </button>
      </div>

      {tab === "heroes" ? (
        <div
          role="tabpanel"
          id="government-heroes"
          aria-labelledby="government-heroes-tab"
        >
          <div className={styles.courtBanner}><h2>Sua corte</h2><span>{state.heroes.length}/10 heróis</span></div>
          {!full&&<div className={styles.courtInvite}>
            <button type="button" className={styles.courtSeal} onClick={()=>setPicker(true)} aria-label="Recrutar herói"><Users size={42}/><span>+</span></button>
            <CrownButton onClick={()=>setPicker(true)}><Users size={20}/>Recrutar herói</CrownButton>
          </div>}
          <p className={styles.vacancies}>{10-state.heroes.length} vagas disponíveis</p>
          <section className={styles.courtGrid} aria-label="Dez vagas da corte">
            {Array.from({length:10},(_,i)=>{
              const hero=state.heroes[i];
              return <button type="button" key={i} data-court-slot={i+1} aria-label={hero?`Gerenciar ${hero.name}`:`Escolher herói para vaga ${i+1}`} onClick={()=>hero?setMember(hero.id):setPicker(true)}>
                {hero?<><Image src={heroPortraits[hero.role]} alt="" fill sizes="110px"/><b>{hero.name}</b></>:<span aria-hidden="true">+</span>}
              </button>;
            })}
          </section>
          {member&&<GovernmentDetail title="Herói da corte" onClose={()=>setMember(null)}>
              {state.heroes.filter(hero=>hero.id===member).map((hero) => {
                const role = HERO_ROLES.find(
                  (entry) => entry.id === hero.role,
                )!;
                const busy = state.orders.find(
                  (entry) => entry.heroId === hero.id,
                );
                return (
                  <article className={styles.hero} key={hero.id}>
                    <div className={styles.heroPortrait}>
                      <Image
                        src={heroPortraits[hero.role]}
                        alt=""
                        fill
                        sizes="72px"
                      />
                    </div>
                    <div className={styles.heroInfo}>
                      <h3>{hero.name}</h3>
                      <span>
                        {role.name}
                        {busy
                          ? " · em conquista"
                          : hero.cityId
                            ? " · designado"
                            : " · na reserva"}
                      </span>
                      <button type="button" className={styles.rosterEffect} aria-label={`Detalhes de ${role.name}`} onClick={()=>{setMember(null);setDetail({kind:"hero",id:hero.role});}}><CozyArt src={heroBadge[hero.role].icon} size={24}/><strong>{heroBadge[hero.role].value}</strong>{heroBadge[hero.role].label}<span>ⓘ</span></button>
                      <select
                        aria-label={`Cidade de ${hero.name}`}
                        value={hero.cityId || ""}
                        disabled={locked || Boolean(busy)}
                        aria-describedby={busy?`hero-availability-${hero.id}`:undefined}
                        onChange={async (event) => {
                          if(await act({
                            type: "assign",
                            heroId: hero.id,
                            cityId: event.target.value || null,
                          }))setMember(null);
                        }}
                      >
                        <option value="" disabled={data.world.persistent && Boolean(hero.cityId)}>Na reserva</option>
                        {state.cities.map((city) => (
                          <option
                            value={city.id}
                            key={city.id}
                            disabled={data.world.persistent && hero.cityId
                              ? hero.cityId !== city.id
                              : Boolean(city.heroId && city.heroId !== hero.id)}
                          >
                            {city.name}
                            {city.heroId && city.heroId !== hero.id
                              ? " · ocupada"
                              : ""}
                          </option>
                        ))}
                      </select>
                      {busy?<p id={`hero-availability-${hero.id}`} className={styles.heroEffect}>Disponível após a conquista · {crownRemaining(busy.arrivesAt,now)}.</p>:hero.cityId&&<button type="button" className={styles.cityLink} aria-label={`Ver cidade de ${hero.name}`} onClick={()=>onCity(hero.cityId!)}>Ver cidade <ArrowRight size={14}/></button>}
                    </div>
                  </article>
                );
              })}
            </GovernmentDetail>}
          {picker&&<GovernmentDetail title="Escolher herói" onClose={()=>setPicker(false)}>
            {(full || poor) && (
              <div className={styles.fundingNotice}><p id="hire-blocked" className={styles.notice}>
                {full
                  ? "Sua corte está completa: 10 heróis."
                  : `Faltam ${Math.ceil(computed.heroCost - state.resources.gold).toLocaleString("pt-BR")} de ouro para contratar.`}
              </p>{poor&&!full&&!computed.readOnly&&computed.started&&<button type="button" onClick={onResources}>Ver ouro e onde encontrar<ArrowRight size={15}/></button>}</div>
            )}
            <div className={styles.hireGrid}>
              {HERO_ROLES.map((role) => (
                <article className={styles.specialist} key={role.id}>
                  <button type="button" className={styles.specialistArt} aria-label={`Detalhes de ${role.name}`} onClick={()=>{setPicker(false);setDetail({kind:"hero",id:role.id});}}>
                    <Image
                      src={heroPortraits[role.id]}
                      alt=""
                      fill
                      sizes="(max-width: 520px) 42vw, 220px"
                    />
                    <span className={styles.infoMark} aria-hidden="true">i</span>
                    <strong className={styles.portraitTitle}>{role.name}</strong>
                  </button>
                  <div className={styles.specialistBody}>
                    <div className={styles.boon}><CozyArt src={heroBadge[role.id].icon} size={26}/><strong>{heroBadge[role.id].value}</strong><span>{heroBadge[role.id].label}</span></div>
                    <CrownButton
                      disabled={locked || full || poor}
                      aria-label={`Contratar ${role.name}`}
                      aria-describedby={
                        full || poor ? "hire-blocked" : undefined
                      }
                      onClick={async()=>{if(await act({type:"hire",role:role.id}))setPicker(false);}}
                    >
                      
                      <CrownCost amount={computed.heroCost} kind="gold" />{heroPoints>0&&<small>+{heroPoints} influência</small>}
                    </CrownButton>
                  </div>
                </article>
              ))}
            </div>

          </GovernmentDetail>}
        </div>
      ) : (
        <div
          role="tabpanel"
          id="government-research"
          aria-labelledby="government-research-tab"
        >
          <div className={styles.researchTreasury}>
            <CozyScene src="/images/cenas-cozy/pesquisa.jpg" position="center 46%" />
            <CozyArt src="/icons/building-government.png" size={34}/>
            <strong>Biblioteca</strong>
            <CrownCost amount={Math.floor(state.resources.gold)} kind="gold"/>
          </div>
          {order && (
            <div className={styles.activeResearch} role="status">
              <CozySymbol name="time" size={19}/>
              <div>
                <span>Em pesquisa{queuedResearch>0 && ` · ${queuedResearch} na fila`}</span>
                <strong>
                  {
                    RESEARCHES.find((entry) => entry.id === order.research)
                      ?.name
                  }
                </strong>
                <CrownProgress
                  value={now - orderStartsAt(order)}
                  max={order.arrivesAt - orderStartsAt(order)}
                  label="Andamento da pesquisa"
                />
              </div>
              <b>{crownRemaining(order.arrivesAt, now)}</b>
            </div>
          )}
          <div className={styles.discoveryGrid}>
            {researchChoices.map(research=>{
              const level=state.research[research.id],complete=level>=research.maxLevel,active=order?.research===research.id;
              const duration=getCozyResearchDurationMs(state,research.id,computed.dayMs);
              const reserved=researchOrders.filter(entry=>orderQueued(entry)&&entry.research===research.id).length;
              return <button type="button" className={styles.researchTile} data-active={active||undefined} aria-pressed={detailResearch?.id===research.id} key={research.id} aria-label={`Ver pesquisa ${research.name}`} onClick={()=>setDetail({kind:"research",id:research.id})}>
                <span className={styles.researchTileLevel}><b>{level}</b><small>/{research.maxLevel}</small></span>
                <CozyArt src={researchArt[research.id]} size={64}/>
                <strong className={styles.researchName}>{research.name}</strong>
                <span className={styles.researchBoon}><b>{level===0?"0%":`${researchBadge[research.id].perLevel>0?"+":"−"}${Math.abs(researchBadge[research.id].perLevel)*level}%`}</b> {researchBadge[research.id].label}</span>
                <span className={styles.levelSteps} role="img" aria-label={`Nível ${level} de ${research.maxLevel}`}>{Array.from({length:research.maxLevel},(_,i)=><i key={i} data-filled={i<level||undefined}/>)}</span>
                <span className={styles.tileQuote}>{complete?<><Check size={18}/>Máximo</>:active?<><CozySymbol name="time" size={18}/>{crownRemaining(order!.arrivesAt,now)}</>:reserved?<span><CozySymbol name="time" size={18}/>{reserved} na fila</span>:<><CrownCost amount={computed.researchCosts[research.id]} kind="gold"/><span><CozySymbol name="time" size={18}/>{crownRemaining(now+duration,now)}</span></>}</span>
              </button>;
            })}
          </div>
      {detailResearch&&(()=>{
        const research=detailResearch,level=state.research[research.id];
        const append=showDirectQueue&&researchOrders.length>0;
        const quote=researchQueueQuote(state,research.id,computed.dayMs,now);
        const nextLevel=(append?quote.level:level)+1;
        const cost=append?quote.cost:computed.researchCosts[research.id];
        const duration=append?quote.duration:getCozyResearchDurationMs(state,research.id,computed.dayMs);
        const complete=level>=research.maxLevel,allReserved=nextLevel>research.maxLevel&&!complete;
        const needsGold=state.resources.gold<cost;
        const noTime=computed.endsAt!==null&&(append?quote.arrivesAt:now+duration)>computed.endsAt;
        const reason=allReserved?"Todos os níveis restantes já estão programados.":!append&&order
          ?`Pesquisa em andamento · ${crownRemaining(order.arrivesAt,now)}`
          :append&&quote.full?"Fila de pesquisas cheia.":noTime?"Não termina antes do fim da temporada."
          :needsGold?`Faltam ${Math.ceil(cost-state.resources.gold).toLocaleString("pt-BR")} de ouro.`:null;
        return <section className={styles.researchSelection} aria-label={`Pesquisa selecionada: ${research.name}`}>
          <strong>{complete?"Pesquisa concluída":allReserved?"Níveis programados":`Nível ${nextLevel}`} · {research.name}</strong>
          <details className={styles.researchExplanation}><summary>ⓘ Efeito por nível</summary><p>{research.description}</p></details>
          {!complete&&!allReserved&&<><div className={styles.detailQuote}><CrownCost amount={cost} kind="gold"/><span><CozySymbol name="time" size={24}/><time dateTime={`PT${duration/1000}S`}>{crownRemaining(now+duration,now)}</time></span></div>
          {append&&!reason&&<p className={styles.detailHint}>Conclui em {crownRemaining(quote.arrivesAt,now)}</p>}
          <CrownButton disabled={locked||Boolean(reason)} aria-label={append?`Adicionar ${research.name} à fila`:`Pesquisar ${research.name}`} aria-describedby={reason?"government-research-reason":undefined}
            onClick={async()=>{if(await act({type:append?"plan_research":"research",research:research.id})&&!showDirectQueue)setDetail(null);}}>
            <BookOpen size={20}/>{append?"Adicionar à fila":`Pesquisar nível ${nextLevel}`}
          </CrownButton></>}
          {complete&&<span className={styles.completed}><Check size={20}/>Nível máximo</span>}
          {reason&&!complete&&<p id="government-research-reason" className={styles.detailHint}>{reason}</p>}
          {needsGold&&!complete&&!order&&!noTime&&<button type="button" className={styles.cityLink} onClick={()=>{setDetail(null);onResources();}}>Ver tesouro <ArrowRight size={16}/></button>}
        </section>;
      })()}
          {canPlanResearch&&<details className={styles.queueDrawer}><summary><CozySymbol name="time" size={24}/>Fila de pesquisas <b>{queuedResearch}</b></summary><CozyPlans key={detailResearch?.id??initialResearch??"economy"} data={data} act={act} locked={locked} now={now} initialResearch={detailResearch?.id??initialResearch}/></details>}

        </div>
      )}
      {detailHero&&<GovernmentDetail title={detailHero.name} onClose={()=>setDetail(null)}>
        <div className={styles.heroDetailArt}><Image src={heroPortraits[detailHero.id]} alt="" fill sizes="240px"/></div>
        <div className={styles.detailEffect}><CozyArt src={heroBadge[detailHero.id].icon} size={44}/><p>{roleEffect[detailHero.id]}</p></div>
        <p className={styles.detailHint}>O bônus entra em vigor ao designar o herói para uma cidade.</p>
        <CrownButton disabled={locked||full||poor} aria-label={`Contratar ${detailHero.name}`} onClick={async()=>{if(await act({type:"hire",role:detailHero.id}))setDetail(null);}}>Contratar <CrownCost amount={computed.heroCost} kind="gold"/></CrownButton>
        {(full||poor)&&<p className={styles.detailHint}>{full?"Corte completa · 10/10":`Faltam ${Math.ceil(computed.heroCost-state.resources.gold).toLocaleString("pt-BR")} de ouro.`}</p>}
      </GovernmentDetail>}

    </CrownPanel>
  );
}
