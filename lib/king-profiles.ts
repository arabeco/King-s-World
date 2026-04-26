export type KingProfileId =
  | "aurelian"
  | "serenna"
  | "magnor"
  | "valerius"
  | "isolde"
  | "orian"
  | "maelis"
  | "corven"
  | "nyra";

export type KingProfile = {
  id: KingProfileId;
  title: string;
  name: string;
  imageSrc: string;
  summary: string;
  traits: Array<{
    label: string;
    value: string;
    tone: "bonus" | "penalty";
  }>;
};

export type KingGameplayModifiers = {
  buildingCostMultiplier: number;
  resourceProductionMultiplier: number;
  satisfactionDelta: number;
  crisisRiskDelta: number;
  militaryBuildBonus: number;
  explorationSpeedMultiplier: number;
};

const DEFAULT_KING_MODIFIERS: KingGameplayModifiers = {
  buildingCostMultiplier: 1,
  resourceProductionMultiplier: 1,
  satisfactionDelta: 0,
  crisisRiskDelta: 0,
  militaryBuildBonus: 0,
  explorationSpeedMultiplier: 1,
};

export const KING_GAMEPLAY_MODIFIERS: Record<KingProfileId, KingGameplayModifiers> = {
  aurelian: {
    ...DEFAULT_KING_MODIFIERS,
    buildingCostMultiplier: 0.98,
    explorationSpeedMultiplier: 0.98,
  },
  serenna: {
    ...DEFAULT_KING_MODIFIERS,
    satisfactionDelta: 3,
    militaryBuildBonus: -0.01,
  },
  magnor: {
    ...DEFAULT_KING_MODIFIERS,
    militaryBuildBonus: 0.01,
    resourceProductionMultiplier: 0.99,
  },
  valerius: {
    ...DEFAULT_KING_MODIFIERS,
    explorationSpeedMultiplier: 1.03,
    satisfactionDelta: -2,
  },
  isolde: {
    ...DEFAULT_KING_MODIFIERS,
    crisisRiskDelta: -4,
    resourceProductionMultiplier: 0.99,
  },
  orian: {
    ...DEFAULT_KING_MODIFIERS,
    explorationSpeedMultiplier: 1.04,
    militaryBuildBonus: -0.01,
  },
  maelis: {
    ...DEFAULT_KING_MODIFIERS,
    satisfactionDelta: 2,
    militaryBuildBonus: -0.01,
  },
  corven: {
    ...DEFAULT_KING_MODIFIERS,
    explorationSpeedMultiplier: 1.04,
    buildingCostMultiplier: 1.01,
  },
  nyra: {
    ...DEFAULT_KING_MODIFIERS,
    militaryBuildBonus: 0.02,
    satisfactionDelta: -2,
  },
};

export function resolveKingGameplayModifiers(profileId: KingProfileId | null | undefined): KingGameplayModifiers {
  return profileId ? (KING_GAMEPLAY_MODIFIERS[profileId] ?? DEFAULT_KING_MODIFIERS) : DEFAULT_KING_MODIFIERS;
}

export const KING_PROFILES: KingProfile[] = [
  {
    id: "aurelian",
    title: "Rei",
    name: "Aurelian Voss",
    imageSrc: "/images/king-aurelian.jpg",
    summary: "Soberano de comando frio, corte disciplinada e ambicao imperial.",
    traits: [
      { label: "Governo", value: "Ordem +", tone: "bonus" },
      { label: "Mapa", value: "Ritmo -", tone: "penalty" },
    ],
  },
  {
    id: "serenna",
    title: "Rainha",
    name: "Serenna Vale",
    imageSrc: "/images/queen-serenna.jpg",
    summary: "Rainha de leitura politica, estabilidade e paciencia de longo prazo.",
    traits: [
      { label: "Sociedade", value: "Satisfacao +", tone: "bonus" },
      { label: "Militar", value: "Pressao -", tone: "penalty" },
    ],
  },
  {
    id: "magnor",
    title: "Rei",
    name: "Magnor Ferroalto",
    imageSrc: "/images/king-magnor.jpg",
    summary: "Veterano de fronteira, construtor de reinos duros e muralhas vivas.",
    traits: [
      { label: "Defesa", value: "Muralha +", tone: "bonus" },
      { label: "Producao", value: "Fluxo -", tone: "penalty" },
    ],
  },
  {
    id: "valerius",
    title: "Rei",
    name: "Valerius Kael",
    imageSrc: "/images/king-valerius.jpg",
    summary: "Nobre agressivo, veloz na expansao e perigoso quando ganha ritmo.",
    traits: [
      { label: "Expansao", value: "Conquista +", tone: "bonus" },
      { label: "Sociedade", value: "Tensao -", tone: "penalty" },
    ],
  },
  {
    id: "isolde",
    title: "Rainha",
    name: "Isolde Gray",
    imageSrc: "/images/queen-isolde.jpg",
    summary: "Rainha austera, excelente em segurar crise sem perder a coroa.",
    traits: [
      { label: "Crise", value: "Controle +", tone: "bonus" },
      { label: "Expansao", value: "Ritmo -", tone: "penalty" },
    ],
  },
  {
    id: "orian",
    title: "Rei",
    name: "Orian Mastro",
    imageSrc: "/images/king-orian.jpg",
    summary: "Mente de rede e logistica, forte em fluxo, rotas e folego de campanha.",
    traits: [
      { label: "Logistica", value: "Rotas +", tone: "bonus" },
      { label: "Defesa", value: "Guarda -", tone: "penalty" },
    ],
  },
  {
    id: "maelis",
    title: "Rainha",
    name: "Maelis Verdan",
    imageSrc: "/images/queen-maelis.jpg",
    summary: "Rainha de cultura e memoria, sobe legado sem perder leitura do reino.",
    traits: [
      { label: "Legado", value: "Memoria +", tone: "bonus" },
      { label: "Quartel", value: "Treino -", tone: "penalty" },
    ],
  },
  {
    id: "corven",
    title: "Rei",
    name: "Corven Nalto",
    imageSrc: "/images/king-corven.jpg",
    summary: "Explorador coroado, vive de mapa aberto, visao e risco calculado.",
    traits: [
      { label: "Exploracao", value: "Visao +", tone: "bonus" },
      { label: "Governo", value: "Ordem -", tone: "penalty" },
    ],
  },
  {
    id: "nyra",
    title: "Rainha",
    name: "Nyra Ashen",
    imageSrc: "/images/queen-nyra.jpg",
    summary: "Rainha sombria, forte em pressao, fim de mundo e escolhas duras.",
    traits: [
      { label: "Militar", value: "Ataque +", tone: "bonus" },
      { label: "Sociedade", value: "Calma -", tone: "penalty" },
    ],
  },
];

export const KING_PROFILE_BY_ID = Object.fromEntries(KING_PROFILES.map((profile) => [profile.id, profile])) as Record<
  KingProfileId,
  KingProfile
>;
