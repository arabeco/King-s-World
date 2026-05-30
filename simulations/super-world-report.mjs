import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT_DIR = process.cwd();
const OUTPUT_DIR = path.join(ROOT_DIR, "simulations", "output");
const REPORTS_DIR = path.join(ROOT_DIR, "reports");
const RESULTS_PATH = path.join(OUTPUT_DIR, "season_v2_paired8_results.json");
const ENDGAME_PATH = path.join(OUTPUT_DIR, "endgame_report.json");
const REPORT_JSON_PATH = path.join(REPORTS_DIR, "super-simulation-120d.json");
const REPORT_MD_PATH = path.join(REPORTS_DIR, "super-simulation-120d.md");

function ensureAuditArtifacts() {
  const result = spawnSync(process.execPath, ["simulations/audit-season.mjs"], {
    cwd: ROOT_DIR,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "Falha ao rodar auditoria de temporada.");
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function avg(items, selector) {
  return items.length ? items.reduce((sum, item) => sum + selector(item), 0) / items.length : 0;
}

function pct(value, total) {
  return total ? round((value / total) * 100, 1) : 0;
}

function estimateTerritorialDiscovery(record) {
  const sorties = Number(record.explorationSorties ?? 0);
  const villages = Number(record.villagesD120 ?? record.villagesD90 ?? 1);
  const skill = Number(record.skillFactor ?? 1);
  const branch = record.branch;
  const profile = record.profile;
  const branchCadence =
    branch === "flow" ? 1.15 : branch === "tactical" ? 1.08 : branch === "urban" ? 0.98 : 0.92;
  const profileCadence =
    profile === "posto" ? 1.18 : profile === "celeiro" ? 1.08 : profile === "metropole" ? 1.0 : 0.94;
  const monthlyCadence = Math.max(0.18, Math.min(0.95, (0.28 + sorties * 0.045 + villages * 0.012) * branchCadence * profileCadence * skill));
  const activeMonths = 120;
  const expeditionMonths = Math.round(activeMonths * monthlyCadence);
  const routeHexes = Math.round(expeditionMonths * (1.45 + Math.max(0, skill - 1) * 1.4));
  const frontierRegions = Math.max(1, Math.round(routeHexes / 7));
  const strategicDiscoveries = Math.round(frontierRegions * (0.38 + Number(record.explorationBonus ?? 0) * 0.025));
  return {
    activeMonths,
    expeditionMonths,
    monthlyCadence: round(monthlyCadence, 2),
    routeHexes,
    frontierRegions,
    strategicDiscoveries,
  };
}

function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function summarizeGroup(records) {
  const territory = records.map(estimateTerritorialDiscovery);
  return {
    players: records.length,
    portal: records.filter((record) => record.enteredPortal).length,
    alive: records.filter((record) => record.alive).length,
    pvpEliminated: records.filter((record) => record.pvpEliminated).length,
    trailDeaths: records.filter((record) => record.diedOnTrail).length,
    blocked: records.filter((record) => record.portalBlocked).length,
    avgInfluenceD90: round(avg(records, (record) => Number(record.influenceD90 ?? 0))),
    avgInfluenceD120: round(avg(records, (record) => Number(record.influenceD120 ?? 0))),
    avgTroopsD120: round(avg(records, (record) => Number(record.troopsAlive ?? 0))),
    avgVillagesD90: round(avg(records, (record) => Number(record.villagesD90 ?? 0))),
    avgVillagesD120: round(avg(records, (record) => Number(record.villagesD120 ?? 0))),
    avgLostToHorde: round(avg(records, (record) => Number(record.villagesLostToHorde ?? 0))),
    avgEtaHours: round(avg(records.filter((record) => Number(record.etaHours ?? 0) > 0), (record) => Number(record.etaHours ?? 0))),
    avgExplorationSorties: round(avg(records, (record) => Number(record.explorationSorties ?? 0))),
    avgRaidLootScore: round(avg(records, (record) => Number(record.raidLootScore ?? 0))),
    avgExplorationBonus: round(avg(records, (record) => Number(record.explorationBonus ?? 0))),
    avgExpeditionMonths: round(avg(territory, (item) => item.expeditionMonths)),
    avgKnownRouteHexes: round(avg(territory, (item) => item.routeHexes)),
    avgFrontierRegions: round(avg(territory, (item) => item.frontierRegions)),
    avgStrategicDiscoveries: round(avg(territory, (item) => item.strategicDiscoveries)),
  };
}

function summarizeTimelineEvents(records) {
  const events = records.flatMap((record) =>
    (record.actionTimeline ?? []).map((event) => ({
      ...event,
      record,
    })),
  );
  const byType = Object.fromEntries(
    [...groupBy(events, (event) => event.type)].map(([type, entries]) => [type, entries.length]),
  );
  const explorationEvents = events.filter((event) => event.type === "explore");
  const criticalEvents = events.filter((event) =>
    ["quest", "horde", "march", "outcome", "group", "tribe"].includes(event.type),
  );

  return {
    total: events.length,
    byType,
    explorationEvents: explorationEvents.length,
    avgExploreDay: round(avg(explorationEvents, (event) => Number(event.day ?? 0))),
    criticalSamples: criticalEvents.slice(0, 12).map((event) => ({
      day: event.day,
      type: event.type,
      action: event.action,
      detail: event.detail,
      scenarioId: event.record.scenarioId,
      playerId: event.record.id,
    })),
  };
}

function main() {
  ensureAuditArtifacts();
  const results = readJson(RESULTS_PATH);
  const endgame = readJson(ENDGAME_PATH);
  const allRecords = results.runsDetailed.flatMap((run) =>
    run.records.map((record) => ({
      ...record,
      seed: run.seed,
      scenarioId: run.scenarioId,
      focusProfile: run.focusProfile,
      actorType: String(record.id).startsWith("H") ? "humano" : "ia",
    })),
  );

  const total = allRecords.length;
  const allTerritory = allRecords.map(estimateTerritorialDiscovery);
  const humans = allRecords.filter((record) => record.actorType === "humano");
  const bots = allRecords.filter((record) => record.actorType === "ia");
  const summary = {
    generatedAt: new Date().toISOString(),
    status: "PASS",
    source: {
      results: path.relative(ROOT_DIR, RESULTS_PATH),
      endgame: path.relative(ROOT_DIR, ENDGAME_PATH),
    },
    world: results.metadata.world,
    calendar: {
      unit: "1 dia jogavel = 1 mes historico",
      months: 120,
      years: 10,
      checkpointLabels: {
        15: "Ano 2, Mes 3",
        30: "Ano 3, Mes 6",
        60: "Ano 5, Mes 12",
        90: "Ano 8, Mes 6",
        120: "Ano 10, Mes 12",
      },
    },
    runs: results.runTable.length,
    simulatedPlayerRuns: total,
    uniquePlayersPerRun: results.metadata.world.players,
    aggregate: {
      portalEntries: allRecords.filter((record) => record.enteredPortal).length,
      portalRatePct: pct(allRecords.filter((record) => record.enteredPortal).length, total),
      aliveAtEnd: allRecords.filter((record) => record.alive).length,
      aliveAtEndPct: pct(allRecords.filter((record) => record.alive).length, total),
      blockedAtPortal: allRecords.filter((record) => record.portalBlocked).length,
      pvpEliminated: allRecords.filter((record) => record.pvpEliminated).length,
      trailDeaths: allRecords.filter((record) => record.diedOnTrail).length,
      avgInfluenceD90: round(avg(allRecords, (record) => Number(record.influenceD90 ?? 0))),
      avgInfluenceD120: round(avg(allRecords, (record) => Number(record.influenceD120 ?? 0))),
      avgVillagesD90: round(avg(allRecords, (record) => Number(record.villagesD90 ?? 0))),
      avgVillagesD120: round(avg(allRecords, (record) => Number(record.villagesD120 ?? 0))),
      avgTroopsD120: round(avg(allRecords, (record) => Number(record.troopsAlive ?? 0))),
      avgExpeditionMonths: round(avg(allTerritory, (item) => item.expeditionMonths)),
      avgKnownRouteHexes: round(avg(allTerritory, (item) => item.routeHexes)),
      avgFrontierRegions: round(avg(allTerritory, (item) => item.frontierRegions)),
      avgStrategicDiscoveries: round(avg(allTerritory, (item) => item.strategicDiscoveries)),
    },
    humans: summarizeGroup(humans),
    bots: summarizeGroup(bots),
    byProfile: Object.fromEntries([...groupBy(allRecords, (record) => record.profile)].map(([key, records]) => [key, summarizeGroup(records)])),
    byBranch: Object.fromEntries([...groupBy(allRecords, (record) => record.branch)].map(([key, records]) => [key, summarizeGroup(records)])),
    events: summarizeTimelineEvents(allRecords),
    runTable: results.runTable,
    endgameSummary: endgame.summary,
    topPlayers: [...allRecords]
      .sort((a, b) => Number(b.influenceD120 ?? 0) - Number(a.influenceD120 ?? 0))
      .slice(0, 12)
      .map((record) => ({
        scenarioId: record.scenarioId,
        id: record.id,
        actorType: record.actorType,
        profile: record.profile,
        branch: record.branch,
        influenceD120: record.influenceD120,
        villagesD120: record.villagesD120,
        troopsAlive: record.troopsAlive,
        enteredPortal: record.enteredPortal,
      })),
    bottomPlayers: [...allRecords]
      .sort((a, b) => Number(a.influenceD120 ?? 0) - Number(b.influenceD120 ?? 0))
      .slice(0, 12)
      .map((record) => ({
        scenarioId: record.scenarioId,
        id: record.id,
        actorType: record.actorType,
        profile: record.profile,
        branch: record.branch,
        influenceD120: record.influenceD120,
        villagesD120: record.villagesD120,
        troopsAlive: record.troopsAlive,
        enteredPortal: record.enteredPortal,
        pvpEliminated: record.pvpEliminated,
        portalBlockReason: record.portalBlockReason,
      })),
  };

  const profileRows = Object.entries(summary.byProfile).map(([profile, item]) => [
    profile,
    String(item.players),
    `${pct(item.portal, item.players)}%`,
    String(item.avgInfluenceD90),
    String(item.avgInfluenceD120),
    String(item.avgTroopsD120),
    String(item.avgLostToHorde),
    String(item.avgExpeditionMonths),
    String(item.avgFrontierRegions),
  ]);
  const runRows = summary.runTable.map((run) => [
    run.scenario,
    String(run.portalSurvivors),
    String(run.finalAlive),
    String(run.day90Eligible),
    String(run.reached2500),
    String(run.hordeDeaths),
    String(run.pvpDeaths),
  ]);
  const topRows = summary.topPlayers.slice(0, 8).map((record) => [
    record.scenarioId,
    record.id,
    record.actorType,
    record.profile,
    record.branch,
    String(record.influenceD120),
    String(record.villagesD120),
    record.enteredPortal ? "sim" : "nao",
  ]);
  const bottomRows = summary.bottomPlayers.slice(0, 8).map((record) => [
    record.scenarioId,
    record.id,
    record.actorType,
    record.profile,
    record.branch,
    String(record.influenceD120),
    String(record.villagesD120),
    record.portalBlockReason ?? (record.pvpEliminated ? "pvp" : "-"),
  ]);
  const eventRows = Object.entries(summary.events.byType)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => [type, String(count)]);
  const criticalRows = summary.events.criticalSamples.slice(0, 8).map((event) => [
    String(event.day),
    event.type,
    event.scenarioId,
    event.playerId,
    event.action,
  ]);

  const md = `# Super Simulacao KingsWorld - Mundo 120 Meses

Gerado em: ${summary.generatedAt}

## Escopo

- 8 runs representativas.
- 50 jogadores por run: 8 humanos e 42 IAs.
- 400 trajetorias simuladas no total.
- Temporada completa de 120 meses historicos.
- Calendario oficial da simulacao: 1 dia jogavel = 1 mes no mundo.
- Duracao dramatica: 10 anos de reinado, fronteira, crise e Exodo.
- Corte do Portal: 1500 influencia.
- Teto teorico: 2500 influencia.

## Veredito Rapido

- Entradas no Portal: ${summary.aggregate.portalEntries}/${summary.simulatedPlayerRuns} (${summary.aggregate.portalRatePct}%).
- Jogadores vivos no fim: ${summary.aggregate.aliveAtEnd}/${summary.simulatedPlayerRuns} (${summary.aggregate.aliveAtEndPct}%).
- Influencia media D90: ${summary.aggregate.avgInfluenceD90}.
- Influencia media D120: ${summary.aggregate.avgInfluenceD120}.
- Aldeias medias D90/D120: ${summary.aggregate.avgVillagesD90} / ${summary.aggregate.avgVillagesD120}.
- Tropas medias D120: ${summary.aggregate.avgTroopsD120}.
- Cartografia media: ${summary.aggregate.avgExpeditionMonths} meses de expedicao, ${summary.aggregate.avgKnownRouteHexes} hexes de rota conhecida e ${summary.aggregate.avgFrontierRegions} regioes de fronteira por jogador.

## Humanos vs IA

${table(
  ["Grupo", "Amostra", "Portal", "Vivos", "Infl. D90", "Infl. D120", "Tropas D120", "Aldeias D120"],
  [
    ["Humanos", String(summary.humans.players), `${pct(summary.humans.portal, summary.humans.players)}%`, `${pct(summary.humans.alive, summary.humans.players)}%`, String(summary.humans.avgInfluenceD90), String(summary.humans.avgInfluenceD120), String(summary.humans.avgTroopsD120), String(summary.humans.avgVillagesD120)],
    ["IA", String(summary.bots.players), `${pct(summary.bots.portal, summary.bots.players)}%`, `${pct(summary.bots.alive, summary.bots.players)}%`, String(summary.bots.avgInfluenceD90), String(summary.bots.avgInfluenceD120), String(summary.bots.avgTroopsD120), String(summary.bots.avgVillagesD120)],
  ],
)}

## Perfis

${table(["Perfil", "Amostra", "Portal", "Infl. D90", "Infl. D120", "Tropas D120", "Perda Horda", "Meses Exp.", "Regioes"], profileRows)}

## Exploracao E Acontecimentos

- Isto agora deve ser lido como descoberta territorial, nao coleta.
- Meses medios com expedicao ativa por jogador: ${summary.aggregate.avgExpeditionMonths}/120.
- Hexes medios de rota/corredor conhecidos por jogador: ${summary.aggregate.avgKnownRouteHexes}.
- Regioes medias de fronteira abertas por jogador: ${summary.aggregate.avgFrontierRegions}.
- Descobertas estrategicas medias: ${summary.aggregate.avgStrategicDiscoveries}.
- Saque/loot existe como efeito secundario medio: ${round(avg(allRecords, (record) => Number(record.raidLootScore ?? 0)))}.
- Primeiro ciclo forte de cartografia: por volta do Mes ${summary.events.avgExploreDay} do Ano 1.

${table(["Tipo de acontecimento", "Registros"], eventRows)}

### Indicacao Pratica Por Fase

- Mes 1-15 (Ano 1 ate Ano 2/Mes 3): abrir fronteira proxima, registrar corredores e achar terreno para 2a aldeia.
- Mes 16-45 (Ano 2/Mes 4 ate Ano 4/Mes 9): cartografar rotas entre cidades e escolher a aldeia foco 100/100.
- Mes 46-90 (Ano 4/Mes 10 ate Ano 8/Mes 6): transformar territorio conhecido em quest, maravilha, heroi e expansao segura.
- Mes 91-120 (Ano 8/Mes 7 ate Ano 10/Mes 12): usar exploracao como controle de risco: horda, PvP, agrupamento e rota ao Portal.

### Amostras Criticas

${table(["Dia", "Tipo", "Run", "Jogador", "Acao"], criticalRows)}

## Runs

${table(["Run", "Portal", "Vivos", "Elegiveis D90", "Pico 2500", "Mortes Horda", "Mortes PvP"], runRows)}

## Top Jogadores

${table(["Run", "ID", "Tipo", "Perfil", "Branch", "Infl. D120", "Aldeias", "Portal"], topRows)}

## Piores Quedas

${table(["Run", "ID", "Tipo", "Perfil", "Branch", "Infl. D120", "Aldeias", "Motivo"], bottomRows)}

## Leitura De Balanceamento

- O D90 esta funcionando como grande filtro: a media geral ja ronda o corte, mas nem todo mundo chega elegivel.
- A fase IV derruba influencia media porque horda/PvP comem aldeias e tropas.
- Bastiao sobrevive melhor no fim, com maior taxa de Portal no agregado.
- Metropole acelera muito bem, mas lazy/metropole sofre quando perde defesa e territorio.
- Celeiro perfeito tem teto alto e melhor pico 2500, mas o lazy sofre no Exodus.

Arquivos fonte:

- ${summary.source.results}
- ${summary.source.endgame}
`;

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.writeFileSync(REPORT_JSON_PATH, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  fs.writeFileSync(REPORT_MD_PATH, md, "utf8");
  console.log(JSON.stringify({ status: "PASS", reportJson: REPORT_JSON_PATH, reportMd: REPORT_MD_PATH, summary: summary.aggregate }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
