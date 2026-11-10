"use client";



import {cityDecisionStory} from "@/lib/cozy/decision-presentation";
import {cityTerritoryCells} from "@/lib/cozy/city-territory";
import CozySymbol from "./CozySymbol";
import {cityUpgradePreview} from "@/lib/cozy/upgrade-preview";
import DecisionEffects,{resourceEffects} from "./DecisionEffects";
import CozyPlans from './CozyPlans';

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Pencil,
  Plus,
  Sparkles,
  X,
  ChevronDown,
} from "lucide-react";
import {
  HERO_ROLES,
  SECTORS,
  getCityDevelopment,
  CITY_TYPES, getCityAppearance,
  getCityInfrastructure,
  getCozyUpgradeDurationMs,
} from "@/lib/cozy/catalog";
import type { CozyPayload, CozySector } from "@/lib/cozy/types";
import type { CozyCommand } from "./useCozyWorld";
import CozyArt from "./CozyArt";
import CozyMapArt from "./CozyMapArt";
import styles from "./cozy-interior.module.css";

export type CozyCityEntry = "sectors" | "decisions" | CozySector;
type Props = {
  data: CozyPayload;
  act: (action: CozyCommand) => Promise<boolean>;
  locked: boolean;
  now: number;
  cityId: string;
  initialEntry?: CozyCityEntry;
  feedback?: ReactNode;
  onGovernment: () => void;
};
const art: Record<CozySector, string> = {
  administration: "/buildings/palacio.png",
  economy: "/buildings/fazenda.png",
  society: "/buildings/habitacao.png",
  recruitment: "/buildings/quartel.png",
  defense: "/icons/building-wall.png",
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

function SectorSheet({
  title,
  children,
  onClose,
  tone,
}: {
  tone?: CozySector;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      requestAnimationFrame(() => {
        if (
          trigger instanceof HTMLElement &&
          trigger.isConnected &&
          !document.querySelector("dialog[open]")
        )
          trigger.focus({ preventScroll: true });
      });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={styles.sheet}
      data-sector={tone}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          onClose();
      }}
    >
      <header className={styles.sheetHeader}>
        <span>{title}</span>
        <button
          type="button"
          aria-label="Fechar setor"
          onClick={onClose}
          autoFocus
        >
          <X size={21} />
        </button>
      </header>
      <div className={styles.sheetBody}>{children}</div>
    </dialog>
  );
}

export default function CozyCityInterior({
  data,
  act,
  locked,
  now,
  cityId,
  initialEntry = "sectors",
  feedback,
  onGovernment,
}: Props) {
  const [localPick,setLocalPick]=useState<{decisionId:string;optionId:string}|null>(null);
  const [tab, setTab] = useState<"sectors" | "decisions">(initialEntry === "decisions" ? "decisions" : "sectors");
  const [selected, setSelected] = useState<CozySector | null>(initialEntry === "sectors" || initialEntry === "decisions" ? null : initialEntry);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const [typeOpen,setTypeOpen]=useState(false);
  const [candidate,setCandidate]=useState<keyof typeof CITY_TYPES|null>(null);
  const benefits={neutral:"Sem especialização",metropole:"+5% de materiais nesta cidade",celeiro:"+5% de suprimentos nesta cidade",bastiao:"+5% à força das muralhas desta cidade",posto_avancado:"+10 vagas no exército do reino"};
  const [heroPicker,setHeroPicker]=useState(false);
  const [chosenHero, setChosenHero] = useState("");
  const nameInput = useRef<HTMLInputElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  useEffect(() => {
    if (renaming) nameInput.current?.focus({ preventScroll: true });
  }, [renaming]);
  const { state, computed } = data;
  const city = state.cities.find((entry) => entry.id === cityId);
  if (!city) return <p>Escolha outra cidade do seu reino.</p>;
  const territory=cityTerritoryCells(state,data.shared,city.id);
  const infrastructure=computed.influenceDetails.cities[city.id]??getCityInfrastructure(city);
  const life = computed.cityLife[city.id];
  const hero = state.heroes.find((entry) => entry.id === city.heroId);
  const order = state.orders.find(
    (entry) => entry.kind === "upgrade" && entry.cityId === city.id,
  );
  const development = getCityDevelopment(city);
  const appearance = getCityAppearance(city);
  const freeHeroes = state.heroes.filter(
    (entry) =>
      !entry.cityId && !state.orders.some((item) => item.heroId === entry.id),
  );
  const nextHero =
    freeHeroes.find((entry) => entry.id === chosenHero) || freeHeroes[0];
  const lockReason = computed.readOnly
    ? "A temporada terminou."
    : !computed.started
      ? "As ações ficam disponíveis ao iniciar a temporada."
      : locked
        ? "Aguarde a confirmação da ação."
        : "";
  const sector = SECTORS.find((entry) => entry.id === selected);
  const level = selected ? city.sectors[selected] : 0;
  const preview=selected?cityUpgradePreview(data,cityId,selected):null;
  const cost = selected ? (computed.upgradeCosts[city.id]?.[selected] ?? 0) : 0;
  const duration = selected
    ? getCozyUpgradeDurationMs(state, city, selected, computed.dayMs)
    : 0;
  const noTime = computed.endsAt !== null && now + duration > computed.endsAt;
  const reason =
    lockReason ||
    (level >= 10
      ? "Este setor chegou ao nível máximo."
      : order
        ? order.sector === selected
          ? `Em evolução · ${remaining(order.arrivesAt, now)}`
          : "Conclua a obra atual desta cidade para iniciar outra."
        : noTime
          ? "Não há tempo para concluir antes do fim da temporada."
          : state.resources.materials < cost
            ? `Faltam ${number(Math.ceil(cost - state.resources.materials))} materiais.`
            : "");
  const sectorBenefit = (key: CozySector) => {
    if (!life) return null;
    if (key === 'administration') return <><CozySymbol name="materials" size={21}/><b>+{number(life.administrationMaterials)}</b><span>/dia por nível</span></>;
    if (key === 'economy') return <><CozySymbol name="materials" size={21}/><b>{number(life.production.materials)}</b><CozySymbol name="supplies" size={21}/><b>{number(life.production.supplies)}</b><span>/dia</span></>;
    if (key === 'society') return <><CozyArt src="/icons/influence-society.png" size={21}/><b>{number(life.contentment)}%</b><span>{life.status}</span></>;
    if (key === 'recruitment') return <><CozyArt src="/icons/building-barracks.png" size={21}/><b>+{number(life.recruitmentCapacity)}</b><span>vagas · +30 / nível</span></>;
    return <><CozyArt src="/icons/building-wall.png" size={21}/><b>{number(life.fortification)}</b><span>defesa · {life.integrity}% íntegra</span></>;
  };
  const heroRole = hero
    ? HERO_ROLES.find((entry) => entry.id === hero.role)
    : null;

  return (
    <div className={styles.interior}>
      <header className={styles.cityHeader}>
        <div className={styles.identity}>
          <h2>{city.name}</h2><button type="button" className={styles.editIdentity} aria-label="Editar cidade" onClick={()=>{setName(city.name);setRenaming(true);}}><Pencil size={17}/></button>
          <button type="button" className={styles.typeBadge} disabled={city.capital} onClick={()=>{setCandidate(null);setTypeOpen(true);}}>{city.capital?"Capital ♛":city.cityClass&&city.cityClass!=="neutral"?`${CITY_TYPES[city.cityClass]} · fixo`:"Escolher tipo ▾"}</button>
        </div>
        <div className={styles.infraScore}><small>Infra do reino</small><strong aria-label={`Infraestrutura do reino: ${data.computed.influence.infrastructure} de 500`}>{data.computed.influence.infrastructure}/500</strong><small><span aria-label={`Influência desta cidade: ${infrastructure} pontos`}>{infrastructure} pts</span> · <span aria-label={`Território desta cidade: ${territory.length} hexágonos`}>{territory.length} hex</span></small></div>
        
      </header>
      {data.world.combatMode==='competitive'&&state.capitalSelectionPending&&!state.defeat&&<div className={styles.construction} aria-label="Escolha da nova capital"><strong>{city.capital?'Capital provisória':city.name}</strong><button type="button" className={styles.primary} disabled={Boolean(lockReason)||(city.integrity??100)<=0} onClick={()=>void act({type:'capital_choose',cityId:city.id})}>Confirmar como capital</button></div>}
      {renaming&&<SectorSheet title="Identidade da cidade" onClose={()=>setRenaming(false)}>
        {!city.renamedBy?.includes(state.playerId)?              <form
                className={styles.renameForm}
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (await act({ type: "rename_city", cityId: city.id, name }))
                    setRenaming(false);
                }}
              >
                <label htmlFor={`${id}-name`}>Nome da cidade</label>
                <input
                  ref={nameInput}
                  id={`${id}-name`}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={32}
                  required
                  disabled={locked}
                />
                <div>
                  <button
                    type="button"
                    className={styles.textButton}
                    disabled={locked}
                    onClick={() => setRenaming(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className={styles.primary}
                    disabled={locked || name.trim().length<2 || name.trim()===city.name}
                  >
                    <Check size={15} />
                    Salvar nome
                  </button>
                </div>
              </form>:<p>Nome escolhido · {city.name}</p>}
        <button type="button" className={styles.typeOption} disabled={city.capital} onClick={()=>{setRenaming(false);setCandidate(null);setTypeOpen(true);}}><strong>{city.capital?"Capital":city.cityClass&&city.cityClass!=="neutral"?CITY_TYPES[city.cityClass]:"Escolher tipo"}</strong><small>{city.capital?"Sede do reino":benefits[city.cityClass??"neutral"]}</small></button>
      </SectorSheet>}
      {typeOpen&&<SectorSheet title={candidate?"Confirmar tipo":"Tipo de aldeia"} onClose={()=>setTypeOpen(false)}>
        {city.cityClass&&city.cityClass!=="neutral"?<p>{CITY_TYPES[city.cityClass]} · {benefits[city.cityClass]}</p>:candidate?<><h3>{CITY_TYPES[candidate]}</h3><p>{benefits[candidate]}</p><p>A escolha é permanente, inclusive após uma conquista.</p><button className={styles.primary} disabled={Boolean(lockReason)} onClick={async()=>{if(await act({type:"city_class",cityId:city.id,cityClass:candidate}))setTypeOpen(false);}}>Confirmar {CITY_TYPES[candidate]}</button></>:Object.entries(CITY_TYPES).filter(([k])=>k!=="neutral").map(([k,label])=><button key={k} className={styles.typeOption} onClick={()=>setCandidate(k as keyof typeof CITY_TYPES)}><strong>{label}</strong><small>{benefits[k as keyof typeof CITY_TYPES]}</small></button>)}
      </SectorSheet>}
      <div className={styles.tabs} role="tablist" aria-label="Áreas da cidade">
        {(
          [
            ["sectors", "Setores"],
            ["decisions", "Decisões"],
          ] as const
        ).map(([value, label], index) => (
          <button
            key={value}
            type="button"
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            role="tab"
            id={`${id}-${value}`}
            aria-controls={`${id}-${value}-panel`}
            aria-selected={tab === value}
            tabIndex={tab === value ? 0 : -1}
            onClick={() => setTab(value)}
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const next =
                event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - index;
              setTab(next === 0 ? "sectors" : "decisions");
              tabRefs.current[next]?.focus();
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "sectors" ? (
        <section
          role="tabpanel"
          id={`${id}-sectors-panel`}
          aria-labelledby={`${id}-sectors`}
        >
          {order&&!computed.readOnly&&<aside className={styles.construction} aria-label="Obra em andamento"><CozyMapArt name={appearance.stage===1?"cityConstructionStage1":appearance.stage===2?"cityConstructionStage2":"cityConstructionStage3"} size={78}/><div><small>Obra em andamento</small><strong>{SECTORS.find(s=>s.id===order.sector)?.name??'Melhoria da cidade'}</strong><span><CozySymbol name="time" size={18}/>{remaining(order.arrivesAt,now)}</span></div><button type="button" onClick={()=>order.sector&&setSelected(order.sector)} aria-label="Ver detalhes da obra"><ChevronRight size={19}/></button></aside>}
          <div className={styles.sectors}>
            {SECTORS.map((item) => (
              <button
                type="button"
                key={item.id}
                className={styles.sectorCard}
                data-sector={item.id}
                data-upgrading={order?.sector === item.id || undefined}
                onClick={() => setSelected(item.id)}
                aria-label={`Ver setor ${item.name}`}
                aria-describedby={`${id}-level-${item.id}`}
              >
                <span className={styles.sectorImage}>
                  <CozyArt src={art[item.id]} size={100} />
                </span>
                <span
                  className={styles.level}
                  id={`${id}-level-${item.id}`}
                  role="img"
                  data-sector-level={city.sectors[item.id]}
                  aria-label={`Nível ${city.sectors[item.id]} de 10`}
                >
                  <CozyArt
                    src={`/icons/${String(city.sectors[item.id]).padStart(2, "0")}.png`}
                    size={45}
                  />
                </span>
                <span className={styles.sectorCopy}>
                  <strong>{item.name}</strong>
                  <small className={styles.sectorMetric}>{sectorBenefit(item.id)}</small>
                  <span className={styles.sectorProgress} aria-hidden="true">{Array.from({length:10},(_,i)=><i key={i} data-filled={i<city.sectors[item.id]||undefined}/>)}</span>
                </span>
                {order?.sector === item.id && (
                  <span className={styles.cardFoot}>
                    <>
                      <CozySymbol name="time" size={18}/>
                      {remaining(order.arrivesAt, now)}
                    </>
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section
          role="tabpanel"
          id={`${id}-decisions-panel`}
          aria-labelledby={`${id}-decisions`}
          className={styles.decisions}
        >
          {lockReason && <p className={styles.notice}>{lockReason}</p>}
          {life&&life.contentment<60&&<aside className={styles.crisisNotice} role="status"><strong>{life.status} · satisfação {number(life.contentment)}%</strong><p>{life.daysToRupture!==null?`Recupere a satisfação para pelo menos 35%. Se a crise continuar por mais ${life.daysToRupture} dias de jogo, esta cidade pode se separar.`:"A confiança no governo precisa de atenção. As decisões locais ajudam a recuperar a cidade."}</p></aside>}
          {life&&life.integrity<100&&<aside className={styles.crisisNotice}><strong>Integridade das estruturas: {life.integrity}%</strong><p>Produção e defesa estão reduzidas. {city.capital?"A capital permanece no reino, mesmo após uma derrota.":"Novos ataques podem causar a perda desta colônia."} Os reparos preservam os níveis que você construiu.</p></aside>}

          {(!city.renamedBy?.includes(state.playerId)||(!city.capital&&(!city.cityClass||city.cityClass==="neutral")))&&<div className={styles.firstChoices}>
            {!city.renamedBy?.includes(state.playerId)&&<button type="button" onClick={()=>{setName(city.name);setRenaming(true);}}><Pencil size={20}/><span>Dar um nome à cidade</span><ArrowRight size={17}/></button>}
            {!city.capital&&(!city.cityClass||city.cityClass==="neutral")&&<button type="button" onClick={()=>{setCandidate(null);setTypeOpen(true);}}><Sparkles size={20}/><span>Escolher especialização</span><ArrowRight size={17}/></button>}
          </div>}
          {life&&<article className={styles.decisionCard} aria-label="Decisão local da cidade">
            <div className={styles.localScene} data-sector={life.decision?.sector??'society'}>
              <span className={styles.localDay}>{life.decision?`Dia ${computed.day} · Na cidade`:computed.readOnly?"Memórias da cidade":!computed.started?"Aguardando a abertura":"Por hoje, tudo cuidado"}</span>
              <h3>{life.decision?.title??(computed.readOnly?"Histórico da cidade":!computed.started?"Um novo começo":"Decisão registrada")}</h3>
            </div>
            {life.decision&&<p className={styles.localStory}>{cityDecisionStory(life.decision.id)}</p>}
            {life.decision?.options.map(option=>{const affordable=Object.entries(option.cost).every(([resource,cost])=>state.resources[resource as keyof typeof state.resources]>=cost!);return <div key={option.id} className={styles.localChoiceFrame} data-selected={localPick?.decisionId===life.decision?.id&&localPick.optionId===option.id||undefined}>
            <button className={styles.localChoice} disabled={Boolean(lockReason)||!affordable} onClick={()=>state.progression?.balance?.unifiedRules?setLocalPick({decisionId:life.decision!.id,optionId:option.id}):void act({type:"city_decision",cityId:city.id,decisionId:life.decision!.id,optionId:option.id})} aria-pressed={state.progression?.balance?.unifiedRules?localPick?.decisionId===life.decision?.id&&localPick.optionId===option.id:undefined} aria-label={`${state.progression?.balance?.unifiedRules?'Escolher':'Decidir'}: ${option.label}`}>
              <strong>{option.label}</strong>

              {!affordable&&<small>Recursos insuficientes.</small>}
            </button>
            <DecisionEffects flow label="Efeitos da decisão local" items={[
              ...resourceEffects(option.cost,true),
              ...resourceEffects({...option.rewards,materials:(option.rewards?.materials??0)+(option.materialsReward??0)}),
              ...(option.contentment?[{key:'trust',label:'Satisfação nesta cidade',icon:'/icons/influence-society.png',value:`${option.contentment>0?'+':''}${number(option.contentment>0?Math.min(option.contentment,100-life.contentment):Math.max(option.contentment,-life.contentment))}`,negative:option.contentment<0}]:[]),
              ...(option.integrityRestore?[{key:'repair',label:'Integridade das estruturas',icon:'/icons/building-wall.png',value:`+${number(Math.min(option.integrityRestore,100-life.integrity))}%`}]:[]),
              ...(option.productionBonus?[{key:'production',label:'Eficiência-base por 2 dias de jogo',icon:'/icons/building-production.png',value:`+${option.productionBonus}%`}]:[]),
            ]}/>
            {option.chance&&<div className={styles.localRisk}><details><summary>{option.chance.successPercent}% de sucesso</summary><small>O custo é gasto também se falhar.</small></details><span>Se falhar</span><DecisionEffects label="Se a decisão local falhar" items={[
              ...resourceEffects(option.chance.failure.rewards??{}),
              ...(option.chance.failure.contentment?[{key:'trust',label:'Satisfação nesta cidade',icon:'/icons/influence-society.png',value:String(option.chance.failure.contentment),negative:true}]:[]),
            ]}/></div>}
</div>;})}
            {state.progression?.balance?.unifiedRules&&life.decision&&<button type="button" className={styles.localConfirm} disabled={Boolean(lockReason)||!life.decision.options.some(option=>localPick?.decisionId===life.decision!.id&&localPick.optionId===option.id&&Object.entries(option.cost).every(([key,cost])=>state.resources[key as keyof typeof state.resources]>=cost))} onClick={()=>localPick&&void act({type:'city_decision',cityId:city.id,decisionId:localPick.decisionId,optionId:localPick.optionId})}><Check size={18}/>Confirmar decisão</button>}
            {life.effectEndsAt&&<p className={styles.description}>Produção com {life.efficiency}% de eficiência · {remaining(life.effectEndsAt,now)} restantes.</p>}
          </article>}

          <button type="button" className={styles.heroSlot} onClick={()=>setHeroPicker(true)} aria-label="Gerenciar herói da cidade"><CozyArt src="/icons/influence-government.png" size={42}/><span><strong>{hero?.name??"+"}</strong><small>{heroRole?.name??"Designar herói"}</small></span></button>
          {heroPicker&&          <SectorSheet title="Herói da cidade" onClose={()=>setHeroPicker(false)}> 
            <div className={styles.decisionHeading}>
              <CozyArt src="/icons/influence-government.png" size={42} />
              <div>
                <h3>Herói da cidade</h3>
                <p>
                  {hero
                    ? `${hero.name} · ${heroRole?.name}`
                    : "Escolha um herói para acompanhar a cidade."}
                </p>
              </div>
            </div>
            {heroRole && (
              <p className={styles.description}>{heroRole.description}</p>
            )}
            {nextHero ? (
              <>
                <label className={styles.fieldLabel} htmlFor={`${id}-hero`}>
                  {hero ? "Trocar por" : "Herói disponível"}
                </label>
                <select
                  id={`${id}-hero`}
                  aria-label="Herói da cidade"
                  value={nextHero.id}
                  onChange={(event) => setChosenHero(event.target.value)}
                  disabled={locked}
                >
                  {freeHeroes.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name} ·{" "}
                      {HERO_ROLES.find((role) => role.id === entry.role)?.name}
                    </option>
                  ))}
                </select>
                <p className={styles.description}>
                  {
                    HERO_ROLES.find((entry) => entry.id === nextHero.role)
                      ?.description
                  }
                </p>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={locked}
                  onClick={() =>
                    void act({
                      type: "assign",
                      heroId: nextHero.id,
                      cityId: city.id,
                    })
                  }
                >
                  {hero ? "Trocar herói" : "Designar herói"}
                  <ArrowRight size={15} />
                </button>
              </>
            ) : (
              !hero && (
                <button
                  type="button"
                  className={styles.textButton}
                  onClick={onGovernment}
                >
                  Escolher herói no Governo
                  <ArrowRight size={15} />
                </button>
              )
            )}
            {hero && (
              <button
                type="button"
                className={styles.textButton}
                disabled={locked}
                onClick={() =>
                  void act({ type: "assign", heroId: hero.id, cityId: null })
                }
              >
                Liberar herói
              </button>
            )}
          </SectorSheet>}

          <article className={`${styles.decisionCard} ${styles.wonderCard}`}>
            <div className={styles.decisionHeading}>
              <CozyArt src="/buildings/maravilha.png" size={64} />
              <div>
                <h3>Maravilha</h3>
                <p>
                  {city.wonder
                    ? "Um marco no história da sua cidade."
                    : development < 100
                      ? "Disponível com os cinco setores no nível 10."
                      : "Celebre o auge da sua cidade."}
                </p>
              </div>
            </div>
            {city.wonder ? (
              <span className={styles.complete}>
                <CheckCircle2 size={16} />
                Construída
              </span>
            ) : (
              development >= 100 && (
                <>
                  {computed.influenceDetails.conquests.wonders>=2&&<p className={styles.notice}>A parcela de Conquistas por Maravilhas está completa. Esta obra não acrescenta pontos nessa parcela.</p>}
                  <div className={styles.wonderAction}>
                    <span>{number(computed.wonderCost)} materiais</span>
                    <button
                      type="button"
                      className={styles.primary}
                      disabled={
                        locked ||
                        state.resources.materials < computed.wonderCost
                      }
                      onClick={() =>
                        void act({ type: "wonder", cityId: city.id })
                      }
                    >
                      <Sparkles size={15} />
                      Construir
                    </button>
                  </div>
                  {state.resources.materials < computed.wonderCost && (
                    <p className={styles.notice}>
                      Faltam{" "}
                      {number(
                        Math.ceil(
                          computed.wonderCost - state.resources.materials,
                        ),
                      )}{" "}
                      materiais.
                    </p>
                  )}
                </>
              )
            )}
          </article>
        </section>
      )}
      {sector && selected && (
        <SectorSheet tone={selected} title={sector.name} onClose={() => setSelected(null)}>
          {feedback}
          <div className={styles.upgradeHero} data-sector={selected}>
            <div className={styles.detailArt}>
              <CozyArt src={art[selected]} size={148} />
            </div>
            <div className={styles.upgradeIdentity}>
              <span className={styles.detailCity}>{city.name}</span>
              <h3 className={styles.detailTitle}>{sector.name}</h3>
              <span className={styles.levelJourney} aria-label={`Nível ${level} de 10`}>
                <b>{level}</b>{level<10?<><ArrowRight size={17}/><strong>{level+1}</strong></>:<CheckCircle2 size={22}/>}
              </span>
              <small>{level<10?'Próximo nível':'Desenvolvimento completo'}</small>
            </div>
          </div>
          <details className={styles.detailMore}><summary>Função do setor <ChevronDown size={15}/></summary><p>{sector.description}</p></details>
          {preview&&<section className={styles.upgradePreview} aria-label="Prévia da evolução" title="Estimativa ao concluir, nas condições atuais do reino.">
            <h4 className={styles.previewTitle}>Com a melhoria</h4>
            {preview.metrics.map(metric=><div key={metric.key}>{metric.key==='materials'||metric.key==='supplies'?<CozySymbol name={metric.key} size={26}/>:<CozyArt src={metric.icon} size={26}/>}<span><small>{metric.label}</small><b>{number(metric.before)}{metric.percent?"%":""} <ArrowRight size={14}/> <strong>{number(metric.after)}{metric.percent?"%":""}</strong></b></span></div>)}
            <div><CozyArt src="/icons/influence-infrastructure.png" size={26}/><span><small>Influência total ao concluir</small><b>{number(preview.influenceBefore)} <ArrowRight size={14}/> <strong>{number(preview.influenceAfter)}</strong></b></span><em>+{number(preview.influenceAfter-preview.influenceBefore)}</em></div>
          </section>}

          <div className={styles.upgradeCommit}>
            {level < 10 && <div className={styles.upgradeSummary}>
              <span aria-label={`Custo: ${number(cost)} materiais`}><CozySymbol name="materials" size={25}/><strong>{number(cost)}</strong></span>
              <span aria-label={`Duração: ${remaining(now + duration, now)}`}><CozySymbol name="time" size={22}/><strong>{remaining(now + duration, now)}</strong></span>
            </div>}
            {reason && <p className={styles.notice} role="status">{reason}</p>}
            {level < 10 ? <button type="button" className={`${styles.primary} ${styles.upgradeButton}`}
              aria-label={`Evoluir ${sector.name}`} disabled={!!reason}
              onClick={async()=>{if(await act({type:'upgrade',cityId:city.id,sector:selected}))setSelected(null);}}>
              <Plus size={19}/><span>Evoluir para o nível {level+1}</span>
            </button>:<span className={styles.complete}><CheckCircle2 size={19}/>Nível máximo</span>}
          </div>
          {life&&(selected==="economy"||selected==="society")&&<section className={styles.localIndicators} aria-label={`Indicadores de ${sector.name}`}>
            <div><strong>{selected==="economy"?"Eficiência":"Satisfação local"}</strong><span>{selected==="economy"?life.efficiency:number(life.contentment)}%</span></div>
            <meter min={0} max={selected==="economy"?105:100} value={selected==="economy"?life.efficiency:life.contentment} aria-label={selected==="economy"?"Eficiência de produção":"Satisfação da cidade"}/>
            {selected==="economy"?<div className={styles.productionRates} aria-label="Produção diária da cidade"><span aria-label={`${number(life.production.materials)} materiais por dia`}><CozySymbol name="materials" size={22}/><strong>{number(life.production.materials)}</strong><small>/dia</small></span><span aria-label={`${number(life.production.supplies)} suprimentos por dia`}><CozySymbol name="supplies" size={22}/><strong>{number(life.production.supplies)}</strong><small>/dia</small></span></div>:<p>{life.status}. {city.capital?"A capital permanece no reino. Cuide da confiança e da recuperação da cidade.":"Abaixo de 35%, uma crise persistente pode levar à separação. Decisões locais e escolhas do Conselho afetam a confiança."}</p>}
            <button className={styles.textButton} onClick={()=>{setSelected(null);setTab("decisions");}}>Ver decisões da cidade <ArrowRight size={15}/></button>
          </section>}

          {life&&selected==="defense"&&<section className={styles.localIndicators}><div><strong>Integridade das estruturas</strong><span>{life.integrity}%</span></div><meter min={0} max={100} value={life.integrity} aria-label="Integridade da cidade"/><button className={styles.textButton} onClick={()=>{setSelected(null);setTab("decisions");}}>Ver reparos e decisões <ArrowRight size={15}/></button></section>}
          {(data.world.mode==="express"||data.world.economyVersion===3)&&<details className={styles.optionalPlans}><summary>Fila automática</summary><CozyPlans data={data} act={act} locked={locked} now={now} cityId={city.id} sector={selected}/></details>}
        </SectorSheet>
      )}
    </div>
  );
}
