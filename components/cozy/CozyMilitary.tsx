"use client";




import CozyBonus from "./CozyBonus";
import CozySymbol from "./CozySymbol";

import Image from "next/image";
import {useRef, useState, type KeyboardEvent} from "react";
import { ArrowRight, LockKeyhole, Shield, Swords } from "lucide-react";
import { TROOPS, canRecruitTroop } from "@/lib/cozy/catalog";
import type {CozyResearch} from "@/lib/cozy/types";
import {usesMobileReviewRules} from "@/lib/cozy/progression";
import CozyArt from "./CozyArt";
import {
  CrownCost,
  CrownPanel,
  CrownProgress,
  crownNumber as number,
  crownRemaining,
  type CrownPanelProps,
} from "./CozyCrownUI";
import styles from "./cozy-military.module.css";

export default function CozyMilitary({
  data,
  act,
  locked,
  onResearch,
  onCity,
  now,onResources,onCities,onAlliance,onOrders,
}: CrownPanelProps & { onResearch: (research: CozyResearch) => void; onCity: (id:string)=>void;onResources:()=>void;onCities:()=>void;onAlliance:()=>void;onOrders:()=>void }) {
  const { state, computed } = data;
  const [tab,setTab]=useState<"recruit"|"defense">("recruit");
  const [lots, setLots] = useState<Record<string, number | "max">>({});
  const recruitTab = useRef<HTMLButtonElement>(null);
  const defenseTab = useRef<HTMLButtonElement>(null);
  function moveTab(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? "recruit" : event.key === "End" ? "defense" : tab === "recruit" ? "defense" : "recruit";
    setTab(next);
    (next === "recruit" ? recruitTab : defenseTab).current?.focus();
  }
  const horde=computed.nextHorde;
  const totalDefense=computed.defensePower+(horde?.supportPower??0);
  const campaign=state.orders.find(o=>o.kind==='attack');
  const total = Object.values(state.army).reduce(
    (sum, value) => sum + value,
    0,
  );
  const freeSlots = Math.max(0, computed.armyCapacity - total);
  return (
    <CrownPanel tone="military">
      
      <header className={styles.command} data-mode={tab}>
        <div className={styles.commandTitle}>
          <CozyArt src="/icons/exercito.png" size={54} />
          <div>

            <h2>{tab==="recruit"?"Recrutar tropas":"Defender o reino"}</h2>
          </div>
        </div>
        <div className={styles.strength}>
          <div>
            <Swords size={16} aria-hidden="true" />
            <span>
              Poder<strong>{number(computed.armyPower)}</strong>
            </span>
          </div>
          <div>
            <Shield size={16} aria-hidden="true" />
            <span>
              Defesa<strong>{number(computed.defensePower)}</strong>
            </span>
          </div>
        </div>
        <div className={styles.capacity}>
          <span>
            Tropas{" "}
            <strong>
              {number(total)} / {number(computed.armyCapacity)}
            </strong>
          </span>
          <span>{number(freeSlots)} vagas</span>
        </div>
        <CrownProgress
          value={total}
          max={computed.armyCapacity}
          label="Capacidade do exército"
        />
      </header>
      {campaign&&<button type="button" className={styles.marchStatus} onClick={onOrders} aria-label="Acompanhar investida"><CozySymbol name="time" size={21}/><span><strong>{campaign.returning?'Investida retornando':'Investida em andamento'}</strong><small>{crownRemaining(campaign.arrivesAt,now)} · {campaign.returning?'até liberar novo ataque':'até a chegada'}</small></span><ArrowRight size={17}/></button>}
      <div className={styles.tabs} role="tablist" aria-label="Comando militar">
        <button ref={recruitTab} type="button" id="military-recruit-tab" role="tab" aria-controls="military-recruit" tabIndex={tab==="recruit"?0:-1} aria-selected={tab==="recruit"} onKeyDown={moveTab} onClick={()=>setTab("recruit")}>Recrutamento</button>
        <button ref={defenseTab} type="button" id="military-defense-tab" role="tab" aria-controls="military-defense" tabIndex={tab==="defense"?0:-1} aria-selected={tab==="defense"} onKeyDown={moveTab} onClick={()=>setTab("defense")}>Defesa</button>
      </div>
      {tab==="defense"?<section className={styles.defense} role="tabpanel" id="military-defense" aria-labelledby="military-defense-tab">
        {(computed.playerThreats??[]).map(threat=><button key={threat.orderId} type="button" className={styles.cityDefense} onClick={()=>onCity(threat.cityId)} aria-label={`Preparar ${threat.cityName} contra ${threat.attackerName}`}><CozyArt src="/icons/action-attack.png" size={36}/><span><strong>{threat.cityName} sob ameaça</strong><small>{threat.attackerName} · {crownRemaining(threat.arrivesAt,now)}</small><small>{threat.conquest?'Tentativa de ocupação':'Ataque às estruturas'}</small></span><ArrowRight size={17}/></button>)}

        {computed.sanctuaryBonuses.defense>0&&<div className={styles.availableNow}><CozyBonus kind="defense" value={computed.sanctuaryBonuses.defense}/></div>}
        {horde?<article className={`${styles.defenseCard} ${styles.threat}`} aria-label="Preparação para a próxima horda"><div>
          <div className={styles.threatHeading}><CozyArt src="/icons/action-defend.png" size={35}/><div><small>Próxima ameaça</small><h3>Horda do dia {horde.day}</h3></div><span><CozySymbol name="time" size={18}/>{crownRemaining(horde.arrivesAt,now)}</span></div>
          <div className={styles.defenseTotals}><span>Sua defesa<strong>{number(computed.defensePower)}</strong></span><span>Apoio aliado<strong>+{number(horde.supportPower)}</strong></span><span>Força da horda<strong>{number(horde.power)}</strong></span></div>
          <p className={styles.readiness} data-ready={totalDefense>=horde.power}>{totalDefense>=horde.power?'Sua defesa atual cobre a força estimada.':`Faltam ${number(horde.power-totalDefense)} de defesa na força atual.`}</p>
          <div className={styles.defenseActions}><button type="button" onClick={()=>{setTab('recruit');recruitTab.current?.focus();}}>Preparar tropas<ArrowRight size={15}/></button><button type="button" onClick={onAlliance}><CozySymbol name="alliance" size={18}/>{state.allianceId?'Ver apoio da aliança':'Encontrar aliados'}</button></div>
          {(computed.royalDefenseBonus>0||computed.allianceDefenseBonus>0||(computed.towerDefenseBonus??0)>0||(computed.equipmentDefenseBonus??0)>0)&&<details className={styles.bonusDetails}><summary>Bônus já incluídos na sua defesa</summary>{computed.royalDefenseBonus>0&&<p>Comando do rei: +{number(computed.royalDefenseBonus)} de defesa.</p>}{computed.allianceDefenseBonus>0&&<p>Projeto da aliança: +{number(computed.allianceDefenseBonus)} de defesa.</p>}{(computed.towerDefenseBonus??0)>0&&<p>Torre: +{number(computed.towerDefenseBonus??0)} de defesa.</p>}{(computed.equipmentDefenseBonus??0)>0&&<p>Equipamentos: +{number(computed.equipmentDefenseBonus??0)} de defesa.</p>}</details>}
        </div></article>:<p>Nenhuma horda pendente nesta temporada.</p>}
        <article className={styles.defenseCard}><CozyArt src="/icons/building-wall.png" size={42}/><div><h3>Fortificações</h3><strong>+{number(computed.fortificationPower)} de defesa</strong></div></article>
        <h3 className={styles.defenseSection}>Defesa das cidades <small>{state.cities.length}</small></h3>
        {state.cities.map(city=><button key={city.id} type="button" className={styles.cityDefense} onClick={()=>onCity(city.id)} aria-label={`Cuidar da defesa de ${city.name}`}><CozyArt src={`/icons/${String(city.sectors.defense).padStart(2,"0")}.png`} size={42}/><span><strong>{city.name}</strong><small>Defesa · nível {city.sectors.defense}/10</small><small data-damaged={(city.integrity??100)<100||undefined}>Integridade · {number(city.integrity??100)}%{(city.integrity??100)<100?" · precisa de reparos":""}</small><progress aria-label={`Integridade de ${city.name}`} value={city.integrity??100} max={100}/></span><ArrowRight size={17}/></button>)}
      </section>:<div className={styles.troops} role="tabpanel" id="military-recruit" aria-labelledby="military-recruit-tab">
        {TROOPS.map((troop) => {
          const available = canRecruitTroop(state, troop.id);
          const cost = computed.troopCosts[troop.id];
          const maxUnits = Math.max(
            0,
            Math.min(freeSlots, Math.floor(state.resources.materials / cost)),
          );
          const amount = lots[troop.id] ?? 1;
          const quantity = amount === "max" ? maxUnits : Math.min(amount,Math.max(1,maxUnits));
          return (
            <article
              key={troop.id}
              className={styles.troop}
              data-locked={!available || undefined}
              aria-label={troop.name}
            >
              <div className={styles.troopTop}>
                <div className={styles.portrait}>
                  <Image
                    src={`/images/troop-${troop.id}.jpg`}
                    alt=""
                    fill
                    sizes="100px"
                  />
                  {!available && (
                    <span>
                      <LockKeyhole size={19} aria-hidden="true" />
                    </span>
                  )}
                </div>
                <div className={styles.troopInfo}>
                  <div className={styles.troopTitle}>
                    <h3>{troop.name}</h3>
                    <strong
                      aria-label={`${number(state.army[troop.id])} no exército`}
                    >
                      {number(state.army[troop.id])}
                      <small>no exército</small>
                    </strong>
                  </div>
                  <span className={styles.power}>
                    <Swords size={13} aria-hidden="true" />
                    {troop.power} poder base
                  </span>
                  <div className={styles.unitCost}>
                    <span>Por unidade</span>
                    <CrownCost amount={cost} />
                  </div>
                </div>
              </div>

              {available ? (
                <div className={styles.recruit}>
                  <div className={styles.lots} aria-label={`Quantidade de ${troop.name}`}>
                    <button type="button" aria-label={`Diminuir quantidade de ${troop.name}`} disabled={locked||quantity<=1} onClick={()=>setLots(previous=>({...previous,[troop.id]:Math.max(1,quantity-1)}))}>−</button>
                    <output aria-label={`Quantidade selecionada: ${quantity}`}>{number(quantity)}</output>
                    <button type="button" aria-label={`Aumentar quantidade de ${troop.name}`} disabled={locked||maxUnits<=quantity} onClick={()=>setLots(previous=>({...previous,[troop.id]:Math.min(maxUnits,quantity+1)}))}>+</button>
                    <button type="button" aria-label={`Selecionar máximo de ${troop.name}`} disabled={locked||maxUnits===0} aria-pressed={amount==="max"} onClick={()=>setLots(previous=>({...previous,[troop.id]:"max"}))}>Máx.</button>
                  </div>
                  <button className={styles.recruitAction} type="button"
                    disabled={locked || quantity <= 0 || quantity > maxUnits}
                    aria-label={`Recrutar ${amount === "max" ? "máximo de" : quantity} ${troop.name}`}
                    onClick={() => void act({type:"recruit", troop:troop.id, amount:amount==='max'?'max':quantity})}>
                    Recrutar <CrownCost amount={cost * quantity}/>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.unlock}
                  onClick={()=>onResearch("military")}
                  aria-label="Ver pesquisa militar"
                >
                  <span>Pesquisa militar · nível {troop.unlockResearch}</span>
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
              )}
              {available && maxUnits === 0 && (
                <p id={`recruit-help-${troop.id}`} className={styles.blocked}>
                  {state.defeat?"Império derrotado · recrutamento encerrado.":computed.readOnly?"Esta temporada está encerrada.":!computed.started?"O recrutamento abre quando a temporada começar.":freeSlots === 0
                    ? "Sem vagas. Evolua Recrutamento nas cidades."
                    : `Faltam ${number(Math.ceil(cost - state.resources.materials))} materiais para uma unidade.`}
                </p>
              )}
              {available&&maxUnits===0&&!computed.readOnly&&computed.started&&<button type="button" className={styles.recoveryLink} onClick={freeSlots===0?onCities:onResources}>{freeSlots===0?"Ver Recrutamento nas cidades":"Ver materiais e produção"}<ArrowRight size={15}/></button>}
            </article>
          );
        })}
      </div>}
      <details className={styles.details}>
        <summary>Preparo e defesa</summary>
        {computed.influenceDetails.model==='zero-v1'&&<p>A força inicial já protege o reino. O preparo desenvolvido além dessa base pode perder influência com baixas ou dano.{state.progression?.balance?.militaryVictoryMax?' As vitórias contra hordas completam o reconhecimento e permanecem registradas.':''}</p>}
        {state.progression?.balance&&<p>{usesMobileReviewRules(state)?"Nos primeiros 50 de força extra, cada 5 valem 1 ponto de preparo. ":""}Depois, cada {state.progression.balance.militaryDivisor} de força extra vale 1 ponto. Tropas e fortificações contam nessa força.</p>}
        <p>
          A defesa contra hordas é automática. Tropas não consomem suprimentos por
          dia.
        </p>
        <p>
          Recrutamento nas cidades amplia as vagas e já reduz seus custos em{" "}
          {Math.round(computed.recruitmentDiscount * 100)}%. Os valores acima
          incluem o desconto.
        </p>
      </details>
    </CrownPanel>
  );
}
