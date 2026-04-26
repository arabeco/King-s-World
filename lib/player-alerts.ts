import {
  SOVEREIGNTY_PORTAL_CUT,
  calculateDefensePower,
  calculateSovereigntyScore,
  calculateTroopPower,
  calculateVillageDevelopment,
} from "@/core/GameBalance";
import { countUnlockedMilitaryTechs } from "@/lib/empire-systems";
import type { ImperialState } from "@/lib/imperial-state";
import type { VillageSummary } from "@/lib/mock-data";
import type { CoachGuide, WorldTab } from "@/lib/world-assistant-guide";

export type PlayerAlertChoice = {
  id: string;
  label: string;
  note?: string;
  tab?: WorldTab;
  query?: Record<string, string>;
};

export type PlayerAlertCard = {
  id: string;
  kind: "decision" | "opportunity" | "reading";
  severity: "high" | "medium" | "low";
  title: string;
  situation: string;
  reason: string;
  impact: string;
  choices: PlayerAlertChoice[];
  sourceTags: string[];
};

export type PlayerAlertDeck = {
  primary: PlayerAlertCard;
  secondary: PlayerAlertCard[];
};

type BuildPlayerAlertInput = {
  currentDay: number;
  worldPhase: string;
  activeAlerts: string[];
  activeVillage: VillageSummary;
  villages: VillageSummary[];
  imperialState: ImperialState;
  guide: CoachGuide;
  heroCount: number;
  highestDevelopment: number;
  questsCompleted: number;
  wondersControlled: number;
};

type StateSignals = {
  capitalVillageId: string;
  focusVillageId: string;
  totalTroops: number;
  attackedVillageCount: number;
  totalDeficits: number;
  maxedVillageCount: number;
  averageDevelopment: number;
  sovereigntyScore: number;
  portalGap: number;
  portalEligible: boolean;
  exodusActive: boolean;
  portalAlertActive: boolean;
  marchAlertActive: boolean;
  hordeAlertActive: boolean;
  pressureActive: boolean;
  collapseActive: boolean;
  stableEconomy: boolean;
  questBacklog: number;
  secondVillagePressure: boolean;
  firstHundredPressure: boolean;
  questPressure: boolean;
  portalPressure: boolean;
  marchPressure: boolean;
  openingActive: boolean;
  expansionActive: boolean;
  openingSprawlPressure: boolean;
  firstHeroPressure: boolean;
};

const CARD_PRIORITY: Record<string, number> = {
  "opening-sprawl": 80,
  "first-hero": 64,
  collapse: 100,
  frontline: 95,
  march: 90,
  "portal-window": 86,
  "second-village-late": 72,
  "first-hundred-late": 68,
  "quest-gap": 54,
  "economy-pressure": 46,
  "stable-window": 30,
  "guide-focus": 10,
};

function severityScore(value: PlayerAlertCard["severity"]): number {
  if (value === "high") return 300;
  if (value === "medium") return 200;
  return 100;
}

function kindScore(value: PlayerAlertCard["kind"]): number {
  if (value === "decision") return 40;
  if (value === "opportunity") return 20;
  return 10;
}

function totalTroops(state: ImperialState): number {
  return state.troops.militia + state.troops.shooters + state.troops.scouts + state.troops.machinery;
}

function totalDefensePower(state: ImperialState): number {
  const defenders = Object.values(state.defenseRecruitsByVillage).reduce(
    (acc, entry) => {
      acc.guards += Math.max(0, Math.floor(entry?.guards ?? 0));
      acc.archers += Math.max(0, Math.floor(entry?.archers ?? 0));
      acc.ballistae += Math.max(0, Math.floor(entry?.ballistae ?? 0));
      return acc;
    },
    { guards: 0, archers: 0, ballistae: 0 },
  );
  return calculateDefensePower(defenders);
}

function buildVillageQueries(villages: VillageSummary[], activeVillage: VillageSummary) {
  const capitalVillageId = villages.find((village) => village.type === "Capital")?.id ?? activeVillage.id;
  const focusVillageId =
    villages.reduce(
      (best, village) => {
        const score = calculateVillageDevelopment(village.buildingLevels);
        return score > best.score ? { id: village.id, score } : best;
      },
      { id: activeVillage.id, score: calculateVillageDevelopment(activeVillage.buildingLevels) },
    ).id;

  return {
    capitalVillageId,
    focusVillageId,
  };
}

function hasAlert(activeAlerts: string[], regex: RegExp): boolean {
  return activeAlerts.some((entry) => regex.test(entry));
}

function clampRatio(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function buildStateSignals(input: BuildPlayerAlertInput): StateSignals {
  const { capitalVillageId, focusVillageId } = buildVillageQueries(input.villages, input.activeVillage);
  const totalTroopsValue = totalTroops(input.imperialState);
  const attackedVillageCount = input.villages.filter((village) => village.underAttack).length;
  const totalDeficits = input.villages.reduce((sum, village) => sum + village.deficits.length, 0);
  const maxedVillageCount = input.villages.filter((village) => calculateVillageDevelopment(village.buildingLevels) >= 100).length;
  const developmentValues = input.villages.map((village) => calculateVillageDevelopment(village.buildingLevels));
  const averageDevelopment =
    developmentValues.length > 0 ? developmentValues.reduce((sum, value) => sum + value, 0) / developmentValues.length : 0;
  const sovereignty = calculateSovereigntyScore({
    villages: input.villages,
    villageDevelopments: developmentValues,
    councilHeroes: input.heroCount,
    militaryRankingPoints: 0,
    eraQuestsCompleted: input.questsCompleted,
    wondersControlled: input.wondersControlled,
    currentDay: input.currentDay,
    hasTribeDome: input.imperialState.sandboxDomeActive,
    tribeLoyaltyStage: input.imperialState.sandboxDomeActive ? 5 : 0,
    kingAlive: input.villages.some((village) => village.kingHere),
    unlockedMilitaryTechs: countUnlockedMilitaryTechs(input.imperialState.militaryTechTree),
    dragonChoice: input.imperialState.dragonChoice,
    senateSatisfaction: input.imperialState.senate.satisfaction,
    troopPower: calculateTroopPower(input.imperialState.troops),
    defensePower: totalDefensePower(input.imperialState),
  });
  const sovereigntyScore = sovereignty.total;
  const portalGap = SOVEREIGNTY_PORTAL_CUT - sovereigntyScore;
  const portalEligible = sovereignty.portalEligible;
  const openingActive = input.guide.windowId === "opening";
  const expansionActive = input.guide.windowId === "expand";
  const exodusActive = /exodo|exodus/i.test(input.worldPhase);
  const portalAlertActive = hasAlert(input.activeAlerts, /portal|corte/i);
  const marchAlertActive = hasAlert(input.activeAlerts, /marcha|centro/i);
  const hordeAlertActive = hasAlert(input.activeAlerts, /horda/i);
  const pressureActive = attackedVillageCount > 0 || hordeAlertActive || totalDeficits > 1;
  const stableEconomy =
    input.imperialState.resources.supplies > input.villages.length * 1400 &&
    input.imperialState.resources.materials > input.villages.length * 1200 &&
    totalDeficits === 0;
  const questBacklog = Math.max(0, 3 - input.questsCompleted);
  const portalWindowActive = exodusActive || portalAlertActive || input.imperialState.sandboxMarchStarted || marchAlertActive;
  const portalPressure =
    portalWindowActive &&
    (!portalEligible ||
      questBacklog > 0 ||
      (input.wondersControlled === 0 && input.guide.buildId !== "posto_avancado") ||
      !input.imperialState.sandboxMarchStarted);
  const marchPressure =
    (exodusActive || marchAlertActive || input.imperialState.sandboxMarchStarted) &&
    (portalEligible || input.imperialState.sandboxMarchStarted) &&
    (pressureActive || !input.imperialState.sandboxMarchStarted || totalTroopsValue < input.villages.length * 140);
  const collapseActive =
    pressureActive &&
    (attackedVillageCount >= 2 ||
      totalDeficits >= 3 ||
      totalTroopsValue < input.villages.length * 90 ||
      clampRatio(sovereigntyScore / SOVEREIGNTY_PORTAL_CUT) < 0.75);
  const secondVillagePressure =
    input.villages.length < 2 &&
    (input.highestDevelopment >= 35 ||
      totalTroopsValue >= 240 ||
      input.imperialState.resources.materials >= 2500 ||
      input.guide.warnings.some((warning) => /2a aldeia/i.test(warning)));
  const firstHundredPressure =
    input.highestDevelopment < 100 &&
    (input.villages.length >= 4 ||
      input.questsCompleted >= 1 ||
      input.wondersControlled > 0 ||
      maxedVillageCount > 0 ||
      input.guide.warnings.some((warning) => /100\/100/i.test(warning)));
  const questPressure =
    questBacklog > 0 &&
    (portalWindowActive ||
      input.villages.length >= 4 ||
      input.highestDevelopment >= 70 ||
      sovereigntyScore >= SOVEREIGNTY_PORTAL_CUT * 0.55);
  const openingSprawlPressure =
    openingActive &&
    input.villages.length === 1 &&
    (totalDeficits > 0 ||
      input.imperialState.resources.supplies < 1100 ||
      input.imperialState.resources.materials < 900 ||
      averageDevelopment >= 24);
  const firstHeroPressure =
    input.heroCount === 0 &&
    !exodusActive &&
    (expansionActive ||
      input.villages.length >= 2 ||
      totalTroopsValue >= 220 ||
      input.highestDevelopment >= 45);

  return {
    capitalVillageId,
    focusVillageId,
    totalTroops: totalTroopsValue,
    attackedVillageCount,
    totalDeficits,
    maxedVillageCount,
    averageDevelopment,
    sovereigntyScore,
    portalGap,
    portalEligible,
    exodusActive,
    portalAlertActive,
    marchAlertActive,
    hordeAlertActive,
    pressureActive,
    collapseActive,
    stableEconomy,
    questBacklog,
    secondVillagePressure,
    firstHundredPressure,
    questPressure,
    portalPressure,
    marchPressure,
    openingActive,
    expansionActive,
    openingSprawlPressure,
    firstHeroPressure,
  };
}

function pushIfUnique(target: PlayerAlertCard[], card: PlayerAlertCard | null) {
  if (!card) return;
  if (target.some((entry) => entry.id === card.id)) return;
  target.push(card);
}

function buildCollapseCard(input: BuildPlayerAlertInput, signals: StateSignals): PlayerAlertCard | null {
  if (!signals.collapseActive) {
    return null;
  }

  const painPoints = [];
  if (signals.attackedVillageCount > 0) painPoints.push(`${signals.attackedVillageCount} aldeia(s) sob ataque`);
  if (signals.totalDeficits > 0) painPoints.push(`${signals.totalDeficits} gargalo(s) ativos`);
  if (signals.totalTroops < input.villages.length * 90) painPoints.push("tropa curta para segurar a largura atual");
  if (!signals.portalEligible && signals.portalGap > 250) painPoints.push(`influencia ainda ${signals.portalGap} abaixo do corte`);

  return {
    id: "collapse",
    kind: "decision",
    severity: "high",
    title: "A run comecou a escorregar",
    situation: "O reino ainda esta vivo, mas a curva virou contra voce.",
    reason: painPoints.join("; "),
    impact: "Se continuar no mesmo ritmo, o que hoje parece atraso vira colapso de verdade.",
    choices: [
      {
        id: "collapse-tighten",
        label: "Fechar a sangria",
        note: "Segurar obra lateral e estabilizar o que ainda sustenta a run.",
        tab: "empire",
        query: { v: signals.capitalVillageId },
      },
      {
        id: "collapse-front",
        label: "Salvar a fronteira",
        note: "Juntar tropa e impedir que a largura atual vire peso morto.",
        tab: "board",
        query: { v: signals.capitalVillageId },
      },
      {
        id: "collapse-score",
        label: "Abandonar largura e salvar score",
        note: "Trocar expansao por consistencia para ainda fechar a campanha.",
        tab: "base",
        query: { v: signals.focusVillageId, b: "senate", sb: "city" },
      },
    ],
    sourceTags: ["collapse", "pressure", "score"],
  };
}

function buildPortalCard(input: BuildPlayerAlertInput, signals: StateSignals): PlayerAlertCard | null {
  if (!signals.portalPressure) {
    return null;
  }

  const reasons = [];
  if (!signals.portalEligible) reasons.push(`score soberano em ${signals.sovereigntyScore}, abaixo do corte de ${SOVEREIGNTY_PORTAL_CUT}`);
  if (signals.questBacklog > 0) reasons.push(`quests fechadas em ${input.questsCompleted}/3`);
  if (input.wondersControlled === 0 && input.guide.buildId !== "posto_avancado") reasons.push("nenhuma Maravilha convertendo teto de score");
  if (!input.imperialState.sandboxMarchStarted) reasons.push("marcha final ainda nao iniciou");
  if (signals.pressureActive) reasons.push("fronteira ainda drena atencao e margem");

  return {
    id: "portal-window",
    kind: "decision",
    severity: signals.exodusActive || input.imperialState.sandboxMarchStarted || signals.portalGap > 250 ? "high" : "medium",
    title: signals.exodusActive || input.imperialState.sandboxMarchStarted ? "Agora e hora de fechar a campanha" : "O Portal entrou no seu horizonte",
    situation: `Voce ainda pode construir mais, mas o mundo ja esta perguntando se essa run vai realmente chegar inteira.`,
    reason: reasons.join("; "),
    impact: "Se voce demorar demais para converter o imperio em score util, a campanha fecha antes da sua margem aparecer.",
    choices: [
      {
        id: "portal-economy",
        label: "Trocar largura por influencia",
        note: "Fechar Senado e estrutura viva antes de abrir mais mapa.",
        tab: "base",
        query: { v: signals.capitalVillageId, b: "senate", sb: "city" },
      },
      {
        id: "portal-quest",
        label: "Fechar o que ainda falta",
        note: "Resolver quest e converter pendencia em score de verdade.",
        tab: "board",
        query: { v: signals.capitalVillageId },
      },
      {
        id: "portal-march",
        label: "Parar de crescer e preparar a chegada",
        note: "Assumir que agora a pergunta e ETA, nao largura.",
        tab: "board",
        query: { v: signals.capitalVillageId },
      },
    ],
    sourceTags: ["influence", "quests", "wonders", "march"],
  };
}

function buildMarchCard(input: BuildPlayerAlertInput, signals: StateSignals): PlayerAlertCard | null {
  if (!signals.marchPressure) {
    return null;
  }

  const reasons = [];
  if (!input.imperialState.sandboxMarchStarted) reasons.push("a marcha ainda nao comecou");
  if (signals.attackedVillageCount > 0) reasons.push("a borda ainda puxa tropa demais");
  if (signals.totalTroops < input.villages.length * 140) reasons.push("o exercito ainda esta curto para sair confortavel");
  if (signals.totalDeficits > 0) reasons.push("a economia ainda balanca enquanto voce tenta reagrupar");

  return {
    id: "march",
    kind: "decision",
    severity: signals.exodusActive ? "high" : "medium",
    title: "A marcha final pede coragem e ordem",
    situation: "A run ja entrou no trecho em que crescer mais pode valer menos do que chegar.",
    reason: reasons.join("; "),
    impact: "Se voce sair cedo demais, morre na estrada. Se sair tarde demais, chega sem janela.",
    choices: [
      {
        id: "march-commit",
        label: "Assumir a marcha agora",
        note: "Reagrupar e jogar o resto da run em funcao da chegada.",
        tab: "board",
        query: { v: signals.capitalVillageId },
      },
      {
        id: "march-one-cycle",
        label: "Comprar mais um ciclo",
        note: "Segurar mais um passo de preparacao sem abrir outra frente.",
        tab: "board",
        query: { v: signals.capitalVillageId },
      },
      {
        id: "march-score",
        label: "Blindar a cidade que decide a run",
        note: "Segurar score e evitar que a reta final comece torta.",
        tab: "base",
        query: { v: signals.focusVillageId, sb: "command", lc: "drill" },
      },
    ],
    sourceTags: ["march", "eta", "exodus"],
  };
}

function buildOpeningSprawlCard(input: BuildPlayerAlertInput, signals: StateSignals): PlayerAlertCard | null {
  if (!signals.openingSprawlPressure) {
    return null;
  }

  const reasons = [];
  if (signals.totalDeficits > 0) reasons.push(`${signals.totalDeficits} gargalo(s) ja apareceram cedo`);
  if (input.imperialState.resources.supplies < 1100) reasons.push("o suprimento ja esta ficando curto");
  if (input.imperialState.resources.materials < 900) reasons.push("os materiais estao sumindo antes da expansao");
  if (signals.averageDevelopment >= 24) reasons.push("voce ja subiu coisa demais para um reino de uma aldeia so");

  return {
    id: "opening-sprawl",
    kind: "decision",
    severity: signals.totalDeficits > 1 ? "high" : "medium",
    title: "Sua abertura esta se espalhando cedo demais",
    situation: "O comeco ainda devia estar simples e afiado, mas o reino ja comecou a gastar foco em direcoes demais.",
    reason: reasons.join("; "),
    impact: "Se a abertura perder forma agora, a 2a aldeia chega tarde e todo o resto do jogo fica pesado.",
    choices: [
      {
        id: "opening-trim",
        label: "Cortar excesso e fechar a base",
        note: "Voltar para a linha curta que ainda sustenta a expansão.",
        tab: "base",
        query: { v: signals.capitalVillageId, b: "farms", sb: "city" },
      },
      {
        id: "opening-save",
        label: "Segurar clique e juntar recurso",
        note: "Parar conforto agora para comprar a proxima virada.",
        tab: "empire",
        query: { v: signals.capitalVillageId },
      },
      {
        id: "opening-map",
        label: "Abrir o mapa e pensar no proximo polo",
        note: "Parar de decorar a capital e lembrar que a run precisa sair dela.",
        tab: "board",
        query: { v: signals.capitalVillageId },
      },
    ],
    sourceTags: ["opening", "economy", "expansion"],
  };
}

function buildFirstHeroCard(input: BuildPlayerAlertInput, signals: StateSignals): PlayerAlertCard | null {
  if (!signals.firstHeroPressure) {
    return null;
  }

  return {
    id: "first-hero",
    kind: "opportunity",
    severity: signals.expansionActive ? "medium" : "low",
    title: "Esta faltando um rosto para puxar a campanha",
    situation: `Voce ja abriu corpo suficiente para o reino pedir um primeiro especialista, mas ainda joga sem heroi ativo.`,
    reason: `${input.villages.length} aldeia(s), ${signals.totalTroops.toLocaleString("pt-BR")} tropas e ${input.highestDevelopment}/100 de pico ja sao massa demais para andar sem uma especializacao clara.`,
    impact: "Um heroi cedo costuma transformar uma run morna em uma run que realmente ganha ritmo.",
    choices: [
      {
        id: "first-hero-base",
        label: "Ir atras do primeiro heroi certo",
        note: `Puxar ${input.guide.build.heroFocus.slice(0, 2).join(" ou ")} antes que o meio da run comece sem identidade.`,
        tab: "base",
        query: { v: signals.capitalVillageId, b: "palace", sb: "city" },
      },
      {
        id: "first-hero-intelligence",
        label: "Rever a rota antes de escolher",
        note: "Checar qual especialista conversa melhor com a fase atual.",
        tab: "intelligence",
        query: { v: signals.capitalVillageId },
      },
    ],
    sourceTags: ["hero", "opening", "specialization"],
  };
}

function buildSecondVillageCard(input: BuildPlayerAlertInput, signals: StateSignals): PlayerAlertCard | null {
  if (!signals.secondVillagePressure) {
    return null;
  }

  return {
    id: "second-village-late",
    kind: "decision",
    severity: input.guide.warnings.some((warning) => /2a aldeia/i.test(warning)) ? "high" : "medium",
    title: "Seu reino ainda depende demais da Capital",
    situation: `Voce ja tem recurso e corpo para sair da abertura, mas a campanha ainda gira em volta de uma aldeia so.`,
    reason: `${Math.round(signals.averageDevelopment)}/100 de media estrutural, ${signals.totalTroops.toLocaleString("pt-BR")} tropas vivas e nenhuma segunda base sustentando o ritmo.`,
    impact: "Se esse segundo polo nao nascer logo, a sua expansão vira promessa e nao poder.",
    choices: [
      {
        id: "second-village-board",
        label: "Buscar a 2a aldeia agora",
        note: "Virar largura real antes que a abertura fique velha.",
        tab: "board",
        query: { v: signals.capitalVillageId },
      },
      {
        id: "second-village-troops",
        label: "Parar obra e juntar tropa",
        note: "Trocar clique de predio por janela de tomada.",
        tab: "base",
        query: { v: signals.capitalVillageId, b: "barracks", sb: "city" },
      },
      {
        id: "second-village-base",
        label: "Guardar recurso para expandir",
        note: "Aceitar menos conforto agora para nao ficar preso em uma cidade so.",
        tab: "base",
        query: { v: signals.capitalVillageId, b: "housing", sb: "city" },
      },
    ],
    sourceTags: ["expansion", "map"],
  };
}

function buildHundredCard(input: BuildPlayerAlertInput, signals: StateSignals): PlayerAlertCard | null {
  if (!signals.firstHundredPressure) {
    return null;
  }

  return {
    id: "first-hundred-late",
    kind: "decision",
    severity: input.guide.warnings.some((warning) => /100\/100/i.test(warning)) ? "high" : "medium",
    title: "Voce espalhou bem, mas ainda nao fechou uma cidade de verdade",
    situation: `A aldeia mais forte parou em ${input.highestDevelopment}/100 enquanto o resto do reino continua abrindo largura.`,
    reason: `Com ${input.villages.length} aldeias e ${input.questsCompleted} quest(s), a run ja pede uma cidade que realmente carregue o score.`,
    impact: "Se ninguem assumir esse papel, o imperio cresce, mas nao impõe respeito na reta final.",
    choices: [
      {
        id: "first-hundred-focus",
        label: "Fechar a cidade que vai carregar a run",
        note: "Concentrar clique onde o score deixa de ser teoria.",
        tab: "base",
        query: { v: signals.focusVillageId, b: "housing", sb: "city" },
      },
      {
        id: "first-hundred-senate",
        label: "Amarrar score com Senado",
        note: "Subir estrutura e influencia no mesmo folego.",
        tab: "base",
        query: { v: signals.focusVillageId, b: "senate", sb: "city" },
      },
      {
        id: "first-hundred-stop",
        label: "Congelar a expansão por um ciclo",
        note: "Parar de abrir largura para nao perder o timing do fechamento.",
        tab: "empire",
        query: { v: signals.focusVillageId },
      },
    ],
    sourceTags: ["development", "score"],
  };
}

function buildFrontlineCard(signals: StateSignals): PlayerAlertCard | null {
  if (!signals.pressureActive) {
    return null;
  }

  return {
    id: "frontline-pressure",
    kind: "decision",
    severity: signals.collapseActive || signals.attackedVillageCount > 1 || signals.hordeAlertActive ? "high" : "medium",
    title: signals.hordeAlertActive ? "A Horda bateu na porta" : "A borda do seu reino ficou cara demais",
    situation: `${signals.attackedVillageCount} aldeia(s) sob ataque, ${signals.totalTroops.toLocaleString("pt-BR")} tropas vivas e ${signals.totalDeficits} gargalo(s) ativos agora.`,
    reason: signals.hordeAlertActive ? "A Horda entrou no mapa e a margem da run encolheu." : "Sua largura atual começou a cobrar defesa, reposição e atenção ao mesmo tempo.",
    impact: "Se voce responder tarde, a perda nao vai ser so territorial: ela bate no ritmo inteiro da campanha.",
    choices: [
      {
        id: "frontline-board",
        label: "Mandar tropa para segurar a borda",
        note: "Assume que a prioridade agora e nao deixar a linha romper.",
        tab: "board",
        query: { v: signals.capitalVillageId },
      },
      {
        id: "frontline-capital",
        label: "Fechar o reino no centro",
        note: "Trocar ambicao por estabilidade antes da frente piorar.",
        tab: "base",
        query: { v: signals.capitalVillageId, sb: "command", lc: "drill" },
      },
      {
        id: "frontline-economy",
        label: "Cortar gasto e segurar a economia",
        note: "Parar o que nao sustenta a linha agora.",
        tab: "empire",
        query: { v: signals.capitalVillageId },
      },
    ],
    sourceTags: ["combat", "horde", "frontline"],
  };
}

function buildQuestCard(input: BuildPlayerAlertInput, signals: StateSignals): PlayerAlertCard | null {
  if (!signals.questPressure) {
    return null;
  }

  return {
    id: "quest-gap",
    kind: "opportunity",
    severity: signals.portalPressure ? "high" : "medium",
    title: "Tem score facil parado na mesa",
    situation: `Voce fechou ${input.questsCompleted}/3 quests e ainda deixou ${signals.questBacklog} etapa(s) sem converter.`,
    reason: "Quest parada e uma das formas mais caras de parecer forte sem realmente ficar forte.",
    impact: "Fechar isso agora costuma ser o jeito mais limpo de devolver folego para a run.",
    choices: [
      {
        id: "quest-board",
        label: "Caçar a quest agora",
        note: "Transformar pendencia em score e ritmo imediatamente.",
        tab: "board",
        query: { v: signals.capitalVillageId },
      },
      {
        id: "quest-intelligence",
        label: "Rever o plano antes de sair",
        note: "Checar qual pilar da fase esta faltando e evitar clique torto.",
        tab: "intelligence",
        query: { v: signals.capitalVillageId },
      },
    ],
    sourceTags: ["quests", "timing"],
  };
}

function buildEconomyCard(input: BuildPlayerAlertInput, signals: StateSignals): PlayerAlertCard | null {
  const villages = Math.max(1, input.villages.length);
  const resources = input.imperialState.resources;
  const lowSupplies = resources.supplies < villages * 1100;
  const lowMaterials = resources.materials < villages * 900;
  const deficits = input.villages.flatMap((village) => village.deficits);

  if (!lowSupplies && !lowMaterials && deficits.length === 0) {
    return null;
  }

  const reasonBits = [];
  if (lowSupplies) reasonBits.push("suprimentos curtos para o tamanho atual do imperio");
  if (lowMaterials) reasonBits.push("materiais curtos para sustentar obra");
  if (deficits.length > 0) reasonBits.push(`deficits ativos: ${deficits.slice(0, 2).join(", ")}`);

  return {
    id: "economy-pressure",
    kind: "reading",
    severity: signals.collapseActive || (lowSupplies && lowMaterials) ? "high" : "medium",
    title: "Sua economia comecou a cansar",
    situation: `Materiais ${resources.materials.toLocaleString("pt-BR")} | suprimentos ${resources.supplies.toLocaleString("pt-BR")}.`,
    reason: reasonBits.join("; "),
    impact: "Mais um ciclo de clique pesado pode fazer o reino perder o passo bem na hora errada.",
    choices: [
      {
        id: "economy-base",
        label: lowSupplies ? "Respirar e repor suprimento" : "Respirar e juntar materiais",
        note: lowSupplies ? "Aceita um passo menos ambicioso para nao travar a campanha." : "Reequilibra obra antes que o resto do reino sinta.",
        tab: "base",
        query: { v: signals.capitalVillageId, b: lowSupplies ? "farms" : "mines", sb: "city" },
      },
    ],
    sourceTags: ["economy", "resources"],
  };
}

function buildStableWindowCard(signals: StateSignals): PlayerAlertCard | null {
  const hasRoomToPush =
    signals.stableEconomy &&
    !signals.pressureActive &&
    !signals.portalPressure &&
    !signals.marchPressure &&
    signals.maxedVillageCount === 0;

  if (!hasRoomToPush) {
    return null;
  }

  return {
    id: "stable-window",
    kind: "opportunity",
    severity: "low",
    title: "Voce ganhou um respiro",
    situation: "A economia esta em pé, a fronteira nao esta gritando e a run ainda tem margem para escolher o proximo salto.",
    reason: "Essa e a melhor hora para empurrar a campanha sem parecer desespero.",
    impact: "Se voce usar bem esse momento, transforma folga em vantagem antes que o mundo aperte de novo.",
    choices: [
      {
        id: "stable-focus",
        label: "Transformar folga em score",
        note: "Empurrar a cidade que vai devolver mais impacto real.",
        tab: "base",
        query: { v: signals.focusVillageId, b: "housing", sb: "city" },
      },
      {
        id: "stable-intelligence",
        label: "Escolher o proximo salto com calma",
        note: "Usar o guia enquanto ainda existe margem para decidir bem.",
        tab: "intelligence",
        query: { v: signals.focusVillageId },
      },
    ],
    sourceTags: ["opportunity", "economy"],
  };
}

function buildFallbackCard(input: BuildPlayerAlertInput, focusVillageId: string): PlayerAlertCard {
  return {
    id: "guide-focus",
    kind: "reading",
    severity: "low",
    title: "O reino esta rodando, mas o foco decide o teto",
    situation: input.guide.focus,
    reason: `Voce esta na ${input.guide.windowLabel.toLowerCase()} da rota ${input.guide.build.label}.`,
    impact: input.guide.nextAction,
    choices: [
      {
        id: "guide-open",
        label: "Seguir o foco da fase",
        note: "Ir direto para a tela que mais pesa agora.",
        tab: input.guide.recommendedTab,
        query: { v: focusVillageId },
      },
    ],
    sourceTags: ["guide"],
  };
}

function selectPrimaryCard(cards: PlayerAlertCard[]): PlayerAlertCard | null {
  const decisions = cards.filter((entry) => entry.kind === "decision");
  if (decisions.length > 0) {
    return decisions[0] ?? null;
  }
  return cards[0] ?? null;
}

function selectSecondaryCards(cards: PlayerAlertCard[], primaryId: string): PlayerAlertCard[] {
  const pool = cards.filter((entry) => entry.id !== primaryId);
  const opportunity = pool.find((entry) => entry.kind === "opportunity");
  const reading = pool.find((entry) => entry.kind === "reading");
  return [opportunity, reading].filter(Boolean) as PlayerAlertCard[];
}

function cardPriority(card: PlayerAlertCard): number {
  return CARD_PRIORITY[card.id] ?? 0;
}

export function buildPlayerAlertDeck(input: BuildPlayerAlertInput): PlayerAlertDeck {
  const signals = buildStateSignals(input);
  const candidates: PlayerAlertCard[] = [];

  pushIfUnique(candidates, buildOpeningSprawlCard(input, signals));
  pushIfUnique(candidates, buildFirstHeroCard(input, signals));
  pushIfUnique(candidates, buildCollapseCard(input, signals));
  pushIfUnique(candidates, buildPortalCard(input, signals));
  pushIfUnique(candidates, buildMarchCard(input, signals));
  pushIfUnique(candidates, buildSecondVillageCard(input, signals));
  pushIfUnique(candidates, buildHundredCard(input, signals));
  pushIfUnique(candidates, buildFrontlineCard(signals));
  pushIfUnique(candidates, buildQuestCard(input, signals));
  pushIfUnique(candidates, buildEconomyCard(input, signals));
  pushIfUnique(candidates, buildStableWindowCard(signals));

  const ordered = candidates.sort((left, right) => {
    const score =
      severityScore(right.severity) +
      kindScore(right.kind) +
      cardPriority(right) -
      (severityScore(left.severity) + kindScore(left.kind) + cardPriority(left));
    if (score !== 0) return score;
    return left.title.localeCompare(right.title);
  });

  const primary = selectPrimaryCard(ordered) ?? buildFallbackCard(input, signals.focusVillageId);

  const secondary = selectSecondaryCards(ordered, primary.id);
  if (secondary.length === 0 && primary.id !== "guide-focus") {
    secondary.push(buildFallbackCard(input, signals.focusVillageId));
  }

  return {
    primary,
    secondary,
  };
}
