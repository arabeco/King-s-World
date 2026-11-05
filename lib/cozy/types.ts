import type {CityLifeView} from "./city-life";
import type {progressionBreakdown} from './progression';
/** Version two is a separate, server-owned season. Legacy saves remain untouched. */
export type CozyWorld = {
  id: string;
  name: string;
  mode: "classic" | "express";
  speedMultiplier?: 1 | 2 | 4;
  economyVersion?:2;
  status: "open" | "running" | "finalized";
  startsAt: number | null;
  influenceVersion?: 1 | 2;
  combatMode?:"cozy"|"competitive";
};
export type CozyCoord = { q: number; r: number };
export type CozySector =
  | "administration"
  | "economy"
  | "society"
  | "recruitment"
  | "defense";
export type CozyBuildingDamage={sector:CozySector;from:number;to:number};
export type CozyTroop = "militia" | "shooters" | "scouts" | "machinery";
export type CozyHeroRole =
  | "general"
  | "engineer"
  | "administrator"
  | "explorer"
  | "sage";
export type CozyResearch =
  | "economy"
  | "military"
  | "exploration"
  | "fortification";
export type CozyResources = {
  gold: number;
  materials: number;
  supplies: number;
};
export type CozyCity = CozyCoord & {
  renamedBy?:string[];
  cityClass?: import("../cities").CityClass;
  id: string;
  name: string;
  capital: boolean;
  sectors: Record<CozySector, number>;
  heroId: string | null;
  wonder: boolean;
  integrity?:number;
  life?: {contentment:number;lastDecisionDay:number|null;lastSocialDay?:number;unrestDays?:number;hordeDamage?:number;productionEffect?:{bonus:number;endsAt:number}};
};
export type CozyHero = {
  id: string;
  name: string;
  role: CozyHeroRole;
  cityId: string | null;
};
export type CozyOrder = {
  id: string;
  kind: "explore" | "attack" | "collect" | "portal" | "upgrade" | "research";
  createdAt: number;
  arrivesAt: number;
  q?: number;
  r?: number;
  cityId?: string;
  sector?: CozySector;
  research?: CozyResearch;
  heroId?: string;
  sanctuaryId?: string;
  sanctuaryPactId?: string;
  targetPlayerId?:string;
  targetCityId?:string;
  expeditionArmy?:Record<CozyTroop,number>;
  abstractAttack?:boolean;
  returning?:boolean;
  returnTravelMs?:number;
  cargo?:Partial<CozyResources>;
  expeditionOrigin?:CozyCoord;
  explorationPath?:CozyCoord[];
  planned?: {startsAt:number; expectedLevel:number; cost:Partial<CozyResources>; started:boolean};
  conquest?: boolean;
  areaRules?: boolean;
  collectResource?: "gold" | "materials";
  collectAmount?: number;
};
export type CozyReport = {
  id: string;
  at: number;
  kind:
    | "welcome"
    | "exploration"
    | "combat"
    | "horde"
    | "economy"
    | "council"
    | "progress"
    | "alliance"
    | "portal"
    | "season";
  title: string;
  body: string;
  positive: boolean;
  battle?: {
    city: CozyCoord & {name:string};
    perspective: 'attacker'|'defender';
    attackPower:number;
    defensePower:number;
    troopsLost:number;
    integrityBefore:number;
    integrityAfter:number;
    infrastructureBefore:number;
    infrastructureAfter:number;
    buildings:CozyBuildingDamage[];
    resourceDelta:Partial<CozyResources>;
    delivery:'return'|'credited'|'lost';
    returnsAt?:number;
    conquered:boolean;
  };
};
export type CozyDecree = {
  id: string;
  day: number;
  counselorId: string;
  title: string;
  body: string;
  options: { id: string; label: string; description: string; effects: {materials: number; satisfaction: number; localSatisfaction?:Record<string,number>}; resolution: "certain"; }[];
};
export type CozyProgression = {
  version: 2;
  balance?: {militaryDivisor:number; militaryVictoryMax?:number; councilExpansionDamping:boolean; expressEconomy?:boolean;plannedCapacity?:number;infrastructureRanked?:boolean;infrastructureWeights?:number[];constructionGrowth?:number;councilMeaningfulDecrees?:boolean;councilContinuity?:boolean;councilMerit?:{decree:number;local:number;stable:number};councilSourceCaps?:{decree:number;local:number;stable:number}};
  capitalId: string;
  capitalLevels: Record<CozySector,number>;
  militaryBaseline: number;
  council: {sources?:{decree:number;local:number;stable:number};merit:number;episodes:string[];careSince:Record<string,number>;selfHarm:Record<string,number>};
  feats: {wonders:string[];surveys:string[];collected:Record<string,number>;supports:string[];projects?:string[]};
};
export type CozyState = {
  knownTerritories?:string[];
  scoutedCells?:string[];
  defeat?:{at:number;byPlayerId:string;lastCityId:string};
  capitalSelectionPending?:boolean;
  crestId?:string;
  crestFinish?:'plain'|'imperial';
  version: 2;
  playerId: string;
  playerName: string;
  createdAt: number;
  settledAt: number;
  citySystemsAt?:number;
  progression?:CozyProgression;
  king?: {sovereignId?:string;equipment?:string[];attributes?:{administration:number;command:number;exploration:number};profileId:string|null;nickname:string;alive:boolean;generation:number;history:{nickname:string;profileId:string|null;generation:number;diedAt:number;defense:number;enemyPower:number}[]};
  resources: CozyResources;
  cities: CozyCity[];
  army: Record<CozyTroop, number>;
  heroes: CozyHero[];
  research: Record<CozyResearch, number>;
  counselors: [string, string];
  satisfaction: number;
  explored: string[];
  sanctuaryVisits?: Record<string, number>;
  sanctuaryPactReceipts?: Record<string,"completed"|"refunded">;
  sanctuaryRaidReceipts?:string[];
  sanctuaryBenefits?: {supportRules?:2;pactId:string;allianceId:string|null;ownerPlayerId:string;kind:CozyAllianceProjectKind;from:number;until:number}[];
  raided: Record<string, number>;
  orders: CozyOrder[];
  reports: CozyReport[];
  readAt: number;
  quests: string[];
  decreesSigned: number[];
  hordesResolved: number[];
  hordesWon: number;
  supportSentAt: number | null;
  allianceId: string | null;
  allianceProjectReceipts?: Record<string,"completed"|"refunded">;
  allianceBenefits?: {projectId:string;allianceId:string;kind:CozyAllianceProjectKind;from:number;until:number}[];
  cooperation: number;
  portalCrossedAt: number | null;
  finalizedAt: number | null;
  finalScore: number | null;
  seasonXp: number;
  sequence: number;
};
export type CozyDeposit = {
  id: string;
  resource: "gold" | "materials";
  capacity: number;
  remaining: number;
  surveys: number;
  contributors: string[];
};
export type CozyResourceArea = {
  id: string;
  resource: "gold" | "materials";
  cells: string[];
  reserve: CozyDeposit;
  owners: string[];
  ownerCities?:Record<string,string>;
  annexedAt: number | null;
};
export type CozyAllianceProjectKind = "defense" | "provisions";
export type CozyAllianceProject = {
 id:string;allianceId:string;kind:CozyAllianceProjectKind;createdAt:number;
 contributions:Record<string,Partial<CozyResources>>;completedAt:number|null;until:number|null;canceledAt?:number;
};
export type CozySanctuaryThreat={pactId:string;day:number;arrivesAt:number;power:number;defense:number;pledgedPower:number;offer:number;availableAt:number;canDefend:boolean;reason:string};
export type CozySanctuaryPact = {
  id:string;supportRules?:2;sanctuaryId:string;ownerPlayerId:string;allianceId:string|null;kind:CozyAllianceProjectKind;createdAt:number;
  contributions:Record<string,Partial<CozyResources>>;completedAt:number|null;until:number|null;canceledAt?:number;
  endedAt?:number;
  raids?:{version:1;waves:{day:number;arrivesAt:number;power:number;defenders:{playerId:string;at:number;power:number}[];outcome?:"won"|"lost"|"canceled";resolvedAt?:number;defense?:number;recipients?:string[]}[]};
  guardian?:{power:number;attempts:{orderId:string;playerId:string;arrivesAt:number;at?:number;outcome?:"won"|"lost"|"canceled";attackPower?:number;losses?:number}[]};
};
export type CozyAlliance = {
  id: string;
  name: string;
  founderId: string;
  admission?: "open"|"approval";
  invitations?: string[];
  requests?: string[];
  members: string[];
  createdAt: number;
};
export type CozySupport = {
  id: string;
  allianceId: string;
  requesterId: string;
  waveDay: number;
  arrivesAt: number;
  requestedAt: number;
  supporterId: string | null;
  power: number;
  acceptedAt: number | null;
  resolvedAt?:number;
};
export type CozyShared = {
  realmCrests?:Record<string,{id:string;finish:'plain'|'imperial'}>;
  version: 2;
  progressionBalance?: CozyProgression['balance'] | null;
  claims: Record<string, { playerId: string; cityId: string; name: string; reservedSlot?: boolean }>;
  deposits: Record<string, CozyDeposit>;
  areas?: Record<string, CozyResourceArea>;
  territories?: Record<string, string>;
  territoryCities?:Record<string,{playerId:string;cityId:string}>;
  independentCities?:Record<string,{city:CozyCity;formerOwnerId:string;at:number;reason:"separation"|"horde";territory?:string[];resourceAreas?:string[]}>;
  allianceBattles?: {id:string;allianceId:string;playerId:string;waveDay:number;at:number;won:boolean;defense:number;enemyPower:number;troopsLost:number;supportPower:number;damage?:{city:string;integrityLost:number;lost:boolean;buildings?:CozyBuildingDamage[];infrastructureLost?:number}}[];
  allianceProjects?: CozyAllianceProject[];
  sanctuaryPacts?: CozySanctuaryPact[];
  alliances: CozyAlliance[];
  support: CozySupport[];
};
export type CozyTileKind =
  | "unknown"
  | "plain"
  | "ruin"
  | "npc"
  | "abandoned"
  | "gold"
  | "materials"
  | "portal"
  | "city";
export type CozyTile = CozyCoord & {
  reservedSlot?: boolean;
  id: string;
  kind: CozyTileKind;
  clue: string;
  name: string;
  revealed: boolean;
  terrainVisible?: boolean;
  attackable: boolean;
  ownerId: string | null;
  cityId: string | null;
  color: "fog" | "neutral" | "yellow" | "green" | "ally";
  power: number | null;
  deposit: CozyDeposit | null;
  territoryOwnerId?: string | null;
  landmarkId?: string | null;
  combat?: {attackRequired:number;occupationRequired:number;attackWins:boolean;occupationMargin:boolean} | null;
  area?: { id: string; cells: string[]; owners: string[]; canAnnex: boolean; canCollect: boolean } | null;
  distance: number;
  exploreCost: number;
  travelMs: number;
};
export type CozyInfluence = {
  infrastructure: number;
  government: number;
  military: number;
  society: number;
  legacy: number;
  total: number;
};
export type CozyComputed = {
  influenceDetails: ReturnType<typeof progressionBreakdown>;
  day: number;
  durationDays: number;
  realDurationDays: number;
  dayMs: number;
  endsAt: number | null;
  phase: string;
  started: boolean;
  readOnly: boolean;
  influence: CozyInfluence;
  worldDiagonalLimit?: number;
  playerThreats?:{orderId:string;attackerId:string;attackerName:string;cityId:string;cityName:string;arrivesAt:number;conquest:boolean}[];
  armyPower: number;
  playerAttackPower:number;
  defensePower: number;
  supportOffer: number;
  allianceDefenseBonus:number;
  allianceSupplyBonus:number;
  fortificationPower:number;
  royalDefenseBonus:number;
  towerDefenseBonus?:number;
  equipmentDefenseBonus?:number;
  recruitmentDiscount: number;
  armyCapacity: number;
  productionPerDay: CozyResources;
  cityLife: Record<string,CityLifeView>;
  nextHorde: {
    day: number;
    arrivesAt: number;
    power: number;
    supportPower: number;
  } | null;
  decree: CozyDecree | null;
  portalOpen: boolean;
  canEnterPortal: boolean;
  unreadReports: number;
  heroCost: number;
  troopCosts: Record<CozyTroop, number>;
  researchCosts: Record<CozyResearch, number>;
  upgradeCosts: Record<string, Record<CozySector, number>>;
  wonderCost: number;
  sanctuaries: {id:string;name:string;q:number;r:number;visitedAt:number|null;supplyCost:number;travelMs:number;arrivesAt:number|null;guardianPower:number}[];
  sanctuaryBonuses:{defense:number;provisions:number};
  sanctuaryThreats?:CozySanctuaryThreat[];
  questProgress: {
    id: string;
    current: number;
    target: number;
    complete: boolean;
    claimed: boolean;
  }[];
};
export type CozyAction =
  | {type:"attack_player";q:number;r:number;conquest?:boolean;heroId?:string}
  | {type:"capital_choose";cityId:string}
  | {type:'plan_upgrade';cityId:string;sector:CozySector;steps?:1|2|3|4}
  | {type:'plan_research';research:CozyResearch;steps?:1|2|3|4}
  | {type:'cancel_plan';orderId:string}
  | {type:"king_choose";profileId:string;nickname:string;equipment?:string[];kingId?:string;statRevision?:number;crestId?:string;crestFinish?:'plain'|'imperial'}
  | {type:"city_decision";cityId:string;decisionId:string;optionId:string}
  | { type: "upgrade"; cityId: string; sector: CozySector }
  | { type: "recruit"; troop: CozyTroop; amount: number | "max" }
  | { type: "hire"; role: CozyHeroRole }
  | { type: "assign"; heroId: string; cityId: string | null }
  | { type: "research"; research: CozyResearch }
  | { type: "counselor"; slot: 0 | 1; counselorId: string }
  | { type: "decree"; decreeId: string; optionId: string }
  | { type: "explore"; q: number; r: number }
  | {
      type: "attack";
      q: number;
      r: number;
      conquest?: boolean;
  areaRules?: boolean;
      heroId?: string;
    }
  | { type: "annex"; q: number; r: number; heroId: string }
  | { type: "collect"; q: number; r: number }
  | { type: "wonder"; cityId: string }
  | { type: "sanctuary_explore"; sanctuaryId: string }
  | {type:"sanctuary_pact_start";sanctuaryId:string;kind:CozyAllianceProjectKind;scope:"solo"|"alliance"}
  | {type:"sanctuary_pact_contribute";pactId:string;resource:keyof CozyResources;amount:50|100|"max"}
  | {type:"sanctuary_pact_cancel";pactId:string}
  | {type:"sanctuary_pact_challenge";pactId:string}
  | {type:"sanctuary_pact_defend";pactId:string;waveDay:number}
  | { type: "quest"; questId: string }
  | { type: "area_annex"; q: number; r: number }
  | { type: "portal" }
  | { type: "alliance_create"; name: string }
  | { type: "alliance_join"; allianceId: string }
  | { type: "alliance_leave" }
  | {type:"alliance_invite";playerId:string}
  | {type:"alliance_request";allianceId:string}
  | {type:"alliance_respond";playerId:string;accept:boolean}
  | {type:"alliance_decline";allianceId:string}
  | {type:"alliance_settings";admission:"open"|"approval"}
  | {type:"alliance_project_start";kind:CozyAllianceProjectKind}
  | {type:"alliance_project_contribute";projectId:string;resource:keyof CozyResources;amount:50|100|"max"}
  | { type: "support_request" }
  | { type: "support_send"; requestId: string }
  | { type: "read_reports" }
  | { type: "city_class"; cityId:string; cityClass:import("../cities").CityClass }
  | { type: "rename_city"; cityId: string; name: string };
export type CozyPlayerSummary = {
  playerId: string;
  playerName: string;
  influence: number;
  cities: number;
  portalCrossedAt: number | null;
  allianceId: string | null;
  finalized: boolean;
};
export type CozyAccount = {
  xp: number;
  level: number;
  seals: number;
  trophies: number;
  seasons: number;
};
export type CozyPayload = {
  world: CozyWorld;
  state: CozyState;
  shared: CozyShared;
  computed: CozyComputed;
  tiles: CozyTile[];
  players: CozyPlayerSummary[];
  account: CozyAccount;
  revision: number;
  serverNow: number;
};
