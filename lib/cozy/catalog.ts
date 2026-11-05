import type {
  CozyCity,
  CozyHeroRole,
  CozyResearch,
  CozySector,
  CozyState,
  CozyTroop,
} from "./types";

/** Shared duration preview; the server still validates and commits every order. */
export const researchCost=(state:CozyState,level:number)=>Math.round(200*1.7**level*(state.progression?.balance?.expressEconomy?0.25:1));
export const upgradeCost=(state:CozyState,level:number)=>Math.round(150*(state.progression?.balance?.constructionGrowth??1.42)**level);
export const planningCapacity=(state:CozyState)=>state.progression?.balance?.plannedCapacity??4;
export function getCozyResearchDurationMs(state:CozyState,research:CozyResearch,dayMs:number):number {
  const sages=state.heroes.filter(hero=>hero.role==="sage"&&hero.cityId!==null).length;
  return Math.round(dayMs*(0.25+state.research[research]*0.1)*(1-Math.min(4,sages)*0.15));
}

export function getCozyUpgradeDurationMs(
  state: CozyState,
  city: CozyCity,
  sector: CozySector,
  dayMs: number,
): number {
  const engineer = state.heroes.some(
    (hero) =>
      hero.id === city.heroId &&
      hero.cityId === city.id &&
      hero.role === "engineer",
  );
  return Math.round(
    dayMs * (0.04 + city.sectors[sector] * 0.014) * (engineer ? 0.75 : 1),
  );
}

export const SECTORS: { id: CozySector; name: string; description: string }[] =
  [
    {
      id: "administration",
      name: "Administração",
      description:
        "Organiza a cidade e aumenta a produção de materiais. O Conselho cuida das decisões do reino.",
    },
    {
      id: "economy",
      name: "Economia",
      description:
        "Fazendas e oficinas produzem alimento e materiais automaticamente.",
    },
    {
      id: "society",
      name: "Sociedade",
      description:
        "Moradia, emprego e bem-estar. Contribui para a influência social.",
    },
    {
      id: "recruitment",
      name: "Recrutamento",
      description:
        "Aumenta a capacidade do exército global e reduz o custo das tropas.",
    },
    {
      id: "defense",
      name: "Defesa",
      description: "As muralhas somam proteção à defesa global contra hordas.",
    },
  ];
export const TROOPS: {
  id: CozyTroop;
  name: string;
  power: number;
  baseCost: number;
  unlockResearch: number;
}[] = [
  { id: "militia", name: "Milícia", power: 1, baseCost: 12, unlockResearch: 0 },
  {
    id: "shooters",
    name: "Atiradores",
    power: 3,
    baseCost: 34,
    unlockResearch: 1,
  },
  {
    id: "scouts",
    name: "Batedores",
    power: 4,
    baseCost: 44,
    unlockResearch: 2,
  },
  {
    id: "machinery",
    name: "Maquinaria",
    power: 10,
    baseCost: 100,
    unlockResearch: 3,
  },
];
export const HERO_ROLES: {
  id: CozyHeroRole;
  name: string;
  description: string;
}[] = [
  {
    id: "general",
    name: "General",
    description:
      "Designado a uma cidade: +8% ao poder do exército (máximo +40%).",
  },
  {
    id: "engineer",
    name: "Engenheiro",
    description: "Designado a uma cidade: obras dessa cidade 25% mais rápidas.",
  },
  {
    id: "administrator",
    name: "Administrador",
    description:
      "Designado a uma cidade: +15% à sua produção de materiais e alimento.",
  },
  {
    id: "explorer",
    name: "Explorador",
    description:
      "Designado a uma cidade: viagens do reino 10% mais rápidas (máximo 40%).",
  },
  {
    id: "sage",
    name: "Sábio",
    description:
      "Designado a uma cidade: pesquisas 15% mais rápidas (máximo 60%).",
  },
];
export const RESEARCHES: {
  id: CozyResearch;
  name: string;
  description: string;
  maxLevel: number;
}[] = [
  {
    id: "economy",
    name: "Cultivo e ofícios",
    description: "+8% de materiais e alimento por nível.",
    maxLevel: 5,
  },
  {
    id: "military",
    name: "Doutrina militar",
    description:
      "+20% de poder por nível. Atiradores no 1, Batedores no 2, Maquinaria no 3.",
    maxLevel: 5,
  },
  {
    id: "exploration",
    name: "Cartografia",
    description: "Reduz tempo e alimento das explorações em 8% por nível.",
    maxLevel: 5,
  },
  {
    id: "fortification",
    name: "Muralhas do reino",
    description: "+15% ao poder das muralhas por nível.",
    maxLevel: 5,
  },
];
export const COUNSELORS = [
  {
    id: "helena",
    name: "Helena",
    moral: "Diplomática",
    seat: "political" as const,
    description: "Procura acordos e valoriza a confiança do povo.",
  },
  {
    id: "tomas",
    name: "Tomás",
    moral: "Pragmático",
    seat: "political" as const,
    description: "Prefere resultados econômicos e reservas para o futuro.",
  },
  {
    id: "ines",
    name: "Inês",
    moral: "Solidária",
    seat: "internal" as const,
    description: "Defende acolhimento, trabalho e bem-estar.",
  },
  {
    id: "bento",
    name: "Bento",
    moral: "Severo",
    seat: "internal" as const,
    description: "Valoriza disciplina e obras de proteção.",
  },
];
export const QUESTS = [
  {
    id: "city",
    name: "Uma cidade para chamar de lar",
    description: "Alcance desenvolvimento 40 em uma cidade.",
    target: 40,
    points: 50,
  },
  {
    id: "expansion",
    name: "Três cidades, um reino",
    description: "Governe três cidades.",
    target: 3,
    points: 50,
  },
  {
    id: "exploration",
    name: "Além da neblina",
    description: "Revele dez pontos do mapa.",
    target: 10,
    points: 50,
  },
  {
    id: "research",
    name: "Conhecimento compartilhado",
    description: "Conclua cinco níveis de pesquisa.",
    target: 5,
    points: 50,
  },
  {
    id: "defense",
    name: "O reino permanece",
    description: "Vença duas hordas.",
    target: 2,
    points: 50,
  },
  {
    id: "council",
    name: "A voz da Coroa",
    description: "Assine cinco decretos.",
    target: 5,
    points: 50,
  },
];
export const COZY_LIMITS = {
  cities: 10,
  heroes: 10,
  sectorLevel: 10,
  influenceArea: 500,
  influenceTotal: 2500,
  portalCut: 1500,
  durationDays: 120,
  exodusDay: 91,
  wonderCost: 8000,
} as const;
/** Infrastructure points require all five sectors; development remains a separate 0–100 scale. */
export function getCityInfrastructure(city: CozyCity): number {
  return SECTORS.every((sector) => city.sectors[sector.id] > 0)
    ? SECTORS.reduce((sum, sector) => sum + city.sectors[sector.id], 0)
    : 0;
}
export function getCityDevelopment(city: CozyCity): number {
  return SECTORS.reduce(
    (sum, sector) =>
      sum + Math.max(0, Math.min(10, city.sectors[sector.id])) * 2,
    0,
  );
}
/** Presentation only: completed sector levels drive the same city art on every screen. */
export function getCityAppearance(city: CozyCity) {
  const development = getCityDevelopment(city);
  if (development < 34) return { art: "settlementSmall" as const, stage: 1, label: "Cidade pequena", development };
  if (development < 68) return { art: "settlementMedium" as const, stage: 2, label: "Cidade média", development };
  return { art: "settlementLarge" as const, stage: 3, label: "Cidade grande", development };

}
export function canRecruitTroop(state: CozyState, troop: CozyTroop): boolean {
  const definition = TROOPS.find((item) => item.id === troop);
  return Boolean(
    definition && state.research.military >= definition.unlockResearch,
  );
}

export const CITY_TYPES = {neutral:"Neutra",metropole:"Metrópole",posto_avancado:"Posto avançado",bastiao:"Bastião",celeiro:"Celeiro"} satisfies Record<import("../cities").CityClass,string>;
