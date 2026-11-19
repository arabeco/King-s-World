"use client";

import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {Check,ChevronDown,Gem} from "lucide-react";
import {ASCENSION_MEDALS,ASCENSION_MEDAL_ART,ASCENSION_MINIMUM,ascensionRewardAmounts,ascensionStanding,type CozyAscensionPreview as Preview} from "@/lib/cozy/ascension-preview";
import {ASCENSION_PROOF_LABELS,ASCENSION_PROOFS,ASCENSION_PROOFS_REQUIRED,RITE,completedAscensionProofs,riteAvailable,riteCouncilCities} from "@/lib/cozy/ascension-rite";
import {EQUIPMENT_RARITY_LABELS} from "@/lib/collection";
import {collectionRequest} from "@/lib/collection-client";
import {CollectionDialog} from "@/components/profile/CollectionDialog";
import CozyArt from "./CozyArt";
import CozyAscensionResult from "./CozyAscensionResult";
import {CrownButton,CrownCost,CrownProgress,crownNumber,crownRemaining,type CrownPanelProps} from "./CozyCrownUI";
import styles from "./cozy-achievements.module.css";

const formatDate = new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium"});
const steps = ["Provas","Recompensas","Confirmar"];
const artwork = {
  expedition:"/icons/action-attack.png",
  provisions:"/icons/producao.png",
  council:"/icons/nav-intel.png",
};

export type RiteRecovery = {
  error:string|null;
  uncertain:boolean;
  busy:boolean;
  retry:()=>Promise<boolean>;
};

function Rewards({preview}: {preview:Preview}) {
  const {medal}=preview.standing;
  const {rewards,sovereign}=preview;
  return <div className={styles.rewardRows}>
    <div className={styles.ascensionRewardRow}><Gem size={26} aria-hidden="true"/><span>
      <strong>+{crownNumber(rewards.creditedGems)} gemas</strong>
      {rewards.conversionGems>0&&<small>{rewards.baseGems} base + {rewards.conversionGems} pela raridade completa</small>}
      {rewards.refundOffset>0&&<small>{rewards.refundOffset} gemas repõem o estorno.</small>}
    </span></div>
    {rewards.equipment ? <div className={styles.ascensionRewardRow}>
      <CozyArt src={rewards.equipment.image??"/icons/influence-legacy.png"} size={46}/>
      <span><strong>{rewards.equipment.name}</strong>
        <small>{EQUIPMENT_RARITY_LABELS[medal.rarity]}{rewards.equipment.effect&&` · ${rewards.equipment.effect}`}</small></span>
    </div> : <small>Coleção {EQUIPMENT_RARITY_LABELS[medal.rarity].toLocaleLowerCase("pt-BR")} completa.</small>}
    <div className={styles.riteAccount}>
      <strong>Perfil do soberano</strong>
      {sovereign&&<span>Nível {sovereign.level} · {crownNumber(sovereign.xp)} XP · {sovereign.availablePoints} {sovereign.availablePoints===1?"ponto livre":"pontos livres"}</span>}
      <small>O XP já está na conta. Aplique os pontos no Perfil para os próximos reinados.</small>
    </div>
  </div>;
}

export default function CozyAscensionPreview({data,act,locked,now,recovery}:CrownPanelProps & {recovery:RiteRecovery}) {
  const {world,state,computed}=data;
  const finished=state.ascension;
  const standing=ascensionStanding(computed.influence.total,state.peakInfluence);
  const proofs=completedAscensionProofs(state);
  const eligible=riteAvailable(state,standing.current);
  const expedition=state.orders.find(order=>order.riteExpedition);
  const [step,setStep]=useState<number|null>(null);
  const [choice,setChoice]=useState<"welcome"|"repair">("welcome");
  const [attempt,reload]=useState(0);
  const [result,setResult]=useState<{key:string;preview:Preview}|{key:string;error:string}>();
  const heading=useRef<HTMLHeadingElement>(null);
  const url=`/api/worlds/${encodeURIComponent(world.id)}/cozy?view=ascension`;
  const quoteKey=[url,state.playerId,state.createdAt,standing.medal.id,state.cities.length,state.quests.length,
    state.progression?.feats.wonders.length??0,proofs.length,attempt].join(":");

  useEffect(()=>{
    if(finished)return;
    const controller=new AbortController();
    void collectionRequest<Preview>(url,{cache:"no-store",signal:controller.signal}).then(
      preview=>{if(!controller.signal.aborted)setResult({key:quoteKey,preview});},
      error=>{if(!controller.signal.aborted)setResult({key:quoteKey,error:error instanceof Error?error.message:"Prévia indisponível."});},
    );
    return ()=>controller.abort();
  },[finished,quoteKey,url]);
  useEffect(()=>{
    if(step!==null&&!finished)heading.current?.focus({preventScroll:true});
  },[step,finished]);

  const loaded=result?.key===quoteKey?result:undefined;
  const preview=loaded&&"preview" in loaded?loaded.preview:undefined;
  const error=loaded&&"error" in loaded?loaded.error:undefined;
  const badge=ASCENSION_MEDALS.find(tier=>tier.id===finished?.medal)??preview?.standing.medal??standing.medal;
  const councilCities=riteCouncilCities(state);
  const busyArmy=state.orders.some(order=>order.kind==="attack");
  const missingMaterials=Math.max(0,Math.ceil(RITE.provisions.materials-state.resources.materials));
  const missingSupplies=Math.max(0,Math.ceil(RITE.provisions.supplies-state.resources.supplies));
  const canPrepare=!missingMaterials&&!missingSupplies;
  const canMeet=state.counselors.every(Boolean)&&councilCities.length>0;
  const canConfirm=eligible&&proofs.length>=ASCENSION_PROOFS_REQUIRED&&!expedition&&preview;

  const medal=<div className={styles.rewardMedal} data-tier={badge.id}>
    <CozyArt src={ASCENSION_MEDAL_ART[badge.id]} size={54}/>
    <div><small>{finished?"Medalha conquistada":standing.peak>=ASCENSION_MINIMUM?"Medalha pelo recorde":"Primeira medalha"}</small><h3>{badge.label}</h3></div>
  </div>;
  const quoteError=error ? <div role="status"><p>{error}</p>
    <CrownButton quiet onClick={()=>reload(value=>value+1)}>Atualizar recompensas</CrownButton>
  </div> : !loaded ? <p role="status">Carregando recompensas…</p> : null;

  return <>
    {finished ? <section className={`${styles.portalBody} ${styles.ascension}`} aria-label="Reinado arquivado">
      {medal}
      <div className={styles.portalScore}><span>Influência final</span><strong>{crownNumber(state.finalScore??0)}</strong></div>
      <CrownButton onClick={()=>setStep(0)}>Ver resultado da Travessia</CrownButton>
      <Link className={styles.riteSecondary} href="/lobby">Voltar aos mundos</Link>
    </section> : <section className={`${styles.portalBody} ${styles.ascension}`} aria-label="Prévia da Ascensão">
      <header className={styles.ascensionHead}><h3>Meta do reinado</h3>
        <span data-ready={standing.missing===0}>{standing.missing?`Faltam ${crownNumber(standing.missing)}`:"Meta alcançada"}</span>
      </header>
      <div className={styles.portalScore}><span>Influência atual</span>
        <strong>{crownNumber(standing.current)}<small> / {crownNumber(ASCENSION_MINIMUM)}</small></strong></div>
      <CrownProgress value={standing.current} max={ASCENSION_MINIMUM} label="Progresso para a Ascensão"/>
      <div className={styles.portalScore}><span>Recorde do reinado</span><strong>{crownNumber(standing.peak)}</strong></div>
      {(eligible||proofs.length>0||expedition)&&<CrownButton onClick={()=>setStep(0)}>Abrir Rito da Travessia <small>{Math.min(2,proofs.length)}/2 provas</small></CrownButton>}
      <ol className={styles.medalLadder} aria-label="Patamares das medalhas">
        {ASCENSION_MEDALS.map(tier=><li key={tier.id} data-tier={tier.id} data-reached={standing.peak>=tier.min}>
          <CozyArt src={ASCENSION_MEDAL_ART[tier.id]} size={22}/><b>{tier.label}</b><span>{crownNumber(tier.min)}</span>
        </li>)}
      </ol>
      <section className={styles.ascensionRewards} aria-label="Prévia das recompensas">{medal}{preview&&<Rewards preview={preview}/>}
        {quoteError}
      </section>
      {preview&&<details className={styles.ascensionArchive}>
        <summary>O que fica no Legado <ChevronDown size={16} aria-hidden="true"/></summary>
        <div><strong>{preview.archive.worldName}</strong><small>{preview.archive.sovereign} · desde {formatDate.format(preview.archive.foundedAt)}</small></div>
        <ul>{preview.archive.cities.map(city=><li key={city.id}><span>{city.name}</span>{city.capital&&<small>Capital</small>}</li>)}</ul>
        <small>{preview.archive.milestones} marcos · {preview.archive.wonders} maravilhas</small>
      </details>}
    </section>}

    {step!==null&&<CollectionDialog title={finished?"Resultado da Travessia":"Rito da Travessia"} busy={recovery.busy} onClose={()=>setStep(null)}>
      {finished ? <CozyAscensionResult progress={preview?.sovereign} result={{
        worldName:world.name,score:state.finalScore??0,peak:standing.peak,medal:finished.medal,
        sovereign:state.king?.nickname??state.playerName,sovereignId:state.king?.sovereignId??null,
        rewards:{...ascensionRewardAmounts(world.mode,finished.equipmentId===null,finished.refundOffset),...finished},
      }}/> :
        <div className={styles.rite}>
          <ol className={styles.riteSteps} aria-label="Etapas do Rito">{steps.map((name,index)=>
            <li key={name} aria-current={index===step?"step":undefined}>{name}</li>)}</ol>
          <h3 ref={heading} tabIndex={-1}>{["Conclua duas provas","O que vai para a conta","Confirmar Ascensão"][step]}</h3>
          {step===0&&<div className={styles.riteProofs}>
            {standing.missing>0&&<small>Faltam {crownNumber(standing.missing)} de Influência para continuar.</small>}
            {ASCENSION_PROOFS.map(proof=>{
              const complete=proofs.includes(proof);
              return <section key={proof} className={styles.riteProof} aria-label={ASCENSION_PROOF_LABELS[proof]}>
                <div className={styles.riteLine}><CozyArt src={artwork[proof]} size={30}/><b>{ASCENSION_PROOF_LABELS[proof]}</b>
                  {complete&&<small><Check size={16} aria-hidden="true"/> Concluída</small>}</div>
                {!complete&&proof==="expedition"&&<><small>Poder {crownNumber(computed.armyPower)} / {crownNumber(RITE.expedition.enemyPower)} · ida e volta em {crownRemaining(now+RITE.expedition.days*computed.dayMs,now)}</small>
                  {expedition?<small role="status">Volta em {crownRemaining(expedition.arrivesAt,now)}</small>:<CrownButton quiet disabled={locked||!eligible||busyArmy||!computed.armyPower||state.resources.supplies<RITE.expedition.supplies}
                    onClick={()=>void act({type:"rite_expedition"})}>Enviar expedição <CrownCost kind="supplies" amount={RITE.expedition.supplies}/></CrownButton>}
                  {!expedition&&busyArmy&&<small>Exército em outra missão.</small>}</>}
                {!complete&&proof==="provisions"&&<><CrownButton quiet disabled={locked||!eligible||!canPrepare}
                  onClick={()=>void act({type:"rite_provisions"})}>Preparar <CrownCost amount={RITE.provisions.materials}/><CrownCost kind="supplies" amount={RITE.provisions.supplies}/></CrownButton>
                  {!canPrepare&&<small>Faltam {[missingMaterials&&`${crownNumber(missingMaterials)} materiais`,missingSupplies&&`${crownNumber(missingSupplies)} suprimentos`].filter(Boolean).join(" e ")}.</small>}
                </>}
                {!complete&&proof==="council"&&<>
                  <small>{canMeet?councilCities.map(city=>city.name).join(", "):`Dois conselheiros e uma cidade com herói e ${RITE.council.minimumTrust}% de confiança.`}</small>
                  {canMeet&&<><div role="group" className={styles.riteNav} aria-label="Decisão da audiência">
                    <CrownButton quiet aria-pressed={choice==="welcome"} onClick={()=>setChoice("welcome")}>+{RITE.council.trustBonus} confiança</CrownButton>
                    <CrownButton quiet aria-pressed={choice==="repair"} onClick={()=>setChoice("repair")}>+{RITE.council.repair} integridade</CrownButton>
                  </div><CrownButton quiet disabled={locked||!eligible} onClick={()=>void act({type:"rite_council",choice})}>Assinar audiência</CrownButton></>}
                </>}
              </section>;
            })}
          </div>}
          {step===1&&<>{medal}{preview&&<Rewards preview={preview}/>} {quoteError}</>}
          {step===2&&<>
            <p className={styles.riteNote}>Ao confirmar, este reinado vai para o Legado, as ordens serão encerradas e a vaga será liberada.</p>
            <div className={styles.riteLine}><CozyArt src={ASCENSION_MEDAL_ART[badge.id]} size={30}/><b>{badge.label}</b>
              {preview&&<span>+{crownNumber(preview.rewards.creditedGems)} gemas{preview.rewards.equipment?` · ${preview.rewards.equipment.name}`:""}</span>}</div>
            {!eligible&&<small>Alcance {crownNumber(ASCENSION_MINIMUM)} de Influência atual.</small>}
            {proofs.length<ASCENSION_PROOFS_REQUIRED&&<small>{proofs.length}/2 provas concluídas.</small>}
            {expedition&&<small>Aguarde o retorno do exército.</small>}
            {quoteError}
          </>}
          {recovery.error&&<p className={styles.riteError} role="alert">{recovery.error}</p>}
          {recovery.uncertain&&<CrownButton quiet disabled={recovery.busy} onClick={()=>void recovery.retry()}>Conferir mesma ação</CrownButton>}
          <footer className={styles.riteNav}>
            <CrownButton quiet disabled={step===0||recovery.busy} onClick={()=>setStep(step-1)}>Anterior</CrownButton>
            {step<2 ? <CrownButton disabled={recovery.busy} onClick={()=>setStep(step+1)}>Próximo</CrownButton> :
              <CrownButton disabled={!canConfirm||locked} onClick={async()=>{
                if(!preview)return;
                const {rewards}=preview;
                if(!await act({type:"ascend",confirmation:{medal:preview.standing.medal.id,equipmentId:rewards.equipment?.id??null,
                  creditedGems:rewards.creditedGems,refundOffset:rewards.refundOffset}}))reload(value=>value+1);
              }}>Ascender e receber</CrownButton>}
          </footer>
        </div>}
    </CollectionDialog>}
  </>;
}
