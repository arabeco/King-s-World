"use client";



import { useId, useRef, useState, type KeyboardEvent } from "react";
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Crown,
  Hourglass,
  Sparkles,
} from "lucide-react";
import CozyFirstVisitHelp from "./CozyFirstVisitHelp";
import CozySanctuaryCard from "./CozySanctuaryCard";
import {wonderPlan} from "@/lib/cozy/legacy-objectives";
import { QUESTS } from "@/lib/cozy/catalog";
import type { CozyPayload } from "@/lib/cozy/types";
import {usesMobileReviewRules} from "@/lib/cozy/progression";
import CozyArt from "./CozyArt";
import {
  CrownButton,
  CrownPanel,
  CrownProgress,
  crownNumber,
  crownRemaining,
  type CrownPanelProps,
} from "./CozyCrownUI";
import styles from "./cozy-achievements.module.css";

const TABS = ["Conquistas", "Vitória", "Ranking"] as const;
type LegacyTab = (typeof TABS)[number];
const QUEST_ART: Record<string, string> = {
  city: "/icons/nav-cities.png",
  expansion: "/icons/action-found-city.png",
  exploration: "/icons/action-explore.png",
  research: "/icons/influence-government.png",
  defense: "/icons/action-defend.png",
  council: "/icons/nav-intel.png",
};

export default function CozyAchievements({
  data,
  act,
  locked,
  now,
  onCities,
  onQuest,
  onAlliance,
  onWonderCity,
  onTower,
  initialTab='Conquistas',
}: CrownPanelProps & { onCities: () => void; onQuest: (id:string) => void; onAlliance: () => void; onWonderCity:(id:string)=>void; onTower:(q:number,r:number)=>void;initialTab?:LegacyTab }) {
  const [tab, setTab] = useState<LegacyTab>(initialTab);
  const [towerGuideEnabled,setTowerGuideEnabled]=useState(false);
  const towerDetails=useRef<HTMLDetailsElement>(null);
  const id = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const { state, shared, computed } = data;
  const plan=wonderPlan(state,computed.wonderCost);
  const towers=computed.sanctuaries;
  const visits=towers.filter(t=>t.visitedAt!==null).length;
  const wonders = computed.influenceDetails.conquests.wonders;
  const revised = usesMobileReviewRules(state);
  const wonderPoints = revised ? 100 : 60;
  const cooperation = computed.influenceDetails.conquests.cooperation;
  const zeroModel=computed.influenceDetails.model==='zero-v1';
  const missionPoints=computed.influenceDetails.conquests.missions;
  const missions=[...computed.questProgress].sort((a,b)=>Number(b.complete&&!b.claimed)-Number(a.complete&&!a.claimed)||Number(a.claimed)-Number(b.claimed));
  const claimed = computed.questProgress.filter(
    (quest) => quest.claimed,
  ).length;
  const available = computed.questProgress.filter(
    (quest) => quest.complete && !quest.claimed,
  ).length;

  function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft")
      next = (index + TABS.length - 1) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    else return;
    event.preventDefault();
    setTowerGuideEnabled(false);
    setTab(TABS[next]);
    tabRefs.current[next]?.focus();
  }

  return (
    <CrownPanel tone="achievements">
      
      {available > 0 && !computed.readOnly && (
        <span id={`${id}-rewards`} className={styles.srOnly}>
          {available}{" "}
          {available === 1
            ? "recompensa disponível"
            : "recompensas disponíveis"}
        </span>
      )}
      <div className={styles.tabs} role="tablist" aria-label="Conquistas">
        {TABS.map((entry, index) => (
          <button
            key={entry}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            id={`${id}-tab-${index}`}
            type="button"
            role="tab"
            aria-label={entry}
            aria-describedby={
              entry === "Conquistas" && available > 0 && !computed.readOnly ? `${id}-rewards` : undefined
            }
            aria-selected={tab === entry}
            aria-controls={`${id}-panel-${index}`}
            tabIndex={tab === entry ? 0 : -1}
            onClick={() => {setTowerGuideEnabled(false);setTab(entry);}}
            onKeyDown={(event) => moveTab(event, index)}
          >
            {entry}
            {entry === "Conquistas" && available > 0 && !computed.readOnly && (
              <span className={styles.tabDot} aria-hidden="true" />
            )}
          </button>
        ))}
      </div>

      <div
        className={styles.content}
        id={`${id}-panel-${TABS.indexOf(tab)}`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${TABS.indexOf(tab)}`}
        tabIndex={0}
      >
        {tab === "Conquistas" && (
          <>
            {!!computed.sanctuaryThreats?.length&&<button type="button" className={styles.towerAlert} onClick={()=>{if(towerDetails.current){towerDetails.current.open=true;
              const towerId=shared.sanctuaryPacts?.find(p=>p.id===computed.sanctuaryThreats?.[0]?.pactId)?.sanctuaryId;
              const pact=Array.from(towerDetails.current.querySelectorAll<HTMLDetailsElement>('details[data-tower-pact]')).find(p=>p.dataset.towerPact===towerId);
              if(pact)pact.open=true;
              requestAnimationFrame(()=>(pact?.querySelector('[data-tower-defense]')??towerDetails.current)?.scrollIntoView({block:"start",behavior:"smooth"}));}}}><CozyArt src="/icons/action-defend.png" size={32}/><span><strong>Torres sob ameaça · {computed.sanctuaryThreats.length}</strong><small>Preparar defesa e conferir os apoios</small></span><ArrowRight size={17}/></button>}
            <div className={styles.legacyTotal}>
              <ol className={styles.milestones} aria-label="Marcos de influência">
                {[0,100,250,350,500].map(value => <li key={value} data-reached={computed.influence.legacy >= value}>
                  <span aria-hidden="true">★</span>{value}
                </li>)}
              </ol>
              <details className={styles.breakdown}><summary>Fontes de influência</summary>
              <div className={styles.sources}>
                <span>
                  Marcos <b>{missionPoints}/300</b>
                </span>
                <span>
                  Maravilhas <b>{computed.influenceDetails.conquests.wonderPoints}/{wonderPoints*2}</b>
                </span>
                {!revised&&<span>Cooperação <b>{cooperation}/80</b></span>}
              </div>
              </details>
            </div>

            <div className={styles.sectionTitle}>
              <h3>Missões da temporada</h3>
              <span>{available>0&&!computed.readOnly?`${available} ${available===1?"pronta":"prontas"} · `:""}{claimed}/6 registradas</span>
            </div>
            <div className={styles.quests}>
              {missions.map((progress) => {
                const quest = QUESTS.find((entry) => entry.id === progress.id);
                if (!quest) return null;
                return (
                  <article
                    key={progress.id}
                    aria-label={quest.name}
                    className={`${styles.quest} ${progress.claimed ? styles.claimed : progress.complete ? styles.ready : ""}`}
                  >
                    <span className={styles.questState}>{progress.claimed?"Registrada":progress.complete?computed.readOnly?"Concluída sem resgate":"Pronta para receber":computed.readOnly?"Não concluída":progress.current>0?"Em andamento":"Para começar"}</span>
                    <div className={styles.questTop}>
                      <CozyArt
                        src={
                          QUEST_ART[progress.id] ||
                          "/icons/influence-legacy.png"
                        }
                        size={42}
                      />
                      <h4>{quest.name}</h4>
                      <span className={styles.questReward}>
                        +{quest.points}
                        <small>Conquistas</small>
                      </span>
                    </div>
                    <p>{progress.id==="exploration"?`Explore ${progress.target} hexágonos distintos.`:quest.description}</p>
                    <CrownProgress
                      value={progress.current}
                      max={progress.target}
                      label={quest.name}
                    />
                    <div className={styles.questBottom}>
                      <span>
                        {crownNumber(
                          Math.min(progress.current, progress.target),
                        )}{" "}
                        / {crownNumber(progress.target)}
                      </span>
                      {progress.claimed ? (
                        <span className={styles.recorded}>
                          <Check size={14} /> Conquistado
                        </span>
                      ) : progress.complete&&computed.readOnly?(<span className={styles.recorded}>Não resgatada</span>):progress.complete ? (
                        <CrownButton
                          disabled={locked}
                          aria-label={`Receber ${quest.points} de Conquistas: ${quest.name}`}
                          onClick={() =>
                            void act({ type: "quest", questId: progress.id })
                          }
                        >
                          Receber +{quest.points}
                          <Sparkles size={14} />
                        </CrownButton>
                      ) : (
                        <CrownButton quiet onClick={()=>onQuest(progress.id)} aria-label={`${computed.readOnly?"Ver":"Avançar"} missão: ${quest.name}`}>{({city:"Cuidar das cidades",expansion:"Explorar o mundo",exploration:"Explorar o mundo",research:"Ver pesquisas",defense:"Preparar exército",council:"Ouvir o Conselho"} as Record<string,string>)[progress.id]??"Continuar"}<ArrowRight size={14}/></CrownButton>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
            <div className={styles.sectionTitle}><h3>Feitos e cooperação</h3></div>
            <article className={styles.wonder}>
              <div className={styles.wonderArt}>
                <CozyArt src="/buildings/maravilha.png" size={124} />
              </div>
              <div className={styles.wonderBody}>
                <span className={styles.eyebrow}>Obras eternas</span>
                <h3>Maravilhas {wonders}/2</h3>
                <strong className={styles.reward}>
                  {computed.influenceDetails.conquests.wonderPoints}
                  <small> / {wonderPoints*2} de Conquistas</small>
                </strong>
                <CrownProgress
                  value={wonders}
                  max={2}
                  label="Maravilhas construídas"
                />
                <span>+{wonderPoints} por Maravilha · máximo 2</span>
                {wonders>=2&&<p>Reconhecimento completo. Outras Maravilhas não aumentam esta parcela de influência.</p>}
                {zeroModel&&<details><summary>Reconhecimento permanente</summary><p>O feito de construir fica registrado, mesmo se a cidade for perdida.</p></details>}
                {plan&&wonders<2&&<div className={styles.wonderPlan} aria-label="Próxima Maravilha">
                  <strong>{plan.city.name}</strong>
                  <CrownProgress value={plan.development} max={100} label="Preparação da próxima Maravilha"/>
                  <span>{plan.completedSectors}/5 setores no nível máximo · {plan.development}% de desenvolvimento</span>
                  <span>{plan.missingMaterials?`Faltam ${crownNumber(plan.missingMaterials)} materiais para a obra.`:"Materiais disponíveis para a obra."}</span>
                  <CrownButton quiet onClick={()=>onWonderCity(plan.city.id)}>{plan.development===100?"Ver construção na cidade":"Preparar esta cidade"}<ArrowRight size={14}/></CrownButton>
                </div>}
                <CrownButton quiet onClick={onCities}>
                  Ver cidades <ArrowRight size={14} />
                </CrownButton>
              </div>
            </article>

            <details ref={towerDetails} className={styles.towers} onToggle={event=>setTowerGuideEnabled(event.currentTarget.open)}>
              <summary><CozyArt src="/landmarks/sanctuary-district-v1.png" size={48}/><span><strong>Torres do mundo</strong><small>Reconhecimentos opcionais · sem influência</small></span><b>{visits}/{towers.length}</b></summary>
              <CozyFirstVisitHelp helpId={`torres:${state.playerId}`} enabled={towerGuideEnabled} title="Como funcionam as torres" steps={[
                {art:"/icons/action-explore.png",title:"Explorar",text:"Reconheça a torre com uma expedição de suprimentos."},
                {art:"/icons/producao.png",title:"Reservar",text:"Escolha seu reino ou a aliança e complete os recursos do pacto."},
                {art:"/icons/action-attack.png",title:"Enfrentar",text:"Envie o exército. Pode haver perdas; envio e tropas perdidas não são devolvidos."},
                {art:"/icons/status-success.png",title:"Ativar e proteger",text:"O bônus tem prazo. Se uma horda ameaçar a torre, confirme apoio para protegê-lo. Torres não dão influência."},
              ]}/>
              <div className={styles.towerList}>{towers.map(tower=><CozySanctuaryCard key={tower.id} tower={tower} data={data} act={act} locked={locked} now={now} onLocate={()=>onTower(tower.q,tower.r)}/>)}</div>
            </details>

            {!revised&&<details className={styles.cooperation}>
              <summary>
                <CozyArt src="/icons/influence-society.png" size={40} />
                <span>
                  <strong>Cooperação</strong>
                  <small>Somada automaticamente</small>
                </span>
                <b>
                  {cooperation}
                  <small> / 80</small>
                </b>
              </summary>
              <div className={styles.cooperationDetail}>
                <CrownProgress
                  value={cooperation}
                  max={80}
                  label="Conquistas por cooperação"
                />
                <p>
                  {zeroModel?'Avançar levantamentos vale +4. Cada 500 recursos coletados soma +4, independentemente do número de ordens. Apoio utilizado na batalha e projeto da aba Aliança concluído com sua contribuição valem +12 cada, dentro do teto de cooperação.':'Levantamentos de depósitos e coletas concluídas valem +4. Apoiar um aliado vale +12.'}
                </p>
                {zeroModel&&<dl className={styles.cooperationStats}><div><dt>Etapas de levantamento</dt><dd>{computed.influenceDetails.conquests.surveySteps}</dd></div><div><dt>Recursos recebidos</dt><dd>{crownNumber(computed.influenceDetails.conquests.collectedUnits)}</dd></div><div><dt>Apoios usados</dt><dd>{computed.influenceDetails.conquests.supports}</dd></div><div><dt>Projetos com sua contribuição</dt><dd>{computed.influenceDetails.conquests.projects}</dd></div></dl>}
                <CrownButton quiet onClick={onAlliance}>Ver aliança <ArrowRight size={14}/></CrownButton>
              </div>
            </details>}

          </>
        )}
        {tab === "Vitória" && (
          <Portal data={data} act={act} locked={locked} now={now} />
        )}
        {tab === "Ranking" && <SeasonRanking data={data} />}
      </div>
    </CrownPanel>
  );
}

function Portal({ data }: CrownPanelProps) {
  const { state, computed } = data;
  const won = state.portalCrossedAt !== null;
  const missing = Math.max(0, 1500 - computed.influence.total);
  return (
    <article className={styles.portal}>
      <div className={styles.portalArt}>
        <img src="/images/king-alive.jpg" alt="" width={640} height={400} />
        <span className={styles.portalPhase}>{won ? "Vitória registrada" : "O objetivo do reino"}</span>
        <div><span className={styles.eyebrow}>Selo de Vitória</span><h3>{won ? "Seu reino fez história" : "Alcance 1.500 de influência"}</h3></div>
      </div>
      <div className={styles.portalBody}>
        <div className={styles.portalScore}><span>Influência do reino</span><strong>{crownNumber(computed.influence.total)}<small> / 1.500</small></strong></div>
        <CrownProgress value={computed.influence.total} max={1500} label="Progresso para o Selo de Vitória" />
        {won ? <><div className={styles.victory}><CheckCircle2 size={24} /><strong>O Selo de Vitória é seu.</strong></div><p>Conquistado em {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(state.portalCrossedAt!)}. A conquista permanece mesmo se a influência cair.</p></> : <p>{state.defeat&&state.finalizedAt===null?"Seu império foi derrotado. O mundo continua até o ranking final.":computed.readOnly ? "A temporada terminou. Seu legado e o ranking continuam disponíveis." : `Faltam ${crownNumber(missing)} de influência. O selo é registrado automaticamente ao alcançar a meta.`}</p>}
        {!computed.readOnly && <p>A temporada continua até o ranking final.</p>}
        {state.finalizedAt!==null&&<Link className={styles.seasonPrizes} href={`/inventory?season=${encodeURIComponent(data.world.id)}`}>Ver prêmios da temporada<ArrowRight size={17}/></Link>}
      </div>
    </article>
  );
}

function SeasonRanking({ data }: { data: CozyPayload }) {
  const players = [...data.players].sort(
    (a, b) =>
      b.influence - a.influence ||
      (a.portalCrossedAt ?? Infinity) - (b.portalCrossedAt ?? Infinity) ||
      a.playerId.localeCompare(b.playerId),
  );
  return (
    <div className={styles.ranking}>
      <div className={styles.sectionTitle}>
        <h3>
          {data.computed.readOnly&&!data.state.defeat||data.state.finalizedAt!==null
            ? "Resultado da temporada"
            : "Os reinos deste mundo"}
        </h3>
        <span>{players.length}</span>
      </div>
      <ol className={styles.rankList} aria-label="Ranking da temporada">
        {players.map((player, index) => {
          const self = player.playerId === data.state.playerId;
          return (
            <li key={player.playerId} className={self ? styles.rankSelf : ""}>
              <span
                className={styles.rankNumber}
                aria-label={`${index + 1}º lugar`}
              >
                {index === 0 ? (
                  <Crown size={21} aria-hidden="true" />
                ) : (
                  String(index + 1).padStart(2, "0")
                )}
              </span>
              <div className={styles.player}>
                <strong>
                  {player.playerName}
                  {self && <small>Você</small>}
                </strong>
                <span>
                  {player.cities} {player.cities === 1 ? "cidade" : "cidades"}
                  {player.portalCrossedAt !== null && (
                    <b>
                      <CheckCircle2 size={12} /> Selo de Vitória
                    </b>
                  )}
                </span>
              </div>
              <span className={styles.rankScore}>
                {crownNumber(player.influence)}
                <small>Influência</small>
              </span>
            </li>
          );
        })}
      </ol>
      {players.length === 0 && (
        <p className={styles.rankEmpty}>
          Os reinos aparecerão aqui quando a jornada começar.
        </p>
      )}
    </div>
  );
}
