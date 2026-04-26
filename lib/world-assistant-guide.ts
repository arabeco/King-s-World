﻿import { FINAL_EXODUS_DAY } from "@/core/GameBalance";
import type { EvolutionMode } from "@/core/GameBalance";
import type { CityClass } from "@/lib/cities";

export type WorldTab = "empire" | "base" | "board" | "intelligence" | "guide";
export type CoachBuildId = "balanced" | "metropole" | "posto_avancado" | "bastiao" | "celeiro";
export type CoachWindowId = "opening" | "expand" | "convert" | "scale" | "exodus";

export type CoachBuildMeta = {
  label: string;
  identity: string;
  opening: string;
  secondVillageTarget: number;
  firstHundredTarget: number;
  day90Goal: string;
  heroFocus: string[];
};

export type CoachGuide = {
  build: CoachBuildMeta;
  buildId: CoachBuildId;
  windowId: CoachWindowId;
  windowLabel: string;
  focus: string;
  summary: string;
  nextAction: string;
  actions: string[];
  checkpoints: string[];
  warnings: string[];
  recommendedTab: WorldTab;
  beginnerTitle: string;
  beginnerSteps: string[];
};

const GUIDE_HERO_DEPTH_DAY = Math.ceil(FINAL_EXODUS_DAY * 0.67);

export type SandboxCoachCta = {
  label: string;
  detail: string;
  tab: WorldTab;
  query: Record<string, string>;
};

export const BUILD_META: Record<CoachBuildId, CoachBuildMeta> = {
  balanced: {
    label: "Balanceado",
    identity: "Segura a economia cedo, expande sem exagero e fecha score antes do Êxodo.",
    opening: "Produção 3 + Sociedade 3 + um eixo de identidade sem espalhar nível.",
    secondVillageTarget: 15,
    firstHundredTarget: 45,
    day90Goal: "1800+ de influência pronta para a Fase 4.",
    heroFocus: ["1 herói útil até D20-D30", "Engenheiro", "Explorador se o spawn for longe"],
  },
  metropole: {
    label: "Metrópole",
    identity: "Converte Capital forte em vila 100, conselho e Maravilhas cedo.",
    opening: "Governo 4 + Produção 3 + Sociedade 3.",
    secondVillageTarget: 11,
    firstHundredTarget: 39,
    day90Goal: "2200+ de influência com quests e Maravilhas bem encaixadas.",
    heroFocus: ["Engenheiro", "Sabio", "Administrador", "General", "Explorador"],
  },
  posto_avancado: {
    label: "Posto Avançado",
    identity: "Transforma combate e pressão de mapa em expansão e score real.",
    opening: "Quartel 4 + Produção 3 + Governo 2.",
    secondVillageTarget: 14,
    firstHundredTarget: 38,
    day90Goal: "2100+ de influência com militar forte e quests em dia.",
    heroFocus: ["General cedo", "Engenheiro", "Explorador", "Administrador"],
  },
  bastiao: {
    label: "Bastião",
    identity: "Defende bem no mid game sem perder a janela de logística final.",
    opening: "Muralha 4 + Sociedade 3 + Produção 3.",
    secondVillageTarget: 16,
    firstHundredTarget: 46,
    day90Goal: "1900+ de influência com defesa viva e ETA viável.",
    heroFocus: ["Engenheiro", "Explorador", "heróis de sustentação"],
  },
  celeiro: {
    label: "Celeiro",
    identity: "Acelera fluxo interno e converte economia em vila 100, quests e ETA.",
    opening: "Produção 4 + Sociedade 4 + Governo 2.",
    secondVillageTarget: 9,
    firstHundredTarget: 37,
    day90Goal: "1789+ de influência com Flow e logística fechados.",
    heroFocus: ["Administrador cedo", "Engenheiro", "Sabio", "Explorador"],
  },
};

export function resolveBuild(mode: EvolutionMode | undefined, cityClass: CityClass | undefined): CoachBuildId {
  if (cityClass === "metropole") return "metropole";
  if (cityClass === "posto_avancado") return "posto_avancado";
  if (cityClass === "bastiao") return "bastiao";
  if (cityClass === "celeiro") return "celeiro";
  if (mode === "metropole") return "metropole";
  if (mode === "vanguard") return "posto_avancado";
  if (mode === "bastion") return "bastiao";
  if (mode === "flow") return "celeiro";
  return "balanced";
}

export function formatCampaignDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function buildGuide(
  buildId: CoachBuildId,
  currentDay: number,
  stats: {
    villageCount: number;
    highestDevelopment: number;
    heroCount: number;
    wonders: number;
    quests: number;
  },
): CoachGuide {
  const build = BUILD_META[buildId];
  const warnings: string[] = [];

  if (currentDay > build.secondVillageTarget && stats.villageCount < 2) {
    warnings.push(`Sua 2a aldeia está atrasada para a rota ${build.label}. Meta ideal: até D${build.secondVillageTarget}.`);
  }
  if (currentDay > build.firstHundredTarget && stats.highestDevelopment < 100) {
    warnings.push(`A primeira aldeia 100/100 ainda não fechou. A rota ${build.label} queria isso perto de D${build.firstHundredTarget}.`);
  }
  if (currentDay >= GUIDE_HERO_DEPTH_DAY && stats.heroCount <= 1) {
    warnings.push("Seu conselho parece raso para o mid/late game. O blueprint forte entra na reta final com mais especialistas.");
  }
  if (currentDay >= FINAL_EXODUS_DAY && stats.quests <= 1) {
    warnings.push("Você chegou ao Êxodo com poucas quests. Isso costuma travar o corte do Portal.");
  }
  if (currentDay >= FINAL_EXODUS_DAY && stats.wonders === 0 && buildId !== "posto_avancado") {
    warnings.push("Seu teto de score está curto sem Maravilhas nesta altura da campanha.");
  }

  if (currentDay <= 5) {
    return {
      build,
      buildId,
      windowId: "opening",
      windowLabel: "Janela D1-D5",
      focus: "Abrir a build sem espalhar recurso em setores demais.",
      summary: build.opening,
      nextAction: `Feche a abertura da ${build.label} e guarde recurso para acelerar a 2a aldeia.`,
      actions: [
        "Feche Produção/Sociedade cedo para não travar material, suprimento e população.",
        `Suba o eixo de identidade da build: ${build.opening}`,
        "Faça buscas/coletas cedo para criar folga antes da primeira expansão.",
      ],
      checkpoints: [
        `Meta de 2a aldeia: até D${build.secondVillageTarget}.`,
        "Não espalhe upgrades em muitos setores pequenos.",
        "Comece a desenhar qual vila vai virar a primeira 100/100.",
      ],
      warnings,
      recommendedTab: "base",
      beginnerTitle: currentDay === 0 ? "Primeiros cliques do reino" : "Rotina da abertura",
      beginnerSteps: currentDay === 0
        ? [
            "Abra Cidades para melhorar a Capital e ver os 5 setores do reino.",
            "Abra Império para entender recursos, heróis e a força atual do seu reino.",
            "Abra Mapa quando quiser expandir, procurar oportunidades e planejar a próxima aldeia.",
          ]
        : [
            "Comece por Cidades e execute a melhoria sugerida no centro da tela.",
            "Use o conselheiro para não espalhar recurso em muitos setores ao mesmo tempo.",
            "Quando houver folga, visite o Mapa para preparar expansão e reconhecimento.",
          ],
    };
  }

  if (currentDay <= 15) {
    return {
      build,
      buildId,
      windowId: "expand",
      windowLabel: "Janela D6-D15",
      focus: "Expandir sem quebrar a economia inicial.",
      summary: "Agora o jogo quer 2a aldeia, exército inicial e o primeiro herói certo para a build.",
      nextAction: `Busque ou funda a 2a aldeia até D${build.secondVillageTarget} enquanto monta o primeiro pacote de tropas.`,
      actions: [
        "Pare de abrir setores demais e concentre recurso na expansão.",
        "Monte o primeiro bloco de exército na Capital.",
        `Priorize heróis desta rota: ${build.heroFocus.slice(0, 2).join(" + ")}.`,
      ],
      checkpoints: [
        `2a aldeia no prazo ideal: D${build.secondVillageTarget}.`,
        "Primeira quest deve entrar na sua mira para o começo do mid game.",
        "Mapa e logística já precisam entrar na rotina, não só setor de cidade.",
      ],
      warnings,
      recommendedTab: "board",
      beginnerTitle: "Como jogar esta fase",
      beginnerSteps: [
        "Olhe a ação sugerida do conselheiro antes de gastar recurso.",
        "Abra o Mapa para buscar a 2a aldeia e enxergar espaços próximos.",
        "Volte para Cidades para converter recurso em crescimento real.",
      ],
    };
  }

  if (currentDay <= 45) {
    return {
      build,
      buildId,
      windowId: "convert",
      windowLabel: "Janela D16-D45",
      focus: "Parar de crescer largo e converter uma cidade em score real.",
      summary: "Este trecho decide se a run vira campanha forte ou economia bonita sem fechamento.",
      nextAction: `Escolha agora a vila 100/100 e empurre até fechar perto de D${build.firstHundredTarget}.`,
      actions: [
        "Feche Quest 1 e tire proveito do primeiro pico de heróis.",
        "Não tente upar todas as aldeias igual; uma precisa virar referência.",
        "Abra economia ou pressão militar conforme a identidade da build.",
      ],
      checkpoints: [
        `1a aldeia 100/100 ideal: perto de D${build.firstHundredTarget}.`,
        "3-4 aldeias bem nutridas normalmente valem mais que 6 aldeias moles.",
        "Se Engenheiro faz parte da rota, ele já deve estar no radar.",
      ],
      warnings,
      recommendedTab: "empire",
      beginnerTitle: "Como ler o jogo daqui em diante",
      beginnerSteps: [
        "Escolha uma aldeia principal e clique nela com frequência.",
        "Priorize score real em vez de subir tudo um pouco.",
        "Abra Império para checar se a estrutura está virando poder de verdade.",
      ],
    };
  }

  if (currentDay <= 90) {
    return {
      build,
      buildId,
      windowId: "scale",
      windowLabel: "Janela D46-D90",
      focus: "Escalar pilares de score sem perder timing de ETA.",
      summary: "Seu reino precisa virar um império completo: aldeias, quests, conselho, militar e Maravilhas/logística.",
      nextAction: "Feche as lacunas do seu pilar principal e não deixe ETA para a última hora.",
      actions: [
        "Leve o império para 7-10 aldeias com qualidade, não só quantidade.",
        "Feche Quest 2 e Quest 3 e traga o conselho para perto do pacote ideal.",
        `Seu alvo de D90 para esta build: ${build.day90Goal}`,
      ],
      checkpoints: [
        "Explorador deixa de ser opcional quando o spawn é longe.",
        "Engenheiro quase sempre vira teto alto de score.",
        "Uma run boa entra no Dia 90 sabendo como vai chegar ao Centro.",
      ],
      warnings,
      recommendedTab: "intelligence",
      beginnerTitle: "Como manter o reino jogável",
      beginnerSteps: [
        "Abra Inteligência para ler o momento da run e os cards que importam agora.",
        "Cheque Cidades quando precisar transformar sobra de recurso em eficiência.",
        "Use o Mapa para validar distâncias, fronteiras e alvos antes de agir.",
      ],
    };
  }

  return {
    build,
    buildId,
    windowId: "exodus",
    windowLabel: "Janela D91-D120",
    focus: "Agrupar, proteger score e marchar no timing certo.",
    summary: "No Êxodo, quem vence não é quem construiu cedo; é quem manteve setores, conselho, quests e ETA vivos até a marcha final.",
    nextAction: "Reagrupe, confira a influência e marche apenas quando a conta final continuar viva acima do corte.",
    actions: [
      "Agrupe tropas e cidades chave na Capital.",
      "Cheque score, quest, Maravilhas e ETA antes de comprometer a marcha.",
      "Evite sair cedo sem logística ou tarde demais sem janela de chegada.",
    ],
    checkpoints: [
      "Portal pede influência viva, não histórico bonito.",
      "A reta final pune reinos largos mas desorganizados.",
      "Se o spawn é longe, logística manda mais que força bruta.",
    ],
    warnings,
    recommendedTab: "board",
    beginnerTitle: "Como fechar a campanha",
    beginnerSteps: [
      "Abra Mapa para preparar a marcha e reagrupar o que importa.",
      "Confira Império para garantir que sua influência continua viva.",
      "Só execute a jogada final quando logística e defesa estiverem coerentes.",
    ],
  };
}

export function buildSandboxCoachCta(
  currentDay: number,
  strategyId: string | null | undefined,
  capitalVillageId: string,
  focusVillageId: string,
): SandboxCoachCta {
  const strategy = strategyId ?? "metropole";

  if (currentDay <= 5) {
    if (strategy === "metropole") {
      return {
        label: "Abrir Governo",
        detail: "Vá direto para o setor de Governo da Capital e clique no +Nv de uma skill.",
        tab: "base",
        query: { v: capitalVillageId, s: "crown", sb: "city" },
      };
    }
    if (strategy === "posto_avancado") {
      return {
        label: "Abrir Quartel",
        detail: "Abertura militar: vá direto para o setor de Quartel da Capital e suba a skill principal.",
        tab: "base",
        query: { v: capitalVillageId, s: "recruitment", sb: "city" },
      };
    }
    if (strategy === "bastiao") {
      return {
        label: "Abrir Muralha",
        detail: "Abertura defensiva: vá direto para Muralha ou Sociedade e garanta segurança antes de expandir.",
        tab: "base",
        query: { v: capitalVillageId, s: "defense", sb: "city" },
      };
    }
    return {
      label: "Abrir Produção",
      detail: "Vá direto para Produção ou Sociedade e transforme recurso em crescimento real.",
      tab: "base",
      query: { v: capitalVillageId, s: "economy", sb: "city" },
    };
  }

  if (currentDay <= 15) {
    return {
      label: "Ir para a ação do mapa",
      detail: "Agora a jogada certa costuma ser preparar 2a aldeia, busca ou expansão no mapa.",
      tab: "board",
      query: { v: focusVillageId },
    };
  }

  if (currentDay <= 45) {
    return {
      label: "Abrir cidade foco",
      detail: "Concentre clique na cidade foco: ela precisa virar 100/100 antes do reino espalhar demais.",
      tab: "base",
      query: { v: focusVillageId, s: "society", sb: "city" },
    };
  }

  if (currentDay <= 90) {
    return {
      label: "Abrir comando do império",
      detail: "Neste trecho o clique certo costuma misturar recrutamento, herói e operações.",
      tab: "base",
      query: { v: capitalVillageId, sb: "command", lc: "drill" },
    };
  }

  return {
    label: "Abrir marcha final",
    detail: "Reta final: reagrupar, consolidar tropas e preparar a marcha no mapa.",
    tab: "board",
    query: { v: capitalVillageId },
  };
}
