"use client";

import {
  PORTAL_MANDATE_DAY,
  PORTAL_PRESSURE_DAY,
  SOVEREIGNTY_PORTAL_CUT,
  calculateDefensePower,
  calculateSovereigntyScore,
  calculateTroopPower,
  calculateVillageDevelopment,
} from "@/core/GameBalance";
import type { HeroSpecialistId } from "@/lib/council";
import { buildKingdomSurvivalState } from "@/lib/kingdom-survival";
import type { VillageSummary } from "@/lib/mock-data";

export type SenateResources = {
  materials: number;
  supplies: number;
  influence: number;
};

export type SenateTroops = {
  militia: number;
  shooters: number;
  scouts: number;
  machinery: number;
};

export type PoliticalPressureBand = "CALM" | "TENSE" | "PRESSURED" | "CRITICAL";
export type SenateMeetingKind = "CRITICAL" | "IMPORTANT" | "POLITICAL";
export type SenateMeetingId =
  | "frontier-lockdown"
  | "treasury-strain"
  | "portal-mandate"
  | "raider-incursion"
  | "demon-breach";

export type SenateChoiceEffect = {
  materials?: number;
  supplies?: number;
  influence?: number;
  militia?: number;
  shooters?: number;
  scouts?: number;
  machinery?: number;
  satisfaction?: number;
  pressure?: number;
  neglect?: number;
};

export type SenateMeetingChoice = {
  id: string;
  label: string;
  note: string;
  effect: SenateChoiceEffect;
};

export type SenateMeeting = {
  id: SenateMeetingId;
  kind: SenateMeetingKind;
  title: string;
  situation: string;
  heroId: HeroSpecialistId;
  heroLine: string;
  choices: SenateMeetingChoice[];
  triggeredAtDay: number;
  sourceTags: string[];
};

export type SenateState = {
  satisfaction: number;
  politicalPressure: number;
  pressureBand: PoliticalPressureBand;
  politicalNeglect: number;
  activeMeeting: SenateMeeting | null;
  lastMeetingDay: number;
  resolvedMeetingIds: string[];
  dismissedHeroes: HeroSpecialistId[];
};

export type SenateClimate = {
  politicalPressure: number;
  pressureBand: PoliticalPressureBand;
  reasons: string[];
  shouldOfferMeeting: boolean;
  suggestedMeeting: SenateMeeting | null;
};

type SenateRuntimeInput = {
  currentDay: number;
  worldPhase: string;
  activeAlerts: string[];
  villages: VillageSummary[];
  resources: SenateResources;
  troops: SenateTroops;
  heroByVillage: Record<string, string | "none">;
  senateSatisfaction: number;
  politicalNeglect: number;
  activeMeeting: SenateMeeting | null;
  lastMeetingDay: number;
  resolvedMeetingIds: string[];
  dismissedHeroes: HeroSpecialistId[];
  questsCompleted: number;
  wondersControlled: number;
  sandboxMarchStarted: boolean;
  kingAlive: boolean;
  hasTribeDome?: boolean;
  militaryTechCount?: number;
  dragonChoice?: "none" | "fire" | "ice";
};

type PreviewLineTone = "positive" | "negative" | "neutral";

export type SenateChoicePreviewLine = {
  label: string;
  tone: PreviewLineTone;
};

export type AppliedChoiceSummary = {
  updatedSatisfaction: number;
  updatedPressure: number;
  updatedNeglect: number;
  lines: SenateChoicePreviewLine[];
};

const HERO_LABEL: Record<HeroSpecialistId, string> = {
  engineer: "Engenheira Iele",
  marshal: "General Varyn",
  navigator: "Explorador Corven",
  intendente: "Administrador Salen",
  erudite: "Sabia Maelis",
};

export function buildDefaultSenateState(): SenateState {
  return {
    satisfaction: 62,
    politicalPressure: 0,
    pressureBand: "CALM",
    politicalNeglect: 0,
    activeMeeting: null,
    lastMeetingDay: 0,
    resolvedMeetingIds: [],
    dismissedHeroes: [],
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toFiniteNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isHeroSpecialist(value: unknown): value is HeroSpecialistId {
  return value === "engineer" || value === "marshal" || value === "navigator" || value === "intendente" || value === "erudite";
}

function normalizeChoiceEffect(value: unknown): SenateChoiceEffect {
  if (!value || typeof value !== "object") {
    return {};
  }
  const raw = value as Partial<Record<keyof SenateChoiceEffect, unknown>>;
  return {
    materials: Math.floor(toFiniteNumber(raw.materials)),
    supplies: Math.floor(toFiniteNumber(raw.supplies)),
    influence: Math.floor(toFiniteNumber(raw.influence)),
    militia: Math.floor(toFiniteNumber(raw.militia)),
    shooters: Math.floor(toFiniteNumber(raw.shooters)),
    scouts: Math.floor(toFiniteNumber(raw.scouts)),
    machinery: Math.floor(toFiniteNumber(raw.machinery)),
    satisfaction: Math.floor(toFiniteNumber(raw.satisfaction)),
    pressure: Math.floor(toFiniteNumber(raw.pressure)),
    neglect: Math.floor(toFiniteNumber(raw.neglect)),
  };
}

function normalizeMeetingChoice(value: unknown): SenateMeetingChoice | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<SenateMeetingChoice>;
  if (typeof raw.id !== "string" || typeof raw.label !== "string" || typeof raw.note !== "string") {
    return null;
  }
  return {
    id: raw.id,
    label: raw.label,
    note: raw.note,
    effect: normalizeChoiceEffect(raw.effect),
  };
}

export function normalizeSenateMeeting(value: unknown): SenateMeeting | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Partial<SenateMeeting>;
  const meetingId =
    raw.id === "frontier-lockdown" ||
    raw.id === "treasury-strain" ||
    raw.id === "portal-mandate" ||
    raw.id === "raider-incursion" ||
    raw.id === "demon-breach"
      ? raw.id
      : null;
  const meetingKind =
    raw.kind === "CRITICAL" || raw.kind === "IMPORTANT" || raw.kind === "POLITICAL" ? raw.kind : null;
  if (!meetingId || !meetingKind || typeof raw.title !== "string" || typeof raw.situation !== "string" || typeof raw.heroLine !== "string" || !isHeroSpecialist(raw.heroId)) {
    return null;
  }

  const choices = Array.isArray(raw.choices)
    ? raw.choices.map((choice) => normalizeMeetingChoice(choice)).filter((choice): choice is SenateMeetingChoice => Boolean(choice)).slice(0, 3)
    : [];

  if (choices.length === 0) {
    return null;
  }

  return {
    id: meetingId,
    kind: meetingKind,
    title: raw.title,
    situation: raw.situation,
    heroId: raw.heroId,
    heroLine: raw.heroLine,
    choices,
    triggeredAtDay: Math.max(0, Math.floor(toFiniteNumber(raw.triggeredAtDay))),
    sourceTags: Array.isArray(raw.sourceTags) ? raw.sourceTags.filter((entry): entry is string => typeof entry === "string").slice(0, 8) : [],
  };
}

export function normalizeSenateState(value: unknown): SenateState {
  const fallback = buildDefaultSenateState();
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const raw = value as Partial<SenateState>;
  const dismissedHeroes = Array.isArray(raw.dismissedHeroes)
    ? raw.dismissedHeroes.filter(isHeroSpecialist).slice(0, 5)
    : fallback.dismissedHeroes;

  return {
    satisfaction: clamp(Math.floor(toFiniteNumber(raw.satisfaction, fallback.satisfaction)), 0, 100),
    politicalPressure: clamp(Math.floor(toFiniteNumber(raw.politicalPressure)), 0, 100),
    pressureBand:
      raw.pressureBand === "CALM" || raw.pressureBand === "TENSE" || raw.pressureBand === "PRESSURED" || raw.pressureBand === "CRITICAL"
        ? raw.pressureBand
        : fallback.pressureBand,
    politicalNeglect: clamp(Math.floor(toFiniteNumber(raw.politicalNeglect)), 0, 5),
    activeMeeting: normalizeSenateMeeting(raw.activeMeeting),
    lastMeetingDay: Math.max(0, Math.floor(toFiniteNumber(raw.lastMeetingDay))),
    resolvedMeetingIds: Array.isArray(raw.resolvedMeetingIds)
      ? raw.resolvedMeetingIds.filter((entry): entry is string => typeof entry === "string").slice(0, 16)
      : fallback.resolvedMeetingIds,
    dismissedHeroes,
  };
}

export function resolvePoliticalPressureBand(score: number): PoliticalPressureBand {
  if (score >= 72) return "CRITICAL";
  if (score >= 52) return "PRESSURED";
  if (score >= 28) return "TENSE";
  return "CALM";
}

function satisfactionShield(satisfaction: number) {
  if (satisfaction >= 75) return 0.82;
  if (satisfaction >= 55) return 1;
  if (satisfaction >= 35) return 1.16;
  return 1.3;
}

function countAssignedHeroes(heroByVillage: Record<string, string | "none">) {
  return Object.values(heroByVillage).filter((entry) => entry && entry !== "none").length;
}

function totalTroops(troops: SenateTroops) {
  return troops.militia + troops.shooters + troops.scouts + troops.machinery;
}

function totalDefensePowerFromVillages(villages: VillageSummary[]) {
  const defenders = villages.reduce(
    (acc, village) => {
      const levels = village.buildingLevels ?? {};
      acc.guards += Math.max(0, Math.floor(levels.wall ?? 0));
      acc.archers += Math.max(0, Math.floor(levels.barracks ?? 0));
      acc.ballistae += Math.max(0, Math.floor(levels.arsenal ?? 0));
      return acc;
    },
    { guards: 0, archers: 0, ballistae: 0 },
  );
  return calculateDefensePower(defenders);
}

function resolveSovereigntyScore(input: SenateRuntimeInput): number {
  return calculateSovereigntyScore({
    villages: input.villages,
    villageDevelopments: input.villages.map((village) => calculateVillageDevelopment(village.buildingLevels)),
    councilHeroes: countAssignedHeroes(input.heroByVillage),
    militaryRankingPoints: 0,
    eraQuestsCompleted: input.questsCompleted,
    wondersControlled: input.wondersControlled,
    currentDay: input.currentDay,
    hasTribeDome: input.hasTribeDome,
    tribeLoyaltyStage: input.hasTribeDome ? 5 : undefined,
    kingAlive: input.kingAlive,
    senateSatisfaction: input.senateSatisfaction,
    unlockedMilitaryTechs: input.militaryTechCount ?? 0,
    dragonChoice: input.dragonChoice ?? "none",
    troopPower: calculateTroopPower(input.troops),
    defensePower: totalDefensePowerFromVillages(input.villages),
  }).total;
}

function chooseSpeaker(preferred: HeroSpecialistId, dismissedHeroes: HeroSpecialistId[]) {
  if (!dismissedHeroes.includes(preferred)) {
    return preferred;
  }
  return (["marshal", "intendente", "erudite", "navigator", "engineer"] as HeroSpecialistId[]).find(
    (hero) => !dismissedHeroes.includes(hero),
  ) ?? preferred;
}

function buildFrontierMeeting(input: SenateRuntimeInput, attackedCount: number, deficits: number): SenateMeeting {
  const speaker = chooseSpeaker("marshal", input.dismissedHeroes);
  const crownState = buildKingdomSurvivalState({
    villages: input.villages,
    activeAlerts: input.activeAlerts,
    sovereignty: { kingAlive: input.kingAlive },
  });
  return {
    id: "frontier-lockdown",
    kind: crownState.crownRiskBand === "danger" || attackedCount >= 2 ? "CRITICAL" : "IMPORTANT",
    title: crownState.crownRiskBand === "danger" ? "A Capital entrou na linha de morte" : attackedCount >= 2 ? "A fronteira comecou a rachar" : "A borda do reino esta ficando cara",
    situation:
      crownState.crownRiskBand === "danger"
        ? `${crownState.capitalName} ja esta no raio da guerra. Muralha ${crownState.capitalWallLevel}/10, ${attackedCount} cidade(s) sob risco e ${deficits} gargalo(s) drenando resposta.`
        : `${attackedCount} cidade(s) sob risco, ${totalTroops(input.troops).toLocaleString("pt-BR")} tropas vivas e ${deficits} gargalo(s) drenando a defesa.`,
    heroId: speaker,
    heroLine:
      crownState.crownRiskBand === "danger"
        ? `${HERO_LABEL[speaker]}: se a Capital abrir, o rei nao vai morrer do nada. Ele vai cair porque voce viu a linha fechar e nao reagiu.`
        : input.politicalNeglect > 0
          ? `${HERO_LABEL[speaker]}: voce ja deixou isso escalar uma vez. Se repetir, a borda vira ferida aberta.`
          : `${HERO_LABEL[speaker]}: ou seguramos a linha agora, ou o mapa vai escolher por voce.`,
    choices: [
      {
        id: "frontier-garrison",
        label: "Convocar guarnicoes",
        note: "Segura a linha, mas queima caixa e folego imediato.",
        effect: { supplies: -180, militia: 55, satisfaction: 8, pressure: -16, neglect: -2 },
      },
      {
        id: "frontier-fortify",
        label: "Blindar o centro",
        note: "Protege a capital e compra tempo, mas reduz ambicao ofensiva.",
        effect: { materials: -160, influence: 12, satisfaction: 4, pressure: -11, neglect: -1 },
      },
      {
        id: "frontier-counter",
        label: "Forcar contra-ataque",
        note: "Empurra presenca e influencia, mas pode custar caro se a base estiver curta.",
        effect: { influence: 18, militia: -70, shooters: -22, satisfaction: -4, pressure: -18, neglect: -2 },
      },
    ],
    triggeredAtDay: input.currentDay,
    sourceTags: ["frontier", "military", "pressure"],
  };
}

function buildTreasuryMeeting(input: SenateRuntimeInput, deficits: number): SenateMeeting {
  const speaker = chooseSpeaker("intendente", input.dismissedHeroes);
  return {
    id: "treasury-strain",
    kind: deficits >= 3 ? "IMPORTANT" : "POLITICAL",
    title: "O caixa do reino perdeu folga",
    situation: `Deficits ativos em ${deficits} frente(s), suprimentos em ${input.resources.supplies.toLocaleString("pt-BR")} e materiais em ${input.resources.materials.toLocaleString("pt-BR")}.`,
    heroId: speaker,
    heroLine:
      input.politicalNeglect > 1
        ? `${HERO_LABEL[speaker]}: eu ja avisei antes. O reino ainda anda, mas agora sente cada erro.`
        : `${HERO_LABEL[speaker]}: ainda da para reorganizar sem colapso, mas nao existe mais gordura.`,
    choices: [
      {
        id: "treasury-cut",
        label: "Cortar expansao por um ciclo",
        note: "Respira recursos e melhora a margem da reuniao imperial.",
        effect: { materials: 140, supplies: 220, satisfaction: 7, pressure: -14, neglect: -2 },
      },
      {
        id: "treasury-tax",
        label: "Apertar tributo imperial",
        note: "Gera influencia e caixa agora, mas desgasta o conselho.",
        effect: { materials: 180, influence: 14, satisfaction: -10, pressure: -7, neglect: -1 },
      },
      {
        id: "treasury-forge",
        label: "Sustentar a guerra mesmo assim",
        note: "Nao desacelera o militar, mas aceita mais pressao politica.",
        effect: { supplies: -160, militia: 28, shooters: 16, satisfaction: -4, pressure: -5, neglect: -1 },
      },
    ],
    triggeredAtDay: input.currentDay,
    sourceTags: ["economy", "deficit", "senate"],
  };
}

function buildPortalMeeting(input: SenateRuntimeInput, portalGap: number, questsBacklog: number): SenateMeeting {
  const speaker = chooseSpeaker("erudite", input.dismissedHeroes);
  return {
    id: "portal-mandate",
    kind: portalGap > 180 || questsBacklog > 1 ? "IMPORTANT" : "POLITICAL",
    title: "A reuniao imperial quer saber se essa run vai fechar",
    situation: `${resolveSovereigntyScore(input).toLocaleString("pt-BR")} de score soberano, ${Math.max(0, portalGap)} faltando para o corte e ${questsBacklog} pendencia(s) de legado abertas.`,
    heroId: speaker,
    heroLine:
      input.sandboxMarchStarted
        ? `${HERO_LABEL[speaker]}: ja estamos andando para o fim do mundo. Agora cada atraso cobra dobrado.`
        : `${HERO_LABEL[speaker]}: continuar crescendo sem converter isso em fechamento e so parecer forte.`,
    choices: [
      {
        id: "portal-align",
        label: "Alinhar o reino ao Portal",
        note: "Converte foco em score real, mas segura o resto da maquina.",
        effect: { materials: -120, influence: 24, satisfaction: 6, pressure: -13, neglect: -2 },
      },
      {
        id: "portal-delay",
        label: "Comprar mais um ciclo de preparo",
        note: "Ganha corpo militar, mas a reuniao imperial tolera menos atraso depois disso.",
        effect: { militia: 36, shooters: 14, satisfaction: -6, pressure: 8, neglect: -1 },
      },
      {
        id: "portal-bargain",
        label: "Negociar um fechamento mais frio",
        note: "Melhora estabilidade politica agora, mas entrega menos influencia imediata.",
        effect: { influence: 10, satisfaction: 10, pressure: -8, neglect: -2 },
      },
    ],
    triggeredAtDay: input.currentDay,
    sourceTags: ["portal", "legacy", "quests"],
  };
}

function buildRaiderMeeting(input: SenateRuntimeInput, deficits: number): SenateMeeting {
  const speaker = chooseSpeaker("navigator", input.dismissedHeroes);
  return {
    id: "raider-incursion",
    kind: deficits >= 2 || input.resources.supplies < input.villages.length * 900 ? "IMPORTANT" : "POLITICAL",
    title: "Saqueadores entraram nas rotas do imperio",
    situation: `Comboios sumiram, postos ficaram cegos e o reino sente ${deficits} gargalo(s) aberto(s) enquanto os estoques correm sob pressao.`,
    heroId: speaker,
    heroLine:
      input.politicalNeglect > 0
        ? `${HERO_LABEL[speaker]}: ja deixamos a borda frouxa antes. Se ignorar de novo, eles vao aprender nosso ritmo.`
        : `${HERO_LABEL[speaker]}: nao e um exercito regular. E pior. Eles batem, roubam e somem antes da resposta fechar.`,
    choices: [
      {
        id: "raider-hunt",
        label: "Caçar os saqueadores",
        note: "Queima tropa leve e suprimento, mas limpa a rota e reduz a pressao.",
        effect: { supplies: -120, scouts: -18, satisfaction: 7, pressure: -14, neglect: -2 },
      },
      {
        id: "raider-pay",
        label: "Pagar protecao por um ciclo",
        note: "Compra tempo no caixa agora, mas passa fraqueza politica.",
        effect: { materials: -180, supplies: 80, satisfaction: -6, pressure: -6, neglect: -1 },
      },
      {
        id: "raider-fortify",
        label: "Fechar rotas e reforcar postos",
        note: "Perde giro imediato, mas endurece a malha imperial.",
        effect: { materials: -110, influence: 10, satisfaction: 4, pressure: -10, neglect: -1 },
      },
    ],
    triggeredAtDay: input.currentDay,
    sourceTags: ["raiders", "routes", "economy"],
  };
}

function buildDemonMeeting(input: SenateRuntimeInput, portalGap: number): SenateMeeting {
  const speaker = chooseSpeaker("engineer", input.dismissedHeroes);
  return {
    id: "demon-breach",
    kind: input.currentDay >= PORTAL_PRESSURE_DAY || portalGap > 0 ? "CRITICAL" : "IMPORTANT",
    title: "Uma ruptura demoniaca abriu no territorio",
    situation: `Relatos de fogo negro, choque nas vilas e patrulhas quebradas. O reino precisa escolher entre conter a fenda ou sangrar a frente inteira.`,
    heroId: speaker,
    heroLine:
      input.sandboxMarchStarted
        ? `${HERO_LABEL[speaker]}: isso nao e mais ruido de mundo. A reta final abriu um buraco real no mapa.`
        : `${HERO_LABEL[speaker]}: demonios nao cercam como gente. Eles atravessam a linha e deixam crise para tras.`,
    choices: [
      {
        id: "demon-seal",
        label: "Selar a ruptura",
        note: "Custa obra e influencia, mas evita escalada de crise.",
        effect: { materials: -220, influence: -10, satisfaction: 10, pressure: -18, neglect: -2 },
      },
      {
        id: "demon-bait",
        label: "Atrair a horda para uma zona morta",
        note: "Preserva o nucleo, mas sacrifica estoque e estabilidade lateral.",
        effect: { supplies: -200, militia: -45, satisfaction: -4, pressure: -10, neglect: -1 },
      },
      {
        id: "demon-harvest",
        label: "Explorar a fenda por poder",
        note: "Gera influencia e corpo militar curto, mas deixa o reino mais nervoso.",
        effect: { influence: 28, machinery: 6, satisfaction: -12, pressure: 12, neglect: -1 },
      },
    ],
    triggeredAtDay: input.currentDay,
    sourceTags: ["demons", "breach", "crisis"],
  };
}

export function buildSenateClimate(input: SenateRuntimeInput): SenateClimate {
  const crownState = buildKingdomSurvivalState({
    villages: input.villages,
    activeAlerts: input.activeAlerts,
    sovereignty: { kingAlive: input.kingAlive },
  });
  const deficits = input.villages.reduce((sum, village) => sum + village.deficits.length, 0);
  const attackedCount = input.villages.filter((village) => village.underAttack).length;
  const averageDevelopment =
    input.villages.length > 0
      ? input.villages.reduce((sum, village) => sum + calculateVillageDevelopment(village.buildingLevels), 0) / input.villages.length
      : 0;
  const troopCount = totalTroops(input.troops);
  const questBacklog = Math.max(0, 3 - input.questsCompleted);
  const sovereigntyScore = resolveSovereigntyScore(input);
  const portalGap = SOVEREIGNTY_PORTAL_CUT - sovereigntyScore;
  const heroCount = countAssignedHeroes(input.heroByVillage);
  const aggressiveExpansion = input.villages.length >= 4 && averageDevelopment < 60;
  const demonAlert = input.activeAlerts.some((entry) => /demo|demon|ruptura|fenda|abismo|horda/i.test(entry));
  const raiderAlert = input.activeAlerts.some((entry) => /saque|saqueador|raider|comboio|rota/i.test(entry));
  const deficitsScore = deficits * 9;
  const alertScore = Math.min(18, input.activeAlerts.length * 4);
  const militaryScore = attackedCount * 16 + (troopCount < input.villages.length * 120 ? 12 : 0);
  const crownScore =
    crownState.crownRiskBand === "danger"
      ? 24
      : crownState.crownRiskBand === "warning"
        ? 12
        : 0;
  const economyScore = input.resources.supplies < input.villages.length * 1150 ? 10 : 0;
  const legacyDelayScore =
    (questBacklog > 0 ? questBacklog * 8 : 0) +
    (portalGap > 250 ? 12 : portalGap > 0 && input.currentDay >= PORTAL_PRESSURE_DAY ? 8 : 0);
  const expansionScore = aggressiveExpansion ? 10 : 0;
  const heroVacuumScore = heroCount === 0 && input.villages.length >= 2 ? 6 : 0;
  const neglectScore = input.politicalNeglect * 12;
  const satisfactionPenalty = input.senateSatisfaction < 40 ? 12 : input.senateSatisfaction < 58 ? 6 : 0;

  const politicalPressure = clamp(
    deficitsScore +
      alertScore +
      militaryScore +
      crownScore +
      economyScore +
      legacyDelayScore +
      expansionScore +
      heroVacuumScore +
      neglectScore +
      satisfactionPenalty,
    0,
    100,
  );

  const pressureBand = resolvePoliticalPressureBand(politicalPressure);
  const reasons: string[] = [];
  if (deficits > 0) reasons.push(`${deficits} gargalo(s) ativos`);
  if (attackedCount > 0) reasons.push(`${attackedCount} cidade(s) sob pressao`);
  if (aggressiveExpansion) reasons.push("largura acima da estrutura");
  if (questBacklog > 0) reasons.push(`${questBacklog} objetivo(s) importantes atrasados`);
  if (portalGap > 0 && input.currentDay >= PORTAL_PRESSURE_DAY) reasons.push("corte do Portal ainda distante");
  if (demonAlert) reasons.push("ruptura demoniaca em circulacao");
  if (raiderAlert) reasons.push("saqueadores nas rotas");
  if (input.politicalNeglect > 0) reasons.push(`reuniao imperial ignorada ${input.politicalNeglect}x`);
  if (input.senateSatisfaction < 50) reasons.push("paciencia politica baixa");
  if (crownState.crownRiskBand === "danger") reasons.push("a Capital pode deixar de segurar o rei");
  else if (crownState.crownRiskBand === "warning") reasons.push("a muralha da Capital entrou em alerta");

  const cooldownDays = pressureBand === "CRITICAL" ? 1 : pressureBand === "PRESSURED" ? 2 : 3;
  const canOfferByCooldown = input.currentDay - input.lastMeetingDay >= cooldownDays;
  const repeatedBlocked = input.activeMeeting ? false : input.resolvedMeetingIds.includes(`day:${input.currentDay}`);

  let suggestedMeeting: SenateMeeting | null = null;
  if (demonAlert || (input.currentDay >= PORTAL_PRESSURE_DAY && (input.sandboxMarchStarted || attackedCount >= 2))) {
    suggestedMeeting = buildDemonMeeting(input, portalGap);
  } else if (raiderAlert || (deficits >= 2 && input.resources.supplies < input.villages.length * 980)) {
    suggestedMeeting = buildRaiderMeeting(input, deficits);
  } else if (attackedCount > 0 || input.activeAlerts.some((entry) => /horda|fronteira|ataque|press/i.test(entry))) {
    suggestedMeeting = buildFrontierMeeting(input, attackedCount, deficits);
  } else if (deficits >= 2 || input.resources.supplies < input.villages.length * 1000 || input.resources.materials < input.villages.length * 700) {
    suggestedMeeting = buildTreasuryMeeting(input, deficits);
  } else if (
    input.currentDay >= PORTAL_MANDATE_DAY &&
    (questBacklog > 0 || portalGap > 0 || input.wondersControlled === 0 || input.sandboxMarchStarted)
  ) {
    suggestedMeeting = buildPortalMeeting(input, portalGap, questBacklog);
  }

  return {
    politicalPressure,
    pressureBand,
    reasons,
    shouldOfferMeeting: Boolean(!input.activeMeeting && suggestedMeeting && politicalPressure >= 28 && canOfferByCooldown && !repeatedBlocked),
    suggestedMeeting,
  };
}

export function previewSenateChoice(choice: SenateMeetingChoice, senateSatisfaction: number): AppliedChoiceSummary {
  const shield = satisfactionShield(senateSatisfaction);
  const scale = (value: number | undefined) => {
    const safe = value ?? 0;
    return safe < 0 ? Math.round(safe * shield) : safe;
  };

  const updatedSatisfaction = clamp(senateSatisfaction + scale(choice.effect.satisfaction), 0, 100);
  const updatedPressure = scale(choice.effect.pressure);
  const updatedNeglect = clamp(scale(choice.effect.neglect), -3, 3);
  const lines: SenateChoicePreviewLine[] = [];

  const push = (value: number | undefined, positiveLabel: string, negativeLabel: string) => {
    const safe = scale(value);
    if (!safe) return;
    lines.push({
      label: `${safe > 0 ? "+" : ""}${safe} ${safe > 0 ? positiveLabel : negativeLabel}`,
      tone: safe > 0 ? "positive" : "negative",
    });
  };

  push(choice.effect.influence, "score soberano -> aproxima o corte do Portal", "score soberano -> afasta o corte do Portal");
  push(choice.effect.satisfaction, "satisfacao imperial -> aumenta sua margem de erro", "satisfacao imperial -> reduz sua margem de erro");
  push(choice.effect.pressure, "pressao politica -> o reino respira melhor", "pressao politica -> o reino fica mais reativo e instavel");
  push(choice.effect.materials, "materiais -> folga imediata para obras e caixa", "materiais -> aperta sua obra e tesouro");
  push(choice.effect.supplies, "suprimentos -> sustenta a campanha por mais tempo", "suprimentos -> aumenta risco de estrangulamento");

  const troopsDelta = scale(choice.effect.militia) + scale(choice.effect.shooters) + scale(choice.effect.scouts) + scale(choice.effect.machinery);
  if (troopsDelta) {
    lines.push({
      label: `${troopsDelta > 0 ? "+" : ""}${troopsDelta} tropas -> ${troopsDelta > 0 ? "segura melhor a fronteira" : "encolhe sua margem militar"}`,
      tone: troopsDelta > 0 ? "positive" : "negative",
    });
  }

  return {
    updatedSatisfaction,
    updatedPressure,
    updatedNeglect,
    lines: lines.slice(0, 4),
  };
}

export function applyMeetingChoiceEffects(input: {
  state: SenateState;
  resources: SenateResources;
  troops: SenateTroops;
  meeting: SenateMeeting;
  choice: SenateMeetingChoice;
}): {
  senate: SenateState;
  resources: SenateResources;
  troops: SenateTroops;
  summary: AppliedChoiceSummary;
} {
  const summary = previewSenateChoice(input.choice, input.state.satisfaction);
  const shield = satisfactionShield(input.state.satisfaction);
  const scaleNegative = (value: number | undefined) => {
    const safe = value ?? 0;
    return safe < 0 ? Math.round(safe * shield) : safe;
  };

  const nextResources: SenateResources = {
    materials: Math.max(0, input.resources.materials + scaleNegative(input.choice.effect.materials)),
    supplies: Math.max(0, input.resources.supplies + scaleNegative(input.choice.effect.supplies)),
    influence: input.resources.influence,
  };

  const nextTroops: SenateTroops = {
    militia: Math.max(0, input.troops.militia + scaleNegative(input.choice.effect.militia)),
    shooters: Math.max(0, input.troops.shooters + scaleNegative(input.choice.effect.shooters)),
    scouts: Math.max(0, input.troops.scouts + scaleNegative(input.choice.effect.scouts)),
    machinery: Math.max(0, input.troops.machinery + scaleNegative(input.choice.effect.machinery)),
  };

  return {
    senate: {
      satisfaction: summary.updatedSatisfaction,
      politicalPressure: clamp(input.state.politicalPressure + summary.updatedPressure, 0, 100),
      pressureBand: resolvePoliticalPressureBand(input.state.politicalPressure + summary.updatedPressure),
      politicalNeglect: clamp(input.state.politicalNeglect + summary.updatedNeglect, 0, 5),
      activeMeeting: null,
      lastMeetingDay: input.meeting.triggeredAtDay,
      resolvedMeetingIds: [`${input.meeting.id}:${input.meeting.triggeredAtDay}`, `day:${input.meeting.triggeredAtDay}`, ...input.state.resolvedMeetingIds].slice(0, 16),
      dismissedHeroes: [...input.state.dismissedHeroes],
    },
    resources: nextResources,
    troops: nextTroops,
    summary,
  };
}

export function buildIgnoredMeetingOutcome(input: {
  state: SenateState;
  meeting: SenateMeeting;
}): {
  senate: SenateState;
  dismissedHero: HeroSpecialistId | null;
  lines: SenateChoicePreviewLine[];
} {
  const shield = satisfactionShield(input.state.satisfaction);
  const neglectGain = input.meeting.kind === "CRITICAL" ? 2 : 1;
  const pressureGain = input.meeting.kind === "CRITICAL" ? 15 : input.meeting.kind === "IMPORTANT" ? 11 : 7;
  const satisfactionLoss = Math.round((input.meeting.kind === "CRITICAL" ? -12 : input.meeting.kind === "IMPORTANT" ? -8 : -5) * shield);
  const nextNeglect = clamp(input.state.politicalNeglect + neglectGain, 0, 5);
  const nextPressure = clamp(input.state.politicalPressure + pressureGain, 0, 100);
  let dismissedHero: HeroSpecialistId | null = null;
  const dismissedHeroes = [...input.state.dismissedHeroes];

  if (nextNeglect >= 3 && !dismissedHeroes.includes(input.meeting.heroId)) {
    dismissedHero = input.meeting.heroId;
    dismissedHeroes.push(input.meeting.heroId);
  }

  return {
    senate: {
      satisfaction: clamp(input.state.satisfaction + satisfactionLoss, 0, 100),
      politicalPressure: nextPressure,
      pressureBand: resolvePoliticalPressureBand(nextPressure),
      politicalNeglect: nextNeglect,
      activeMeeting: null,
      lastMeetingDay: input.meeting.triggeredAtDay,
      resolvedMeetingIds: [`${input.meeting.id}:${input.meeting.triggeredAtDay}:ignored`, `day:${input.meeting.triggeredAtDay}`, ...input.state.resolvedMeetingIds].slice(0, 16),
      dismissedHeroes,
    },
    dismissedHero,
    lines: [
      {
        label: `${satisfactionLoss} satisfacao imperial -> sua margem de erro encolhe`,
        tone: "negative",
      },
      {
        label: `+${pressureGain} pressao politica -> o reino reage pior aos proximos erros`,
        tone: "negative",
      },
      {
        label: `+${neglectGain} negligencia -> ignorar de novo pode custar um heroi`,
        tone: "negative",
      },
    ],
  };
}
