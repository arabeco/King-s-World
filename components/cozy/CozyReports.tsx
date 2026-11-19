"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCheck, ChevronDown, Search, X } from "lucide-react";
import Image from "next/image";
import type { CozyPayload, CozyReport } from "@/lib/cozy/types";
import type { CozyCommand } from "./useCozyWorld";
import {COUNSELORS} from "@/lib/cozy/catalog";
import {isUnreadReport,reportNotice} from "@/lib/cozy/notices";
import {CozyNovelty,VisibleNotice} from "./CozyNovelty";
import {counselorPortraits,heroPortraits} from "./cozy-portraits";
import CozyArt from "./CozyArt";
import CozyBattleResult from './CozyBattleResult';

import styles from "./cozy-reports.module.css";

type Category = "all" | "discoveries" | "battles" | "kingdom" | "alliance";
export type ReportDestination="world"|"defense"|"council"|"government"|"cities"|"alliance"|"achievements"|"treasury"|"rite";
const followUp=(report:CozyReport):{target:ReportDestination;label:string}|null=>{
 if(["Caminho da Travessia aberto","Guardiões do Rito resistiram","Provisões da Travessia","Conselho reunido para a Travessia","Reinado arquivado"].includes(report.title))
  return {target:"rite",label:"Ver Travessia"};
 switch(report.kind){
 case "combat":if(["Guardiões da torre superados","Guardiões repeliram a expedição","Desafio da torre encerrado","Apoio à torre confirmado","Torre protegida","Sintonia interrompida pela horda","Defesa da torre encerrada"].includes(report.title))return {target:"achievements",label:"Ver desafio da torre"};return {target:"world",label:"Ver o mundo"};
 case "exploration":return {target:"world",label:"Ver o mundo"};
 case "horde":return {target:"defense",label:"Conferir defesa do reino"};
 case "economy":return {target:"treasury",label:"Conferir recursos"};
 case "council":return report.location ? {target:"cities",label:"Ver decisões da cidade"} : {target:"council",label:"Voltar ao Conselho"};
 case "progress":if(report.title==="Sintonia da torre concluída")return {target:"achievements",label:"Ver torres"};if(["Conquista registrada","Uma maravilha para a história"].includes(report.title))return {target:"achievements",label:"Ver conquistas"};return report.title==="Pesquisa concluída"?{target:"government",label:"Ver pesquisas"}:{target:"cities",label:"Ver cidades do reino"};
 case "alliance":return {target:"alliance",label:"Ver aliança"};
 case "portal":case "season":return {target:"achievements",label:"Ver conquistas"};
 default:return null;
 }
};

const reportKinds: Record<CozyReport["kind"], { label: string; art: string }> = {
  welcome: { label: "Seu reino", art: "/icons/nav-empire.png" },
  exploration: { label: "Descoberta", art: "/icons/action-explore.png" },
  combat: { label: "Batalha", art: "/icons/action-attack.png" },
  horde: { label: "Defesa", art: "/icons/action-defend.png" },
  economy: { label: "Recursos", art: "/icons/producao.png" },
  council: { label: "Conselho", art: "/icons/nav-intel.png" },
  progress: { label: "Evolução", art: "/icons/action-upgrade.png" },
  alliance: { label: "Aliança", art: "/icons/alliance-crest-v1.png" },
  portal: { label: "Vitória", art: "/icons/action-enter-world.png" },
  season: { label: "Temporada", art: "/icons/influence-legacy.png" },
};

function reportScene(report: CozyReport) {
  if (report.allianceGift) return "/images/cenas-cozy/alianca.jpg";
  if (report.completedWork || report.title === "Setor concluído") return "/images/cenas-cozy/obra.jpg";
  if (report.title === "Pesquisa concluída") return "/images/cenas-cozy/pesquisa.jpg";
  if (report.title === "Caravana comercial voltou") return "/images/cenas-cozy/caravana.jpg";
  if (report.title === "Expedição retornou" && report.positive) return "/images/cenas-cozy/chegada.jpg";
  if (report.kind === "exploration" && report.positive) return "/images/cenas-cozy/descoberta.jpg";
  if (report.kind === "horde" && report.positive) return "/images/cenas-cozy/defesa.jpg";
  if (report.title === "Capital fundada") return "/images/cenas-cozy/fundacao.jpg";
  return null;
}

function matchesCategory(report: CozyReport, category: Category) {
  if (category === "all") return true;
  if (category === "alliance") return report.kind === "alliance";
  if (category === "discoveries") return report.kind === "exploration";
  const battle = report.kind === "combat" || report.kind === "horde";
  return category === "battles"
    ? battle
    : !battle && report.kind !== "exploration";
}

const calendarDate = (at: number) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(at);

const time = (at: number) =>
  new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(at);

function groupCompletedWorks(entries:CozyReport[]) {
  const rows:CozyReport[][]=[];
  const cities=new Map<string,CozyReport[]>();
  for(const report of entries){
    const cityId=report.completedWork?.cityId;
    const current=cityId ? cities.get(cityId) : undefined;
    if(current){current.push(report);continue;}
    const row=[report];
    rows.push(row);
    if(cityId) cities.set(cityId,row);
  }
  return rows;
}

export default function CozyReports({
  data,
  act,
  busy,
  focusReportId,
  onFollowUp,
}: {
  data: CozyPayload;
  act: (action: CozyCommand) => Promise<boolean>;
  busy: boolean;
  focusReportId?: string;
  onFollowUp:(target:ReportDestination,report?:CozyReport)=>void;
}) {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [category, setCategory] = useState<Category>("all");
  const [search, setSearch] = useState("");
  const [expanded,setExpanded] = useState<string[]>([]);
  const focusReport = useRef<HTMLDetailsElement|null>(null);
  const persistent = data.world.persistent;
  const searchInput = useRef<HTMLInputElement>(null);
  const reading=useRef(false),mounted=useRef(true),retryTimer=useRef<number|null>(null);
  const attempts=useRef({latest:0,count:0});
  const [readRetry,setReadRetry]=useState(0);
  const latest=data.state.reports.reduce((n,r)=>Math.max(n,r.at),0);
  useEffect(()=>{
    mounted.current=true;
    const online=()=>{attempts.current.count=0;if(retryTimer.current!==null){window.clearTimeout(retryTimer.current);retryTimer.current=null;}setReadRetry(n=>n+1);};
    window.addEventListener('online',online);
    return()=>{mounted.current=false;window.removeEventListener('online',online);if(retryTimer.current!==null)window.clearTimeout(retryTimer.current);};
  },[]);
  useEffect(()=>{
    if(persistent||busy||latest<=data.state.readAt||reading.current||retryTimer.current!==null)return;
    if(attempts.current.latest!==latest)attempts.current={latest,count:0};
    if(attempts.current.count>=3)return;
    attempts.current.count++;reading.current=true;
    void act({type:"read_reports"}).then(ok=>{
      reading.current=false;if(!mounted.current)return;
      if(ok){setReadRetry(n=>n+1);return;}
      retryTimer.current=window.setTimeout(()=>{retryTimer.current=null;setReadRetry(n=>n+1);},2000*attempts.current.count);
    });
  },[latest,data.state.readAt,busy,act,readRetry,persistent]);
  useEffect(() => {
    if (!focusReportId || !focusReport.current) return;
    const cityGroup=focusReport.current.closest<HTMLDetailsElement>("details[data-completed-works]");
    if(cityGroup) cityGroup.open=true;
    focusReport.current.open = true;
    focusReport.current.scrollIntoView({block:"start"});
  },[focusReportId]);

  const searchText = search.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const isUnread = (report:CozyReport) => isUnreadReport(data.state,report,persistent);
  const unreadCount = data.state.reports.filter(
    isUnread,
  ).length;
  const reports = data.state.reports
    .filter(
      (report) =>
        (filter === "all" || isUnread(report) || expanded.includes(report.id)) &&
        matchesCategory(report, category) &&
        (!searchText || `${report.title} ${report.body}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").includes(searchText)),
    )
    .sort((a, b) => b.at - a.at);
  const groups = new Map<string, CozyReport[]>();
  for (const report of reports) {
    const day = calendarDate(report.at);
    const group = groups.get(day) || [];
    group.push(report);
    groups.set(day, group);
  }
  const resetFilters = () => {
    setFilter("all");
    setCategory("all");
    setSearch("");
  };

  return (
    <section className={styles.reports} aria-label="Relatos do reino">
      <header className={styles.header}>
        <CozyArt src="/images/cenas-cozy/carta.png" size={52} />
        <div>
          <h2>Relatos do reino</h2>
          <p>
            {unreadCount === 0
              ? "Em dia"
              : `${unreadCount} ${unreadCount === 1 ? "novo" : "novos"}`}
          </p>
        </div>
        

      </header>

      <div className={styles.filters} aria-label="Filtrar relatos">
        <button
          type="button"
          aria-pressed={filter === "all"}
          onClick={() => setFilter("all")}
        >
          Todos <span>{data.state.reports.length}</span>
        </button>
        <button
          type="button"
          aria-pressed={filter === "unread"}
          onClick={() => setFilter("unread")}
        >
          Não lidos <span>{unreadCount}</span>
        </button>
      </div>

      <div className={styles.tools}>
        <div className={styles.search} role="search" aria-label="Buscar nas crônicas">
          <Search size={17} aria-hidden="true" />
          <input ref={searchInput} type="search" aria-label="Buscar relatos" placeholder="Buscar nas crônicas" value={search} maxLength={120} onChange={event=>setSearch(event.target.value)} />
          {search && <button type="button" aria-label="Limpar busca de relatos" onClick={()=>{setSearch("");searchInput.current?.focus();}}><X size={17}/></button>}
        </div>
        <label>
          <span>Assunto</span>
          <select
            aria-label="Assunto dos relatos"
            value={category}
            onChange={(event) => setCategory(event.target.value as Category)}
          >
            <option value="all">Todos os assuntos</option>
            <option value="discoveries">Descobertas</option>
            <option value="battles">Batalhas</option>
            <option value="kingdom">Reino</option>
            <option value="alliance">Aliança</option>
          </select>
        </label>

      </div>

      <p className={styles.resultCount} role="status">
        {reports.length} {reports.length === 1 ? "relato" : "relatos"}
        {filter === "unread"
          ? reports.length === 1
            ? " não lido"
            : " não lidos"
          : ""}
        {category !== "all" ? " neste assunto" : ""}
        {searchText ? " na busca" : ""}
        {reports.length > 0 && <span>Toque para ler</span>}
      </p>

      {Array.from(groups, ([day, entries]) => (
        <section className={styles.dayGroup} key={day} aria-label={day}>
          <h3 className={styles.dayHeading}>{day}</h3>
          <div className={styles.list}>
            {(persistent&&!searchText ? groupCompletedWorks(entries) : entries.map(report=>[report])).map(row=>{
              const rendered=row.map((report) => {
                const unread = isUnread(report);
                const author = report.decisionAuthor;
                const portrait = author?.kind === "hero" ? heroPortraits[author.role] : author ? counselorPortraits[author.id] : undefined;
                const authorName = author?.kind === "hero" ? author.name : author ? COUNSELORS.find(person=>person.id===author.id)?.name : undefined;
                const kind = reportKinds[report.kind];
                const next=followUp(report);
                const scene=reportScene(report);
                return (
                  <details
                    key={report.id}
                    ref={report.id===focusReportId ? focusReport : undefined}
                    onToggle={persistent ? event => {
                      const open=event.currentTarget.open;
                      setExpanded(ids=>open ? ids.includes(report.id) ? ids : [...ids,report.id] : ids.filter(id=>id!==report.id));
                    } : undefined}
                    className={styles.report}
                    data-unread={unread}
                    data-positive={report.positive}
                    data-battle={Boolean(report.battle)||undefined}
                  >
                    <summary aria-label={`Ler relato: ${report.title}`} aria-description={persistent && unread ? "Novidade" : undefined}>
                      <span className={styles.eventArt}>
                        <CozyArt src={kind.art} size={40} />
                      </span>
                      <span className={styles.reportIdentity}>
                        <span className={styles.metadata}>
                          <span>{kind.label}</span>
                          <time dateTime={new Date(report.at).toISOString()}>
                            {calendarDate(report.at)} · {time(report.at)}
                          </time>
                          {unread && (persistent ? <CozyNovelty/> : <span className={styles.unread}>Novo</span>)}
                        </span>
                        <strong>{report.title}</strong>
                      </span>
                      <ChevronDown
                        className={styles.chevron}
                        size={17}
                        aria-hidden="true"
                      />
                    </summary>
                    <div className={styles.body}>
                      {expanded.includes(report.id)&&<VisibleNotice id={unread ? reportNotice(report.id) : undefined} act={act} quiet/>}
                      {scene&&<Image className={styles.reportScene} src={scene} alt="" width={900} height={600} sizes="(max-width: 540px) 90vw, 500px"/>}
                      {portrait&&authorName&&<div className={styles.metadata}><CozyArt src={portrait} size={28}/><strong>{authorName}</strong></div>}
                      {report.battle?<><CozyBattleResult battle={report.battle}/><details className={styles.battleDetails}><summary>Detalhes do combate</summary><p>{report.body}</p></details></>:<p>{report.body}</p>}
                      {next&&<button type="button" className={styles.followUp} onClick={()=>onFollowUp(next.target,report)}>{report.battle?'Ver local da batalha':next.label}<ArrowRight size={16}/></button>}
                    </div>
                  </details>
                );
              });
              if(row.length===1) return rendered[0];
              const first=row[0],unread=row.some(isUnread);
              return <details key={`works:${first.completedWork!.cityId}`} className={styles.report} data-completed-works
                data-unread={unread}>
                <summary>
                  <CozyArt src={reportKinds.progress.art} size={40}/>
                  <span className={styles.reportIdentity}>
                    <strong>{row.length} obras · {first.completedWork!.cityName}</strong>
                    <span className={styles.metadata}>Concluídas{unread&&<CozyNovelty/>}</span>
                  </span>
                  <ChevronDown className={styles.chevron} size={17} aria-hidden="true"/>
                </summary>
                <div className={`${styles.body} ${styles.list}`}>{rendered}</div>
              </details>;
            })}
          </div>
        </section>
      ))}

      {reports.length === 0 && (
        <div className={styles.empty}>
          <CozyArt
            src={
              filter === "unread" && unreadCount === 0
                ? "/icons/status-success.png"
                : "/icons/nav-intel.png"
            }
            size={60}
          />
          <h3>
            {searchText ? "Nenhum relato encontrado" : filter === "unread" && unreadCount === 0
              ? "Tudo em dia"
              : "Nenhum relato por aqui"}
          </h3>
          <p>
            {searchText ? "Tente outro nome, lugar ou palavra do relato." : filter === "unread" && unreadCount === 0
              ? "Nenhum relato novo para ler por enquanto."
              : category !== "all"
                ? "Ainda não há relatos que combinem com estes filtros."
                : "Suas descobertas e conquistas ficarão guardadas aqui."}
          </p>
          {(filter !== "all" || category !== "all" || searchText) && (
            <button type="button" onClick={resetFilters}>
              Ver todos os relatos
            </button>
          )}
        </div>
      )}
    </section>
  );
}
