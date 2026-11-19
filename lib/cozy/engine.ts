import {decisionReceipt} from './decision-receipt';
import {modernCouncilDecision} from './council-decisions';
import {CITY_FOUNDATION_COST,CITY_FOUNDATION_DAYS,foundationSite} from './city-foundation';
import {npcOccupation} from './npc-occupation';
import {armyPower,cityWallLevels,wallPower,defensePower} from './military-power';
import {expeditionCost,expeditionTravelMs,explorationPath,explorationCorridor,explorationQueue,EXPLORATION_QUEUE_LIMIT} from './exploration-route';
import {cityWorkQuote,cityWorksLane} from './city-works';
import {ASCENSION_MINIMUM,ascensionRewardAmounts,ascensionStanding,type CozyAscensionConfirmation} from './ascension-preview';
import {ASCENSION_PROOFS_REQUIRED,RITE,completedAscensionProofs,riteAvailable,riteCouncilCities} from './ascension-rite';
import {empireArmy,committedTroops,retargetArmyReturns,restoreAbstractArmy} from './expedition-army';
import {playerCampaign} from './player-campaign';
import {damageCityBuildings} from './city-damage';
import {bindCityTerritories,nearestTerritoryCity,restoreCityTerritory} from './city-territory';
import {economicExpress,seasonDays,waveDays,clockSpeed} from './rhythm';
import { FRONTIER_RENEWAL_DAYS, renewFrontier, TRADE_ROUTE, TRADE_ROUTE_TRIPS } from "./frontier-renewal";
import {WAVE_POWER} from "./hordes";
import {miniMissionOffer} from './mini-missions';
import {resolveSanctuaryRaids,sanctuaryThreats,syncSanctuaryRaidReports} from "./sanctuary-raids";
import {councilTopic} from "./council-context";
import {applySanctuaryPactAction,pactFunded,canUsePact,activateSanctuaryPact,SanctuaryPactError,syncSanctuaryPacts,sanctuaryBonus,realmSupportBonus,cancelOrphanedPacts,cancelUnfinishedPacts} from "./sanctuary-pacts";
import {applyAllianceAction,AllianceRuleError,allianceBonus,syncAllianceProjects} from './alliances';
import {equipmentBonus} from "./equipment";
import {ROYAL_PROFILES,royalBonus} from "./royal-profiles";
import {createProgression,hasZeroProgression,zeroInfluence,progressionBreakdown,localTrustDelta,decreeCareRecognized,councilCredit,recordCityCare,recordStableAdministration,recognizeSupport,usesMobileReviewRules,PROGRESSION} from './progression';
import {citySocialStatus,SOCIAL_RUPTURE_DAYS,releaseCity} from "./city-crisis";
import {cityEfficiency,cityDecision,type CityOutcome} from "./city-life";
import {prepareFrontierProgress,recordFrontierVictory} from "./frontier-progress";
import {ALLIANCE_GIFT_PACKS,ALLIANCE_GIFT_RECEIVE_LIMIT,ALLIANCE_GIFT_RESOURCES,allianceGiftUsage,canReceiveAllianceGift} from "./alliance-gifts";
import {activeNoticeIds,isUnreadReport} from "./notices";
import {combatAssessment} from "./combat";
import {knownMapCells, visibleTerrainCells} from "./map-visibility";
import {sanctuaryAt, ALL_SANCTUARIES} from "./landmarks";
import {migrateResourceAreas, resourceArea, resourceAreaId, areaCells, discoverResourceArea, areaAllied, canUseArea, syncAreaDeposits} from "./areas";
import {
  CITY_TYPES,COZY_LIMITS,researchCost,upgradeCost,planningCapacity,
  COUNSELORS,
  HERO_ROLES,
  QUESTS,
  questsForRealm,
  RESEARCHES,
  SECTORS,
  TROOPS,
  canRecruitTroop,
  getCityDevelopment,
  getCityInfrastructure,
  getCozyUpgradeDurationMs,
  getCozyResearchDurationMs,
} from "./catalog";
import type {
  CozyAction,
  CozyBuildingDamage,
  CozyCity,
  CozyComputed,
  CozyCoord,
  CozyDecree,
  CozyDecreeEffects,
  CozyHeroRole,
  CozyInfluence,
  CozyOrder,
  CozyReport,
  CozyResources,
  CozySector,
  CozyShared,
  CozyState,
  CozyTile,
  CozyTileKind,
  CozyWorld,
} from "./types";
export * from "./catalog";

const DAY = 86_400_000;
const EPSILON = 0.000001;
export class CozyRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CozyRuleError";
  }
}
function rule(condition: unknown, message: string): asserts condition {
  if (!condition) throw new CozyRuleError(message);
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function hash(seed: string) {
  let n = 2166136261;
  for (let i = 0; i < seed.length; i++)
    n = Math.imul(n ^ seed.charCodeAt(i), 16777619);
  return n >>> 0;
}
function key(coord: CozyCoord) {
  return `${coord.q},${coord.r}`;
}
function fromKey(id: string): CozyCoord {
  const [q, r] = id.split(",").map(Number);
  return { q, r };
}
function distance(a: CozyCoord, b: CozyCoord) {
  return Math.max(
    Math.abs(a.q - b.q),
    Math.abs(a.r - b.r),
    Math.abs(a.q + a.r - b.q - b.r),
  );
}
function dayMs(world: CozyWorld) {
  return DAY/clockSpeed(world);
}
function endAt(world: CozyWorld) {
  return world.persistent || world.startsAt === null ? null : world.startsAt + dayMs(world) * seasonDays(world);
}
export function getCozyDay(world: CozyWorld, now: number): number {
  if (
    world.startsAt === null ||
    now < world.startsAt ||
    world.status === "open"
  )
    return 0;
  const day = Math.floor((now - world.startsAt) / dayMs(world)) + 1;
  return world.persistent ? day : clamp(day, 1, seasonDays(world));
}
function arrivalForDay(world: CozyWorld, day: number) {
  return (world.startsAt ?? 0) + (day - 1) * dayMs(world);
}
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
function nextId(state: CozyState, prefix: string) {
  state.sequence += 1;
  return `${state.playerId}:${prefix}:${state.sequence}`;
}
function report(
  state: CozyState,
  at: number,
  kind: CozyReport["kind"],
  title: string,
  body: string,
  positive = true,
  location?: CozyCoord,
  decisionAuthor?: CozyReport["decisionAuthor"],
) {
  const entry: CozyReport = {
    id: nextId(state, "report"),
    at,
    kind,
    title,
    body,
    positive,
    ...(location ? { location } : {}),
    ...(decisionAuthor ? { decisionAuthor } : {}),
  };
  state.reports.unshift(entry);
  state.reports = state.reports.slice(0, 80);
  return entry;
}
function heroesOf(state: CozyState, role: CozyHeroRole) {
  return state.heroes.filter(
    (hero) => hero.role === role && hero.cityId !== null,
  ).length;
}
function cityHasHero(state: CozyState, city: CozyCity, role: CozyHeroRole) {
  return state.heroes.some(
    (hero) =>
      hero.id === city.heroId && hero.cityId === city.id && hero.role === role,
  );
}
function cityById(state: CozyState, id: unknown) {
  const city = state.cities.find((item) => item.id === id);
  rule(city, "Cidade não encontrada no seu reino.");
  return city;
}
function resourceSpend(state: CozyState, cost: Partial<CozyResources>) {
  for (const resource of ["gold", "materials", "supplies"] as const) {
    const amount = cost[resource] ?? 0;
    rule(Number.isFinite(amount) && amount >= 0, "Custo inválido.");
    rule(
      state.resources[resource] + EPSILON >= amount,
      `Você precisa de mais ${resource === "gold" ? "ouro" : resource === "materials" ? "materiais" : "alimento"}.`,
    );
  }
  for (const resource of ["gold", "materials", "supplies"] as const)
    state.resources[resource] = Math.max(
      0,
      state.resources[resource] - (cost[resource] ?? 0),
    );
}
function sumSectors(state: CozyState, sector: keyof CozyCity["sectors"]) {
  return state.cities.reduce((sum, city) => sum + city.sectors[sector], 0);
}
function production(state: CozyState, at=state.settledAt, cities=state.cities): CozyResources {
  const balance=state.progression?.balance;
  // Worlds without explicit rates retain their original economy.
  const materialsRate=balance?.materialsProductionMultiplier??(balance?.expressEconomy?4:1);
  const suppliesRate=balance?.suppliesProductionMultiplier??(balance?.expressEconomy?4:1);
  const technology = (1 + state.research.economy * 0.08)*(1+royalBonus(state,"administration"));
  return cities.reduce(
    (total, city) => {
      const multiplier =
        technology * (cityHasHero(state, city, "administrator") ? 1.15 : 1) * cityEfficiency(city,at)/100;
      total.materials +=
        (120 + city.sectors.economy * 85 + city.sectors.administration * 15) *
        multiplier * materialsRate * (!city.capital&&city.cityClass==="metropole"?1.05:1)*(1+equipmentBonus(state,"materials"));
      total.supplies += (70 + city.sectors.economy * 50) * multiplier * suppliesRate * (!city.capital&&city.cityClass==="celeiro"?1.05:1) * (1+realmSupportBonus(state,"provisions",at))*(1+equipmentBonus(state,"supplies"));
      return total;
    },
    { gold: 0, materials: 0, supplies: 0 },
  );
}
function influence(state: CozyState): CozyInfluence {
  if (state.founding) {
    const government = state.heroes.length * PROGRESSION.hero;
    return { infrastructure: 0, government, military: 0, society: 0, legacy: 0, total: government };
  }
  if(state.defeat)return {infrastructure:0,government:0,military:0,society:0,legacy:0,total:0};
  if(hasZeroProgression(state))return zeroInfluence(state,armyPower({...state,army:empireArmy(state)}),wallPower(state));
  const infrastructure = Math.min(
    500,
    state.cities.reduce((sum, city) => sum + getCityInfrastructure(city), 0),
  );
  const government = Math.min(
    500,
    state.heroes.filter(
      (hero) =>
        hero.cityId !== null &&
        state.cities.some(
          (city) => city.id === hero.cityId && city.heroId === hero.id,
        ),
    ).length * 50,
  );
  const military = Math.min(
    500,
    Math.floor((armyPower({...state,army:empireArmy(state)}) + wallPower(state)) / 6) +
      state.research.military * 15,
  );
  const society = Math.min(
    500,
    Math.round(
      state.satisfaction * 2 +
        (sumSectors(state, "society") / Math.max(1, state.cities.length)) * 30,
    ),
  );
  const legacy = Math.min(
    500,
    state.quests.reduce(
      (sum, id) => sum + (QUESTS.find((quest) => quest.id === id)?.points ?? 0),
      0,
    ) +
      Math.min(2, state.cities.filter((city) => city.wonder).length) * 60 +
      Math.min(80, state.cooperation * 4),
  );
  return {
    infrastructure,
    government,
    military,
    society,
    legacy,
    total: infrastructure + government + military + society + legacy,
  };
}
function questProgress(state: CozyState) {
  const frontier = state.progression?.feats.frontier;
  const progress: Record<string, number> = {
    city: Math.max(...state.cities.map(getCityDevelopment)),
    expansion: state.cities.length,
    exploration: usesMobileReviewRules(state)?new Set([...state.explored,...(state.scoutedCells??[])]).size:state.explored.length,
    research: Object.values(state.research).reduce(
      (sum, level) => sum + level,
      0,
    ),
    defense: frontier ? Number(frontier.resourceAreaClaimed) : state.hordesWon,
    council: state.decreesSigned.length,
  };
  return questsForRealm(state).map((quest) => {
    const target=quest.id==="exploration"&&usesMobileReviewRules(state)?40:quest.target;
    return {
    id: quest.id,
    current: Math.min(target, Math.max(0, progress[quest.id] ?? 0)),
    target,
    complete: (progress[quest.id] ?? 0) >= target,
    claimed: state.quests.includes(quest.id),
    };
  });
}
function getDecree(
  state: CozyState,
  shared: CozyShared,
  world: CozyWorld,
  now: number,
  capture = false,
): CozyDecree | null {
  if (state.founding) return null;
  if (state.firstAudience) {
    const audience = state.firstAudience;
    const city = state.cities.find(candidate => candidate.capital);
    const trust = city?.life?.contentment ?? state.satisfaction;
    const stateGain = (gain: number) => clamp(state.satisfaction + gain, 0, 100) - state.satisfaction;
    return {
      ...audience,
      options: audience.options.map(option => ({
        ...option, effects: {
          ...option.effects,
          satisfaction: stateGain(option.effects.satisfaction),
          localSatisfaction: Object.fromEntries(state.cities.map(candidate => [
            candidate.id, candidate.id === city?.id
              ? clamp(trust + option.effects.satisfaction, 0, 100) - trust
              : 0,
          ])),
        },
      })),
    };
  }
  const day = getCozyDay(world, now);
  if (!day || state.finalizedAt !== null) return null;
  const decreeDay = 1 + Math.floor((day - 1) / 3) * 3;
  if (world.persistent && !capture) {
    const pending = state.decisionInbox?.council;
    if (!pending) return null;
    const normalize = (outcome: CozyDecreeEffects) => ({
      ...outcome, ...councilTrustEffects(state, outcome.materials, outcome.satisfaction),
    });
    return {
      ...pending,
      options: pending.options.map(option => option.resolution === "chance" ?
        {...option, effects: normalize(option.effects), failure: normalize(option.failure)} :
        {...option, effects: normalize(option.effects)}),
    };
  }
  if (world.persistent && state.decisionInbox?.councilResolvedCycle === decreeDay) return null;
  if (state.decreesSigned.includes(decreeDay)) return null;
  const seat = Math.floor((decreeDay - 1) / 3) % 2;
  const counselorId = state.counselors[seat];
  const counselor = COUNSELORS.find((person) => person.id === counselorId)!;
  const upcomingWave = world.persistent ? null : nextHorde(state,shared,world,now)?.day ?? null;
  const {careLabel,investLabel,careDescription,investDescription,...topic}=councilTopic(state,decreeDay,day,upcomingWave);
  const generous = counselorId === "helena" || counselorId === "ines";
  const effects=(materials:number,requested:number)=>capture ? {materials,satisfaction:requested} : councilTrustEffects(state,materials,requested);
  if(state.progression?.balance?.unifiedRules)return modernCouncilDecision(state,decreeDay,day,upcomingWave,counselorId,effects,now);
  return {
    id: `${decreeDay}:${counselorId}`,
    day: decreeDay,
    counselorId,
    ...topic,
    options: [
      {
        id: "care",
        effects: effects(80,generous?10:6),
        resolution: "certain",
        label: careLabel ?? (generous ? "Acolher e ouvir o povo" : "Abrir uma exceção"),
        description: careDescription ?? (generous
          ? "Dar prioridade às famílias e à confiança na Coroa."
          : "Reservar espaço para quem precisa, mesmo com o conselho dividido."),
      },
      {
        id: "invest",
        effects: effects(generous?220:350,generous?2:-5),
        resolution: "certain",
        label: investLabel ?? (generous
          ? "Combinar ajuda com trabalho"
          : "Priorizar as reservas"),
        description: investDescription ?? (generous
          ? "Organizar uma contribuição voluntária para as oficinas."
          : "Concentrar o esforço do reino em materiais para os próximos desafios."),
      },
      ...(usesMobileReviewRules(state)&&decreeDay%12===4?[{
        id:"risk", label:"Apostar numa caravana", description:"Envie mercadores por uma rota incerta.",
        resolution:"chance" as const, successPercent:70, effects:effects(440,2), failure:effects(0,-8),
      }]:[]),
    ],
  };
}
function councilTrustEffects(state: CozyState, materials: number, requested: number) {
  const satisfaction = clamp(state.satisfaction + requested, 0, 100) - state.satisfaction;
  if (!hasZeroProgression(state)) return {materials,satisfaction};
  const localSatisfaction = Object.fromEntries(state.cities.map(city => {
    const trust = city.life?.contentment ?? state.satisfaction;
    return [city.id, clamp(trust + localTrustDelta(state,city,requested),0,100)-trust];
  }));
  return {materials,satisfaction,localSatisfaction};
}
function syncDecisionInbox(state: CozyState, shared: CozyShared, world: CozyWorld, now: number) {
  if (!world.persistent || state.founding || state.defeat || state.finalizedAt !== null) return;
  const day = getCozyDay(world,now);
  const inbox = state.decisionInbox ??= {cities:{},affinity:{}};
  if (!state.firstAudience && !inbox.council) {
    const draft = getDecree(state,shared,world,now,true);
    if (draft) {
      const prefersCare = draft.counselorId === "helena" || draft.counselorId === "ines";
      const suggested = draft.options.find(option => option.id === (prefersCare ? "care" : "invest"));
      inbox.council = {...draft,suggestedOptionId:suggested?.id};
    }
  }
  const owned = new Set(state.cities.map(city => city.id));
  for (const id of Object.keys(inbox.cities)) if (!owned.has(id)) delete inbox.cities[id];
  for (const city of state.cities) {
    if (inbox.cities[city.id]) continue;
    const hero = state.heroes.find(candidate => candidate.id === city.heroId && candidate.cityId === city.id);
    const context = state.progression?.balance?.unifiedRules
      ? {resources:state.resources,now,hordeSoon:false,heroRole:hero?.role} : undefined;
    const draft = cityDecision(city,day,context);
    if (draft) inbox.cities[city.id] = {...draft,day,...(hero ? {author:{name:hero.name,role:hero.role}} : {})};
  }
}
function nextHorde(
  state: CozyState,
  shared: CozyShared,
  world: CozyWorld,
  now: number,
) {
  if (
    world.startsAt === null ||
    world.status === "open" ||
    state.finalizedAt !== null || Boolean(state.defeat)
  )
    return null;
  const index = waveDays(world).findIndex(
    (day) =>
      !state.hordesResolved.includes(day) && arrivalForDay(world, day) >= now,
  );
  if (index < 0) return null;
  const day = waveDays(world)[index];
  const supportPower = shared.support
    .filter(
      (item) =>
        item.requesterId === state.playerId &&
        item.waveDay === day &&
        item.acceptedAt !== null &&
        item.acceptedAt < item.arrivesAt,
    )
    .reduce((sum, item) => sum + item.power, 0);
  return {
    day,
    arrivesAt: arrivalForDay(world, day),
    power: WAVE_POWER[index],
    supportPower,
  };
}
function sanctuaryGuardianPower(world:CozyWorld,now:number){
  const index=waveDays(world).findIndex(day=>arrivalForDay(world,day)>now);
  return WAVE_POWER[index<0?WAVE_POWER.length-1:index];
}
export function getCozyComputed(
  state: CozyState,
  shared: CozyShared,
  world: CozyWorld,
  now: number,
): CozyComputed {
  const day = getCozyDay(world, now);
  const endsAt = endAt(world);
  const started = day > 0;
  const readOnly =
    world.status === "finalized" ||
    state.finalizedAt !== null || Boolean(state.defeat) ||
    (endsAt !== null && now >= endsAt);
  const score = influence(state);
  const recruitmentDiscount = Math.min(
    0.35,
    sumSectors(state, "recruitment") * 0.004,
  );
  const portalOpen = started && !readOnly && !world.persistent;
  const supportOffer=Math.max(20,Math.floor(defensePower(state,now)*0.2));
  const horde = state.founding ? null : nextHorde(state,shared,world,now);
  return {
    day,
    durationDays: seasonDays(world),
    realDurationDays: dayMs(world)*seasonDays(world)/DAY,
    dayMs: dayMs(world),
    endsAt,
    phase: state.ascension?"Reinado arquivado":state.defeat?"Império derrotado":!started
      ? "Préparação"
      : readOnly
        ? "Temporada encerrada"
        : day <= 20*seasonDays(world)/120
          ? "Consolidação"
          : day <= 60*seasonDays(world)/120
            ? "Expansão"
            : day <= 90*seasonDays(world)/120
              ? "Fortificação"
              : "Apogeu",
    started,
    readOnly,
    influence: score,
    influenceDetails:progressionBreakdown(state,armyPower({...state,army:empireArmy(state)}),wallPower(state)),
    worldDiagonalLimit: worldDiagonalLimit(state,shared),
    armyPower: armyPower(state),
    playerAttackPower:Math.floor(armyPower(state)*(1+royalBonus(state,'command'))),
    defensePower:defensePower(state,now),
    supportOffer,
    allianceDefenseBonus:Math.floor((armyPower(state)+wallPower(state))*(1+royalBonus(state,"command"))*(1+allianceBonus(state,"defense",now)))-Math.floor((armyPower(state)+wallPower(state))*(1+royalBonus(state,"command"))),
    allianceSupplyBonus:allianceBonus(state,"provisions",now),
    towerDefenseBonus:Math.floor((armyPower(state)+wallPower(state))*(1+royalBonus(state,"command"))*(1+realmSupportBonus(state,'defense',now)))-Math.floor((armyPower(state)+wallPower(state))*(1+royalBonus(state,"command"))*(1+allianceBonus(state,'defense',now))),
    equipmentDefenseBonus:defensePower(state,now)-Math.floor((armyPower(state)+wallPower(state))*(1+royalBonus(state,"command"))*(1+realmSupportBonus(state,'defense',now))),
    fortificationPower:wallPower(state),
    royalDefenseBonus:Math.floor((armyPower(state)+wallPower(state))*(1+royalBonus(state,"command")))-armyPower(state)-wallPower(state),
    recruitmentDiscount,
    armyCapacity: 200 + state.cities.filter(c=>!c.capital&&c.cityClass==="posto_avancado").length*10 + sumSectors(state, "recruitment") * 30,
    productionPerDay: production(state,now),
    cityLife: Object.fromEntries(state.cities.map(city => {
      const rates = production(state,now,[city]);
      const trust = city.life?.contentment ?? state.satisfaction;
      const integrity = city.integrity ?? 100;
      const activeEffect = city.life?.productionEffect;
      const effect = activeEffect && activeEffect.endsAt > now ? activeEffect : null;
      const raw = !started || readOnly ? null : world.persistent
        ? state.decisionInbox?.cities[city.id] ?? null
        : cityDecision(city,day,state.progression?.balance?.unifiedRules
          ? {resources:state.resources,now,hordeSoon:Boolean(!world.persistent && horde && horde.day-day<=3)} : undefined);
      const normalize = <T extends CityOutcome>(outcome: T): T => {
        const delta = localTrustDelta(state,city,outcome.contentment);
        if (!world.persistent) return {...outcome,contentment:delta};
        return {
          ...outcome,
          contentment: clamp(trust+delta,0,100)-trust,
          ...(outcome.integrityRestore ? {integrityRestore:Math.min(outcome.integrityRestore,100-integrity)} : {}),
          productionBonus: outcome.productionBonus >= (effect?.bonus ?? 0) ? outcome.productionBonus : 0,
        };
      };
      const decision = raw ? {...raw,options:raw.options.map(option => ({
        ...normalize(option),
        ...(option.chance ? {chance:{...option.chance,failure:normalize(option.chance.failure)}} : {}),
      }))} : null;
      return [city.id,{
        contentment:trust,status:citySocialStatus(city),unrestDays:city.life?.unrestDays??0,integrity,
        daysToRupture:!world.persistent&&!city.capital&&state.cities.length>1&&trust<35
          ? Math.max(0,SOCIAL_RUPTURE_DAYS-(city.life?.unrestDays??0)) : null,
        efficiency:cityEfficiency(city,now),production:{materials:rates.materials,supplies:rates.supplies},
        administrationMaterials:rates.materials*15/(120+city.sectors.economy*85+city.sectors.administration*15),
        recruitmentCapacity:city.sectors.recruitment*30+(!city.capital&&city.cityClass==="posto_avancado"?10:0),
        fortification:Math.floor(cityWallLevels(city)*18*(1+state.research.fortification*0.15)),
        effectEndsAt:effect?.endsAt??null,decision,
      }];
    })),
    nextHorde: horde,
    decree: readOnly ? null : getDecree(state, shared, world, now),
    portalOpen,
    canEnterPortal:
      portalOpen &&
      score.total >= 1500 &&
      state.portalCrossedAt === null &&
      !state.orders.some((order) => order.kind === "portal"),
    unreadReports: state.reports.filter((item) => isUnreadReport(state,item,world.persistent))
      .length,
    heroCost: state.progression?.balance?.expressEconomy
      ? (state.heroes.length === 0 ? 150 : 225 + (state.heroes.length - 1) * 25)
      : 200 + state.heroes.length * 100,
    ...(world.persistent && !state.founding ? { tradeRoute: {
      gold: TRADE_ROUTE.gold, supplies: TRADE_ROUTE.supplies, durationMs: TRADE_ROUTE.travelDays * dayMs(world),
      intervalMs: (TRADE_ROUTE.travelDays + TRADE_ROUTE.cooldownDays) * dayMs(world),
      nextAt: state.nextTradeAt ?? 0, arrivesAt: state.orders.find(order => order.tradeRoute)?.arrivesAt ?? null,
    } } : {}),
    troopCosts: Object.fromEntries(
      TROOPS.map((troop) => [
        troop.id,
        Math.max(1, Math.ceil(troop.baseCost * (1 - recruitmentDiscount))),
      ]),
    ) as CozyComputed["troopCosts"],
    researchCosts: Object.fromEntries(
      RESEARCHES.map((research) => [
        research.id,
        researchCost(state,state.research[research.id]),
      ]),
    ) as CozyComputed["researchCosts"],
    upgradeCosts: Object.fromEntries(
      state.cities.map((city) => [
        city.id,
        Object.fromEntries(
          SECTORS.map((sector) => [
            sector.id,
            upgradeCost(state,city.sectors[sector.id]),
          ]),
        ),
      ]),
    ) as CozyComputed["upgradeCosts"],
    wonderCost: COZY_LIMITS.wonderCost,
    sanctuaryThreats:sanctuaryThreats(state,shared,now,dayMs(world),supportOffer,started&&!readOnly),
    sanctuaryBonuses:{defense:sanctuaryBonus(state,"defense",now),provisions:sanctuaryBonus(state,"provisions",now)},
    sanctuaries: ALL_SANCTUARIES.map(tower=>({id:tower.id,name:tower.name,q:tower.q,r:tower.r,
      visitedAt:state.sanctuaryVisits?.[tower.id]??null,
      supplyCost:exploreCost(state,tower),travelMs:travelMs(state,world,tower),guardianPower:sanctuaryGuardianPower(world,now),
      arrivesAt:state.orders.find(order=>order.sanctuaryId===tower.id)?.arrivesAt??null})),
    questProgress: questProgress(state),
  };
}
function baseTile(
  world: CozyWorld,
  coord: CozyCoord,
  shared?: CozyShared,
): {
  kind: Exclude<CozyTileKind, "unknown" | "city">;
  name: string;
  clue: string;
  power: number;
} {
  const independent=shared?.independentCities?.[key(coord)];
  if(independent)return {kind:independent.reason==="horde"?"npc":"abandoned",name:independent.city.name,clue:independent.reason==="horde"?"A horda ocupa as estruturas desta antiga cidade do reino.":"Uma cidade independente guarda as marcas do antigo reino.",power:shared?.npcResistance?.[key(coord)]?.remaining??(25+independent.city.sectors.defense*18)};
  if (coord.q === 0 && coord.r === 0)
    return {
      kind: "portal",
      name: "Portal Central",
      clue: "O caminho do Êxodo",
      power: 0,
    };
  const n = hash(`${world.id}:tile:${key(coord)}`) % 100;
  let kind: Exclude<CozyTileKind,"unknown"|"city"> =
    n < 18
      ? "npc"
      : n < 30
        ? "abandoned"
        : n < 48
          ? "ruin"
          : n < 62
            ? "gold"
            : n < 77
              ? "materials"
              : "plain";
  if(world.economyVersion===3){
    const q0=Math.floor((coord.q+40)/8)*8-40,r0=Math.floor((coord.r+40)/8)*8-40;
    const district=hash(`${world.id}:district:${q0},${r0}`)%100;
    // A resource district is one continuous area, never a different objective per cell.
    kind=district<15?'gold':district<30?'materials':coord.q===q0+3&&coord.r===r0+3&&district<65?'abandoned':n<2?'npc':n<4?'ruin':'plain';
  }
  const names = {
    npc: world.persistent ? "Acampamento da horda" : "Aldeia da horda",
    abandoned: "Cidade abandonada",
    ruin: "Ruínas antigas",
    gold: "Veio de ouro",
    materials: "Pedreira da floresta",
    plain: "Campos tranquilos",
  };
  const clues = {
    npc: "Bandeiras escuras se movem à distância.",
    abandoned: "Telhados entre a névoa; nenhuma bandeira.",
    ruin: "Pedras antigas parecem guardar uma história.",
    gold: "Um brilho quente atravessa as rochas.",
    materials: "A encosta parece rica em pedra e madeira.",
    plain: "O vento passa livre pelos campos.",
  };
  const centralPressure = Math.max(0, 36 - distance(coord, { q: 0, r: 0 }));
  return {
    kind,
    name: names[kind],
    clue: clues[kind],
    power:
      shared?.npcResistance?.[key(coord)]?.remaining??(25 + centralPressure * 8 + (hash(`${world.id}:power:${key(coord)}`) % 70)),
  };
}
function tileDistance(state: CozyState, coord: CozyCoord) {
  return Math.max(
    1,
    Math.min(...state.cities.map((city) => distance(city, coord))),
  );
}

function capitalSites(state: CozyState, shared: CozyShared, world: CozyWorld): CozyCoord[] {
  const origin = state.founding!.origin;
  const sites: CozyCoord[] = [];
  for (let radius = 0; radius <= 18 && sites.length < 12; radius++) {
    for (let q = -radius; q <= radius && sites.length < 12; q++) {
      for (let r = -radius; r <= radius && sites.length < 12; r++) {
        const coord = { q: origin.q + q, r: origin.r + r };
        const id = key(coord);
        if (distance(origin, coord) !== radius || Math.abs(coord.q) > 40 ||
          Math.abs(coord.r) > 40 || Math.abs(coord.q + coord.r) > 40 ||
          sanctuaryAt(coord) || shared.deposits[id] || shared.territories?.[id] ||
          baseTile(world, coord, shared).kind !== "plain" || foundationSite(state, shared, coord)) continue;
        sites.push(coord);
      }
    }
  }
  return sites;
}
function travelMs(state:CozyState,world:CozyWorld,coord:CozyCoord){return expeditionTravelMs(state,world,coord);}
function exploreCost(state:CozyState,coord:CozyCoord){return expeditionCost(state,coord);}
function mapTile(
  state: CozyState,
  shared: CozyShared,
  world: CozyWorld,
  coord: CozyCoord,
  known: Set<string>,
  sight: Set<string>,
): CozyTile {
  const id = key(coord);
  const base = baseTile(world, coord, shared);
  const revealed = known.has(id);
  const claim = revealed ? shared.claims[id] : undefined;
  const sanctuary=sanctuaryAt(coord);
  const legacyDeposit=Boolean(shared.deposits[id]);
  const reserved=Boolean(sanctuary&&!shared.claims[id]&&!legacyDeposit&&!shared.independentCities?.[id]);
  const area = (base.kind === "gold" || base.kind === "materials") ? resourceArea(shared,coord,base.kind) : undefined;
  const areaKnown = area && !reserved && (revealed || area.owners.includes(state.playerId));
  const areaConflict=Boolean(area?.cells.some(id=>{const owner=shared.claims[id]?.playerId??shared.territories?.[id];return owner&&owner!==state.playerId&&(area.exclusive||!areaAllied(shared,owner,state.playerId));}));
  const city =
    claim?.playerId === state.playerId
      ? state.cities.find((item) => item.id === claim.cityId)
      : undefined;
  const camp = world.persistent && base.kind === "npc" && !shared.independentCities?.[id];
  const resistance = shared.npcResistance?.[id];
  return {
    ...coord,
    id,
    kind: !revealed ? "unknown" : claim ? "city" : reserved ? "plain" : base.kind,
    landmarkId: revealed && reserved ? sanctuary!.id : null,
    clue: revealed && reserved ? "Distrito monumental reservado; novas cidades não podem ocupar estes hexágonos." : base.clue,
    name: !revealed ? "Território desconhecido" : claim?.name ?? (reserved ? sanctuary!.name : base.name),
    revealed,
    terrainVisible: revealed || sight.has(id),
    attackable: !shared.claims[id] && !reserved && (base.kind === "npc" || base.kind === "abandoned") && !(camp && base.power === 0),
    ownerId: claim?.playerId ?? null,
    reservedSlot: claim?.reservedSlot === true,
    cityId: claim?.cityId ?? null,
    color: claim
      ? claim.playerId === state.playerId
        ? city && getCityDevelopment(city) >= 60
          ? "green"
          : "yellow"
        : "ally"
      : revealed
        ? "neutral"
        : "fog",
    power:
      !reserved && revealed && (base.kind === "npc" || base.kind === "abandoned")
        ? base.power
        : null,
    deposit: !reserved && revealed ? (area?.reserve ?? shared.deposits[id] ?? null) : null,
    ...(revealed && area && shared.depletedAreas?.[area.id] !== undefined
      ? { replenishesAt: shared.depletedAreas[area.id] + FRONTIER_RENEWAL_DAYS * dayMs(world) } : {}),
    ...(revealed && !claim && !reserved && camp && resistance?.remaining === 0
      ? { campRecoveryAt: resistance.at + FRONTIER_RENEWAL_DAYS * dayMs(world) } : {}),
    territoryOwnerId: revealed ? shared.territories?.[id] ?? null : null,
    area: areaKnown ? {exclusive:area.exclusive,id:area.id,cells:area.cells,owners:area.owners,canCollect:canUseArea(shared,area,state.playerId),blockedReason:areaConflict?'Há território de outro império nesta área.':null,canAnnex:!areaConflict&&area.reserve.surveys===3&&area.reserve.remaining>0&&(!area.owners.length||(!area.exclusive&&!area.owners.includes(state.playerId)&&areaAllied(shared,area.owners[0],state.playerId)))} : world.economyVersion===3&&revealed&&!reserved&&['gold','materials'].includes(base.kind)?{exclusive:true,id:resourceAreaId(coord,base.kind as 'gold'|'materials'),cells:areaCells(coord,true),owners:[],canAnnex:false,canCollect:false}:null,
    ...(world.economyVersion===3&&revealed&&!claim&&!camp&&['npc','abandoned'].includes(base.kind)?{occupation:npcOccupation(base.power,resistance?.initial??base.power)}:{}),
    ...(!state.founding&&world.economyVersion===3&&revealed&&!claim&&!reserved&&base.kind==='plain'?{foundation:{canFound:!foundationSite(state,shared,coord),reason:foundationSite(state,shared,coord),materials:CITY_FOUNDATION_COST.materials,supplies:CITY_FOUNDATION_COST.supplies+exploreCost(state,coord),durationMs:travelMs(state,world,coord)+CITY_FOUNDATION_DAYS*dayMs(world)}}:{}),
    distance: state.founding ? distance(state.founding.origin, coord) : tileDistance(state, coord),
    combat: !reserved&&revealed&&(base.kind==="npc"||base.kind==="abandoned")&&!claim ? combatAssessment(armyPower(state),base.power) : null,
    exploreCost: exploreCost(state, coord),
    travelMs: travelMs(state, world, coord),
  };
}
export function getCozyTiles(
  state: CozyState,
  shared: CozyShared,
  world: CozyWorld,
): CozyTile[] {
  if (state.founding) {
    const sites = capitalSites(state, shared, world);
    const visible = new Set(sites.map(key));
    return sites.map(coord => ({
      ...mapTile(state, shared, world, coord, visible, visible),
      foundation: { canFound: true, reason: null, materials: 0, supplies: 0, durationMs: 0 },
    }));
  }
  const limit = worldDiagonalLimit(state,shared);
  const known = knownMapCells(state, shared);
  const sight = visibleTerrainCells(state);
  const coordinates = new Map<string, CozyCoord>();
  const add = (coord: CozyCoord) => {
    if (Math.abs(coord.q) <= 40 && Math.abs(coord.r) <= 40 && Math.abs(coord.q+coord.r)<=limit)
      coordinates.set(key(coord), coord);
  };
  const neighbors = (coord: CozyCoord, radius: number) => {
    for (let q = -radius; q <= radius; q++)
      for (let r = -radius; r <= radius; r++)
        if (distance({ q: 0, r: 0 }, { q, r }) <= radius)
          add({ q: coord.q + q, r: coord.r + r });
  };
  state.cities.forEach((city) => neighbors(city, 4));
  state.explored.forEach((id) => neighbors(fromKey(id), 2));
  state.orders
    .filter((order) => order.q !== undefined && order.r !== undefined)
    .forEach((order) => add({ q: order.q!, r: order.r! }));
  known.forEach(id => add(fromKey(id)));
  return [...coordinates.values()].map((coord) =>
    mapTile(state, shared, world, coord, known, sight),
  );
}
export function createCozyShared(_world: CozyWorld): CozyShared {
  return { version: 2, claims: {}, deposits: {}, alliances: [], support: [] };
}
export function createCozyState(
  world: CozyWorld,
  playerId: string,
  playerName: string,
  now: number,
): CozyState {
  rule(
    Number.isFinite(now) && now >= 0 && playerId.length > 0,
    "Identidade ou horário inválido.",
  );
  const spawn = hash(`${world.id}:${playerId}:spawn`);
  const r = (hash(`${world.id}:${playerId}:side`) % 2 ? 1 : -1) * 28;
  const q = Math.max(-38,-38-r) + spawn % (Math.min(38,38-r)-Math.max(-38,-38-r)+1);
  const startingLevel=world.influenceVersion===2?0:1;
  const city: CozyCity = {
    id: `${playerId}:capital`,
    name: "Capital",
    q,
    r,
    capital: true,
    sectors: {
      administration: startingLevel,
      economy: startingLevel,
      society: startingLevel,
      recruitment: startingLevel,
      defense: startingLevel,
    },
    heroId: null,
    wonder: false,
  };
  const endsAt = endAt(world);
  const state: CozyState = {
    version: 2,
    playerId,
    playerName,
    createdAt: now,
    citySystemsAt: now,
    settledAt: endsAt === null ? now : Math.min(now, endsAt),
    resources: { gold: 350, materials: 1800, supplies: 500 },
    cities: world.foundingOnboarding ? [] : [city],
    army: { militia: 25, shooters: 0, scouts: 0, machinery: 0 },
    heroes: [],
    research: { economy: 0, military: 0, exploration: 0, fortification: 0 },
    counselors: world.foundingOnboarding ? ["", ""] : ["helena", "ines"],
    satisfaction: 70,
    explored: [],
    raided: {},
    orders: [],
    reports: [],
    readAt: 0,
    quests: [],
    decreesSigned: [],
    hordesResolved:
      world.startsAt !== null
        ? waveDays(world).filter((day) => arrivalForDay(world, day) < now)
        : [],
    hordesWon: 0,
    supportSentAt: null,
    allianceId: null,
    cooperation: 0,
    portalCrossedAt: null,
    finalizedAt: null,
    finalScore: null,
    seasonXp: 0,
    sequence: 0,
  };
  if (world.foundingOnboarding) {
    state.founding = { origin: { q, r } };
    return state;
  }
  if(world.influenceVersion===2)createProgression(state,armyPower(state)+wallPower(state),economicExpress(world),world.economyVersion===3);
  report(
    state,
    now,
    "welcome",
    "Seu reino começa aqui",
    "A Coroa reúne cinco caminhos. Evolua a cidade, explore uma pista e escolha como cuidar do seu povo. Seu exército defenderá o reino automaticamente.",
  );
  return state;
}
function ensureCapitalClaim(state: CozyState, shared: CozyShared) {
  if(state.defeat)return;
  const capital = state.cities.find((city) => city.capital)!;
  if (
    shared.claims[key(capital)]?.playerId &&
    shared.claims[key(capital)].playerId !== state.playerId
  ) {
    // Deterministic collision resolution runs inside the shared-state CAS transaction.
    let placed = false;
    for (let radius = 1; radius <= 80 && !placed; radius++)
      for (let q = -radius; q <= radius && !placed; q++)
        for (const r of [-radius, radius]) {
          const coord = { q: capital.q + q, r: capital.r + r };
          if (
            Math.abs(coord.q) <= 40 &&
            Math.abs(coord.r) <= 40 && Math.abs(coord.q+coord.r)<=40 &&
            key(coord) !== "0,0" &&
            !shared.claims[key(coord)]
          ) {
            capital.q = coord.q;
            capital.r = coord.r;
            placed = true;
            break;
          }
        }
    rule(placed, "O mapa está cheio.");
  }
  for (const city of state.cities)
    shared.claims[key(city)] = {
      playerId: state.playerId,
      cityId: city.id,
      name: city.name,
    };
}
function accrue(state: CozyState, world: CozyWorld, from: number, to: number) {
  if (to <= from || world.startsAt === null) return;
  const start=Math.max(from,world.startsAt);
  const cuts=[...new Set([...[...(state.allianceBenefits??[]),...(state.sanctuaryBenefits??[])].flatMap(b=>[b.from,b.until].filter(at=>at>start&&at<to)),...state.cities.flatMap(c=>c.life?.productionEffect&&c.life.productionEffect.endsAt>start&&c.life.productionEffect.endsAt<to?[c.life.productionEffect.endsAt]:[]),to])].sort((a,b)=>a-b);
  let cursor=start;
  for(const end of cuts){const rates=production(state,cursor),duration=Math.max(0,end-cursor);state.resources.materials+=rates.materials*duration/dayMs(world);state.resources.supplies+=rates.supplies*duration/dayMs(world);cursor=end;}

}
function loseTroops(state: CozyState, fraction: number) {
  let losses = 0;
  for (const troop of TROOPS) {
    const lost = Math.floor(state.army[troop.id] * fraction);
    state.army[troop.id] -= lost;
    losses += lost;
  }
  return losses;
}
function resolveHorde(
  state: CozyState,
  shared: CozyShared,
  world: CozyWorld,
  day: number,
  at: number,
) {
  const index = waveDays(world).indexOf(day);
  const supports = shared.support.filter(
    (item) =>
      item.requesterId === state.playerId &&
      item.waveDay === day &&
      item.acceptedAt !== null &&
      item.acceptedAt < at,
  );
  if(state.progression)for(const support of supports)support.resolvedAt??=at;
  const supportPower = supports.reduce((sum, item) => sum + item.power, 0);
  const defense = defensePower(state,at)+supportPower;
  const won = defense >= WAVE_POWER[index];
  const infrastructureBefore=influence(state).infrastructure;
  const losses = loseTroops(state, won ? 0.025 : 0.12);
  let damage:{city:string;integrityLost:number;lost:boolean;buildings?:CozyBuildingDamage[];infrastructureLost?:number}|undefined,damagedCityId:string|undefined;
  state.hordesResolved.push(day);
  if (won) {
    state.hordesWon += 1;
    state.satisfaction = clamp(state.satisfaction + 3, 0, 100);
    for(const city of state.cities)if(city.life)city.life.contentment=clamp(city.life.contentment+3,0,100);
  } else {
    const city = [...(state.cities.some(c=>!c.capital)?state.cities.filter(c=>!c.capital):state.cities)].sort(
      (a, b) =>
        (a.integrity??100)-(b.integrity??100)||b.sectors.economy-a.sectors.economy||a.id.localeCompare(b.id),
    )[0];
    const structural=at>=(state.citySystemsAt??at);
    damagedCityId=city.id;
    damage={city:city.name,integrityLost:structural?Math.min(25,city.integrity??100):0,lost:false};
    if(structural){city.integrity=Math.max(0,(city.integrity??100)-25);damage.buildings=damageCityBuildings(state,city,defense,WAVE_POWER[index]);}
    else city.sectors.economy=Math.max(1,city.sectors.economy-1);
    state.satisfaction = clamp(state.satisfaction - 8, 0, 100);
    if(city.life)city.life.contentment=clamp(city.life.contentment+localTrustDelta(state,city,-8),0,100);
    if(structural&&state.cities.length===1&&city.capital&&city.integrity===0&&defense*2<WAVE_POWER[index]&&state.king?.alive!==false){
      state.king??={profileId:null,nickname:state.playerName,alive:true,generation:1,history:[]};
      const king=state.king;king.history.push({nickname:king.nickname,profileId:king.profileId,generation:king.generation,diedAt:at,defense,enemyPower:WAVE_POWER[index]});king.alive=false;
      report(state,at,"horde",`${king.nickname}: fim do reinado`,`${defense} de defesa contra ${WAVE_POWER[index]} da horda. A capital sem integridade sofreu uma derrota extrema e o rei morreu. O reino continua: escolha o sucessor e recupere a cidade.`,false);
    }
    if(structural&&city.integrity===0&&releaseCity(state,shared,city,at,"horde"))report(state,at,"horde",`${city.name} foi perdida para a horda`,"As estruturas cederam após ataques sucessivos. A cidade e sua região ficaram independentes; seu herói retornou ao reino. Outras cidades e seus territórios continuam seus.",false);
  }
  const buildingDamage=damage?.buildings?.map(hit=>`${SECTORS.find(s=>s.id===hit.sector)!.name} ${hit.from} → ${hit.to}`).join(", ");
  const group=shared.alliances.find(a=>a.id===state.allianceId&&a.members.includes(state.playerId));
  if(damage){damage.lost=!state.cities.some(c=>c.id===damagedCityId);damage.infrastructureLost=Math.max(0,infrastructureBefore-influence(state).infrastructure);}
  if(group)(shared.allianceBattles??=[]).push({id:`${state.playerId}:horde:${day}`,allianceId:group.id,playerId:state.playerId,waveDay:day,at,won,defense,enemyPower:WAVE_POWER[index],troopsLost:losses,supportPower,...(damage?{damage}:{})});
  report(
    state,
    at,
    "horde",
    won
      ? `Horda do dia ${day} contida`
      : `O reino resistiu à horda do dia ${day}`,
    `${defense} de defesa contra ${WAVE_POWER[index]} de poder. ${losses} tropas perdidas.${allianceBonus(state,"defense",at)>0?` O projeto da aliança reforçou a defesa em ${Math.round(allianceBonus(state,"defense",at)*100)}%.`:""}${sanctuaryBonus(state,"defense",at)>allianceBonus(state,"defense",at)?` A sintonia da torre reforçou a defesa em ${Math.round(sanctuaryBonus(state,"defense",at)*100)}%.`:""} ${supportPower ? ` A aliança somou ${supportPower} de proteção.` : ""} ${won ? "As cidades estão protegidas." : (at<(state.citySystemsAt??at)?"Uma cidade sofreu dano na Economia.":"Uma cidade sofreu dano estrutural. Confira a integridade e as decisões de reparo; derrotas sucessivas podem causar perda de cidade.")}${buildingDamage?` ${damage!.city}: ${buildingDamage}.`:""}${damage?.infrastructureLost?` Infraestrutura do reino: −${damage.infrastructureLost} de influência (${infrastructureBefore} → ${infrastructureBefore-damage.infrastructureLost}).`:""}`,
    won,
  );
}
function settlePeacefulDefense(state: CozyState, shared: CozyShared, world: CozyWorld, at: number) {
  const day = state.pendingDefenseDay;
  if (day === undefined || state.orders.some(order => order.kind === "attack" && !order.foundation && !order.occupationOnly)) return;
  delete state.pendingDefenseDay;
  const enemy = WAVE_POWER[waveDays(world).indexOf(day)];
  const due = arrivalForDay(world, day);
  let supportPower = 0;
  for (const support of shared.support) {
    if (support.requesterId !== state.playerId || support.waveDay !== day ||
      support.acceptedAt === null || support.acceptedAt >= due) continue;
    support.resolvedAt ??= at;
    supportPower += support.power;
  }
  const defense = defensePower(state, at) + supportPower;
  const won = defense >= enemy;
  if (won) {
    state.hordesWon += 1;
    state.satisfaction = clamp(state.satisfaction + 3, 0, 100);
    for (const city of state.cities) if (city.life)
      city.life.contentment = clamp(city.life.contentment + 3, 0, 100);
  }
  const alliance = shared.alliances.find(group => group.id === state.allianceId && group.members.includes(state.playerId));
  if (alliance) (shared.allianceBattles ??= []).push({
    id: `${state.playerId}:horde:${day}`, allianceId: alliance.id, playerId: state.playerId,
    waveDay: day, at, won, defense, enemyPower: enemy, troopsLost: 0, supportPower,
  });
  report(state, at, "horde", won ? "Patrulha conteve a horda" : "Patrulha voltou ao reino",
    `${defense} de defesa contra ${enemy} de poder. ${won ? "O encontro reforçou a confiança nas cidades." : "As cidades e as tropas estão a salvo."}`, won);
}

function establishCity(
  state: CozyState,
  shared: CozyShared,
  world: CozyWorld,
  coord: CozyCoord,
  heroId: string,
  at: number,
  foundation=false,
) {
  const hero = state.heroes.find(
    (item) => item.id === heroId && item.cityId === null,
  );
  if (!hero || state.cities.length >= 10) {
    report(
      state,
      at,
      "combat",
      "Conquista adiada",
      "Não há um herói livre ou uma vaga de cidade. O exército retornou à prontidão.",
      false,
    );
    return;
  }
  const level = foundation?0:1 + (hash(`${world.id}:${key(coord)}:city`) % 3);
  const city: CozyCity = {
    ...coord,
    id: nextId(state, "city"),
    name: `Colônia ${state.cities.length}`,
    capital: false,
    life: {contentment: state.satisfaction, lastDecisionDay: null, lastSocialDay: getCozyDay(world, at), unrestDays: 0},
    sectors: {
      administration: level,
      economy: level,
      society: level,
      recruitment: level,
      defense: level,
    },
    heroId: hero.id,
    wonder: false,
  };
  const independent=shared.independentCities?.[key(coord)];
  if(independent){city.renamedBy=clone(independent.city.renamedBy??[]);city.cityClass=independent.city.cityClass;city.name=independent.city.name;city.sectors=clone(independent.city.sectors);city.wonder=independent.city.wonder;city.integrity=independent.city.integrity??100;city.life={contentment:Math.max(35,independent.city.life?.contentment??35),lastDecisionDay:null,lastSocialDay:getCozyDay(world,at),unrestDays:0};delete shared.independentCities![key(coord)];}
  hero.cityId = city.id;
  state.cities.push(city);
  if(shared.npcResistance)delete shared.npcResistance[key(coord)];
  if(independent)restoreCityTerritory(state,shared,city,independent);
  shared.claims[key(coord)] = {
    playerId: state.playerId,
    cityId: city.id,
    name: city.name,
  };
  report(
    state,
    at,
    "progress",
    `${city.name} se une ao reino`,
    `${hero.name} assumiu a cidade. ${foundation?"O investimento de fundação foi aplicado aos primeiros assentamentos.":"A cidade foi anexada após a expedição."} A infraestrutura e os bônus passam a contar para o reino.`,
    true,
    coord,
  );
}
function returnNpcExpedition(state: CozyState, world: CozyWorld, order: CozyOrder, target: CozyCoord, cargo?: Partial<CozyResources>) {
  const home = state.cities.find(city=>city.capital) ?? state.cities[0];
  if (!home) return;
  const at = order.arrivesAt;
  const returning = {...order,id:nextId(state,"return"),createdAt:at,q:home.q,r:home.r,returning:true,
    conquest:false,arrivesAt:at+(order.returnTravelMs??travelMs(state,world,target)),...(cargo?{cargo}:{})};
  delete returning.heroId;
  state.orders.push(returning);
}

function resolveOrder(
  state: CozyState,
  shared: CozyShared,
  world: CozyWorld,
  order: CozyOrder,
) {
  const at = order.arrivesAt;
  if(order.miniMission){
    const mission=order.miniMission;
    const power=armyPower(state);
    const won=combatAssessment(power,mission.enemyPower).attackWins;
    const losses=loseTroops(state,won?.06:.2);
    if(won)for(const resource of ['gold','materials','supplies'] as const)
      state.resources[resource]+=mission.reward[resource];
    const reward=won?`Recompensa: ${mission.reward.gold} ouro, ${mission.reward.materials} materiais e ${mission.reward.supplies} suprimentos.`:'Sem recompensa desta vez.';
    const receipt=report(state,at,'combat',won?`${mission.title}: vitória`:`${mission.title}: retirada`,
      `${power} de poder contra ${mission.enemyPower} de ${mission.enemy}. ${losses} tropas perdidas. ${reward} O exército voltou ao reino.`,won);
    receipt.miniMission={title:mission.title,won};
    return;
  }
  if(order.riteExpedition){
    const power=armyPower(state);
    const won=combatAssessment(power,RITE.expedition.enemyPower).attackWins;
    const losses=loseTroops(state,won?.06:.2);
    if(won)(state.ascensionProofs??={}).expedition=at;
    report(state,at,"combat",won?"Caminho da Travessia aberto":"Guardiões do Rito resistiram",
      `${power} de poder contra ${RITE.expedition.enemyPower} dos guardiões. ${losses} baixas. O exército voltou ao reino.`,won);
    return;
  }
  if (order.tradeRoute) {
    const gold = order.cargo?.gold ?? 0;
    state.resources.gold += gold;
    report(state, at, "economy", "Caravana comercial voltou", `+${gold} de ouro no tesouro.`);
    return;
  }
  if(order.returning){
    for(const resource of ['gold','materials','supplies'] as const)state.resources[resource]+=order.cargo?.[resource]??0;
    report(state,at,'combat','Expedição retornou',`A investida foi concluída. ${order.cargo?.gold??0} de ouro e ${order.cargo?.materials??0} materiais foram entregues. Uma nova investida está disponível.`);return;
  }
  if (order.kind === "upgrade") {
    const city = state.cities.find((item) => item.id === order.cityId);
    if (city && order.sector) {
      city.sectors[order.sector] = Math.min(10, city.sectors[order.sector] + 1);
      if(order.sector==='society'&&state.progression)state.progression.council.careSince[`${city.q},${city.r}`]??=getCozyDay(world,at);
      const receipt = report(
        state,
        at,
        "progress",
        "Setor concluído",
        `${SECTORS.find((item) => item.id === order.sector)!.name} de ${city.name} chegou ao nível ${city.sectors[order.sector]}.`,
        true,
        world.persistent ? {q:city.q,r:city.r} : undefined,
      );
      if(world.persistent) receipt.completedWork={cityId:city.id,cityName:city.name};
    }
    return;
  }
  if (order.kind === "research" && order.research) {
    state.research[order.research] = Math.min(
      5,
      state.research[order.research] + 1,
    );
    report(
      state,
      at,
      "progress",
      "Pesquisa concluída",
      `${RESEARCHES.find((item) => item.id === order.research)!.name}: nível ${state.research[order.research]}.`,
    );
    return;
  }
  if (order.kind === "portal") {
    // Historical travel orders no longer gate victory.
    recordInfluenceVictory(state, world, at);
    return;
  }
  if (order.kind === "explore" && order.sanctuaryId) {
    const tower=ALL_SANCTUARIES.find(t=>t.id===order.sanctuaryId);
    if(tower && state.sanctuaryVisits?.[tower.id]===undefined){
      (state.sanctuaryVisits??={})[tower.id]=at;
      report(state,at,"exploration","Torre reconhecida",`${tower.name} foi reconhecido pela expedição do reino. O registro não concede influência nem conta como levantamento de recursos ou missão de exploração.`);
    }
    return;
  }
  if(order.kind==="attack"&&order.sanctuaryPactId){
    const pact=shared.sanctuaryPacts?.find(p=>p.id===order.sanctuaryPactId),attempt=pact?.guardian?.attempts.find(a=>a.orderId===order.id&&a.playerId===state.playerId);
    if(!pact?.guardian||!attempt||attempt.outcome)return;
    attempt.at=at;
    if(pact.canceledAt!==undefined||pact.completedAt!==null||!canUsePact(state,shared,pact)){
      attempt.outcome="canceled";attempt.losses=0;
      report(state,at,"combat","Desafio da torre encerrado","O pacto foi encerrado ou o reino deixou a aliança. Não houve confronto nem perdas; o envio da expedição já havia sido utilizado.",false);return;
    }
    const power=armyPower(state),won=combatAssessment(power,pact.guardian.power).attackWins;
    const losses=loseTroops(state,won?.06:.2);
    attempt.outcome=won?"won":"lost";attempt.attackPower=power;attempt.losses=losses;
    if(won)activateSanctuaryPact(pact,at,dayMs(world),endAt(world)??Infinity,waveDays(world).map((day,index)=>({day,arrivesAt:arrivalForDay(world,day),power:WAVE_POWER[index]})));
    report(state,at,"combat",won?"Guardiões da torre superados":"Guardiões repeliram a expedição",`${power} de poder contra ${pact.guardian.power}. ${losses} tropas perdidas. ${won?"A sintonia foi ativada; o benefício começa nesta chegada.":"As reservas do pacto permanecem disponíveis para outra tentativa ou cancelamento."} Este confronto não causa dano às cidades e não gera saque, missão ou influência por vitória.`,won);
    return;
  }
  if (order.kind === "collect") {
    if (order.collectResource && order.collectAmount) {
      state.resources[order.collectResource] += order.collectAmount;
      state.cooperation += 1;
      if(state.progression){const area=resourceArea(shared,{q:order.q!,r:order.r!},order.collectResource);const id=area?.id??`${order.collectResource}:${order.q},${order.r}`;state.progression.feats.collected[id]=(state.progression.feats.collected[id]??0)+order.collectAmount;}
      report(
        state,
        at,
        "economy",
        "Coleta recebida",
        `${order.collectAmount} de ${order.collectResource === "gold" ? "ouro" : "materiais"} chegaram ao reino. A reserva já havia sido separada no depósito compartilhado.`,
      );
    }
    return;
  }
  const coord = { q: order.q!, r: order.r! };
  const id = key(coord);
  const base = baseTile(world, coord, shared);
  if (order.kind === "explore") {
    if(order.explorationPath)state.scoutedCells=[...new Set([...(state.scoutedCells??[]),...explorationCorridor(order.explorationPath,worldDiagonalLimit(state,shared))])].sort();
    const first = !state.explored.includes(id);
    if (first) state.explored.push(id);
    if(shared.claims[id]){report(state,at,"exploration","Cidade de outro reino reconhecida",`${shared.claims[id].name} foi localizada. Reconhecer não altera a posse e não concede reservas de NPC.`,true,coord);return;}
    let detail = base.clue;
    if (base.kind === "gold" || base.kind === "materials") {
      let area = resourceArea(shared,coord,base.kind);
      if(!area){
        const capacity=(base.kind === "gold" ? 1600 : 6000)+(hash(`${world.id}:deposit:${id}`)%(base.kind === "gold" ? 1800 : 6000));
        area=discoverResourceArea(shared,coord,{id,resource:base.kind,capacity,remaining:capacity,surveys:0,contributors:[]},world.economyVersion===3);
      }
      const deposit=area.reserve;
      const priorSurveys=deposit.surveys;
      deposit.surveys=world.economyVersion===3?3:Math.min(3,deposit.surveys+1);
      if(state.progression&&deposit.surveys>priorSurveys){const step=`${area.id}:${deposit.surveys}`;if(!state.progression.feats.surveys.includes(step))state.progression.feats.surveys.push(step);}
      if(!deposit.contributors.includes(state.playerId))deposit.contributors.push(state.playerId);
      shared.deposits[id]={...deposit,id};
      syncAreaDeposits(shared,area);
      state.cooperation += 1;
      detail = `Levantamento da área ${deposit.surveys}/3. ${deposit.surveys === 3 ? "O levantamento terminou. Anexar ocupa a área inteira; explorar não muda o dono." : "Mais uma exploração avança o levantamento; qualquer jogador pode ajudar."}`;
    } else if (first && (base.kind === "ruin" || base.kind === "abandoned")) {
      const gold = 80 + (hash(`${world.id}:discovery:${id}`) % 121);
      state.resources.gold += gold;
      detail = `${base.kind === "ruin" ? "Uma antiga reserva foi encontrada." : "Os moradores deixaram uma pequena reserva."} +${gold} de ouro.`;
    }
    report(state, at, "exploration", `${base.name} revelado`, detail, true, coord);
    return;
  }
  if (order.kind === "attack") {
    if (!state.explored.includes(id)) state.explored.push(id);
    if(order.foundation){
      const hero=state.heroes.find(h=>h.id===order.heroId&&h.cityId===null);
      if(base.kind!=="plain"||foundationSite(state,shared,coord)||!hero){state.resources.materials+=order.foundationMaterials??CITY_FOUNDATION_COST.materials;report(state,at,"progress","Fundação interrompida","O local ou o herói ficou indisponível. Os materiais de construção foram devolvidos; os suprimentos da expedição foram gastos.",false);return;}
      establishCity(state,shared,world,coord,hero.id,at,true);
      if (!world.persistent) report(state,at,"progress","Nova cidade fundada","A cidade começa com os cinco setores no nível zero. Escolha seu tipo e desenvolva as construções.");
      return;
    }
    if (shared.claims[id]) {
      if (world.persistent && !order.conquest) returnNpcExpedition(state,world,order,coord);
      report(
        state,
        at,
        "combat",
        "Investida encerrada em paz",
        "O local agora pertence a um jogador. Não há combate entre reinos.",
        false,
      );
      return;
    }
    const owner=shared.territories?.[id];
    if(order.conquest&&((order.areaRules&&sanctuaryAt(coord))||(owner&&owner!==state.playerId&&!areaAllied(shared,owner,state.playerId)))){
      report(state,at,"combat","Ocupação interrompida","O destino está reservado ou pertence a outro império. O herói permanece disponível.",false);
      return;
    }
    if(order.occupationOnly){
      const hero=state.heroes.find(h=>h.id===order.heroId&&h.cityId===null);
      if(!npcOccupation(base.power,shared.npcResistance?.[id]?.initial??base.power).canAnnex||!hero||state.cities.length>=10){report(state,at,"combat","Anexação interrompida","A cidade voltou a ter resistência, o herói ficou indisponível ou o limite de cidades foi atingido.",false);return;}
      establishCity(state,shared,world,coord,hero.id,at);return;
    }
    const power = armyPower(state);
    const won = combatAssessment(power,base.power).attackWins;
    if(world.economyVersion===3&&!order.conquest){
      const initial=shared.npcResistance?.[id]?.initial??base.power;
      const camp = world.persistent && base.kind==="npc" && !shared.independentCities?.[id];
      const alreadyBeaten = camp ? base.power===0 : npcOccupation(base.power,initial).canAnnex;
      if (world.persistent && alreadyBeaten) {
        returnNpcExpedition(state,world,order,coord);
        report(state,at,"combat","Alvo já vencido","A expedição encontrou o local sem resistência e iniciou o retorno.",false,coord);
        return;
      }
      const losses=loseTroops(state,won?.06:.2);
      const remaining=won?0:Math.max(1,base.power-Math.max(1,Math.floor(power*.35)));
      (shared.npcResistance??={})[id]={initial,remaining,at};state.raided[id]=at;
      returnNpcExpedition(state,world,order,coord,won?{gold:100+Math.floor(initial*.6),materials:100+initial}:undefined);
      const points = world.persistent && won ? recordFrontierVictory(state,id) : 0;
      const merit = points ? ` +${points} de influência militar pelo novo alvo vencido.` : "";
      if (camp) {
        report(state,at,"combat",won?"Acampamento vencido":"Resistência enfraquecida",
          `${power} de poder contra ${base.power}. ${losses} tropas perdidas. ${won?"O saque chega com o retorno.":"A defesa restante diminuiu."}${merit}`,won,coord);
        return;
      }
      const occupation=npcOccupation(remaining,initial);
      report(state,at,"combat",occupation.canAnnex?"Cidade pronta para anexar":"Resistência enfraquecida",`${power} de poder contra ${base.power}. ${losses} tropas perdidas. Controle: ${Math.ceil(occupation.control)}%. Anexação liberada em ${occupation.threshold}% ou menos. ${occupation.canAnnex?"Envie um herói disponível para anexar; a cidade ainda não pertence ao reino.":"Reforce as tropas e ataque novamente."}${merit}`,won,coord);
      return;
    }
    const losses =
      base.kind === "abandoned" ? 0 : loseTroops(state, won ? 0.06 : 0.2);
    state.raided[id] = at;
    if (!won) {
      report(
        state,
        at,
        "combat",
        "Investida repelida",
        `${power} de poder contra ${base.power}. ${losses} tropas perdidas. O exército continua protegendo o reino.`,
        false,
      );
      return;
    }
    if (order.conquest) {
      if (!combatAssessment(power,base.power).occupationMargin) {
        report(
          state,
          at,
          "combat",
          "Vitória sem ocupação",
          `O combate foi vencido, mas faltou a margem de 25% de poder para ocupar. ${losses} tropas perdidas. Seu herói segue disponível.`,
          false,
        );
        return;
      }
      establishCity(state, shared, world, coord, order.heroId!, at);
    } else {
      const gold = 100 + Math.floor(base.power * 0.6);
      const materials = 100 + base.power;
      state.resources.gold += gold;
      state.resources.materials += materials;
      report(
        state,
        at,
        "combat",
        "Saque concluído",
        `${gold} de ouro e ${materials} materiais recuperados. ${losses} tropas perdidas. O local poderá ser saqueado novamente em seis dias de jogo.`,
      );
    }
  }
}
/** Keep the persisted timestamp key compatible with historical saves and rankings. */
function recordInfluenceVictory(state: CozyState, world: CozyWorld, at: number) {
  if (world.persistent) {
    state.peakInfluence = Math.max(state.peakInfluence ?? 0, influence(state).total);
    return;
  }
  if (state.portalCrossedAt !== null || influence(state).total < 1500) return;
  state.portalCrossedAt = at;
  report(state, at, "portal", "Selo de Vitória conquistado",
    "Seu reino alcançou 1.500 de Influência. O selo está registrado; a temporada continua até o ranking final.");
}
/** Settles in chronological order: production, completions, then hordes at equal times. */
export function settleCozyState(
  input: CozyState,
  sharedInput: CozyShared,
  world: CozyWorld,
  now: number,
  options?:{deferWorldEventsAt:number},
): { state: CozyState; shared: CozyShared } {
  rule(Number.isFinite(now) && now >= 0, "Horário inválido.");
  const state = clone(input),
    shared = clone(sharedInput);
  if (state.ascension) return {state,shared};
  if (state.founding) {
    state.settledAt = Math.max(state.settledAt, Math.min(now, endAt(world) ?? now));
    return { state, shared };
  }
  if(state.defeat){
    const ends=endAt(world),until=ends===null?now:Math.min(now,ends);
    state.settledAt=Math.max(state.settledAt,until);
    syncAllianceProjects(state,shared,until,(title,body)=>report(state,until,"alliance",title,body));
    syncSanctuaryPacts(state,shared,until,(title,body)=>report(state,until,"economy",title,body));
    if(ends!==null&&(now>=ends||world.status==='finalized')){state.finalizedAt=ends;state.finalScore=0;state.seasonXp=0;}
    return {state,shared};
  }
  state.citySystemsAt??=now;
  restoreAbstractArmy(state);
  ensureCapitalClaim(state, shared);
  retargetArmyReturns(state);
  migrateResourceAreas(shared);
  if (world.persistent) prepareFrontierProgress(state,shared);
  for(const city of state.cities){city.life??={contentment:state.satisfaction,lastDecisionDay:null};city.life.lastSocialDay??=getCozyDay(world,Math.min(now,endAt(world)??now));city.life.unrestDays??=0;}
  if (state.finalizedAt !== null) return { state, shared };
  bindCityTerritories(state,shared);
  syncAllianceProjects(state,shared,state.settledAt,(title,body)=>report(state,state.settledAt,"alliance",title,body));
  syncSanctuaryPacts(state,shared,state.settledAt,(title,body,refund)=>report(state,state.settledAt,refund?"economy":"progress",title,body));
  syncSanctuaryRaidReports(state,shared,state.settledAt,(at,title,body,positive)=>report(state,at,"combat",title,body,positive));
  const endsAt = endAt(world);
  if (world.startsAt === null || world.status === "open") {
    state.settledAt = Math.max(state.settledAt, now);
    return { state, shared };
  }
  const until = Math.max(state.settledAt, Math.min(now, endsAt ?? now));
  if (endsAt !== null && until >= endsAt) cancelUnfinishedPacts(shared, endsAt);
  const events: {
    at: number;
    kind: "order" | "planStart" | "tower" | "horde" | "social" | "alliance";
    order?: CozyOrder;
    day?: number;
  }[] = state.orders
    .filter((order) => order.arrivesAt <= until && (endsAt === null || order.arrivesAt <= endsAt))
    .map((order) => ({ at: order.arrivesAt, kind: "order", order }));
  for(const order of state.orders)if(order.planned&&!order.planned.started&&order.planned.startsAt<=until)
    events.push({at:order.planned.startsAt,kind:'planStart',order});
  waveDays(world).forEach((day) => {
    const at = arrivalForDay(world, day);
    if (
      !state.hordesResolved.includes(day) &&
      at <= until &&
      at >= state.createdAt
    )
      events.push({ at, kind: "horde", day });
  });
  const socialFrom=Math.max(1,Math.min(...state.cities.map(c=>c.life!.lastSocialDay??1)));
  if (!world.persistent) {
    for(let day=socialFrom+1;day<=Math.min(seasonDays(world),getCozyDay(world,until));day++){const at=arrivalForDay(world,day);if(at>=state.createdAt)events.push({at,kind:"social",day});}
  }
  for(const project of shared.allianceProjects??[]){const at=project.completedAt??project.canceledAt;if(at!==undefined&&at!==null&&at>state.settledAt&&at<=until)events.push({at,kind:"alliance"});}
  for(const pact of shared.sanctuaryPacts??[]){const at=pact.completedAt??pact.canceledAt;if(at!==undefined&&at!==null&&at>state.settledAt&&at<=until)events.push({at,kind:"alliance"});}
  const towerBoundaries=new Set((shared.sanctuaryPacts??[]).flatMap(p=>(p.raids?.waves??[]).map(w=>w.arrivesAt)));
  for(const at of towerBoundaries)if(at>state.settledAt&&at<=until)events.push({at,kind:"tower"});
  if(options)for(let i=events.length-1;i>=0;i--)if(events[i].at===options.deferWorldEventsAt&&(events[i].kind==="horde"||events[i].kind==="social"))events.splice(i,1);
  events.sort((a, b) => a.at - b.at || ({order:0,planStart:1,tower:2,alliance:3,horde:4,social:5}[a.kind]-{order:0,planStart:1,tower:2,alliance:3,horde:4,social:5}[b.kind]));
  let cursor = Math.max(state.settledAt, world.startsAt);
  const renewAt = (at: number) => {
    if (world.persistent) renewFrontier(shared, at, dayMs(world), id => baseTile(world, fromKey(id), shared).kind === "npc");
  };
  if (until >= cursor) recordInfluenceVictory(state, world, cursor);
  for (const event of events) {
    renewAt(event.at);
    accrue(state, world, cursor, event.at);
    cursor = Math.max(cursor, event.at);
    if(event.kind==='planStart'&&event.order){
      const order=state.orders.find(o=>o.id===event.order!.id);
      if(order?.planned){
        const level=order.kind==='research'?state.research[order.research!]:state.cities.find(c=>c.id===order.cityId)?.sectors[order.sector!];
        const target = order.kind==="explore" && order.q!==undefined && order.r!==undefined ? key({q:order.q,r:order.r}) : null;
        const origin = order.explorationPath?.[0];
        const canExplore = target!==null && !state.explored.includes(target) && shared.claims[target]?.playerId!==state.playerId &&
          origin && state.cities.some(city=>city.q===origin.q&&city.r===origin.r);
        if(order.tradeRoute || canExplore || (level!==undefined&&level===order.planned.expectedLevel))order.planned.started=true;
        else if(order.kind==="explore"){
          state.resources.supplies+=order.planned.cost.supplies??0;
          state.orders=state.orders.filter(item=>item.id!==order.id);
          report(state,event.at,'economy','Exploração cancelada','A origem ou o destino mudou. Os suprimentos reservados voltaram ao tesouro.',false);
        }
        else {
          cancelPlans(state,order);
          report(state,event.at,'economy','Fila interrompida','O destino ou nível previsto mudou. As reservas dos planos que não começaram foram devolvidas.',false);
        }
      }
    } else if(event.kind==="social"){
      for(const city of [...state.cities]){
        if((city.life!.lastSocialDay??0)>=event.day!)continue;
        city.life!.lastSocialDay=event.day!;
        recordStableAdministration(state,city,event.day!);
        if(city.life!.contentment>=35){if(city.life!.unrestDays)report(state,event.at,"council",`${city.name}: crise interrompida`,"A confiança voltou ao patamar necessário. A contagem de ruptura foi encerrada.");city.life!.unrestDays=0;continue;}
        city.life!.unrestDays=(city.life!.unrestDays??0)+1;
        const days=city.life!.unrestDays;
        if(days===1||days===3||days===6)report(state,event.at,"council",`${city.name}: ${days>=3?"movimento separatista":"crise social"}`,`Satisfação local em ${city.life!.contentment}%. ${!city.capital&&state.cities.length>1?`Restam ${SOCIAL_RUPTURE_DAYS-days} dias de jogo antes de uma possível separação.`:"Sua última cidade exige recuperação urgente."} Responda às decisões da cidade.`,false);
        if(days>=SOCIAL_RUPTURE_DAYS&&releaseCity(state,shared,city,event.at,"separation"))report(state,event.at,"council",`${city.name} se tornou independente`,"A crise persistiu sem recuperação. A cidade e sua região ficaram independentes. O herói retornou; produção e acesso às reservas vinculadas deixaram o império. Na reconquista, só os terrenos ainda livres retornam.",false);
      }
    } else if(event.kind==="tower")resolveSanctuaryRaids(shared,event.at);
    else if (event.order) {
      if(event.order.targetPlayerId)continue; // Shared battle resolves with both players after this boundary.
      if(!state.orders.some(o=>o.id===event.order!.id))continue;
      state.orders = state.orders.filter(
        (order) => order.id !== event.order!.id,
      );
      resolveOrder(state, shared, world, event.order);
    } else if (event.kind === "horde") {
      if (world.persistent) {
        state.hordesResolved.push(event.day!);
        state.pendingDefenseDay ??= event.day!;
      } else resolveHorde(state, shared, world, event.day!, event.at);
    }
    if (world.persistent) settlePeacefulDefense(state, shared, world, event.at);
    syncAllianceProjects(state,shared,event.at,(title,body)=>report(state,event.at,"alliance",title,body));
  syncSanctuaryPacts(state,shared,event.at,(title,body,refund)=>report(state,event.at,refund?"economy":"progress",title,body));
  syncSanctuaryRaidReports(state,shared,event.at,(at,title,body,positive)=>report(state,at,"combat",title,body,positive));
    recognizeSupport(state,shared,event.at);
    recordInfluenceVictory(state, world, event.at);
  }
  retargetArmyReturns(state);
  accrue(state, world, cursor, until);
  renewAt(until);
  syncAllianceProjects(state,shared,until,(title,body)=>report(state,until,"alliance",title,body));
  syncSanctuaryPacts(state,shared,until,(title,body,refund)=>report(state,until,refund?"economy":"progress",title,body));
  syncSanctuaryRaidReports(state,shared,until,(at,title,body,positive)=>report(state,at,"combat",title,body,positive));
  recognizeSupport(state,shared,until);
  if (until >= world.startsAt) recordInfluenceVictory(state, world, until);
  const previousDay = getCozyDay(world, state.settledAt);
  state.settledAt = until;
  const currentDay = getCozyDay(world, until);
  if (!world.persistent && currentDay > previousDay && endsAt !== null && until < endsAt)
    report(
      state,
      until,
      "economy",
      `Relatório do dia ${currentDay}`,
      `Seu reino continuou produzindo durante sua ausência. ${state.cities.length} cidades, ${influence(state).total} de Influência e ${state.orders.length} ações em andamento.`,
    );
  if (endsAt !== null && (now >= endsAt || world.status === "finalized") && options?.deferWorldEventsAt!==until) {
    if(state.progression)state.progression.mobileReviewRules=true;
    state.finalizedAt = Math.min(now, endsAt!);
    state.finalScore = influence(state).total;
    state.seasonXp = 0; // Legacy field: king XP is earned during gameplay, never as a season payout.
    for(const order of state.orders)if(order.planned&&!order.planned.started)
      for(const resource of ['gold','materials','supplies'] as const)state.resources[resource]+=order.planned.cost[resource]??0;
    state.orders = [];
    report(
      state,
      state.finalizedAt,
      "season",
      "A temporada chegou ao fim",
      `${state.finalScore} de Influência final. ${state.portalCrossedAt !== null ? "O Selo de Vitória está garantido." : "A história do reino foi preservada."}`,
    );
  }
  syncDecisionInbox(state,shared,world,until);
  return { state, shared };
}
function cancelPlans(state:CozyState,target:CozyOrder){
 const startsAt = target.planned!.startsAt;
 const canceled=state.orders.filter(o=>o.planned&&!o.planned.started&&o.kind===target.kind&&o.tradeRoute===target.tradeRoute&&
   (o.kind!=='upgrade'||o.cityId===target.cityId)&&o.planned.startsAt>=startsAt);
 if (target.tradeRoute) state.nextTradeAt=startsAt;
 for(const o of canceled)for(const resource of ['gold','materials','supplies'] as const)state.resources[resource]+=o.planned!.cost[resource]??0;
 state.orders=state.orders.filter(o=>!canceled.includes(o));
}

/** Finalize a settled reign after the server has approved its rite. This is not a player command. */
export function archiveCozyReign(input:CozyState,sharedInput:CozyShared,world:CozyWorld,confirmation:CozyAscensionConfirmation,now:number){
  rule(world.persistent&&world.status==="running"&&input.settledAt===now&&input.finalizedAt===null&&
    !input.founding&&!input.defeat&&input.king?.alive&&input.cities.length,"O reinado não pode ser arquivado agora.");
  const standing=ascensionStanding(influence(input).total,input.peakInfluence);
  rule(standing.current>=ASCENSION_MINIMUM,"A Ascensão exige 1.500 de Influência atual.");
  rule(standing.medal.id===confirmation.medal,"A medalha mudou. Reveja a prévia.");

  const state=clone(input),shared=clone(sharedInput),id=state.playerId;
  if(shared.alliances.some(group=>group.id===state.allianceId&&group.members.includes(id)))
    applyAllianceAction(state,shared,{type:"alliance_leave"},now,dayMs(world),prefix=>nextId(state,prefix));
  state.allianceId=null;
  for(const group of shared.alliances){
    if(group.requests)group.requests=group.requests.filter(player=>player!==id);
    if(group.invitations)group.invitations=group.invitations.filter(player=>player!==id);
    if(group.requestEvents)delete group.requestEvents[id];
    if(group.invitationEvents)delete group.invitationEvents[id];
  }
  shared.support=shared.support.filter(support=>support.resolvedAt!==undefined||
    (support.requesterId!==id&&support.supporterId!==id));
  cancelOrphanedPacts(shared,now);
  for(const pact of shared.sanctuaryPacts??[]){
    if(!pact.allianceId&&pact.ownerPlayerId===id&&pact.canceledAt===undefined){
      if(pact.completedAt===null)pact.canceledAt=now;
      else pact.endedAt=Math.min(pact.endedAt??now,now);
    }
    for(const wave of pact.raids?.waves??[])
      if(!wave.outcome)wave.defenders=wave.defenders.filter(defender=>defender.playerId!==id);
    for(const attempt of pact.guardian?.attempts??[])
      if(attempt.playerId===id&&!attempt.outcome){attempt.outcome="canceled";attempt.at=now;}
  }

  for(const order of state.orders){
    if(order.kind!=="collect"||order.tradeRoute||!order.collectResource||
      !order.collectAmount||order.q===undefined||order.r===undefined)continue;
    const area=resourceArea(shared,{q:order.q,r:order.r},order.collectResource);
    if(!area)continue;
    area.reserve.remaining=Math.min(area.reserve.capacity,area.reserve.remaining+order.collectAmount);
    if(shared.depletedAreas)delete shared.depletedAreas[area.id];
    syncAreaDeposits(shared,area);
  }
  for(const [cell,claim] of Object.entries(shared.claims))if(claim.playerId===id)delete shared.claims[cell];
  for(const [cell,owner] of Object.entries(shared.territories??{}))if(owner===id)delete shared.territories![cell];
  for(const [cell,ownership] of Object.entries(shared.territoryCities??{}))if(ownership.playerId===id)delete shared.territoryCities![cell];
  for(const area of Object.values(shared.areas??{})){
    if(area.owners.includes(id))area.owners=area.owners.filter(owner=>owner!==id);
    if(area.ownerCities)delete area.ownerCities[id];
  }
  if(shared.realmCrests)delete shared.realmCrests[id];
  state.army=empireArmy(state);
  state.orders=[];
  state.peakInfluence=standing.peak;
  state.finalScore=standing.current;
  if(state.progression)state.progression.mobileReviewRules=true;
  state.finalizedAt=now;
  state.ascension=structuredClone(confirmation);
  report(state,now,"progress","Reinado arquivado","Sua medalha e o recibo estão no Legado.");
  return {state,shared,influence:standing.current};
}
// Existing possessions, surveys and journeys outside the new diagonal retain access.
export function worldDiagonalLimit(state:CozyState,shared:CozyShared):number {
  let limit=40;
  for(const id of [...Object.keys(shared.claims),...Object.keys(shared.territories??{}),...Object.keys(shared.independentCities??{}),...Object.keys(shared.deposits),...state.explored,...(state.scoutedCells??[])]){
    const [q,r]=id.split(',').map(Number);
    if(Number.isFinite(q+r))limit=Math.max(limit,Math.abs(q+r));
  }
  for(const cell of [...state.cities,...state.orders]){
    if(cell.q!==undefined&&cell.r!==undefined)limit=Math.max(limit,Math.abs(cell.q+cell.r));
  }
  return Math.min(80,limit);
}
function validateCoord(action: { q: unknown; r: unknown },state:CozyState,shared:CozyShared): CozyCoord {
  rule(
    Number.isInteger(action.q) &&
      Number.isInteger(action.r) &&
      Math.abs(Number(action.q)) <= 40 &&
      Math.abs(Number(action.r)) <= 40 && Math.abs(Number(action.q)+Number(action.r)) <= worldDiagonalLimit(state,shared),
    "Escolha um ponto válido do mapa.",
  );
  return { q: Number(action.q), r: Number(action.r) };
}
function validateFreeHero(state: CozyState, heroId: unknown) {
  const hero = state.heroes.find(
    (item) => item.id === heroId && item.cityId === null,
  );
  rule(hero, "Escolha um herói já comprado e disponível na pool.");
  rule(
    !state.orders.some((order) => order.heroId === hero.id),
    "Esse herói já está reservado para outra conquista.",
  );
  return hero;
}
function currentAlliance(state: CozyState, shared: CozyShared) {
  const alliance = shared.alliances.find(
    (item) =>
      item.id === state.allianceId && item.members.includes(state.playerId),
  );
  rule(alliance, "Entre em uma aliança para cooperar.");
  return alliance;
}
/** The server commits both drafts under the same world revision and command receipt. */
export function transferAllianceGift(
  sender: CozyState,
  recipient: CozyState,
  shared: CozyShared,
  world: CozyWorld,
  action: Extract<CozyAction,{type:"alliance_gift"}>,
  now: number,
) {
  const day = getCozyDay(world,now);
  rule(world.persistent && world.status==="running" && day>0,"Presentes estão disponíveis no Cozy persistente.");
  rule(action.day===day,"Virou o dia de jogo. Confira a cota e confirme o presente de novo.");
  rule(sender.playerId!==recipient.playerId && action.recipientId===recipient.playerId &&
    canReceiveAllianceGift(sender) && canReceiveAllianceGift(recipient),"Escolha um reino ativo para receber o presente.");
  const alliance = currentAlliance(sender,shared);
  rule(action.allianceId===alliance.id && recipient.allianceId===alliance.id &&
    alliance.members.includes(recipient.playerId),"Só é possível presentear membros da sua aliança.");
  rule(action.resource==="materials" || action.resource==="supplies","Escolha materiais ou suprimentos.");
  rule(ALLIANCE_GIFT_PACKS.some(amount=>amount===action.amount),"Escolha um dos pacotes de presente.");
  const sent = allianceGiftUsage(sender,day);
  const received = allianceGiftUsage(recipient,day);
  rule(!sent.sentTo.includes(recipient.playerId),"Você já enviou um presente para este aliado hoje.");
  rule(received.received<ALLIANCE_GIFT_RECEIVE_LIMIT,"Este aliado já recebeu três presentes neste dia de jogo.");
  resourceSpend(sender,{[action.resource]:action.amount});
  recipient.resources[action.resource] += action.amount;
  sender.allianceGiftDay = {...sent,sentTo:[...sent.sentTo,recipient.playerId]};
  recipient.allianceGiftDay = {...received,received:received.received+1};
  const {resource,amount} = action;
  const label = ALLIANCE_GIFT_RESOURCES[resource];
  report(sender,now,"alliance","Presente entregue",`Você enviou ${amount} de ${label} para ${recipient.playerName}.`)
    .allianceGift = {direction:"sent",resource,amount,otherPlayerName:recipient.playerName};
  report(recipient,now,"alliance","Presente recebido",`${sender.playerName} enviou ${amount} de ${label} para seu tesouro.`)
    .allianceGift = {direction:"received",resource,amount,otherPlayerName:sender.playerName};
}
function addOrder(
  state: CozyState,
  world: CozyWorld,
  now: number,
  order: Omit<CozyOrder, "id" | "createdAt">,
) {
  rule(
    order.arrivesAt <= (endAt(world) ?? Infinity),
    "Não há tempo para concluir essa ação antes do fim da temporada.",
  );
  const pending={ ...order, id: nextId(state, "order"), createdAt: now };
  state.orders.push(pending);
  return pending;
}
export function nextCityDayAt(state:CozyState,world:CozyWorld){
 if(world.persistent)return null;
 if(world.startsAt===null||world.status!=="running"||state.finalizedAt!==null||state.defeat)return null;
 const days=state.cities.flatMap(city=>city.life?.lastSocialDay!==undefined?[city.life.lastSocialDay]:[]);
 if(!days.length)return null;
 const next=Math.max(1,Math.min(...days))+1;if(next>seasonDays(world))return null;
 return arrivalForDay(world,next);
}
export function applyCozyAction(
  input: CozyState,
  sharedInput: CozyShared,
  world: CozyWorld,
  action: CozyAction,
  now: number,
): { state: CozyState; shared: CozyShared } {
  rule(
    action && typeof action === "object" && typeof action.type === "string",
    "Ação inválida.",
  );
  const { state, shared } = settleCozyState(input, sharedInput, world, now);
  const computed = getCozyComputed(state, shared, world, now);
  if (action.type === "read_reports") {
    state.readAt = now;
    return { state, shared };
  }
  if (action.type === "notice_seen") {
    rule(world.persistent && typeof action.id === "string" && action.id.length <= 512, "Novidade inválida.");
    const active = new Set(activeNoticeIds(state,shared,computed,now));
    const seen = new Set((state.seenNotices ?? []).filter(id => active.has(id)));
    if (active.has(action.id)) seen.add(action.id);
    state.seenNotices = [...seen];
    return { state, shared };
  }
  const preparing = Boolean(state.founding) &&
    (action.type === "king_choose" || action.type === "counselor" || action.type === "hire" || action.type === "found_capital");
  const signingWelcome = action.type === "decree" && action.decreeId === state.firstAudience?.id;
  if (state.founding) rule(preparing, "Funde sua capital antes desta ação.");
  if(action.type!=="king_choose" && !preparing && !signingWelcome)rule(
    computed.started && !computed.readOnly,
    computed.readOnly
      ? "Esta temporada já terminou."
      : "Aguarde o início da temporada.",
  );
  if(action.type==="king_choose" || preparing || signingWelcome)rule(!computed.readOnly,"Esta temporada já terminou.");
  rule(!state.defeat,"Seu império foi derrotado. Você ainda pode acompanhar os relatos e o resultado.");
  switch (action.type) {
    case 'mini_mission': {
      const offer=miniMissionOffer(state,world,now);
      rule(offer && typeof action.id==='string' && action.id===offer.id && typeof action.accept==='boolean',
        'Este encontro já terminou ou não está mais disponível.');
      if(action.accept){
        rule(!state.orders.some(order=>order.kind==='attack'),'Aguarde o retorno do exército.');
        rule(computed.armyPower>0,'Recrute tropas antes de partir.');
        resourceSpend(state,{supplies:offer.suppliesCost});
        addOrder(state,world,now,{kind:'attack',miniMission:{title:offer.title,enemy:offer.enemy,
          enemyPower:offer.enemyPower,reward:{...offer.reward}},arrivesAt:now+Math.round(computed.dayMs*.5)});
      }
      state.lastMiniMissionCycle=offer.cycle;
      break;
    }
    case "rite_provisions":
    case "rite_expedition":
    case "rite_council":
    case "ascend": {
      rule(world.persistent&&riteAvailable(state,computed.influence.total),
        "O Rito exige um reinado ativo com pelo menos 1.500 de Influência.");
      const proofs=completedAscensionProofs(state);
      if(action.type==="ascend"){
        rule(proofs.length>=ASCENSION_PROOFS_REQUIRED,"Conclua duas provas da Travessia.");
        rule(!state.orders.some(order=>order.riteExpedition),"Aguarde o retorno da expedição do Rito.");
        const confirmation=action.confirmation;
        const maximumGems=ascensionRewardAmounts(world.mode,true).totalGems;
        rule(confirmation&&typeof confirmation==="object"&&
          (confirmation.equipmentId===null||(typeof confirmation.equipmentId==="string"&&/^item-[a-z0-9-]+$/.test(confirmation.equipmentId)))&&
          Number.isInteger(confirmation.creditedGems)&&confirmation.creditedGems>=0&&
          Number.isInteger(confirmation.refundOffset)&&confirmation.refundOffset>=0&&
          confirmation.creditedGems+confirmation.refundOffset<=maximumGems,"Confirme as recompensas da prévia.");
        return archiveCozyReign(state,shared,world,{
          medal:confirmation.medal,equipmentId:confirmation.equipmentId,
          creditedGems:confirmation.creditedGems,refundOffset:confirmation.refundOffset,
        },now);
      }
      if(action.type==="rite_provisions"){
        rule(!proofs.includes("provisions"),"As provisões da Travessia já foram preparadas.");
        resourceSpend(state,RITE.provisions);
        (state.ascensionProofs??={}).provisions=now;
        report(state,now,"progress","Provisões da Travessia","O carregamento da Travessia foi preparado.");
      } else if(action.type==="rite_expedition"){
        rule(!proofs.includes("expedition"),"O caminho da Travessia já foi aberto.");
        rule(!state.orders.some(order=>order.kind==="attack"),"Aguarde o retorno do exército.");
        rule(computed.armyPower>0,"Recrute tropas para enfrentar os guardiões.");
        resourceSpend(state,{supplies:RITE.expedition.supplies});
        addOrder(state,world,now,{kind:"attack",riteExpedition:true,
          arrivesAt:now+Math.round(RITE.expedition.days*computed.dayMs)});
      } else {
        rule(!proofs.includes("council"),"O Conselho já concluiu a prova.");
        rule(action.choice==="welcome"||action.choice==="repair","Escolha uma decisão da audiência.");
        const cities=riteCouncilCities(state);
        rule(state.counselors.every(Boolean)&&cities.length,"Reúna os dois conselheiros e uma cidade estável com herói.");
        for(const city of cities){
          if(action.choice==="welcome"){
            city.life??={contentment:state.satisfaction,lastDecisionDay:null};
            city.life.contentment=clamp(city.life.contentment+RITE.council.trustBonus,0,100);
          } else city.integrity=clamp((city.integrity??100)+RITE.council.repair,0,100);
        }
        (state.ascensionProofs??={}).council=now;
        report(state,now,"council","Conselho reunido para a Travessia",
          `${cities.map(city=>city.name).join(", ")} participaram da audiência.`);
      }
      break;
    }
    case "found_capital": {
      rule(world.foundingOnboarding && state.founding, "Sua capital já foi fundada.");
      rule(state.king?.alive && state.counselors.every(Boolean), "Escolha o soberano e os dois conselheiros.");
      const hero = validateFreeHero(state, action.heroId);
      const coord = validateCoord(action, state, shared);
      rule(capitalSites(state, shared, world).some(site => key(site) === key(coord)), "Este terreno mudou. Escolha outro local para a capital.");
      const name = typeof action.name === "string" ? action.name.trim() : "";
      rule(name.length >= 2 && name.length <= 32 && !/[\u0000-\u001f]/.test(name), "Use um nome de cidade entre 2 e 32 caracteres.");
      const day = Math.max(1, computed.day);
      const city: CozyCity = {
        ...coord, id: `${state.playerId}:capital`, name, capital: true, heroId: hero.id, wonder: false,
        sectors: { administration: 0, economy: 0, society: 0, recruitment: 0, defense: 0 },
        life: { contentment: state.satisfaction, lastDecisionDay: null, lastSocialDay: day },
      };
      hero.cityId = city.id;
      state.cities.push(city);
      delete state.founding;
      state.createdAt = now;
      state.citySystemsAt = now;
      state.hordesResolved = waveDays(world).filter(wave => world.startsAt !== null && arrivalForDay(world, wave) < now);
      createProgression(state, armyPower(state) + wallPower(state), false, true);
      ensureCapitalClaim(state, shared);
      state.firstAudience = {
        id: `welcome:${state.playerId}`,
        day: 1 + Math.floor((day - 1) / 3) * 3,
        counselorId: state.counselors[0],
        title: "A primeira feira",
        body: `Os moradores de ${name} se reúnem para organizar a primeira feira.`,
        options: [
          { id: "listen", label: "Ouvir os moradores", description: "Acolher as propostas para a praça.", resolution: "certain",
            effects: { materials: 0, satisfaction: 4 } },
          { id: "market", label: "Abastecer a feira", description: "Trocar provisões por materiais para as oficinas.", resolution: "certain",
            cost: { supplies: 60 }, effects: { materials: 80, satisfaction: 0 } },
        ],
      };
      report(state, now, "welcome", "Capital fundada", `${hero.name} assumiu a cidade de ${name}.`);
      break;
    }
    case "capital_choose": {
      rule(world.combatMode==='competitive'&&state.capitalSelectionPending,"A capital não está aguardando escolha.");
      const city=cityById(state,action.cityId);rule((city.integrity??100)>0,"Recupere a integridade da cidade antes de escolher a capital.");
      for(const c of state.cities)c.capital=c.id===city.id;state.capitalSelectionPending=false;
      report(state,now,"progress","Nova capital escolhida",`${city.name} assume a sede do império. Os níveis e os territórios das cidades permanecem.`);
      break;
    }
    case "attack_player": {
      rule(world.combatMode==='competitive',"Ataques entre jogadores não estão disponíveis no Cozy.");
      const coord=validateCoord(action,state,shared),id=key(coord),claim=shared.claims[id];
      rule(claim&&claim.playerId!==state.playerId,"Selecione uma cidade de outro império.");
      rule(getCozyTiles(state,shared,world).some(t=>t.id===id&&t.revealed),"Explore o destino antes de atacar.");
      rule(!areaAllied(shared,claim.playerId,state.playerId),"Não é possível atacar um aliado.");
      rule(!state.orders.some(o=>o.kind==='attack'),"Uma investida já está em andamento.");
      rule(action.conquest===undefined||typeof action.conquest==='boolean',"Modo de investida inválido.");
      rule(computed.armyPower>0,"Recrute tropas antes de atacar.");
      if(action.conquest){rule(state.cities.length<10,"Seu reino já tem dez cidades.");validateFreeHero(state,action.heroId);}
      const campaign=playerCampaign(state,world,coord),travel=campaign.returnMs,arrivesAt=now+campaign.arrivalMs;rule(now+campaign.totalMs<=endAt(world)!,"Não há tempo para atacar e retornar antes do fim da temporada.");
      resourceSpend(state,{supplies:campaign.supplies});
      const expeditionOrigin=nearestTerritoryCity(state,coord)!;
      addOrder(state,world,now,{kind:'attack',...coord,targetPlayerId:claim.playerId,targetCityId:claim.cityId,conquest:action.conquest===true,heroId:action.conquest?action.heroId:undefined,abstractAttack:true,returnTravelMs:travel,expeditionOrigin:{q:expeditionOrigin.q,r:expeditionOrigin.r},arrivesAt});
      report(state,now,'combat','Investida enviada',`${claim.name}: a defesa e o dano serão resolvidos na chegada. A ocupação exige derrubar a integridade e superar a defesa em 25%.`);
      break;
    }
    case "king_choose": {
      const profile=ROYAL_PROFILES.find(p=>p.id===action.profileId);rule(profile,"Escolha um perfil de rei válido.");
      rule(!state.king?.profileId||!state.king.alive,"O perfil deste reinado já foi escolhido.");
      rule(typeof action.nickname==="string"&&action.nickname.trim().length>=2&&action.nickname.trim().length<=24&&!/[\u0000-\u001f]/.test(action.nickname),"Use um nickname entre 2 e 24 caracteres.");
      const previous=state.king;state.king={profileId:profile.id,nickname:action.nickname.trim(),alive:true,generation:previous&&!previous.alive?previous.generation+1:previous?.generation??1,history:previous?.history??[]};
      report(state,now,"progress",`${state.king.nickname}, ${profile.name}`,`Começa o reinado ${state.king.generation}. A capital e o histórico do reino permanecem.`);
      break;
    }
    case "city_decision": {
      const city=cityById(state,action.cityId),decision=computed.cityLife[city.id]?.decision;
      rule(decision&&decision.id===action.decisionId,"Esta decisão da cidade já foi resolvida ou mudou.");
      const option=decision.options.find(o=>o.id===action.optionId);rule(option,"Opção de cidade inválida.");
      resourceSpend(state,option.cost);
      const succeeded=!option.chance||hash(`local:${world.id}:${state.playerId}:${city.id}:${decision.day??computed.day}:${decision.id}`)%100<option.chance.successPercent;
      const outcome=option.chance&&!succeeded?option.chance.failure:option;
      city.life??={contentment:state.satisfaction,lastDecisionDay:null};
      const priorTrust=city.life.contentment,priorIntegrity=city.integrity??100,priorBonus=city.life.productionEffect&&city.life.productionEffect.endsAt>now?city.life.productionEffect.bonus:0;
      city.life.contentment=clamp(city.life.contentment+outcome.contentment,0,100);
      if(city.life.contentment>=35)city.life.unrestDays=0;
      city.life.lastDecisionDay=computed.day;
      if (state.decisionInbox) delete state.decisionInbox.cities[city.id];
      state.resources.materials+=outcome.materialsReward??0;
      for(const resource of ['gold','materials','supplies'] as const)state.resources[resource]+=outcome.rewards?.[resource]??0;
      if(outcome.integrityRestore)city.integrity=clamp((city.integrity??100)+outcome.integrityRestore,0,100);
      if(outcome.productionBonus)city.life.productionEffect={bonus:outcome.productionBonus,endsAt:now+2*dayMs(world)};
      recordCityCare(state,city,computed.day,city.life.contentment-priorTrust,(city.integrity??100)>priorIntegrity||outcome.productionBonus>priorBonus);
      if (world.persistent && succeeded) recordStableAdministration(state,city,computed.day);
      const receipt=state.progression?.balance?.unifiedRules?decisionReceipt(option.cost,{...outcome.rewards,materials:(outcome.materialsReward??0)+(outcome.rewards?.materials??0)}):'';
      const title = `${city.name}: ${option.chance&&!succeeded?"o plano não deu certo":"decisão concluída"}`;
      const legacyRewards = !state.progression?.balance?.unifiedRules && outcome.rewards
        ? Object.entries(outcome.rewards).map(([key,value])=>`+${value} ${key==='gold'?'ouro':key==='supplies'?'suprimentos':'materiais'}`).join(", ") : "";
      const notes = [
        option.label,receipt,legacyRewards,
        !state.progression?.balance?.unifiedRules && outcome.materialsReward ? `+${outcome.materialsReward} materiais` : "",
        outcome.integrityRestore ? `Integridade: ${city.integrity}%` : "",
        outcome.contentment ? `Satisfação local: ${city.life.contentment}%` : "",
        outcome.productionBonus ? `Eficiência de produção: +${outcome.productionBonus}% por dois dias de jogo` : "",
      ].filter(Boolean);
      report(state,now,"council",title,`${notes.join(". ")}.`,succeeded&&outcome.contentment>=0,
        world.persistent ? {q:city.q,r:city.r} : undefined,
        decision.author ? {kind:"hero",...decision.author} : undefined);
      break;
    }
    case 'cancel_plan': {
      const target=state.orders.find(o=>o.id===action.orderId);
      rule(target?.planned&&!target.planned.started,'Somente planos que ainda não começaram podem ser cancelados.');
      cancelPlans(state,target!);report(state,now,'economy','Planejamento cancelado','Este plano e os seguintes foram retirados da fila. As reservas que não foram utilizadas voltaram ao tesouro.');break;
    }
    case 'plan_city_works': {
      rule(world.persistent,'Este planejamento está disponível no Cozy persistente.');
      const city=cityById(state,action.cityId);
      const lane=cityWorksLane(state,city.id,now);
      rule(Array.isArray(action.works)&&action.works.length>0&&action.works.length<=SECTORS.length,'Escolha entre uma e cinco obras.');
      rule(action.works.length<=lane.slots,'Fila de obras cheia. Confira novamente o planejamento.');
      const seen=new Set<CozySector>();
      let startsAt=lane.startsAt;
      for(const work of action.works){
        rule(work&&SECTORS.some(sector=>sector.id===work.sector)&&!seen.has(work.sector),'Setor inválido ou repetido.');
        rule(!lane.orders.some(order=>order.sector===work.sector)&&city.sectors[work.sector]===work.level&&work.level<10,
          'A fila mudou. Confira novamente os níveis e custos.');
        const quote=cityWorkQuote(state,city,work.sector,work.level,dayMs(world));
        const cost={materials:quote.materials};
        const arrivesAt=startsAt+quote.duration;
        resourceSpend(state,cost);
        addOrder(state,world,now,{kind:'upgrade',cityId:city.id,sector:work.sector,arrivesAt,
          planned:{startsAt,expectedLevel:work.level,cost,started:startsAt===now}});
        seen.add(work.sector);
        startsAt=arrivesAt;
      }
      break;
    }
    case 'plan_upgrade':case 'plan_research': {
      rule(world.mode==='express'||world.economyVersion===3,'O planejamento exige as regras de filas desta temporada.');
      rule(action.steps===undefined||[1,2,3,4].includes(action.steps),'Quantidade de planos inválida.');
      if(action.steps&&action.steps>1){
        let next={state,shared};
        for(let i=0;i<action.steps;i++)next=applyCozyAction(next.state,next.shared,world,{...action,steps:undefined},now);
        return next;
      }
      const research=action.type==='plan_research';
      const city=action.type==='plan_upgrade'?cityById(state,action.cityId):null;
      rule(research?RESEARCHES.some(r=>r.id===action.research):SECTORS.some(s=>s.id===action.sector),'Plano inválido.');
      const lane=state.orders.filter(o=>research?o.kind==='research':o.kind==='upgrade'&&o.cityId===city!.id);
      rule(lane.filter(o=>o.planned&&!o.planned.started).length<planningCapacity(state),`Você já tem ${planningCapacity(state)} planos aguardando nesta fila.`);
      const shadow=clone(state);
      const expected=research?state.research[action.research]+lane.filter(o=>o.research===action.research).length:city!.sectors[action.sector]+lane.filter(o=>o.sector===action.sector).length;
      if (action.type === "plan_upgrade" && action.expectedLevel !== undefined)
        rule(expected === action.expectedLevel, "A fila mudou. Confira novamente o nível e o custo.");
      rule(expected<(research?5:10),'O plano ultrapassa o nível máximo.');
      if(action.type==='plan_research')shadow.research[action.research]=expected;
      else shadow.cities.find(c=>c.id===city!.id)!.sectors[action.sector]=expected;
      const quote=getCozyComputed(shadow,shared,world,now);
      const startsAt=Math.max(now,...lane.map(o=>o.arrivesAt));
      const cost=action.type==='plan_research'?{gold:quote.researchCosts[action.research]}:{materials:quote.upgradeCosts[city!.id][action.sector]};
      const duration=action.type==='plan_research'?getCozyResearchDurationMs(shadow,action.research,dayMs(world)):getCozyUpgradeDurationMs(shadow,shadow.cities.find(c=>c.id===city!.id)!,action.sector,dayMs(world));
      resourceSpend(state,cost);
      addOrder(state,world,now,{kind:research?'research':'upgrade',...(action.type==='plan_research'?{research:action.research}:{cityId:city!.id,sector:action.sector}),arrivesAt:startsAt+duration,planned:{startsAt,expectedLevel:expected,cost,started:startsAt===now}});
      break;
    }
    case "upgrade": {
      const city = cityById(state, action.cityId);
      rule(
        SECTORS.some((item) => item.id === action.sector),
        "Setor inválido.",
      );
      rule(
        city.sectors[action.sector] < 10,
        "Este setor já chegou ao nível 10.",
      );
      if (action.expectedLevel !== undefined)
        rule(city.sectors[action.sector] === action.expectedLevel, "O setor mudou. Confira o novo nível e o custo.");
      rule(
        !state.orders.some(
          (order) => order.kind === "upgrade" && order.cityId === city.id,
        ),
        "Essa cidade já está evoluindo um setor.",
      );
      const duration = getCozyUpgradeDurationMs(
        state,
        city,
        action.sector,
        dayMs(world),
      );
      resourceSpend(state, {
        materials: computed.upgradeCosts[city.id][action.sector],
      });
      addOrder(state, world, now, {
        kind: "upgrade",
        cityId: city.id,
        sector: action.sector,
        arrivesAt: now + duration,
      });
      break;
    }
    case "recruit": {
      rule(
        TROOPS.some((item) => item.id === action.troop) &&
          canRecruitTroop(state, action.troop),
        "Conclua a pesquisa militar para liberar essa tropa.",
      );
      rule(
        action.amount === "max" || (Number.isSafeInteger(action.amount) && Number(action.amount)>0),
        "Lote de recrutamento inválido.",
      );
      const capacity = Math.max(
        0,
        computed.armyCapacity -committedTroops(state)-
          Object.values(state.army).reduce((sum, amount) => sum + amount, 0),
      );
      const affordable = Math.floor(
        (state.resources.materials + EPSILON) /
          computed.troopCosts[action.troop],
      );
      const amount =
        action.amount === "max"
          ? Math.min(capacity, affordable)
          : action.amount;
      rule(
        amount > 0 && amount <= capacity,
        "Evolua Recrutamento para aumentar a capacidade do exército.",
      );
      resourceSpend(state, {
        materials: amount * computed.troopCosts[action.troop],
      });
      state.army[action.troop] += amount;
      break;
    }
    case "hire": {
      if (state.founding) {
        rule(state.king?.alive && state.counselors.every(Boolean), "Escolha o soberano e os dois conselheiros.");
        rule(state.heroes.length === 0, "O primeiro herói já está na corte.");
      }
      rule(
        HERO_ROLES.some((item) => item.id === action.role),
        "Tipo de herói inválido.",
      );
      rule(state.heroes.length < 10, "A pool já tem dez heróis.");
      resourceSpend(state, { gold: computed.heroCost });
      const definition = HERO_ROLES.find((item) => item.id === action.role)!;
      state.heroes.push({
        id: nextId(state, "hero"),
        role: action.role,
        name: `${definition.name} ${state.heroes.length + 1}`,
        cityId: null,
      });
      break;
    }
    case "assign": {
      const hero = state.heroes.find((item) => item.id === action.heroId);
      rule(hero, "Herói não encontrado.");
      rule(
        !state.orders.some((order) => order.heroId === hero.id),
        "O herói está reservado para uma conquista.",
      );
      const city =
        action.cityId === null ? null : cityById(state, action.cityId);
      const origin = state.cities.find(item => item.heroId === hero.id);
      if (world.persistent && origin && city?.id !== origin.id) {
        const outgoing = state.heroes.find(item => item.id === city?.heroId);
        rule(outgoing && city && !state.orders.some(order => order.heroId === outgoing.id),"Escolha outro responsável para manter as duas cidades atendidas.");
        origin.heroId = outgoing.id;
        outgoing.cityId = origin.id;
        city.heroId = hero.id;
        hero.cityId = city.id;
        break;
      }
      if (city?.id && city.id === origin?.id) break;
      state.cities
        .filter((item) => item.heroId === hero.id)
        .forEach((item) => {
          item.heroId = null;
        });
      if (city?.heroId) {
        const previous = state.heroes.find((item) => item.id === city.heroId);
        if (previous) previous.cityId = null;
      }
      hero.cityId = city?.id ?? null;
      if (city) city.heroId = hero.id;
      break;
    }
    case "research": {
      rule(
        RESEARCHES.some((item) => item.id === action.research),
        "Pesquisa inválida.",
      );
      rule(
        state.research[action.research] < 5,
        "Essa pesquisa já está completa.",
      );
      rule(
        !state.orders.some((order) => order.kind === "research"),
        "Uma pesquisa já está em andamento.",
      );
      resourceSpend(state, { gold: computed.researchCosts[action.research] });
      addOrder(state, world, now, {
        kind: "research",
        research: action.research,
        arrivesAt:
          now +
          getCozyResearchDurationMs(state,action.research,dayMs(world)),
      });
      break;
    }
    case "counselor": {
      if (state.founding) rule(state.king?.alive, "Escolha o soberano antes de nomear conselheiros.");
      rule(
        action.slot === 0 || action.slot === 1,
        "Cadeira do Conselho inválida.",
      );
      const person = COUNSELORS.find((item) => item.id === action.counselorId);
      rule(
        person &&
          person.seat === (action.slot === 0 ? "political" : "internal"),
        "Escolha um representante dessa cadeira.",
      );
      state.counselors[action.slot] = person.id;
      break;
    }
    case "decree": {
      const decree = computed.decree;
      rule(
        decree &&
          decree.id === action.decreeId &&
          decree.options.some((option) => option.id === action.optionId),
        "Este decreto já mudou ou foi assinado.",
      );
      const option=decree.options.find(option=>option.id===action.optionId)!;
      resourceSpend(state,option.cost??{});
      const succeeded=option.resolution==="certain"||hash(`council:${world.id}:${state.playerId}:${decree.day}`)%100<option.successPercent;
      const effects=option.resolution==="chance"&&!succeeded?option.failure:option.effects;
      const {satisfaction,materials}=effects;
      const meaningfulCare=decreeCareRecognized(state,computed.day,effects.localSatisfaction??{},satisfaction)||Boolean(effects.integrityRestore&&state.cities.some(city=>(city.integrity??100)<100))||Boolean(effects.productionBonus&&state.cities.some(city=>!city.life?.productionEffect||city.life.productionEffect.endsAt<=now||city.life.productionEffect.bonus<effects.productionBonus!));
      state.satisfaction=clamp(state.satisfaction+satisfaction,0,100);
      state.resources.materials+=materials;state.resources.gold+=effects.gold??0;state.resources.supplies+=effects.supplies??0;
      for(const city of state.cities)if(city.life){const before=city.life.contentment;city.life.contentment=clamp(city.life.contentment+(effects.localSatisfaction?.[city.id]??satisfaction),0,100);if(city.life.contentment>=35)city.life.unrestDays=0;if(effects.integrityRestore)city.integrity=clamp((city.integrity??100)+effects.integrityRestore,0,100);if(effects.productionBonus&&(!city.life.productionEffect||city.life.productionEffect.endsAt<=now||city.life.productionEffect.bonus<=effects.productionBonus))city.life.productionEffect={bonus:effects.productionBonus,endsAt:now+2*dayMs(world)};recordCityCare(state,city,computed.day,city.life.contentment-before,false,false);}
      if(meaningfulCare&&satisfaction>=0&&state.cities.every(city=>(city.life?.contentment??0)>=60&&!((state.progression?.council.selfHarm[`${city.q},${city.r}`]??0)>0)))councilCredit(state,`decree:${decree.day}`,PROGRESSION.decreeMerit);
      state.decreesSigned.push(decree.day);
      if (world.persistent && state.decisionInbox) {
        const {affinity} = state.decisionInbox;
        if (decree.suggestedOptionId) {
          const recent = affinity[decree.counselorId] ?? [];
          affinity[decree.counselorId] = [...recent,option.id===decree.suggestedOptionId].slice(-3);
        }
        delete state.decisionInbox.council;
        state.decisionInbox.councilResolvedCycle = 1 + Math.floor((computed.day-1)/3)*3;
      }
      if (world.persistent && meaningfulCare && succeeded)
        for (const city of state.cities) recordStableAdministration(state,city,Math.max(1,computed.day));
      if (signingWelcome) delete state.firstAudience;
      report(
        state,
        now,
        "council",
        option.resolution==="certain"?"Decreto assinado":succeeded?"A caravana voltou":"A caravana não voltou",
        state.progression?.balance?.unifiedRules?`${option.label}.${decisionReceipt(option.cost??{},{materials,gold:effects.gold,supplies:effects.supplies})?` ${decisionReceipt(option.cost??{},{materials,gold:effects.gold,supplies:effects.supplies})}.`:''}${satisfaction?` ${satisfaction>0?'+':''}${satisfaction} de confiança.`:''}${effects.integrityRestore?` Até +${effects.integrityRestore}% de integridade nas cidades.`:''}${effects.productionBonus?` +${effects.productionBonus}% de eficiência-base por dois dias de jogo; efeitos mais fortes preservados.`:''}`:`${option.label}: ${satisfaction >= 0 ? "+" : ""}${satisfaction} de contentamento e +${materials} materiais.`,
        satisfaction >= 0,
        undefined,
        world.persistent ? {kind:"counselor",id:decree.counselorId} : undefined,
      );
      break;
    }
    case "sanctuary_pact_defend": {
      const threat=(computed.sanctuaryThreats??[]).find(t=>t.pactId===action.pactId&&t.day===action.waveDay);
      rule(threat&&threat.arrivesAt>now,"Não há uma ameaça futura disponível nesta torre.");
      rule(threat.canDefend,threat.reason);
      const pact=shared.sanctuaryPacts!.find(p=>p.id===action.pactId)!;
      pact.raids!.waves.find(w=>w.day===action.waveDay)!.defenders.push({playerId:state.playerId,at:now,power:computed.supportOffer});
      state.supportSentAt=now;
      report(state,now,"combat","Apoio à torre confirmado",`+${computed.supportOffer} de defesa para a torre na horda do dia ${action.waveDay}. Sem custo de recursos, deslocamento de tropas ou influência. O apoio confirmado permanece válido após sair da aliança.`);
      break;
    }
    case "sanctuary_pact_challenge": {
      const pact=shared.sanctuaryPacts?.find(p=>p.id===action.pactId);
      rule(pact?.guardian&&pact.completedAt===null&&pact.canceledAt===undefined&&canUsePact(state,shared,pact),"Este desafio não está disponível para o reino.");
      rule(pactFunded(pact),"Complete as reservas antes de enfrentar os guardiões.");
      rule(state.sanctuaryVisits?.[pact.sanctuaryId]!==undefined,"Reconheça esta torre antes de enviar o exército.");
      rule(!pact.guardian.attempts.some(a=>!a.outcome),"Uma expedição já está enfrentando estes guardiões.");
      rule(!state.orders.some(o=>o.kind==="attack"),"Uma investida já está em andamento.");
      rule(armyPower(state)>0,"Recrute tropas antes de enfrentar os guardiões.");
      const tower=ALL_SANCTUARIES.find(t=>t.id===pact.sanctuaryId)!;
      const arrivesAt=now+travelMs(state,world,tower);
      rule(arrivesAt<(endAt(world)??Infinity),"Não há tempo para concluir o desafio antes do fim da temporada.");
      resourceSpend(state,{supplies:exploreCost(state,tower)});
      const pending=addOrder(state,world,now,{kind:"attack",sanctuaryPactId:pact.id,q:tower.q,r:tower.r,arrivesAt});
      pact.guardian.attempts.push({orderId:pending.id,playerId:state.playerId,arrivesAt});
      break;
    }
    case "sanctuary_pact_start":case "sanctuary_pact_contribute":case "sanctuary_pact_cancel": {
      if(action.type==="sanctuary_pact_start"){
        const tower=ALL_SANCTUARIES.find(t=>t.id===action.sanctuaryId);
        rule(!tower||now+travelMs(state,world,tower)<(endAt(world)??Infinity),"Não há tempo para concluir o desafio antes do fim da temporada.");
      }
      try{applySanctuaryPactAction(state,shared,action,now,dayMs(world),endAt(world)??Infinity,prefix=>nextId(state,prefix),sanctuaryGuardianPower(world,now));}
      catch(error){if(error instanceof SanctuaryPactError)throw new CozyRuleError(error.message);throw error;}
      syncSanctuaryPacts(state,shared,now,(title,body,refund)=>report(state,now,refund?"economy":"progress",title,body));
      break;
    }
    case "sanctuary_explore": {
      const tower=ALL_SANCTUARIES.find(t=>t.id===action.sanctuaryId);
      rule(tower,"Torre não encontrada.");
      rule(state.sanctuaryVisits?.[tower.id]===undefined,"Esta torre já foi reconhecida pelo reino.");
      rule(!state.orders.some(order=>order.kind==="explore"),"Uma exploração já está em andamento.");
      resourceSpend(state,{supplies:exploreCost(state,tower)});
      addOrder(state,world,now,{kind:"explore",sanctuaryId:tower.id,q:tower.q,r:tower.r,arrivesAt:now+travelMs(state,world,tower)});
      break;
    }
    case "explore": {
      const coord = validateCoord(action,state,shared),
        id = key(coord),
        base = baseTile(world, coord, shared);
      rule(!sanctuaryAt(coord)||Boolean(shared.deposits[id]),"Este ponto pertence ao distrito de um santuário.");
      rule(
        base.kind !== "portal" && (!shared.claims[id]||(shared.claims[id].playerId!==state.playerId&&!state.explored.includes(id))),
        "Este ponto já é conhecido.",
      );

      const lane = explorationQueue(state,now);
      const mayQueue = world.persistent && action.queue===true;
      rule(!lane.orders.length || mayQueue,"Uma exploração já está em andamento.");
      rule(lane.orders.length < EXPLORATION_QUEUE_LIMIT,"A fila de exploração está cheia.");
      rule(!lane.orders.some(order=>order.q===coord.q&&order.r===coord.r),"Este destino já está na fila de exploração.");
      if (lane.orders.length) rule(state.cities.length>0,"Você precisa de uma cidade para organizar a exploração.");
      rule(
        !state.explored.includes(id) ||
          ((base.kind === "gold" || base.kind === "materials") &&
            (resourceArea(shared,coord,base.kind)?.reserve.surveys ?? shared.deposits[id]?.surveys ?? 0) < 3),
        "Essa área já foi totalmente explorada.",
      );
      if (lane.orders.length) rule(!state.explored.includes(id),"Escolha outro destino para a fila.");
      const supplies = exploreCost(state, coord);
      resourceSpend(state, { supplies });
      addOrder(state, world, now, {
        kind: "explore",
        ...coord,
        explorationPath:explorationPath(state,coord),
        arrivesAt: lane.startsAt + travelMs(state, world, coord),
        ...(lane.orders.length ? {planned:{startsAt:lane.startsAt,started:false,cost:{supplies}}} : {}),
      });
      break;
    }
    case "trade_route": {
      const route = computed.tradeRoute;
      const capital = state.cities.find(city => city.capital);
      rule(world.persistent && route && capital, "A caravana comercial precisa de uma capital neste mundo.");
      rule(route.arrivesAt === null && now >= route.nextAt, "A caravana comercial ainda está em viagem ou em descanso.");
      rule(action.trips===undefined || TRADE_ROUTE_TRIPS.includes(action.trips),"Escolha de uma a três viagens.");
      const trips=action.trips??1;
      resourceSpend(state,{supplies:route.supplies*trips});
      for(let index=0;index<trips;index++){
        const startsAt=now+index*route.intervalMs;
        addOrder(state,world,now,{kind:"collect",tradeRoute:true,q:capital.q,r:capital.r,
          arrivesAt:startsAt+route.durationMs,cargo:{gold:route.gold},
          ...(index>0 ? {planned:{startsAt,started:false,cost:{supplies:route.supplies}}} : {})});
      }
      state.nextTradeAt=now+trips*route.intervalMs;
      break;
    }
    case "found_city": {
      rule(world.economyVersion===3,"A fundação exige as regras de expansão desta nova temporada.");
      const coord=validateCoord(action,state,shared),id=key(coord),base=baseTile(world,coord,shared);
      rule(knownMapCells(state,shared).has(id)&&base.kind==='plain'&&!sanctuaryAt(coord),"Escolha um terreno livre já explorado, fora dos distritos de torre.");
      const reason=foundationSite(state,shared,coord);rule(!reason,reason??'Local indisponível.');validateFreeHero(state,action.heroId);
      rule(!state.orders.some(o=>o.kind==='attack'),"Uma expedição já está em andamento. Aguarde o retorno.");
      resourceSpend(state,{materials:CITY_FOUNDATION_COST.materials,supplies:CITY_FOUNDATION_COST.supplies+exploreCost(state,coord)});
      addOrder(state,world,now,{kind:'attack',...coord,foundation:true,foundationMaterials:CITY_FOUNDATION_COST.materials,heroId:action.heroId,arrivesAt:now+travelMs(state,world,coord)+CITY_FOUNDATION_DAYS*dayMs(world)});break;
    }
    case "attack":
    case "annex": {
      const coord = validateCoord(action,state,shared),
        id = key(coord),
        base = baseTile(world, coord, shared);
      rule(
        !shared.claims[id] && base.kind !== "portal",
        "Não há PvP: cidades de jogadores e o Portal estão protegidos.",
      );
      rule(!sanctuaryAt(coord)||Boolean(shared.independentCities?.[id]),"Este terreno está reservado ao distrito de um santuário.");
      rule(
        getCozyTiles(state, shared, world).some((tile) => tile.id === id),
        "Esse ponto ainda está fora das suas pistas.",
      );
      rule(
        base.kind === "npc" || base.kind === "abandoned",
        "Esse local não é uma aldeia hostil ou abandonada.",
      );
      rule(
        !state.orders.some((order) => order.kind === "attack"),
        "Uma investida já está em andamento. O exército mantém a defesa do reino.",
      );
      const conquest = action.type === "annex" || action.conquest === true;
      if (action.type === "attack")
        rule(
          typeof action.conquest === "undefined" ||
            typeof action.conquest === "boolean",
          "Modo de investida inválido.",
        );
      const staged=world.economyVersion===3;
      if(staged){
        const camp = world.persistent && base.kind==="npc" && !shared.independentCities?.[id];
        rule(state.explored.includes(id),"Explore a cidade antes de atacar ou anexar.");
        rule(action.type!=="attack"||!action.conquest,"Primeiro ataque; a anexação é uma ação separada, depois da vitória.");
        if (camp) {
          rule(action.type==="attack","Você pode saquear o acampamento. Para anexar, escolha uma cidade abandonada.");
          rule(base.power>0,"O acampamento ainda está se recuperando.");
        } else {
          const ready = npcOccupation(base.power,shared.npcResistance?.[id]?.initial??base.power).canAnnex;
          rule(action.type!=="annex"||ready,"Ainda há resistência. Ataque antes de anexar.");
          rule(action.type!=="attack"||!ready,"A cidade já foi vencida. Agora envie um herói para anexar.");
        }
      }
      if (action.type === "annex"&&!staged)
        rule(
          base.kind === "abandoned" && state.explored.includes(id),
          "Revele a cidade abandonada antes de anexar.",
        );
      if (conquest) {
        rule(state.cities.length < 10, "Seu reino já tem dez cidades.");
        validateFreeHero(state, action.heroId);
        rule(
          staged||combatAssessment(computed.armyPower,base.power).occupationMargin,
          "A conquista exige poder pelo menos 25% maior que a resistência local.",
        );
      } else
        rule(
          staged || !state.raided[id] || now - state.raided[id] >= dayMs(world) * 6,
          "Esse local se recupera do último saque. Aguarde seis dias de jogo.",
        );
      rule(staged&&conquest||computed.armyPower > 0, "Recrute tropas antes de atacar.");
      if(staged)resourceSpend(state,{supplies:exploreCost(state,coord)});
      if(conquest){
          const owner=shared.territories?.[id];
        rule(!owner||owner===state.playerId||areaAllied(shared,owner,state.playerId),"Este território pertence a outro império.");
      }
      addOrder(state, world, now, {
        kind: "attack",
        ...coord,
        conquest,
        ...(staged&&conquest?{occupationOnly:true}:{}),
        ...(staged&&!conquest?{returnTravelMs:travelMs(state,world,coord)}:{}),
        areaRules: true,
        heroId: conquest ? action.heroId : undefined,
        arrivesAt: now + travelMs(state, world, coord),
      });
      break;
    }
    case "area_annex": {
      const coord=validateCoord(action,state,shared),base=baseTile(world,coord,shared);
      rule(base.kind==="gold"||base.kind==="materials","Selecione um ponto de recurso.");
      const area=resourceArea(shared,coord,base.kind as "gold"|"materials");
      rule(Boolean(area)&&area!.cells.some(id=>state.explored.includes(id)||(state.scoutedCells??[]).includes(id)),"Revele a área antes de anexar.");
      rule(area!.reserve.surveys===3&&area!.reserve.remaining>0,"Conclua os levantamentos de uma área com reserva disponível.");
      rule(!area!.owners.includes(state.playerId),"Seu reino já anexou esta área.");
      rule(!area!.owners.length||(!area!.exclusive&&areaAllied(shared,area!.owners[0],state.playerId)),"Esta área já pertence a outro reino. A aliança não transfere a reserva.");
      rule(area!.cells.every(id=>{const owner=shared.claims[id]?.playerId??shared.territories?.[id];return !owner||owner===state.playerId||(!area!.exclusive&&areaAllied(shared,owner,state.playerId));}),"Há território de outro império nesta área.");
      area!.owners.push(state.playerId);area!.annexedAt??=now;
      if (state.progression?.feats.frontier) state.progression.feats.frontier.resourceAreaClaimed = true;
      const territoryCity=nearestTerritoryCity(state,coord)!;(area!.ownerCities??={})[state.playerId]=territoryCity.id;shared.territoryCities??={};
      for(const id of area!.cells)if(!shared.claims[id]&&!shared.independentCities?.[id]&&!shared.territories![id]&&!sanctuaryAt(fromKey(id))) {shared.territories![id]=state.playerId;shared.territoryCities[id]={playerId:state.playerId,cityId:territoryCity.id};}
      report(state,now,"progress","Área anexada",area!.owners.length>1?"O acesso ao recurso está compartilhado em aliança. As terras de cada império permanecem.":"A reserva pertence ao reino. O território permanece quando o recurso se esgotar.");
      break;
    }
    case "collect": {
      const coord = validateCoord(action,state,shared), id=key(coord), base=baseTile(world,coord,shared);
      const area=(base.kind==="gold"||base.kind==="materials")?resourceArea(shared,coord,base.kind):undefined;
      const deposit=area?.reserve;
      rule(area&&area.cells.some(cell=>state.explored.includes(cell)||(state.scoutedCells??[]).includes(cell))&&deposit&&deposit.surveys===3,"Revele a área e conclua os três levantamentos para coletar.");
      rule(Boolean(area)&&canUseArea(shared,area!,state.playerId),"Anexe a área ou compartilhe-a em aliança antes de coletar.");
      rule(deposit.remaining > 0, "Esse depósito está esgotado.");
      rule(
        !state.orders.some((order) => order.kind === "collect" && !order.tradeRoute),
        "Uma coleta já está em andamento.",
      );
      const amount = Math.min(
        deposit.remaining,
        (deposit.resource === "gold" ? 350 : 1200)*(economicExpress(world)?4:1),
      );
      // Reserve under the same shared CAS as the order. Offline arrival order cannot duplicate a deposit.
      deposit.remaining -= amount;
      if (world.persistent && area && deposit.remaining === 0) (shared.depletedAreas ??= {})[area.id] = now;
      if(area)syncAreaDeposits(shared,area);
      addOrder(state, world, now, {
        kind: "collect",
        ...coord,
        collectResource: deposit.resource,
        collectAmount: amount,
        arrivesAt: now + travelMs(state, world, coord) + dayMs(world) / 24,
      });
      break;
    }
    case "wonder": {
      const previousConquests=influence(state).legacy;
      const city = cityById(state, action.cityId);
      rule(
        getCityDevelopment(city) === 100 && !city.wonder,
        "Uma maravilha exige desenvolvimento 100 e só pode ser construída uma vez na cidade.",
      );
      resourceSpend(state, { materials: COZY_LIMITS.wonderCost });
      city.wonder = true;
      if(state.progression){const site=`${city.q},${city.r}`;if(!state.progression.feats.wonders.includes(site))state.progression.feats.wonders.push(site);}
      report(
        state,
        now,
        "progress",
        "Uma maravilha para a história",
        `${city.name} inaugurou sua maravilha. ${influence(state).legacy>previousConquests?`+${influence(state).legacy-previousConquests} de Conquistas.`:"Esta obra não soma Conquistas: o teto de reconhecimento foi atingido ou este local já foi reconhecido."}`,
      );
      break;
    }
    case "quest": {
      const quest = computed.questProgress.find(
        (item) => item.id === action.questId,
      );
      rule(
        quest?.complete && !quest.claimed,
        "Essa conquista ainda não está pronta ou já foi registrada.",
      );
      state.quests.push(action.questId);
      report(
        state,
        now,
        "progress",
        "Conquista registrada",
        `${questsForRealm(state).find((item) => item.id === action.questId)!.name}: +50 de Conquistas.`,
      );
      break;
    }
    case "portal": {
      rule(!world.persistent, "A Ascensão ainda está em preparação neste mundo.");
      // Compatibility for older clients: no travel or positional requirement.
      rule(influence(state).total >= 1500, "Alcance 1.500 de Influência para conquistar o Selo de Vitória.");
      recordInfluenceVictory(state, world, now);
      break;
    }
    case "alliance_create":case "alliance_join":case "alliance_leave":
    case "alliance_invite":case "alliance_request":case "alliance_respond":case "alliance_decline":case "alliance_settings":
    case "alliance_project_start":case "alliance_project_contribute": {
      try{applyAllianceAction(state,shared,action,now,dayMs(world),prefix=>nextId(state,prefix));}
      catch(error){if(error instanceof AllianceRuleError)throw new CozyRuleError(error.message);throw error;}
      syncAllianceProjects(state,shared,now,(title,body)=>report(state,now,'alliance',title,body));
      cancelOrphanedPacts(shared,now);
      syncSanctuaryPacts(state,shared,now,(title,body,refund)=>report(state,now,refund?"economy":"progress",title,body));
      break;
    }
    case "support_request": {
      const alliance = currentAlliance(state, shared),
        horde = computed.nextHorde;
      rule(
        horde && horde.arrivesAt > now,
        "Não há uma horda futura para pedir apoio.",
      );
      rule(
        !shared.support.some(
          (item) =>
            item.requesterId === state.playerId && item.waveDay === horde.day,
        ),
        "Já existe um pedido de apoio para essa horda.",
      );
      shared.support.push({
        id: nextId(state, "support"),
        allianceId: alliance.id,
        requesterId: state.playerId,
        waveDay: horde.day,
        arrivesAt: horde.arrivesAt,
        requestedAt: now,
        supporterId: null,
        power: 0,
        acceptedAt: null,
      });
      break;
    }
    case "support_send": {
      const alliance = currentAlliance(state, shared),
        request = shared.support.find((item) => item.id === action.requestId);
      rule(
        request &&
          request.allianceId === alliance.id &&
          alliance.members.includes(request.requesterId),
        "Pedido de apoio não encontrado na sua aliança.",
      );
      rule(
        request.requesterId !== state.playerId && request.supporterId === null,
        "Esse pedido já recebeu apoio ou pertence a você.",
      );
      rule(
        now < request.arrivesAt,
        "A horda já chegou. Esse apoio seria tarde demais.",
      );
      rule(
        state.supportSentAt === null ||
          now - state.supportSentAt >= dayMs(world),
        "O apoio pode ser enviado uma vez por dia de jogo.",
      );
      request.supporterId = state.playerId;
      request.power = computed.supportOffer;
      request.acceptedAt = now;
      state.supportSentAt = now;
      state.cooperation += 3;
      report(
        state,
        now,
        "alliance",
        "Apoio enviado",
        `Seu aliado receberá +${request.power} de defesa na horda do dia ${request.waveDay}. Nenhuma tropa saiu do reino.`,
      );
      break;
    }
    case "city_class": {
      rule(Object.prototype.hasOwnProperty.call(CITY_TYPES,action.cityClass),"Tipo de cidade inválido.");
      const city=cityById(state,action.cityId);
      rule(!city.capital,"A capital já tem um tipo próprio.");
      rule(!city.cityClass||city.cityClass==="neutral","Esta aldeia já escolheu seu tipo.");
      rule(action.cityClass!=="neutral","Escolha uma especialização.");
      city.cityClass=action.cityClass;
      break;
    }
    case "rename_city": {
      const city = cityById(state, action.cityId);
      rule(!city.renamedBy?.includes(state.playerId),"Você já escolheu o nome desta cidade.");
      rule(
        typeof action.name === "string" &&
          action.name.trim().length >= 2 &&
          action.name.trim().length <= 32,
        "Use um nome de cidade entre 2 e 32 caracteres.",
      );
      rule(action.name.trim()!==city.name,"Escolha um nome diferente.");
      city.name = action.name.trim();
      (city.renamedBy??=[]).push(state.playerId);
      shared.claims[key(city)].name = city.name;
      break;
    }
    default:
      throw new CozyRuleError("Ação desconhecida.");
  }
  if (world.persistent) prepareFrontierProgress(state,shared);
  if(computed.started)recordInfluenceVictory(state, world, now);
  syncDecisionInbox(state,shared,world,now);
  return { state, shared };
}
