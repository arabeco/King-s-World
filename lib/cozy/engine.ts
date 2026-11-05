import {expeditionCost,expeditionTravelMs,explorationPath,explorationCorridor} from './exploration-route';
import {empireArmy,committedTroops,retargetArmyReturns,restoreAbstractArmy} from './expedition-army';
import {playerCampaign} from './player-campaign';
import {damageCityBuildings} from './city-damage';
import {bindCityTerritories,nearestTerritoryCity,restoreCityTerritory} from './city-territory';
import {economicExpress,seasonDays,waveDays} from './rhythm';
import {WAVE_POWER} from "./hordes";
import {resolveSanctuaryRaids,sanctuaryThreats,syncSanctuaryRaidReports} from "./sanctuary-raids";
import {councilTopic} from "./council-context";
import {applySanctuaryPactAction,pactFunded,canUsePact,activateSanctuaryPact,SanctuaryPactError,syncSanctuaryPacts,sanctuaryBonus,realmSupportBonus,cancelOrphanedPacts,cancelUnfinishedPacts} from "./sanctuary-pacts";
import {applyAllianceAction,AllianceRuleError,allianceBonus,syncAllianceProjects} from './alliances';
import {equipmentBonus} from "./equipment";
import {ROYAL_PROFILES,royalBonus} from "./royal-profiles";
import {createProgression,hasZeroProgression,zeroInfluence,progressionBreakdown,localTrustDelta,decreeCareRecognized,councilCredit,recordCityCare,recordStableAdministration,recognizeSupport,PROGRESSION} from './progression';
import {citySocialStatus,SOCIAL_RUPTURE_DAYS,releaseCity} from "./city-crisis";
import {cityEfficiency,cityDecision} from "./city-life";
import {combatAssessment} from "./combat";
import {knownMapCells, visibleTerrainCells} from "./map-visibility";
import {sanctuaryAt, ALL_SANCTUARIES} from "./landmarks";
import {migrateResourceAreas, resourceArea, discoverResourceArea, areaAllied, canUseArea, syncAreaDeposits} from "./areas";
import {
  CITY_TYPES,COZY_LIMITS,researchCost,upgradeCost,planningCapacity,
  COUNSELORS,
  HERO_ROLES,
  QUESTS,
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
  CozyHeroRole,
  CozyInfluence,
  CozyOrder,
  CozyReport,
  CozyResources,
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
  return economicExpress(world)?DAY:DAY / (world.mode === "express" ? (world.speedMultiplier===2?2:4) : 1);
}
function endAt(world: CozyWorld) {
  return world.startsAt === null ? null : world.startsAt + dayMs(world) * seasonDays(world);
}
export function getCozyDay(world: CozyWorld, now: number): number {
  if (
    world.startsAt === null ||
    now < world.startsAt ||
    world.status === "open"
  )
    return 0;
  return clamp(Math.floor((now - world.startsAt) / dayMs(world)) + 1, 1, seasonDays(world));
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
) {
  state.reports.unshift({
    id: nextId(state, "report"),
    at,
    kind,
    title,
    body,
    positive,
  });
  state.reports = state.reports.slice(0, 80);
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
  const technology = (state.progression?.balance?.expressEconomy?4:1)*(1 + state.research.economy * 0.08)*(1+royalBonus(state,"administration"));
  return cities.reduce(
    (total, city) => {
      const multiplier =
        technology * (cityHasHero(state, city, "administrator") ? 1.15 : 1) * cityEfficiency(city,at)/100;
      total.materials +=
        (120 + city.sectors.economy * 85 + city.sectors.administration * 15) *
        multiplier * (!city.capital&&city.cityClass==="metropole"?1.05:1)*(1+equipmentBonus(state,"materials"));
      total.supplies += (70 + city.sectors.economy * 50) * multiplier * (!city.capital&&city.cityClass==="celeiro"?1.05:1) * (1+realmSupportBonus(state,"provisions",at))*(1+equipmentBonus(state,"supplies"));
      return total;
    },
    { gold: 0, materials: 0, supplies: 0 },
  );
}
function armyPower(state: CozyState) {
  return Math.floor(
    TROOPS.reduce((sum, troop) => sum + state.army[troop.id] * troop.power, 0) *
      (1 + state.research.military * 0.2) *
      (1 + Math.min(5, heroesOf(state, "general")) * 0.08),
  );
}
function wallPower(state: CozyState) {
  return Math.floor(
    state.cities.reduce((sum,city)=>sum+city.sectors.defense*(city.integrity??100)/100*(!city.capital&&city.cityClass==="bastiao"?1.05:1),0) *
      18 *
      (1 + state.research.fortification * 0.15),
  );
}
function defensePower(state:CozyState,at:number){
 return Math.floor((armyPower(state)+wallPower(state))*(1+royalBonus(state,"command"))*(1+realmSupportBonus(state,'defense',at))*(1+equipmentBonus(state,'defense')));
}
function influence(state: CozyState): CozyInfluence {
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
  const progress: Record<string, number> = {
    city: Math.max(...state.cities.map(getCityDevelopment)),
    expansion: state.cities.length,
    exploration: state.explored.length,
    research: Object.values(state.research).reduce(
      (sum, level) => sum + level,
      0,
    ),
    defense: state.hordesWon,
    council: state.decreesSigned.length,
  };
  return QUESTS.map((quest) => ({
    id: quest.id,
    current: Math.min(quest.target, progress[quest.id] ?? 0),
    target: quest.target,
    complete: (progress[quest.id] ?? 0) >= quest.target,
    claimed: state.quests.includes(quest.id),
  }));
}
function getDecree(
  state: CozyState,
  shared: CozyShared,
  world: CozyWorld,
  now: number,
): CozyDecree | null {
  const day = getCozyDay(world, now);
  if (!day || state.finalizedAt !== null) return null;
  const decreeDay = 1 + Math.floor((day - 1) / 3) * 3;
  if (state.decreesSigned.includes(decreeDay)) return null;
  const seat = Math.floor((decreeDay - 1) / 3) % 2;
  const counselorId = state.counselors[seat];
  const counselor = COUNSELORS.find((person) => person.id === counselorId)!;
  const {careLabel,investLabel,careDescription,investDescription,...topic}=councilTopic(state,decreeDay,day,nextHorde(state,shared,world,now)?.day??null);
  const generous = counselorId === "helena" || counselorId === "ines";
  const effects=(care:boolean)=>{
    const requested=care?(generous?10:6):generous?2:-5;
    const satisfaction=clamp(state.satisfaction+requested,0,100)-state.satisfaction;
    return {materials:care?80:generous?220:350,satisfaction,...(hasZeroProgression(state)?{localSatisfaction:Object.fromEntries(state.cities.map(city=>[city.id,clamp((city.life?.contentment??state.satisfaction)+localTrustDelta(state,city,requested),0,100)-(city.life?.contentment??state.satisfaction)]))}:{})};
  };
  return {
    id: `${decreeDay}:${counselorId}`,
    day: decreeDay,
    counselorId,
    ...topic,
    options: [
      {
        id: "care",
        effects: effects(true),
        resolution: "certain",
        label: careLabel ?? (generous ? "Acolher e ouvir o povo" : "Abrir uma exceção"),
        description: careDescription ?? (generous
          ? "Dar prioridade às famílias e à confiança na Coroa."
          : "Reservar espaço para quem precisa, mesmo com o conselho dividido."),
      },
      {
        id: "invest",
        effects: effects(false),
        resolution: "certain",
        label: investLabel ?? (generous
          ? "Combinar ajuda com trabalho"
          : "Priorizar as reservas"),
        description: investDescription ?? (generous
          ? "Organizar uma contribuição voluntária para as oficinas."
          : "Concentrar o esforço do reino em materiais para os próximos desafios."),
      },
    ],
  };
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
  const portalOpen = started && !readOnly;
  const supportOffer=Math.max(20,Math.floor(defensePower(state,now)*0.2));
  return {
    day,
    durationDays: seasonDays(world),
    realDurationDays: dayMs(world)*seasonDays(world)/DAY,
    dayMs: dayMs(world),
    endsAt,
    phase: state.defeat?"Império derrotado":!started
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
    cityLife:Object.fromEntries(state.cities.map(city=>{const rates=production(state,now,[city]),decision=started&&!readOnly?cityDecision(city,day):null;if(decision&&hasZeroProgression(state))decision.options=decision.options.map(option=>({...option,contentment:localTrustDelta(state,city,option.contentment)}));return [city.id,{contentment:city.life?.contentment??state.satisfaction,status:citySocialStatus(city),unrestDays:city.life?.unrestDays??0,integrity:city.integrity??100,daysToRupture:!city.capital&&state.cities.length>1&&(city.life?.contentment??state.satisfaction)<35?Math.max(0,SOCIAL_RUPTURE_DAYS-(city.life?.unrestDays??0)):null,efficiency:cityEfficiency(city,now),production:{materials:rates.materials,supplies:rates.supplies},effectEndsAt:city.life?.productionEffect&&city.life.productionEffect.endsAt>now?city.life.productionEffect.endsAt:null,decision}];})),
    nextHorde: nextHorde(state, shared, world, now),
    decree: readOnly ? null : getDecree(state, shared, world, now),
    portalOpen,
    canEnterPortal:
      portalOpen &&
      score.total >= 1500 &&
      state.portalCrossedAt === null &&
      !state.orders.some((order) => order.kind === "portal"),
    unreadReports: state.reports.filter((item) => item.at > state.readAt)
      .length,
    heroCost: Math.round((200 + state.heroes.length * 100)*(state.progression?.balance?.expressEconomy?0.25:1)),
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
  if(independent)return {kind:independent.reason==="horde"?"npc":"abandoned",name:independent.city.name,clue:independent.reason==="horde"?"A horda ocupa as estruturas desta antiga cidade do reino.":"Uma cidade independente guarda as marcas do antigo reino.",power:25+independent.city.sectors.defense*18};
  if (coord.q === 0 && coord.r === 0)
    return {
      kind: "portal",
      name: "Portal Central",
      clue: "O caminho do Êxodo",
      power: 0,
    };
  const n = hash(`${world.id}:tile:${key(coord)}`) % 100;
  const kind =
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
  const names = {
    npc: "Aldeia da horda",
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
      25 + centralPressure * 8 + (hash(`${world.id}:power:${key(coord)}`) % 70),
  };
}
function tileDistance(state: CozyState, coord: CozyCoord) {
  return Math.max(
    1,
    Math.min(...state.cities.map((city) => distance(city, coord))),
  );
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
  const city =
    claim?.playerId === state.playerId
      ? state.cities.find((item) => item.id === claim.cityId)
      : undefined;
  return {
    ...coord,
    id,
    kind: !revealed ? "unknown" : claim ? "city" : reserved ? "plain" : base.kind,
    landmarkId: revealed && reserved ? sanctuary!.id : null,
    clue: revealed && reserved ? "Distrito monumental reservado; novas cidades não podem ocupar estes hexágonos." : base.clue,
    name: !revealed ? "Território desconhecido" : claim?.name ?? (reserved ? sanctuary!.name : base.name),
    revealed,
    terrainVisible: revealed || sight.has(id),
    attackable: !shared.claims[id] && !reserved && (base.kind === "npc" || base.kind === "abandoned"),
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
    territoryOwnerId: revealed ? shared.territories?.[id] ?? null : null,
    area: areaKnown ? {id:area.id,cells:area.cells,owners:area.owners,canCollect:canUseArea(shared,area,state.playerId),canAnnex:area.reserve.surveys===3&&area.reserve.remaining>0&&(!area.owners.length||(!area.owners.includes(state.playerId)&&areaAllied(shared,area.owners[0],state.playerId)))} : null,
    distance: tileDistance(state, coord),
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
    cities: [city],
    army: { militia: 25, shooters: 0, scouts: 0, machinery: 0 },
    heroes: [],
    research: { economy: 0, military: 0, exploration: 0, fortification: 0 },
    counselors: ["helena", "ines"],
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
  if(world.influenceVersion===2)createProgression(state,armyPower(state)+wallPower(state),economicExpress(world));
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
function establishCity(
  state: CozyState,
  shared: CozyShared,
  world: CozyWorld,
  coord: CozyCoord,
  heroId: string,
  at: number,
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
  const level = 1 + (hash(`${world.id}:${key(coord)}:city`) % 3);
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
    `${hero.name} assumiu a cidade. O território está amarelo; desenvolvimento 60 o torna verde. A conquista não cobrou recursos adicionais.`,
  );
}
function resolveOrder(
  state: CozyState,
  shared: CozyShared,
  world: CozyWorld,
  order: CozyOrder,
) {
  const at = order.arrivesAt;
  if(order.returning){
    for(const resource of ['gold','materials','supplies'] as const)state.resources[resource]+=order.cargo?.[resource]??0;
    report(state,at,'combat','Expedição retornou',`A investida foi concluída. ${order.cargo?.gold??0} de ouro e ${order.cargo?.materials??0} materiais foram entregues. Uma nova investida está disponível.`);return;
  }
  if (order.kind === "upgrade") {
    const city = state.cities.find((item) => item.id === order.cityId);
    if (city && order.sector) {
      city.sectors[order.sector] = Math.min(10, city.sectors[order.sector] + 1);
      if(order.sector==='society'&&state.progression)state.progression.council.careSince[`${city.q},${city.r}`]??=getCozyDay(world,at);
      report(
        state,
        at,
        "progress",
        "Setor concluído",
        `${SECTORS.find((item) => item.id === order.sector)!.name} de ${city.name} chegou ao nível ${city.sectors[order.sector]}.`,
      );
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
    recordInfluenceVictory(state, at);
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
    if(won)activateSanctuaryPact(pact,at,dayMs(world),endAt(world)!,waveDays(world).map((day,index)=>({day,arrivesAt:arrivalForDay(world,day),power:WAVE_POWER[index]})));
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
    if(shared.claims[id]){report(state,at,"exploration","Cidade de outro reino reconhecida",`${shared.claims[id].name} foi localizada. Reconhecer não altera a posse e não concede reservas de NPC.`);return;}
    let detail = base.clue;
    if (base.kind === "gold" || base.kind === "materials") {
      let area = resourceArea(shared,coord,base.kind);
      if(!area){
        const capacity=(base.kind === "gold" ? 1600 : 6000)+(hash(`${world.id}:deposit:${id}`)%(base.kind === "gold" ? 1800 : 6000));
        area=discoverResourceArea(shared,coord,{id,resource:base.kind,capacity,remaining:capacity,surveys:0,contributors:[]});
      }
      const deposit=area.reserve;
      const priorSurveys=deposit.surveys;
      deposit.surveys=Math.min(3,deposit.surveys+1);
      if(state.progression&&deposit.surveys>priorSurveys){const step=`${area.id}:${deposit.surveys}`;if(!state.progression.feats.surveys.includes(step))state.progression.feats.surveys.push(step);}
      if(!deposit.contributors.includes(state.playerId))deposit.contributors.push(state.playerId);
      shared.deposits[id]={...deposit,id};
      syncAreaDeposits(shared,area);
      state.cooperation += 1;
      detail = `Levantamento da área ${deposit.surveys}/3. ${deposit.surveys === 3 ? "A área pode ser anexada pelo reino ou compartilhada em aliança." : "Mais uma exploração avança o levantamento; qualquer jogador pode ajudar."}`;
    } else if (first && (base.kind === "ruin" || base.kind === "abandoned")) {
      const gold = 80 + (hash(`${world.id}:discovery:${id}`) % 121);
      state.resources.gold += gold;
      detail = `${base.kind === "ruin" ? "Uma antiga reserva foi encontrada." : "Os moradores deixaram uma pequena reserva."} +${gold} de ouro.`;
    }
    report(state, at, "exploration", `${base.name} revelado`, detail);
    return;
  }
  if (order.kind === "attack") {
    if (!state.explored.includes(id)) state.explored.push(id);
    if (shared.claims[id]) {
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
    const power = armyPower(state);
    const won = combatAssessment(power,base.power).attackWins;
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
function recordInfluenceVictory(state: CozyState, at: number) {
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
  const until = Math.max(state.settledAt, Math.min(now, endsAt!));
  if(until>=endsAt!)cancelUnfinishedPacts(shared,endsAt!);
  const events: {
    at: number;
    kind: "order" | "planStart" | "tower" | "horde" | "social" | "alliance";
    order?: CozyOrder;
    day?: number;
  }[] = state.orders
    .filter((order) => order.arrivesAt <= until && order.arrivesAt <= endsAt!)
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
  for(let day=socialFrom+1;day<=Math.min(seasonDays(world),getCozyDay(world,until));day++){const at=arrivalForDay(world,day);if(at>=state.createdAt)events.push({at,kind:"social",day});}
  for(const project of shared.allianceProjects??[]){const at=project.completedAt??project.canceledAt;if(at!==undefined&&at!==null&&at>state.settledAt&&at<=until)events.push({at,kind:"alliance"});}
  for(const pact of shared.sanctuaryPacts??[]){const at=pact.completedAt??pact.canceledAt;if(at!==undefined&&at!==null&&at>state.settledAt&&at<=until)events.push({at,kind:"alliance"});}
  const towerBoundaries=new Set((shared.sanctuaryPacts??[]).flatMap(p=>(p.raids?.waves??[]).map(w=>w.arrivesAt)));
  for(const at of towerBoundaries)if(at>state.settledAt&&at<=until)events.push({at,kind:"tower"});
  if(options)for(let i=events.length-1;i>=0;i--)if(events[i].at===options.deferWorldEventsAt&&(events[i].kind==="horde"||events[i].kind==="social"))events.splice(i,1);
  events.sort((a, b) => a.at - b.at || ({order:0,planStart:1,tower:2,alliance:3,horde:4,social:5}[a.kind]-{order:0,planStart:1,tower:2,alliance:3,horde:4,social:5}[b.kind]));
  let cursor = Math.max(state.settledAt, world.startsAt);
  if (until >= cursor) recordInfluenceVictory(state, cursor);
  for (const event of events) {
    accrue(state, world, cursor, event.at);
    cursor = Math.max(cursor, event.at);
    if(event.kind==='planStart'&&event.order){
      const order=state.orders.find(o=>o.id===event.order!.id);
      if(order?.planned){
        const level=order.kind==='research'?state.research[order.research!]:state.cities.find(c=>c.id===order.cityId)?.sectors[order.sector!];
        if(level===order.planned.expectedLevel)order.planned.started=true;
        else {cancelPlans(state,order);report(state,event.at,'economy','Fila interrompida','O destino ou nível previsto mudou. As reservas dos planos que não começaram foram devolvidas.',false);}
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
    } else if(event.kind==="horde") resolveHorde(state, shared, world, event.day!, event.at);
    syncAllianceProjects(state,shared,event.at,(title,body)=>report(state,event.at,"alliance",title,body));
  syncSanctuaryPacts(state,shared,event.at,(title,body,refund)=>report(state,event.at,refund?"economy":"progress",title,body));
  syncSanctuaryRaidReports(state,shared,event.at,(at,title,body,positive)=>report(state,at,"combat",title,body,positive));
    recognizeSupport(state,shared,event.at);
    recordInfluenceVictory(state, event.at);
  }
  retargetArmyReturns(state);
  accrue(state, world, cursor, until);
  syncAllianceProjects(state,shared,until,(title,body)=>report(state,until,"alliance",title,body));
  syncSanctuaryPacts(state,shared,until,(title,body,refund)=>report(state,until,refund?"economy":"progress",title,body));
  syncSanctuaryRaidReports(state,shared,until,(at,title,body,positive)=>report(state,at,"combat",title,body,positive));
  recognizeSupport(state,shared,until);
  if (until >= world.startsAt) recordInfluenceVictory(state, until);
  const previousDay = getCozyDay(world, state.settledAt);
  state.settledAt = until;
  const currentDay = getCozyDay(world, until);
  if (currentDay > previousDay && until < endsAt!)
    report(
      state,
      until,
      "economy",
      `Relatório do dia ${currentDay}`,
      `Seu reino continuou produzindo durante sua ausência. ${state.cities.length} cidades, ${influence(state).total} de Influência e ${state.orders.length} ações em andamento.`,
    );
  if ((now >= endsAt! || world.status === "finalized") && options?.deferWorldEventsAt!==until) {
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
  return { state, shared };
}
function cancelPlans(state:CozyState,target:CozyOrder){
 const canceled=state.orders.filter(o=>o.planned&&!o.planned.started&&o.kind===target.kind&&(o.kind==='research'||o.cityId===target.cityId)&&o.planned.startsAt>=target.planned!.startsAt);
 for(const o of canceled)for(const resource of ['gold','materials','supplies'] as const)state.resources[resource]+=o.planned!.cost[resource]??0;
 state.orders=state.orders.filter(o=>!canceled.includes(o));
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
function addOrder(
  state: CozyState,
  world: CozyWorld,
  now: number,
  order: Omit<CozyOrder, "id" | "createdAt">,
) {
  rule(
    order.arrivesAt <= endAt(world)!,
    "Não há tempo para concluir essa ação antes do fim da temporada.",
  );
  const pending={ ...order, id: nextId(state, "order"), createdAt: now };
  state.orders.push(pending);
  return pending;
}
export function nextCityDayAt(state:CozyState,world:CozyWorld){
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
  if(action.type!=="king_choose")rule(
    computed.started && !computed.readOnly,
    computed.readOnly
      ? "Esta temporada já terminou."
      : "Aguarde o início da temporada.",
  );
  if(action.type==="king_choose")rule(!computed.readOnly,"Esta temporada já terminou.");
  rule(!state.defeat,"Seu império foi derrotado. Você ainda pode acompanhar os relatos e o resultado.");
  switch (action.type) {
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
      city.life??={contentment:state.satisfaction,lastDecisionDay:null};
      const priorTrust=city.life.contentment,priorIntegrity=city.integrity??100,priorBonus=city.life.productionEffect&&city.life.productionEffect.endsAt>now?city.life.productionEffect.bonus:0;
      city.life.contentment=clamp(city.life.contentment+option.contentment,0,100);
      if(city.life.contentment>=35)city.life.unrestDays=0;
      city.life.lastDecisionDay=computed.day;
      state.resources.materials+=option.materialsReward??0;
      if(option.integrityRestore)city.integrity=clamp((city.integrity??100)+option.integrityRestore,0,100);
      if(option.productionBonus)city.life.productionEffect={bonus:option.productionBonus,endsAt:now+2*dayMs(world)};
      recordCityCare(state,city,computed.day,city.life.contentment-priorTrust,(city.integrity??100)>priorIntegrity||option.productionBonus>priorBonus);
      report(state,now,"council",`${city.name}: decisão concluída`,`${option.label}.${option.integrityRestore?` Integridade: ${city.integrity}%.`:""}${option.materialsReward?` +${option.materialsReward} materiais.`:""}${option.contentment?` Satisfação local: ${city.life.contentment}%.`:''}${option.productionBonus?` Eficiência de produção: +${option.productionBonus}% por dois dias de jogo.`:''}`);
      break;
    }
    case 'cancel_plan': {
      const target=state.orders.find(o=>o.id===action.orderId);
      rule(target?.planned&&!target.planned.started,'Somente planos que ainda não começaram podem ser cancelados.');
      cancelPlans(state,target!);report(state,now,'economy','Planejamento cancelado','Este plano e os seguintes foram retirados da fila. As reservas que não foram utilizadas voltaram ao tesouro.');break;
    }
    case 'plan_upgrade':case 'plan_research': {
      rule(world.mode==='express','O planejamento está disponível no Expresso.');
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
      const {satisfaction,materials}=option.effects;
      const meaningfulCare=decreeCareRecognized(state,computed.day,option.effects.localSatisfaction??{},satisfaction);
      state.satisfaction=clamp(state.satisfaction+satisfaction,0,100);
      state.resources.materials+=materials;
      for(const city of state.cities)if(city.life){const before=city.life.contentment;city.life.contentment=clamp(city.life.contentment+(option.effects.localSatisfaction?.[city.id]??satisfaction),0,100);if(city.life.contentment>=35)city.life.unrestDays=0;recordCityCare(state,city,computed.day,city.life.contentment-before,false,false);}
      if(meaningfulCare&&satisfaction>=0&&state.cities.every(city=>(city.life?.contentment??0)>=60&&!((state.progression?.council.selfHarm[`${city.q},${city.r}`]??0)>0)))councilCredit(state,`decree:${decree.day}`,PROGRESSION.decreeMerit);
      state.decreesSigned.push(decree.day);
      report(
        state,
        now,
        "council",
        "Decreto assinado",
        `${decree.options.find((option) => option.id === action.optionId)!.label}: ${satisfaction >= 0 ? "+" : ""}${satisfaction} de contentamento e +${materials} materiais.`,
        satisfaction >= 0,
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
      rule(arrivesAt<endAt(world)!,"Não há tempo para concluir o desafio antes do fim da temporada.");
      resourceSpend(state,{supplies:exploreCost(state,tower)});
      const pending=addOrder(state,world,now,{kind:"attack",sanctuaryPactId:pact.id,q:tower.q,r:tower.r,arrivesAt});
      pact.guardian.attempts.push({orderId:pending.id,playerId:state.playerId,arrivesAt});
      break;
    }
    case "sanctuary_pact_start":case "sanctuary_pact_contribute":case "sanctuary_pact_cancel": {
      if(action.type==="sanctuary_pact_start"){
        const tower=ALL_SANCTUARIES.find(t=>t.id===action.sanctuaryId);
        rule(!tower||now+travelMs(state,world,tower)<endAt(world)!,"Não há tempo para concluir o desafio antes do fim da temporada.");
      }
      try{applySanctuaryPactAction(state,shared,action,now,dayMs(world),endAt(world)!,prefix=>nextId(state,prefix),sanctuaryGuardianPower(world,now));}
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

      rule(
        !state.orders.some((order) => order.kind === "explore"),
        "Uma exploração já está em andamento.",
      );
      rule(
        !state.explored.includes(id) ||
          ((base.kind === "gold" || base.kind === "materials") &&
            (resourceArea(shared,coord,base.kind)?.reserve.surveys ?? shared.deposits[id]?.surveys ?? 0) < 3),
        "Essa área já foi totalmente explorada.",
      );
      resourceSpend(state, { supplies: exploreCost(state, coord) });
      addOrder(state, world, now, {
        kind: "explore",
        ...coord,
        explorationPath:explorationPath(state,coord),
        arrivesAt: now + travelMs(state, world, coord),
      });
      break;
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
      if (action.type === "annex")
        rule(
          base.kind === "abandoned" && state.explored.includes(id),
          "Revele a cidade abandonada antes de anexar.",
        );
      if (conquest) {
        rule(state.cities.length < 10, "Seu reino já tem dez cidades.");
        validateFreeHero(state, action.heroId);
        rule(
          combatAssessment(computed.armyPower,base.power).occupationMargin,
          "A conquista exige poder pelo menos 25% maior que a resistência local.",
        );
      } else
        rule(
          !state.raided[id] || now - state.raided[id] >= dayMs(world) * 6,
          "Esse local se recupera do último saque. Aguarde seis dias de jogo.",
        );
      rule(computed.armyPower > 0, "Recrute tropas antes de atacar.");
      if(conquest){
          const owner=shared.territories?.[id];
        rule(!owner||owner===state.playerId||areaAllied(shared,owner,state.playerId),"Este território pertence a outro império.");
      }
      addOrder(state, world, now, {
        kind: "attack",
        ...coord,
        conquest,
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
      rule(Boolean(area)&&state.explored.includes(key(coord)),"Revele a área antes de anexar.");
      rule(area!.reserve.surveys===3&&area!.reserve.remaining>0,"Conclua os levantamentos de uma área com reserva disponível.");
      rule(!area!.owners.includes(state.playerId),"Seu reino já anexou esta área.");
      rule(!area!.owners.length||areaAllied(shared,area!.owners[0],state.playerId),"A área pertence a outro reino. É preciso uma aliança para compartilhar.");
      rule(area!.cells.every(id=>{const owner=shared.claims[id]?.playerId??shared.territories?.[id];return !owner||owner===state.playerId||areaAllied(shared,owner,state.playerId);}),"Há território de outro império nesta área.");
      area!.owners.push(state.playerId);area!.annexedAt??=now;
      const territoryCity=nearestTerritoryCity(state,coord)!;(area!.ownerCities??={})[state.playerId]=territoryCity.id;shared.territoryCities??={};
      for(const id of area!.cells)if(!shared.claims[id]&&!shared.independentCities?.[id]&&!shared.territories![id]&&!sanctuaryAt(fromKey(id))) {shared.territories![id]=state.playerId;shared.territoryCities[id]={playerId:state.playerId,cityId:territoryCity.id};}
      report(state,now,"progress","Área anexada",area!.owners.length>1?"O acesso ao recurso está compartilhado em aliança. As terras de cada império permanecem.":"A reserva pertence ao reino. O território permanece quando o recurso se esgotar.");
      break;
    }
    case "collect": {
      const coord = validateCoord(action,state,shared), id=key(coord), base=baseTile(world,coord,shared);
      const area=(base.kind==="gold"||base.kind==="materials")?resourceArea(shared,coord,base.kind):undefined;
      const deposit=area?.reserve;
      rule(state.explored.includes(id)&&deposit&&deposit.surveys===3,"Revele a área e conclua os três levantamentos para coletar.");
      rule(Boolean(area)&&canUseArea(shared,area!,state.playerId),"Anexe a área ou compartilhe-a em aliança antes de coletar.");
      rule(deposit.remaining > 0, "Esse depósito está esgotado.");
      rule(
        !state.orders.some((order) => order.kind === "collect"),
        "Uma coleta já está em andamento.",
      );
      const amount = Math.min(
        deposit.remaining,
        (deposit.resource === "gold" ? 350 : 1200)*(economicExpress(world)?4:1),
      );
      // Reserve under the same shared CAS as the order. Offline arrival order cannot duplicate a deposit.
      deposit.remaining -= amount;
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
        `${QUESTS.find((item) => item.id === action.questId)!.name}: +50 de Legado.`,
      );
      break;
    }
    case "portal": {
      // Compatibility for older clients: no travel or positional requirement.
      rule(influence(state).total >= 1500, "Alcance 1.500 de Influência para conquistar o Selo de Vitória.");
      recordInfluenceVictory(state, now);
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
  if(computed.started)recordInfluenceVictory(state, now);
  return { state, shared };
}
