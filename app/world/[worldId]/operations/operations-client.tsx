"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Compass,
  Crown,
  FlaskConical,
  Shield,
  ShieldCheck,
  Sparkles,
  Swords,
  UserRound,
  Users,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

import {
  CITY_DIPLOMAT_UNLOCK_DEVELOPMENT,
  calculateVillageDevelopment,
  getEvolutionModeProfile,
  listEvolutionModeProfiles,
  MAX_CITY_DIPLOMATS,
  SOVEREIGNTY_MILITARY_SCORE_CAP,
  MAX_TOTAL_DIPLOMATS,
  MAX_TRIBE_ENVOYS,
  calculateTribeProgressStage,
  describeNextTribeStep,
  type EvolutionMode,
} from "@/core/GameBalance";
import { DetailSheet, type DetailSheetContent } from "@/components/detail-sheet";
import { countCouncilSlots, formatCouncilLoadout, type HeroSpecialistId } from "@/lib/council";
import { mergeImperialVillages, useImperialState } from "@/lib/imperial-state";
import { cityClassLabel } from "@/lib/cities";
import { emitUiFeedback } from "@/lib/ui-feedback";
import { useLiveWorld } from "@/lib/world-runtime";

type HeroSpecialist = {
  id: HeroSpecialistId;
  name: string;
  role: string;
  icon: LucideIcon;
  directValue: number;
  summary: string;
  buildHook: string;
};

const HERO_SPECIALISTS: HeroSpecialist[] = [
  { id: "engineer", name: "Engenheiro", role: "Obras", icon: Wrench, directValue: 50, summary: "Acelera obra e habilita Maravilhas.", buildHook: "Guia Metropole e Bastiao no fechamento da cidade 100/100." },
  { id: "marshal", name: "General", role: "Combate", icon: Swords, directValue: 50, summary: "Reduz atrito do exercito e empurra ranking militar.", buildHook: "Guia Posto Avancado e converte ataque em pontos reais." },
  { id: "navigator", name: "Explorador", role: "Mapa", icon: Compass, directValue: 50, summary: "Revela territorio, derruba ETA e limpa rotas longas.", buildHook: "Guia Celeiro e qualquer spawn longe do centro." },
  { id: "intendente", name: "Administrador", role: "Fluxo", icon: Users, directValue: 50, summary: "Organiza suprimentos, comboios e sustentacao de expansao.", buildHook: "Guia expansao com muitas cidades e cadeia de Maravilhas." },
  { id: "erudite", name: "Sabio", role: "Pesquisa", icon: FlaskConical, directValue: 50, summary: "Puxa quests, doutrina e reduz atraso de branch.", buildHook: "Guia rotas de build que vencem por timing e nao por massa." },
];

const HERO_LABELS = Object.fromEntries(
  HERO_SPECIALISTS.map((hero) => [hero.id, hero.name]),
) as Record<HeroSpecialistId, string>;

const MODE_IDS: EvolutionMode[] = ["balanced", "metropole", "vanguard", "bastion", "flow"];

const MODE_CHIP_LABEL: Record<EvolutionMode, string> = {
  balanced: "Consolidar",
  metropole: "Surto Economico",
  vanguard: "Mobilizacao",
  bastion: "Fortificar",
  flow: "Corredor de Marcha",
};

const DETAIL_IMAGE_BY_ID: Record<string, string> = {
  "research-summary": "/images/conselho.jpg",
  "council-summary": "/images/card-council.jpg",
  "diplomats-summary": "/images/card-expansion.jpg",
  "tribe-summary": "/images/territory-controlled.jpg",
  "military-summary": "/images/card-battle.jpg",
  "quests-summary": "/images/card-opportunity.jpg",
};

const HERO_IMAGE_BY_ID: Record<HeroSpecialistId, string> = {
  engineer: "/images/governo.jpg",
  marshal: "/images/military-attack.jpg",
  navigator: "/images/military-explore.jpg",
  intendente: "/images/celeiro.jpg",
  erudite: "/images/conselho.jpg",
};

function detailImageForId(id: string | null): string | undefined {
  if (!id) return undefined;
  if (DETAIL_IMAGE_BY_ID[id]) return DETAIL_IMAGE_BY_ID[id];
  if (id.startsWith("research-")) return "/images/conselho.jpg";
  if (id.startsWith("hero-")) {
    const heroId = id.replace("hero-", "") as HeroSpecialistId;
    return HERO_IMAGE_BY_ID[heroId] ?? "/images/card-council.jpg";
  }
  return undefined;
}

function immersiveCardStyle(imageSrc: string) {
  return {
    backgroundImage: `linear-gradient(180deg, rgba(2,6,23,0.12), rgba(2,6,23,0.9)), url('${imageSrc}')`,
    backgroundPosition: "center",
    backgroundSize: "cover",
  };
}

function tribeEnvoyStageLabel(count: number): string {
  if (count >= 2) return "Dois enviados travados";
  if (count === 1) return "Representacao aberta";
  return "Sem enviado";
}

function tribeInfluenceStageLabel(stage: number): string {
  if (stage >= 5) return "Trilha tribal completa";
  if (stage === 4) return "Ultimo selo pendente";
  if (stage === 3) return "Camara consolidada";
  if (stage === 2) return "Pacto estavel";
  if (stage === 1) return "Representacao";
  return "Sem trilha";
}

function normalizeMode(input: string | undefined): EvolutionMode {
  if (!input) return "balanced";
  return MODE_IDS.includes(input as EvolutionMode) ? (input as EvolutionMode) : "balanced";
}

function branchTone(branch: string): "blue" | "green" | "red" {
  const normalized = branch.toLowerCase();
  if (normalized.includes("urb") || normalized.includes("econom") || normalized.includes("govern")) return "green";
  if (normalized.includes("tatic") || normalized.includes("def") || normalized.includes("apocal")) return "red";
  return "blue";
}

function describeResearchImpact(branch: string): string {
  const normalized = branch.toLowerCase();
  if (normalized.includes("govern") || normalized.includes("urb")) {
    return "Empurra Metropole: custo melhor, 1a cidade 100 mais cedo e conselho mais facil de fechar.";
  }
  if (normalized.includes("log")) {
    return "Empurra Celeiro: comboio, doacao interna e marcha final com ETA menor.";
  }
  if (normalized.includes("apocal") || normalized.includes("def")) {
    return "Empurra Bastiao: menos punição de horda e mais estabilidade no late game.";
  }
  return "Empurra Posto: timing tatico e execução ofensiva.";
}

export function OperationsClient({
  params,
  searchParams,
}: {
  params: { worldId: string };
  searchParams: { v?: string; m?: string };
}) {
  const { world } = useLiveWorld(params.worldId);
  const { imperialState, setImperialState } = useImperialState(params.worldId, world.villages);
  const mergedVillages = mergeImperialVillages(world.villages, imperialState);
  const [openedDetailId, setOpenedDetailId] = useState<string | null>(null);
  const selectedVillageId = typeof searchParams.v === "string" ? searchParams.v : world.activeVillageId;
  const activeVillage = mergedVillages.find((entry) => entry.id === selectedVillageId) ?? mergedVillages[0];
  const evolutionMode = normalizeMode(typeof searchParams.m === "string" ? searchParams.m : undefined);
  const modeProfile = getEvolutionModeProfile(evolutionMode);
  const modes = listEvolutionModeProfiles();

  const councilSlots = Object.values(imperialState.heroByVillage).filter(
    (heroId): heroId is HeroSpecialistId => HERO_SPECIALISTS.some((hero) => hero.id === heroId),
  );
  const activeHeroCount = councilSlots.length;
  const councilCounts = countCouncilSlots(councilSlots);
  const councilLoadout = formatCouncilLoadout(councilCounts, HERO_LABELS);
  const development = calculateVillageDevelopment(activeVillage.buildingLevels);
  const baseDevelopment = calculateVillageDevelopment({
    ...activeVillage.buildingLevels,
    wonder: 0,
  });

  const avgResearchProgress =
    world.researches.length > 0
      ? Math.round(world.researches.reduce((acc, entry) => acc + entry.progress, 0) / world.researches.length)
      : 0;

  const militaryPct = Math.min(100, Math.round((world.sovereignty.militaryRankingPoints / SOVEREIGNTY_MILITARY_SCORE_CAP) * 100));
  const questPct = Math.round((world.sovereignty.eraQuestsCompleted / 3) * 100);
  const heroLimit = 10;
  const councilPct = Math.min(100, Math.round((activeHeroCount / heroLimit) * 100));
  const colonyRows = mergedVillages
    .filter((entry) => entry.type === "Colonia")
    .map((entry) => {
      const cityDevelopment = calculateVillageDevelopment(entry.buildingLevels);
      const unlocked = cityDevelopment >= CITY_DIPLOMAT_UNLOCK_DEVELOPMENT;
      const assigned = imperialState.diplomatByVillage[entry.id] ?? false;
      return {
        id: entry.id,
        name: entry.name,
        development: cityDevelopment,
        unlocked,
        assigned,
        cityClass: entry.cityClass,
      };
    });
  const unlockedDiplomatSlots = Math.min(MAX_CITY_DIPLOMATS, colonyRows.filter((entry) => entry.unlocked).length);
  const recruitedDiplomats = Math.min(unlockedDiplomatSlots, Math.max(0, imperialState.recruitedDiplomats ?? 0));
  const assignedCityDiplomats = colonyRows.filter((entry) => entry.assigned).length;
  const recruitedTribeEnvoys = Math.min(MAX_TRIBE_ENVOYS, Math.max(0, imperialState.recruitedTribeEnvoys ?? 0));
  const tribeEnvoysCommitted = Math.min(MAX_TRIBE_ENVOYS, imperialState.tribeEnvoysCommitted ?? 0);
  const annexEnvoysCommitted = Math.max(0, imperialState.annexEnvoysCommitted ?? 0);
  const freeDiplomats = Math.max(0, recruitedDiplomats - assignedCityDiplomats - annexEnvoysCommitted);
  const freeTribeEnvoys = Math.max(0, recruitedTribeEnvoys - tribeEnvoysCommitted);
  const diplomatPct = Math.min(100, Math.round((recruitedDiplomats / MAX_CITY_DIPLOMATS) * 100));
  const totalDiplomats = recruitedDiplomats + recruitedTribeEnvoys;
  const tribeInfluenceStage = calculateTribeProgressStage({
    currentDay: world.day,
    tribeEnvoysCommitted,
    kingAlive: world.sovereignty.kingAlive,
  });
  const tribePct = Math.min(100, Math.round((tribeInfluenceStage / 5) * 100));
  const nextTribeStep = describeNextTribeStep({
    currentDay: world.day,
    currentStage: tribeInfluenceStage,
    tribeEnvoysCommitted,
    kingAlive: world.sovereignty.kingAlive,
  });

  const details = useMemo<Record<string, DetailSheetContent> | null>(() => {
    if (!openedDetailId) {
      return null;
    }

    const sharedResearchRows = world.researches.map((research) => ({
      label: research.name,
      current: research.progress,
      max: 100,
      note: `${research.branch} · Nv ${research.level} · ETA ${research.eta}`,
    }));

    return {
      "research-summary": {
        eyebrow: "Pesquisa",
        title: "Pesquisa e Branch ativa",
        description: "Pesquisa nao entra como score fixo direto, mas e ela que puxa a personalidade da build. Se a branch estiver errada, a run entra tarde na curva boa.",
        formula: "Branch certa = mais velocidade na sua linha forte. Branch errada = custo de oportunidade e atraso de timing.",
        valueLabel: `${avgResearchProgress}% de media global`,
        progressPct: avgResearchProgress,
        color: "blue",
        metrics: [
          { label: "Modo atual", value: modeProfile.label, note: "Afeta custo e tempo de todos os edificios pelo viés escolhido." },
          { label: "Cidade ativa", value: `${development}/100`, note: `Base da cidade: ${baseDevelopment}/90. Maravilha local entra depois para fechar os 100.` },
          { label: "Pesquisa viva", value: `${world.researches.length}`, note: "Linhas atualmente visiveis neste mock." },
          { label: "Grip de build", value: avgResearchProgress >= 65 ? "Alto" : "Medio", note: "Quanto mais cedo a pesquisa certa entra, mais ela separa uma boa seed da seed errada." },
        ],
        breakdown: sharedResearchRows,
        missing: [
          "Pesquisa precisa ser o volante da build: Urbana puxa economia, Tatica puxa militar, Defensiva puxa sobrevivencia, Fluxo puxa marcha e doacao.",
          "Se a cidade ainda esta abaixo de 90/90 nos 9 predios base, a Maravilha local continua bloqueada.",
        ],
      },
      "council-summary": {
        eyebrow: "Conselho",
        title: "Herois do Governo",
        description: "Heroi agora nasce no Governo da cidade: caro, 1 por cidade, e cada compra precisa disputar recurso com predio e populacao.",
        formula: "10 cidades x 1 heroi x 50 pontos = 500 no score. O tipo e a build do heroi mudam o peso da cidade.",
        valueLabel: `${activeHeroCount}/${heroLimit} ativos${councilLoadout ? ` · ${councilLoadout}` : ""}`,
        progressPct: councilPct,
        color: "blue",
        metrics: [
          { label: "Score direto", value: `${activeHeroCount * 50}/500`, note: "Valor fixo ja convertido em influencia pelo Governo." },
          { label: "Faltam", value: `${Math.max(0, heroLimit - activeHeroCount)}`, note: "Cada cidade sem heroi deixa 50 pontos fora da mesa." },
          { label: "Carga atual", value: councilLoadout || "Sem combo", note: "Composicao atual dos herois contratados." },
          { label: "Risco", value: activeHeroCount >= 7 ? "Baixo" : "Alto", note: "Poucos herois deixam a build generica e menos responsiva." },
        ],
        breakdown: HERO_SPECIALISTS.map((hero) => {
          const copies = councilCounts[hero.id];
          return {
            label: hero.name,
            current: copies,
            max: heroLimit,
            note:
              copies > 0
                ? `${copies} vaga(s) = ${copies * 50} pts. ${hero.summary} ${hero.buildHook}`
                : `Nenhuma vaga alocada. ${hero.buildHook}`,
          };
        }),
        missing: [
  "Metropole gira melhor com Engenheiro x2 + Sabio + Administrador + Explorador.",
  "Posto gira melhor com General x2 + Explorador + Engenheiro + Administrador.",
  "Bastiao gira melhor com General x2 + Engenheiro + Administrador + Sabio.",
  "Celeiro gira melhor com Explorador x2 + Administrador + Engenheiro + Sabio.",
        ],
      },
      "diplomats-summary": {
        eyebrow: "Diplomacia",
        title: "Diplomatas das Colonias",
        description: "Diplomatas nao ocupam os 5 slots do Conselho. Cada Colonia madura abre 1 slot diplomatico, mas voce ainda precisa contratar esse agente na aba de Herois.",
        formula: `Cada Colonia com ${CITY_DIPLOMAT_UNLOCK_DEVELOPMENT}/100 ou mais libera 1 slot (max ${MAX_CITY_DIPLOMATS}). O pool de Colonias cuida de cidades e anexacao. A Tribo usa 2 enviados proprios.`,
        valueLabel: `${totalDiplomats}/${MAX_TOTAL_DIPLOMATS} agentes`,
        progressPct: diplomatPct,
        color: "blue",
        metrics: [
          { label: "Slots", value: `${unlockedDiplomatSlots}/${MAX_CITY_DIPLOMATS}`, note: "Colonias maduras que ja abriram um slot diplomatico." },
          { label: "Contratados", value: `${recruitedDiplomats}/${MAX_CITY_DIPLOMATS}`, note: "Agentes de Colonias realmente recrutados na aba de Herois." },
          { label: "Em cidades", value: `${assignedCityDiplomats}`, note: "Diplomatas hoje cuidando de uma cidade especifica." },
          { label: "Em missao", value: `${annexEnvoysCommitted}`, note: "Diplomatas em campo anexando cidades vazias ou estabilizando posse." },
          { label: "Livres", value: `${freeDiplomats}`, note: "Pool pronto para designar cidade ou anexar no mapa." },
        ],
        breakdown: colonyRows.map((row) => ({
          label: row.name,
          current: row.unlocked ? 1 : 0,
          max: 1,
          note: row.assigned
            ? `Diplomata ativo na cidade. Classe ${cityClassLabel(row.cityClass)}.`
            : row.unlocked
              ? `Slot liberado em ${row.development}/100. Se houver agente contratado livre, pode receber um diplomata.`
              : `Ainda bloqueado. Falta chegar em ${CITY_DIPLOMAT_UNLOCK_DEVELOPMENT}/100.`,
        })),
        missing: [
          "Colonias abaixo do limiar ainda nao liberam slot diplomatico.",
          "Aqui voce decide quantos agentes de Colonias quer contratar de verdade, em vez de ganhar tudo automaticamente.",
        ],
      },
      "tribe-summary": {
        eyebrow: "Tribo",
        title: "Representacao no Domo da Tribo",
        description: "A Tribo agora usa 2 enviados proprios. O primeiro abre os 20 iniciais para quem joga mais solo; o segundo fecha o ultimo selo de 20 no late game.",
        formula: "5 etapas x 20 = 100. Etapa 1 abre com o 1o enviado tribal. Etapas 2, 3 e 4 sobem por permanencia no tempo. Etapa 5 fecha com o 2o enviado tribal no fim.",
        valueLabel: `${tribeInfluenceStage}/5 etapas`,
        progressPct: tribePct,
        color: "green",
        metrics: [
          { label: "Etapa", value: tribeInfluenceStageLabel(tribeInfluenceStage), note: "Estado atual da sua trilha de 100 da Tribo." },
          { label: "Enviados", value: `${tribeEnvoysCommitted}/${MAX_TRIBE_ENVOYS}`, note: "Dois enviados especiais da Tribo, separados dos 9 de Colonia." },
          { label: "Contratados", value: `${recruitedTribeEnvoys}/${MAX_TRIBE_ENVOYS}`, note: "Quantos enviados tribais ja foram recrutados na aba de Herois." },
          { label: "Proximo +20", value: nextTribeStep, note: "Proximo passo para subir a proxima faixa da Tribo." },
        ],
        breakdown: [
          { label: "1. Representacao", current: tribeInfluenceStage >= 1 ? 20 : 0, max: 20, note: "Envie o 1o enviado tribal e abra o piso de +20." },
          { label: "2. Pacto", current: tribeInfluenceStage >= 2 ? 20 : 0, max: 20, note: "Permaneça na Tribo ate o primeiro marco de meio de jogo." },
          { label: "3. Camara", current: tribeInfluenceStage >= 3 ? 20 : 0, max: 20, note: "Segure a relacao viva ate o segundo marco de permanencia." },
          { label: "4. Abrigo", current: tribeInfluenceStage >= 4 ? 20 : 0, max: 20, note: "Entre vivo na fase final com a ligacao tribal mantida." },
          { label: "5. Juramento Final", current: tribeInfluenceStage >= 5 ? 20 : 0, max: 20, note: "Envie o 2o enviado tribal no late game para fechar os 100." },
        ],
        missing: [
          "O 1o enviado tribal eh a porta de entrada de 20 pontos para quem joga mais solo.",
          "O 2o enviado tribal existe para fechar o ultimo selo no endgame, sem disputar com os 9 de Colonia.",
        ],
      },
      "military-summary": {
        eyebrow: "Militar",
        title: "Ranking Militar",
        description: "Militar vale 300 no score. O ponto aqui nao e quantidade cega; e a capacidade de transformar recrutamento, atrito, pesquisa e heroi certo em ranking forte.",
        formula: "Poder militar = qualidade de composicao + herois certos + build tatico/logistico.",
        valueLabel: `${world.sovereignty.militaryRankingPoints}/${SOVEREIGNTY_MILITARY_SCORE_CAP}`,
        progressPct: militaryPct,
        color: "red",
        metrics: [
          { label: "Pontos atuais", value: `${world.sovereignty.militaryRankingPoints}/${SOVEREIGNTY_MILITARY_SCORE_CAP}`, note: "Quanto do teto militar ja virou score." },
          { label: "Faltam", value: `${Math.max(0, SOVEREIGNTY_MILITARY_SCORE_CAP - world.sovereignty.militaryRankingPoints)}`, note: "Gap de ranking ainda aberto." },
                  { label: "Catalisador", value: activeHeroCount > 0 ? "Herois ativos" : "Sem suporte", note: "General e branch tatico precisam aparecer cedo para este pilar explodir." },
          { label: "Leitura", value: militaryPct >= 70 ? "Ja pesa" : "Ainda leve", note: "Se ficar baixo ate D90, a build depende demais de predio/tribo." },
        ],
        breakdown: [
          { label: "Quartel + Arsenal", current: Math.min(100, Math.round((development / 100) * 78)), max: 100, note: "Infra que sustenta tropa de qualidade." },
                  { label: "Herois militares", current: Math.min(100, activeHeroCount >= 2 ? 72 : 38), max: 100, note: "General e Explorador mudam a leitura do militar na run." },
          { label: "Pesquisa aplicada", current: Math.min(100, avgResearchProgress), max: 100, note: "Sem branch certa, o ranking cresce devagar." },
        ],
        missing: [
                "Se o objetivo e ganhar por militar, o quartel sozinho nao basta: Tatica e General precisam puxar a composicao.",
          "Celeiro e Metropole normalmente convertem militar mais tarde; Posto faz isso mais cedo.",
        ],
      },
      "quests-summary": {
        eyebrow: "Quests",
        title: "Quests de Era",
        description: "Quest e score previsivel. Ela funciona como checkpoint de execução: ou a build entra no ritmo e fecha, ou fica patinando em infraestrutura sem converter poder em nota.",
        formula: "3 quests x 100 pontos = 300 de influencia fixa.",
        valueLabel: `${world.sovereignty.eraQuestsCompleted}/3 completas`,
        progressPct: questPct,
        color: "green",
        metrics: [
          { label: "Score direto", value: `${world.sovereignty.eraQuestsCompleted * 100}/300`, note: "Valor bruto ja travado por quest fechada." },
          { label: "Faltam", value: `${Math.max(0, 3 - world.sovereignty.eraQuestsCompleted)}`, note: "Quests que ainda nao viraram influencia." },
                  { label: "Puxa qual build", value: "Sabio", note: "Sabio e pesquisa certa encurtam o atraso das quests." },
          { label: "Momento", value: world.day >= 84 ? "Late" : "Mid", note: "Quest atrasada demais vira problema de portal." },
        ],
        breakdown: [
          { label: "Quest Inicial", current: world.sovereignty.eraQuestsCompleted >= 1 ? 100 : 0, max: 100, note: "Abre o ritmo da temporada." },
          { label: "Quest Media", current: world.sovereignty.eraQuestsCompleted >= 2 ? 100 : 0, max: 100, note: "Separa quem expandiu bem de quem so upou predio." },
          { label: "Quest Final", current: world.sovereignty.eraQuestsCompleted >= 3 ? 100 : 0, max: 100, note: "Fecha score sem depender de sorte de combate." },
        ],
        missing: [
          "Quest deve competir com infraestrutura: se ela sempre ficar para depois, a build perde variedade.",
        ],
      },
      ...Object.fromEntries(
        world.researches.map((research) => [
          `research-${research.name}`,
          {
            eyebrow: "Linha de Pesquisa",
            title: `${research.name} · Nv ${research.level}`,
            description: describeResearchImpact(research.branch),
            formula: "Pesquisa boa encurta timing da build certa; pesquisa errada alonga custo e atrasa pontos de Conselho, Quests e Militar.",
            valueLabel: `${research.progress}% de progresso`,
            progressPct: research.progress,
            color: branchTone(research.branch),
            metrics: [
              { label: "Branch", value: research.branch, note: "Linha atual que esta moldando a curva da run." },
              { label: "ETA", value: research.eta, note: "Quando esse empurrao deve entrar." },
              { label: "Grip direto", value: `Nv ${research.level}`, note: "Nivel atual da linha no mock." },
              { label: "Impacto", value: branchTone(research.branch) === "green" ? "Infra" : branchTone(research.branch) === "red" ? "Execucao" : "Tecnologia", note: "Eixo principal dessa pesquisa." },
            ],
            breakdown: [
              { label: "Custo / Tempo", current: Math.min(100, 35 + research.level * 8), max: 100, note: "Quanto ela ja puxou da curva desta build." },
              { label: "Alinhamento com build", current: branchTone(research.branch) === "green" && evolutionMode === "metropole" ? 92 : branchTone(research.branch) === "red" && evolutionMode === "vanguard" ? 90 : research.branch.toLowerCase().includes("log") && evolutionMode === "flow" ? 94 : 54, max: 100, note: "Quando branch e modo combinam, a seed rende mais." },
            ],
            missing: [
              "Pesquisa precisa deslocar decisões reais: ordem de prédio, timing da 2a cidade, contratação do heroi certo e ETA de marcha.",
            ],
          } satisfies DetailSheetContent,
        ]),
      ),
      ...Object.fromEntries(
        HERO_SPECIALISTS.map((hero) => {
          const copies = councilCounts[hero.id];
          return [
            `hero-${hero.id}`,
            {
              eyebrow: "Heroi",
              title: hero.name,
              description: `${hero.summary} ${hero.buildHook}`,
              formula: "Cada heroi contratado no Governo vale 50 pontos. O ganho real vem do tipo certo na cidade certa.",
              valueLabel: copies > 0 ? `${copies} vaga(s) ativas` : "Ainda nao alocado",
              progressPct: Math.min(100, (copies / heroLimit) * 100),
              color: "blue",
              metrics: [
                { label: "Role", value: hero.role, note: "Papel central deste especialista." },
                { label: "Score", value: `+${hero.directValue}`, note: "Valor direto de Governo." },
                { label: "Copias", value: `${copies}`, note: "Quantidade atual desse tipo entre os herois contratados." },
                { label: "Estado", value: copies > 0 ? "ON" : "OFF", note: copies > 0 ? "Ja esta convertendo valor de build." : "Essa funcao ainda esta fora da composicao." },
                          { label: "Build alvo", value: hero.name === "Engenheiro" ? "Metropole/Bastiao" : hero.name === "General" ? "Posto" : hero.name === "Explorador" ? "Celeiro/Spawns longos" : hero.name === "Administrador" ? "Expansao" : "Quests", note: "Onde esse heroi mais muda a run." },
              ],
              breakdown: [
                { label: "Herois ativos", current: copies, max: heroLimit, note: copies > 0 ? `Hoje aparece ${copies} vez(es) entre os herois.` : "Ainda sem heroi desse tipo." },
                { label: "Valor tatico", current: copies > 0 ? Math.min(100, 44 + copies * 18) : 36, max: 100, note: hero.buildHook },
              ],
              missing: [
                copies > 0
                  ? "Esse especialista ja existe no Governo; agora a decisao e repetir mais uma cidade ou abrir outro papel."
                  : `Sem ${hero.name}, esta run perde um eixo de decisao importante.`,
              ],
            } satisfies DetailSheetContent,
          ];
        }),
      ),
    };
  }, [
    activeHeroCount,
    avgResearchProgress,
    baseDevelopment,
    colonyRows,
    councilCounts,
    councilLoadout,
    development,
    diplomatPct,
    evolutionMode,
    freeDiplomats,
    modeProfile.label,
    militaryPct,
    questPct,
    tribeEnvoysCommitted,
    tribeInfluenceStage,
    tribePct,
    annexEnvoysCommitted,
    unlockedDiplomatSlots,
    recruitedDiplomats,
    recruitedTribeEnvoys,
    totalDiplomats,
    nextTribeStep,
    freeTribeEnvoys,
    assignedCityDiplomats,
    openedDetailId,
    world.day,
    world.researches,
    world.sovereignty.eraQuestsCompleted,
    world.sovereignty.militaryRankingPoints,
  ]);

  const openedDetail = details && openedDetailId ? details[openedDetailId] ?? null : null;
  const openedDetailWithImage = openedDetail
    ? { ...openedDetail, imageSrc: openedDetail.imageSrc ?? detailImageForId(openedDetailId) }
    : null;

  const openDetail = (id: string) => {
    emitUiFeedback("open", "light");
    setOpenedDetailId(id);
  };

  const recruitCityDiplomat = () => {
    if (recruitedDiplomats >= unlockedDiplomatSlots) {
      return;
    }
    setImperialState((current) => ({
      ...current,
      recruitedDiplomats: Math.min(unlockedDiplomatSlots, (current.recruitedDiplomats ?? 0) + 1),
      logs: [`Diplomata de Colonia contratado · ${Math.min(unlockedDiplomatSlots, (current.recruitedDiplomats ?? 0) + 1)}/${MAX_CITY_DIPLOMATS}`, ...current.logs].slice(0, 12),
    }));
  };

  const recruitTribeEnvoy = () => {
    if (recruitedTribeEnvoys >= MAX_TRIBE_ENVOYS) {
      return;
    }
    setImperialState((current) => ({
      ...current,
      recruitedTribeEnvoys: Math.min(MAX_TRIBE_ENVOYS, (current.recruitedTribeEnvoys ?? 0) + 1),
      logs: [`Enviado tribal contratado · ${Math.min(MAX_TRIBE_ENVOYS, (current.recruitedTribeEnvoys ?? 0) + 1)}/${MAX_TRIBE_ENVOYS}`, ...current.logs].slice(0, 12),
    }));
  };

  const toggleCityDiplomat = (villageId: string) => {
    const isAssigned = imperialState.diplomatByVillage[villageId] ?? false;
    if (!isAssigned && freeDiplomats <= 0) {
      return;
    }
    setImperialState((current) => ({
      ...current,
      diplomatByVillage: {
        ...current.diplomatByVillage,
        [villageId]: !isAssigned,
      },
      logs: [
        `${!isAssigned ? "Diplomata enviado" : "Diplomata recolhido"} ${!isAssigned ? "para" : "de"} ${mergedVillages.find((entry) => entry.id === villageId)?.name ?? villageId}`,
        ...current.logs,
      ].slice(0, 12),
    }));
  };

  const commitTribeEnvoy = () => {
    const next = Math.max(0, Math.min(MAX_TRIBE_ENVOYS, tribeEnvoysCommitted + 1));
    if (next === tribeEnvoysCommitted || freeTribeEnvoys <= 0) {
      return;
    }
    setImperialState((current) => ({
      ...current,
      tribeEnvoysCommitted: next,
      logs: [`Envio diplomatico para a Tribo · ${next}/${MAX_TRIBE_ENVOYS}`, ...current.logs].slice(0, 12),
    }));
  };

  return (
    <>
      <section className="space-y-3">
        <article className="kw-glass rounded-3xl p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="kw-title text-base">Politica Global</h2>
            <span className="kw-subtle text-[11px]">{modeProfile.label}</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {modes.map((mode) => {
              const paramsQuery = new URLSearchParams();
              paramsQuery.set("v", activeVillage.id);
              paramsQuery.set("m", mode.id);
              const href = `/world/${params.worldId}/operations?${paramsQuery.toString()}`;
              const active = mode.id === evolutionMode;
              return (
                <Link
                  key={mode.id}
                  href={href}
                  className={`rounded-xl border px-2 py-1.5 text-center text-[10px] font-semibold transition ${
                    active
                      ? "border-sky-300/55 bg-sky-500/20 text-sky-100"
                      : "border-white/20 bg-white/6 text-slate-300 hover:bg-white/10"
                  }`}
                  title={mode.summary}
                >
                  {MODE_CHIP_LABEL[mode.id]}
                </Link>
              );
            })}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[10px] text-slate-200">
            <span className="rounded-xl border border-white/15 bg-white/6 px-2 py-1.5">Modo {modeProfile.label}</span>
            <span className="rounded-xl border border-white/15 bg-white/6 px-2 py-1.5">Dev {development}/100</span>
            <span className="rounded-xl border border-white/15 bg-white/6 px-2 py-1.5">Pesquisa {avgResearchProgress}%</span>
          </div>
        </article>

        <article className="kw-glass rounded-3xl p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="kw-title text-base">Pesquisa, Conselho e Diplomacia</h2>
            <span className="kw-subtle text-[11px]">{activeVillage.name} · Dev {development}/100</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-slate-100">
            <button type="button" onClick={() => openDetail("research-summary")} className="kw-glass-soft kw-status-card overflow-hidden text-left transition hover:border-sky-300/35" style={immersiveCardStyle("/images/conselho.jpg")}>
              <span className="kw-badge">{avgResearchProgress}%</span>
              <div className="kw-icon-core"><FlaskConical className="h-5 w-5 text-sky-300" /></div>
              <p className="kw-card-title mt-2">Pesquisa</p>
              <p className="kw-card-meta">Media global</p>
              <div className="kw-progress"><div className="kw-progress__bar kw-progress__bar--blue" style={{ width: `${avgResearchProgress}%` }} /></div>
            </button>

            <button type="button" onClick={() => openDetail("council-summary")} className="kw-glass-soft kw-status-card overflow-hidden text-left transition hover:border-sky-300/35" style={immersiveCardStyle("/images/card-council.jpg")}>
              <span className="kw-badge">{activeHeroCount}/{heroLimit}</span>
              <div className="kw-icon-core"><Crown className="h-5 w-5 text-amber-300" /></div>
              <p className="kw-card-title mt-2">Herois</p>
              <p className="kw-card-meta">{councilLoadout || "Governo das cidades"}</p>
              <div className="kw-progress"><div className="kw-progress__bar kw-progress__bar--blue" style={{ width: `${councilPct}%` }} /></div>
            </button>

            <button type="button" onClick={() => openDetail("diplomats-summary")} className="kw-glass-soft kw-status-card overflow-hidden text-left transition hover:border-cyan-300/35" style={immersiveCardStyle("/images/card-expansion.jpg")}>
              <span className="kw-badge">{totalDiplomats}/{MAX_TOTAL_DIPLOMATS}</span>
              <div className="kw-icon-core"><Users className="h-5 w-5 text-cyan-300" /></div>
              <p className="kw-card-title mt-2">Diplomatas</p>
              <p className="kw-card-meta">{recruitedDiplomats}/{MAX_CITY_DIPLOMATS} cidade · {recruitedTribeEnvoys}/{MAX_TRIBE_ENVOYS} tribo</p>
              <div className="kw-progress"><div className="kw-progress__bar kw-progress__bar--blue" style={{ width: `${diplomatPct}%` }} /></div>
            </button>

            <button type="button" onClick={() => openDetail("tribe-summary")} className="kw-glass-soft kw-status-card overflow-hidden text-left transition hover:border-emerald-300/35" style={immersiveCardStyle("/images/territory-controlled.jpg")}>
              <span className="kw-badge">{tribeInfluenceStage}/5</span>
              <div className="kw-icon-core"><Shield className="h-5 w-5 text-emerald-300" /></div>
              <p className="kw-card-title mt-2">Tribo</p>
              <p className="kw-card-meta">{tribeInfluenceStageLabel(tribeInfluenceStage)}</p>
              <div className="kw-progress"><div className="kw-progress__bar kw-progress__bar--green" style={{ width: `${tribePct}%` }} /></div>
            </button>

            <button type="button" onClick={() => openDetail("military-summary")} className="kw-glass-soft kw-status-card overflow-hidden text-left transition hover:border-rose-300/35" style={immersiveCardStyle("/images/card-battle.jpg")}>
              <span className="kw-badge">{world.sovereignty.militaryRankingPoints}/{SOVEREIGNTY_MILITARY_SCORE_CAP}</span>
              <div className="kw-icon-core"><Swords className="h-5 w-5 text-rose-300" /></div>
              <p className="kw-card-title mt-2">Militar</p>
              <p className="kw-card-meta">Peso no score</p>
              <div className="kw-progress"><div className="kw-progress__bar kw-progress__bar--red" style={{ width: `${militaryPct}%` }} /></div>
            </button>

            <button type="button" onClick={() => openDetail("quests-summary")} className="kw-glass-soft kw-status-card overflow-hidden text-left transition hover:border-emerald-300/35" style={immersiveCardStyle("/images/card-opportunity.jpg")}>
              <span className="kw-badge">{world.sovereignty.eraQuestsCompleted}/3</span>
              <div className="kw-icon-core"><ShieldCheck className="h-5 w-5 text-emerald-300" /></div>
              <p className="kw-card-title mt-2">Quests</p>
              <p className="kw-card-meta">Marcos de era</p>
              <div className="kw-progress"><div className="kw-progress__bar kw-progress__bar--green" style={{ width: `${questPct}%` }} /></div>
            </button>
          </div>
        </article>

        <article className="kw-glass rounded-3xl p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="kw-title text-base">Diplomatas de Cidade e Tribo</h2>
            <span className="kw-subtle text-[11px]">{totalDiplomats}/{MAX_TOTAL_DIPLOMATS} contratados</span>
          </div>

          <div className="grid grid-cols-5 gap-1.5 text-slate-100">
            <div className="kw-glass-soft rounded-xl p-2 text-center">
              <p className="text-[10px] text-slate-300">Slots</p>
              <p className="text-sm font-black">{unlockedDiplomatSlots}/{MAX_CITY_DIPLOMATS}</p>
            </div>
            <div className="kw-glass-soft rounded-xl p-2 text-center">
              <p className="text-[10px] text-slate-300">Cidade</p>
              <p className="text-sm font-black">{recruitedDiplomats}/{MAX_CITY_DIPLOMATS}</p>
            </div>
            <div className="kw-glass-soft rounded-xl p-2 text-center">
              <p className="text-[10px] text-slate-300">Tribo</p>
              <p className="text-sm font-black">{recruitedTribeEnvoys}/{MAX_TRIBE_ENVOYS}</p>
            </div>
            <div className="kw-glass-soft rounded-xl p-2 text-center">
              <p className="text-[10px] text-slate-300">Em missao</p>
              <p className="text-sm font-black">{annexEnvoysCommitted}</p>
            </div>
            <div className="kw-glass-soft rounded-xl p-2 text-center">
              <p className="text-[10px] text-slate-300">Livres</p>
              <p className="text-sm font-black">{freeDiplomats + freeTribeEnvoys}</p>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-2xl kw-glass-soft p-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="kw-card-title">Contratar diplomata</p>
                  <p className="kw-card-meta">Pool de Colonias</p>
                </div>
                <button
                  type="button"
                  onClick={recruitCityDiplomat}
                  disabled={recruitedDiplomats >= unlockedDiplomatSlots}
                  className={`rounded-lg border px-2 py-1 text-[11px] font-bold ${
                    recruitedDiplomats >= unlockedDiplomatSlots
                      ? "border-white/15 bg-white/5 text-slate-500"
                      : "border-cyan-300/45 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/22"
                  }`}
                >
                  Contratar
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1 text-center text-[10px] text-slate-200">
                <span className="rounded-lg border border-white/10 bg-white/6 px-2 py-1">{recruitedDiplomats}/{MAX_CITY_DIPLOMATS}</span>
                <span className="rounded-lg border border-white/10 bg-white/6 px-2 py-1">{unlockedDiplomatSlots} slots</span>
              </div>
            </div>

            <div className="rounded-2xl kw-glass-soft p-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="kw-card-title">Contratar enviado tribal</p>
                  <p className="kw-card-meta">Dois assentos especiais</p>
                </div>
                <button
                  type="button"
                  onClick={recruitTribeEnvoy}
                  disabled={recruitedTribeEnvoys >= MAX_TRIBE_ENVOYS}
                  className={`rounded-lg border px-2 py-1 text-[11px] font-bold ${
                    recruitedTribeEnvoys >= MAX_TRIBE_ENVOYS
                      ? "border-white/15 bg-white/5 text-slate-500"
                      : "border-emerald-300/45 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/22"
                  }`}
                >
                  Contratar
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1 text-center text-[10px] text-slate-200">
                <span className="rounded-lg border border-white/10 bg-white/6 px-2 py-1">{recruitedTribeEnvoys}/{MAX_TRIBE_ENVOYS}</span>
                <span className="rounded-lg border border-white/10 bg-white/6 px-2 py-1">{tribeInfluenceStage}/5</span>
              </div>
            </div>
          </div>

          <div className="mt-2 rounded-2xl kw-glass-soft p-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="kw-card-title">Domo da Tribo</p>
                <p className="kw-card-meta">{tribeInfluenceStageLabel(tribeInfluenceStage)}</p>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={commitTribeEnvoy}
                  disabled={freeTribeEnvoys <= 0 || tribeEnvoysCommitted >= MAX_TRIBE_ENVOYS}
                  className={`rounded-lg border px-2 py-1 text-[11px] font-bold ${
                    freeTribeEnvoys <= 0 || tribeEnvoysCommitted >= MAX_TRIBE_ENVOYS
                      ? "border-white/15 bg-white/5 text-slate-500"
                      : "border-emerald-300/45 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/22"
                  }`}
                >
                  Enviar
                </button>
              </div>
            </div>
            <div className="kw-progress mt-2">
              <div className="kw-progress__bar kw-progress__bar--green" style={{ width: `${tribePct}%` }} />
            </div>
            <p className="mt-1 text-[11px] font-semibold text-amber-100">{nextTribeStep}</p>
          </div>

          <div className="mt-2 space-y-2">
            {colonyRows.map((row) => {
              const canAssign = row.unlocked && !row.assigned && freeDiplomats > 0;
              return (
                <div key={row.id} className="rounded-2xl kw-glass-soft p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="kw-card-title">{row.name}</p>
                      <p className="kw-card-meta">
                        {row.development}/100 · {cityClassLabel(row.cityClass)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleCityDiplomat(row.id)}
                      disabled={!row.assigned && !canAssign}
                      className={`rounded-lg border px-2 py-1 text-[11px] font-bold ${
                        row.assigned
                          ? "border-cyan-300/50 bg-cyan-500/16 text-cyan-100 hover:bg-cyan-500/24"
                          : !canAssign
                            ? "border-white/15 bg-white/5 text-slate-500"
                            : "border-white/20 bg-white/8 text-slate-100 hover:bg-white/14"
                      }`}
                    >
                      {row.assigned ? "Recolher" : "Alocar"}
                    </button>
                  </div>
                  <div className="kw-progress mt-2">
                    <div className="kw-progress__bar kw-progress__bar--blue" style={{ width: `${Math.min(100, row.development)}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] font-semibold text-slate-300">
                    {row.assigned ? "Ativo" : row.unlocked ? "Slot livre" : `${CITY_DIPLOMAT_UNLOCK_DEVELOPMENT}/100`}
                  </p>
                </div>
              );
            })}
          </div>
        </article>

        <article className="kw-glass rounded-3xl p-3">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-sky-300" />
            <h2 className="kw-title text-base">Cards de Pesquisa</h2>
          </div>

          <div className="kw-status-grid kw-status-grid--2">
            {world.researches.map((research) => {
              const tone = branchTone(research.branch);
              const directValue = Math.round((research.progress / 100) * 35 + research.level * 8);
              return (
                <button
                  key={research.name}
                  type="button"
                  onClick={() => openDetail(`research-${research.name}`)}
                  className="kw-glass-soft kw-status-card overflow-hidden text-left text-slate-100 transition hover:border-sky-300/35"
                  style={immersiveCardStyle("/images/conselho.jpg")}
                >
                  <span className="kw-badge">+{directValue}</span>
                  <div className="kw-icon-core">
                    <FlaskConical className="h-5 w-5 text-sky-300" />
                  </div>
                  <p className="kw-card-title mt-2">{research.name} Lvl {research.level}</p>
                  <p className="kw-card-meta">{research.branch}</p>
                  <div className="kw-progress">
                    <div
                      className={`kw-progress__bar ${tone === "green" ? "kw-progress__bar--green" : tone === "red" ? "kw-progress__bar--red" : "kw-progress__bar--blue"}`}
                      style={{ width: `${Math.min(100, Math.max(0, research.progress))}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    <span className="kw-action-icon" title="Acelerar"><Zap className="h-3.5 w-3.5" /></span>
                    <span className="kw-action-icon" title="Blindar"><Shield className="h-3.5 w-3.5" /></span>
                  </div>
                </button>
              );
            })}
          </div>
        </article>

        <article className="kw-glass rounded-3xl p-3">
          <div className="mb-2 flex items-center gap-2">
            <UserRound className="h-4 w-4 text-cyan-300" />
            <h2 className="kw-title text-base">Cards de Herois</h2>
          </div>

          <div className="kw-status-grid kw-status-grid--2">
            {HERO_SPECIALISTS.map((hero) => {
              const copies = councilCounts[hero.id];
              const Icon = hero.icon;
              const statusPct = copies > 0 ? Math.min(100, copies * 20) : 32;
              return (
                <button
                  key={hero.id}
                  type="button"
                  onClick={() => openDetail(`hero-${hero.id}`)}
                  className="kw-glass-soft kw-status-card overflow-hidden text-left text-slate-100 transition hover:border-cyan-300/35"
                  style={immersiveCardStyle(HERO_IMAGE_BY_ID[hero.id])}
                >
                  <span className="kw-badge">{copies > 0 ? `x${copies}` : "OFF"}</span>
                  <div className="kw-icon-core"><Icon className={`h-5 w-5 ${copies > 0 ? "text-cyan-200" : "text-slate-400"}`} /></div>
                  <p className="kw-card-title mt-2">{hero.name}</p>
                  <p className="kw-card-meta">{hero.role} · +{hero.directValue}</p>
                  <div className="kw-progress"><div className="kw-progress__bar kw-progress__bar--blue" style={{ width: `${statusPct}%` }} /></div>
                  <div className="mt-2 flex items-center gap-1">
                    <span className="kw-action-icon" title="Ativar"><Crown className="h-3.5 w-3.5" /></span>
                    <span className="kw-action-icon" title="Atribuir"><Users className="h-3.5 w-3.5" /></span>
                  </div>
                </button>
              );
            })}
          </div>
        </article>
      </section>

      <DetailSheet open={Boolean(openedDetailWithImage)} content={openedDetailWithImage} onClose={() => setOpenedDetailId(null)} />
    </>
  );
}
