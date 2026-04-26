const BUILDING_DEFS = Object.freeze({
  palace: { label: "Palacio", baseCost: { materials: 450, supplies: 180, energy: 130, influence: 60 }, growth: 1.19 },
  senate: { label: "Senado", baseCost: { materials: 620, supplies: 210, energy: 250, influence: 110 }, growth: 1.2 },
  mines: { label: "Minas", baseCost: { materials: 320, supplies: 120, energy: 110, influence: 36 }, growth: 1.16 },
  farms: { label: "Fazendas", baseCost: { materials: 300, supplies: 135, energy: 80, influence: 34 }, growth: 1.16 },
  housing: { label: "Habitacoes", baseCost: { materials: 360, supplies: 180, energy: 95, influence: 40 }, growth: 1.17 },
  research: { label: "Centro de Pesquisa", baseCost: { materials: 520, supplies: 220, energy: 190, influence: 78 }, growth: 1.18 },
  barracks: { label: "Quartel", baseCost: { materials: 420, supplies: 260, energy: 140, influence: 55 }, growth: 1.18 },
  arsenal: { label: "Arsenal", baseCost: { materials: 560, supplies: 260, energy: 170, influence: 65 }, growth: 1.18 },
  wall: { label: "Muralha", baseCost: { materials: 680, supplies: 120, energy: 190, influence: 70 }, growth: 1.2 },
  wonder: { label: "Maravilha", baseCost: { materials: 1300, supplies: 800, energy: 620, influence: 260 }, growth: 1.22 },
});

const BUILDING_LABEL_TO_ID = Object.freeze({
  Palacio: "palace",
  Senado: "senate",
  Minas: "mines",
  Fazendas: "farms",
  Habitacoes: "housing",
  "Centro de Pesquisa": "research",
  Quartel: "barracks",
  Arsenal: "arsenal",
  Muralha: "wall",
  Maravilha: "wonder",
});

const QUEST_REWARDS = Object.freeze({
  1: { influence: 100, materials: 180, supplies: 140, energy: 80 },
  2: { influence: 100, materials: 260, supplies: 220, energy: 120 },
  3: { influence: 100, materials: 320, supplies: 280, energy: 180 },
});

const MILESTONE_DAYS = [10, 20, 30, 60, 90, 120];

const PHASE_WINDOWS = [
  { label: "I: Consolidacao", start: 1, end: 20 },
  { label: "II: Expansao", start: 21, end: 60 },
  { label: "III: Fortificacao", start: 61, end: 90 },
  { label: "IV: Exodo", start: 91, end: 120 },
];

const AUDIT_WARNINGS = Object.freeze([
  "O simulador de temporada nao persiste estoque inicial real; o saldo de recursos desta auditoria e normalizado a partir do Dia 1.",
  "O motor atual nao registra tipos individuais de tropa; a auditoria expõe totais e perdas agregadas.",
  "A abertura exata/estado aberto de cada quest nao e persistido; a auditoria registra gates, conclusoes e bloqueios observaveis.",
  "A trilha tribal atual e booleana no simulador; a auditoria registra ativacao, efeito e marcos do fluxo final.",
]);

const VISUAL_MILESTONE_PRIORITY = Object.freeze({
  second_village: 1,
  first_100: 2,
  exodus_start: 3,
  march_start: 4,
  portal_gate: 5,
  portal_entry: 6,
  portal_fail_influence: 7,
  portal_fail_eta: 8,
  portal_fail_intercepted: 9,
  portal_fail_pvp: 10,
});

function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safeDiv(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : 0;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function addResourceBucket(target, delta) {
  target.materials += delta.materials ?? 0;
  target.supplies += delta.supplies ?? 0;
  target.energy += delta.energy ?? 0;
  target.influence += delta.influence ?? 0;
}

function cloneResources(resources) {
  return {
    materials: resources.materials,
    supplies: resources.supplies,
    energy: resources.energy,
    influence: resources.influence,
  };
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function phaseLabelForDay(day) {
  return PHASE_WINDOWS.find((window) => day >= window.start && day <= window.end)?.label ?? "Fora da temporada";
}

function getBuildingUpgradeCost(buildingId, nextLevel) {
  const definition = BUILDING_DEFS[buildingId];
  if (!definition) {
    return { materials: 0, supplies: 0, energy: 0, influence: 0 };
  }

  const scalar = definition.growth ** Math.max(0, nextLevel - 1);
  return {
    materials: round(definition.baseCost.materials * scalar),
    supplies: round(definition.baseCost.supplies * scalar),
    energy: round(definition.baseCost.energy * scalar),
    influence: round(definition.baseCost.influence * scalar),
  };
}

function getBuildingActionDelta(buildingId, level) {
  const safeLevel = clamp(Math.floor(level), 1, 10);
  const benefitByLevel = {
    mines: 260 + Math.max(0, safeLevel - 1) * 58,
    farms: 240 + Math.max(0, safeLevel - 1) * 55,
    housing: 8 + Math.max(0, safeLevel - 1),
    research: 4 + Math.max(0, safeLevel - 1) * 1.4,
    palace: 100 + Math.max(0, safeLevel - 1) * 45,
    senate: 500 + Math.max(0, safeLevel - 1) * 250,
    barracks: 12 + Math.max(0, safeLevel - 1) * 2,
    arsenal: 10 + Math.max(0, safeLevel - 1) * 2.5,
    wall: 120 + Math.max(0, safeLevel - 1) * 18,
    wonder: 2 + Math.max(0, safeLevel - 1) * 1.8,
  }[buildingId] ?? 0;

  switch (buildingId) {
    case "mines":
      return { materials: round(Math.max(80, benefitByLevel * 0.92)), supplies: 0, energy: -round(24 + safeLevel * 4), influence: round(4 + safeLevel * 1.4), note: "Extracao acelerada de materiais" };
    case "farms":
      return { materials: 0, supplies: round(Math.max(80, benefitByLevel * 0.9)), energy: -round(20 + safeLevel * 3), influence: round(3 + safeLevel * 1.3), note: "Pulso de abastecimento" };
    case "housing":
      return { materials: -round(28 + safeLevel * 5), supplies: round(34 + safeLevel * 6), energy: -round(10 + safeLevel * 2), influence: round(6 + safeLevel * 1.8), note: "Mobilizacao civil" };
    case "research":
      return { materials: -round(26 + safeLevel * 6), supplies: 0, energy: -round(30 + safeLevel * 4), influence: round(20 + safeLevel * 3), note: "Aceleracao cientifica" };
    case "palace":
      return { materials: -round(34 + safeLevel * 7), supplies: -round(16 + safeLevel * 3), energy: -round(12 + safeLevel * 2), influence: round(28 + safeLevel * 4), note: "Decreto imperial" };
    case "senate":
      return { materials: -round(24 + safeLevel * 5), supplies: -round(22 + safeLevel * 4), energy: -round(14 + safeLevel * 2), influence: round(32 + safeLevel * 4.5), note: "Negociacao politica" };
    case "barracks":
      return { materials: -round(20 + safeLevel * 4), supplies: -round(58 + safeLevel * 10), energy: -round(34 + safeLevel * 6), influence: round(8 + safeLevel * 2), note: "Treino de tropa" };
    case "arsenal":
      return { materials: -round(62 + safeLevel * 12), supplies: -round(28 + safeLevel * 5), energy: -round(42 + safeLevel * 7), influence: round(10 + safeLevel * 2.2), note: "Forja militar" };
    case "wall":
      return { materials: -round(54 + safeLevel * 10), supplies: -round(22 + safeLevel * 4), energy: -round(18 + safeLevel * 3), influence: round(7 + safeLevel * 1.8), note: "Reforco de muralha" };
    case "wonder":
      return { materials: -round(120 + safeLevel * 20), supplies: -round(60 + safeLevel * 9), energy: -round(72 + safeLevel * 11), influence: round(36 + safeLevel * 5), note: "Impulso de legado" };
    default:
      return { materials: 0, supplies: 0, energy: 0, influence: 0, note: "Sem efeito" };
  }
}

function computeTroopSplit(record, totalTroops) {
  const offenseShare = clamp(0.48 + (record.aggression - record.defense) * 0.18 + (record.branch === "tactical" ? 0.06 : 0), 0.34, 0.72);
  const offense = Math.round(totalTroops * offenseShare);
  return {
    offense,
    defense: Math.max(0, totalTroops - offense),
  };
}

function buildEconomyState(record, levels, villageCount, resources, troopsTotal) {
  const averageCore = safeDiv((levels.mines ?? 1) + (levels.farms ?? 1), 2);
  const averageGov = safeDiv((levels.palace ?? 1) + (levels.senate ?? 1), 2);
  const averageInfra = safeDiv((levels.housing ?? 1) + (levels.research ?? 1), 2);
  const averageMilitary = safeDiv((levels.barracks ?? 1) + (levels.arsenal ?? 1) + (levels.wall ?? 1), 3);
  const troopSplit = computeTroopSplit(record, troopsTotal);

  const production = {
    materials: round(villageCount * (155 + averageCore * 24) * (0.84 + record.profile.buildBias * 0.18)),
    supplies: round(villageCount * (148 + averageCore * 22 + (levels.housing ?? 1) * 4) * (0.86 + record.profile.expansionBias * 0.16)),
    energy: round(villageCount * (118 + averageInfra * 19) * (0.88 + record.profile.logisticsBias * 0.15)),
    influence: round(villageCount * (16 + averageGov * 4 + averageInfra * 1.5) * (0.74 + record.skillFactor * 0.18)),
  };

  const upkeep = round(villageCount * 42 + troopSplit.offense * 0.052 + troopSplit.defense * 0.047);
  const villageConsumptionEnergy = round(villageCount * 18 + averageInfra * 9 + averageMilitary * 6);

  const stocksAfterTick = {
    materials: Math.max(0, resources.materials + production.materials),
    supplies: Math.max(0, resources.supplies + production.supplies - upkeep),
    energy: Math.max(0, resources.energy + production.energy - villageConsumptionEnergy),
    influence: Math.max(0, resources.influence + production.influence),
  };

  return {
    production,
    upkeep,
    villageConsumptionEnergy,
    stocksAfterTick,
  };
}

function parseUpgradeActions(actions, levelsBefore) {
  const upgrades = [];

  for (const action of actions) {
    const match = normalizeText(action).match(/^(.*) -> Nv (\d+)$/);
    if (!match) {
      continue;
    }

    const buildingLabel = normalizeText(match[1]);
    const buildingId = BUILDING_LABEL_TO_ID[buildingLabel];
    const toLevel = Number(match[2]);
    if (!buildingId || !Number.isFinite(toLevel)) {
      continue;
    }

    upgrades.push({
      buildingId,
      buildingLabel,
      fromLevel: levelsBefore[buildingLabel] ?? Math.max(0, toLevel - 1),
      toLevel,
      cost: getBuildingUpgradeCost(buildingId, toLevel),
      expectedImpact: getBuildingActionDelta(buildingId, toLevel),
    });
  }

  return upgrades;
}

function summarizeResourceReason(production, spend, upkeep, energyConsumption, upgrades, confrontations, questsCompleted, emptyCityEvents) {
  const candidates = [
    { label: "upgrade de predios", magnitude: Math.abs(spend.materials) + Math.abs(spend.supplies) + Math.abs(spend.energy), active: upgrades.length > 0 },
    { label: "recrutamento e manutencao", magnitude: Math.abs(upkeep) + Math.abs(energyConsumption), active: upkeep > 0 || energyConsumption > 0 },
    { label: "producao da economia", magnitude: Math.abs(production.materials) + Math.abs(production.supplies) + Math.abs(production.energy), active: true },
    { label: "combate", magnitude: confrontations.length * 200, active: confrontations.length > 0 },
    { label: "quest", magnitude: questsCompleted.length * 120, active: questsCompleted.length > 0 },
    { label: "ocupacao de cidade vazia", magnitude: emptyCityEvents.length * 140, active: emptyCityEvents.length > 0 },
  ].filter((entry) => entry.active);

  return candidates.sort((left, right) => right.magnitude - left.magnitude)[0]?.label ?? "sem variacao relevante";
}

function buildSyntheticCaptures(record) {
  const capturedCount = Math.max(0, (record.villagesD120 + record.villagesLostToPvp) - (record.villagesD90 - record.villagesLostToHorde));
  if (capturedCount === 0) {
    return [];
  }

  const start = Math.max(record.secondVillageDay + 6, 24);
  const end = Math.min(82, record.firstVillage100Day + 28);
  const gap = Math.max(6, Math.floor((end - start) / Math.max(1, capturedCount)));

  return Array.from({ length: capturedCount }, (_, index) => ({
    day: clamp(start + index * gap, 20, 88),
    index: index + 1,
  }));
}

function buildSyntheticPvpDays(record) {
  if (!record.villagesLostToPvp) {
    return [];
  }

  const start = Math.max(96, (record.groupingDay ?? 90) + 6);
  return Array.from({ length: record.villagesLostToPvp }, (_, index) => clamp(start + index * 4, 96, 118));
}

function buildSyntheticTimelineMap(record) {
  const map = new Map();

  for (const capture of buildSyntheticCaptures(record)) {
    const existing = map.get(capture.day) ?? [];
    existing.push({
      type: "empty_city",
      action: `Ocupou cidade vazia ${capture.index}`,
      detail: "Expansao territorial convertida em aldeia ativa sem confronto formal registrado pelo simulador.",
    });
    map.set(capture.day, existing);
  }

  for (const [index, day] of buildSyntheticPvpDays(record).entries()) {
    const existing = map.get(day) ?? [];
    existing.push({
      type: "pvp",
      action: `Sofreu pressao PvP ${index + 1}/${record.villagesLostToPvp}`,
      detail: "Ajuste de late game confirmado pela perda de aldeia para outro soberano.",
    });
    map.set(day, existing);
  }

  return map;
}

function mergeDayEvents(baseEvents, syntheticEvents) {
  return [...(baseEvents ?? []), ...(syntheticEvents ?? [])];
}

function toMarkdownResourceLine(resources) {
  return `M ${resources.materials} | S ${resources.supplies} | E ${resources.energy} | I ${resources.influence}`;
}

function describeOutcomeReason(record) {
  if (record.enteredPortal) {
    return `Entrou no Portal com ${record.influenceD120} de influencia.`;
  }
  if (record.portalBlockReason === "pvp_eliminated") {
    return "Falhou porque foi eliminado por PvP antes da janela final.";
  }
  if (record.portalBlockReason === "eta_late") {
    return "Falhou por ETA tardio na marcha final.";
  }
  if (record.portalBlockReason === "intercepted") {
    return "Falhou por interceptacao na trilha do Exodo.";
  }
  if (record.portalBlockReason === "influencia_insuficiente") {
    return "Falhou por influencia insuficiente no gate do Portal.";
  }
  return "Sem motivo especifico adicional.";
}

function classifyEconomyState(dayEntry) {
  const balances = dayEntry.resources.balance;
  const net = dayEntry.resources.net;
  const villages = Math.max(1, dayEntry.buildings.villageCount);
  const hardPressure =
    balances.materials <= villages * 120 ||
    balances.supplies <= villages * 100 ||
    balances.energy <= villages * 80 ||
    net.supplies < 0 ||
    net.energy < 0;

  if (
    balances.materials <= villages * 40 ||
    balances.supplies <= villages * 30 ||
    balances.energy <= villages * 20 ||
    (net.supplies < 0 && net.energy < 0)
  ) {
    return "colapsando";
  }

  if (hardPressure || dayEntry.resources.primaryReason === "upgrade de predios" || dayEntry.resources.primaryReason === "recrutamento e manutencao") {
    return "pressionada";
  }

  return "estavel";
}

function classifyExpansionState(dayEntry, previousDay, record) {
  const villages = dayEntry.buildings.villageCount;
  const delta = villages - (previousDay?.buildings.villageCount ?? 1);

  if (dayEntry.day <= 10) {
    if (record.secondVillageDay <= 10 || villages >= 2) return "agressiva";
    if (record.secondVillageDay <= 15) return "ideal";
    return "lenta";
  }

  if (dayEntry.day <= 30) {
    if (villages >= 4 || delta >= 2) return "agressiva";
    if (villages >= 3 || delta >= 1) return "ideal";
    return "lenta";
  }

  if (dayEntry.day <= 60) {
    if (villages >= 6 || delta >= 2) return "agressiva";
    if (villages >= 5 || delta >= 1) return "ideal";
    return "lenta";
  }

  if (dayEntry.day <= 90) {
    if (villages >= 8) return "agressiva";
    if (villages >= 6) return "ideal";
    return "lenta";
  }

  if (villages >= 8) return "ideal";
  if (villages >= 6) return "lenta";
  return "lenta";
}

function classifyMilitaryState(dayEntry, previousDay) {
  const previousTroops = previousDay?.troops.total ?? dayEntry.troops.total;
  const troopDropRatio = safeDiv(previousTroops - dayEntry.troops.total, Math.max(1, previousTroops));
  const lostVillages = Math.max(0, (previousDay?.buildings.villageCount ?? dayEntry.buildings.villageCount) - dayEntry.buildings.villageCount);
  const hadConfrontation = dayEntry.confrontations.length > 0;

  if (troopDropRatio >= 0.28 || (lostVillages > 0 && dayEntry.troops.lost > 0)) {
    return "critico";
  }

  if (troopDropRatio >= 0.12 || hadConfrontation || dayEntry.troops.lost > dayEntry.troops.created) {
    return "em desgaste";
  }

  return "estavel";
}

function expectedInfluenceForDay(record, day) {
  if (day <= 90) {
    return round(record.influenceD90 * safeDiv(day, 90), 2);
  }

  return round(
    record.influenceD90 + (record.influenceD120 - record.influenceD90) * safeDiv(day - 90, 30),
    2,
  );
}

function classifyInfluenceState(dayEntry, record) {
  const expected = expectedInfluenceForDay(record, dayEntry.day);
  const ratio = safeDiv(dayEntry.influence.value, Math.max(1, expected));

  if (ratio < 0.9) return "abaixo da curva esperada";
  if (ratio > 1.08) return "acima da curva esperada";
  return "dentro da curva esperada";
}

function classifyFinalRisk(dayEntry, previousDay, record, options) {
  const influenceStatus = classifyInfluenceState(dayEntry, record);
  const militaryStatus = classifyMilitaryState(dayEntry, previousDay);
  const portalMargin = dayEntry.influence.value - options.portalCut;
  const hasLateFailure = Boolean(record.portalBlockReason) && !record.enteredPortal;

  if (dayEntry.day >= 90) {
    if (!dayEntry.endgame.portalEligible || militaryStatus === "critico") return "alto";
    if (record.enteredPortal && portalMargin >= 250) return "baixo";
    return hasLateFailure ? "alto" : "medio";
  }

  if (dayEntry.day >= 60) {
    if (influenceStatus === "abaixo da curva esperada" || militaryStatus === "critico") return "alto";
    if (record.enteredPortal && influenceStatus !== "abaixo da curva esperada") return "baixo";
    return hasLateFailure ? "alto" : "medio";
  }

  if (influenceStatus === "acima da curva esperada" && militaryStatus === "estavel") return "baixo";
  if (influenceStatus === "abaixo da curva esperada") return "alto";
  return "medio";
}

function findWindowEvents(days, startDay, endDay, predicate) {
  return days.filter((entry) => entry.day > startDay && entry.day <= endDay).flatMap((entry) => entry.events.filter(predicate));
}

function explainCheckpointCollapses(previousDay, currentDay, record) {
  if (!previousDay) {
    return [];
  }

  const reasons = [];
  const daysWindow = currentDay.allDays ?? [];
  const villageDrop = currentDay.buildings.villageCount - previousDay.buildings.villageCount;
  const troopDrop = currentDay.troops.total - previousDay.troops.total;
  const influenceDrop = currentDay.influence.value - previousDay.influence.value;
  const hadHorde = findWindowEvents(daysWindow, previousDay.day, currentDay.day, (event) => event.type === "horde").length > 0;
  const hadPvp = findWindowEvents(daysWindow, previousDay.day, currentDay.day, (event) => event.type === "pvp").length > 0;
  const marchStarted = findWindowEvents(daysWindow, previousDay.day, currentDay.day, (event) => event.type === "march").length > 0;
  const gateFail = currentDay.endgame.failureReason === "influencia_insuficiente";
  const etaFail = currentDay.endgame.failureReason === "eta_late";
  const intercepted = currentDay.endgame.failureReason === "intercepted";
  const pvpFail = currentDay.endgame.failureReason === "pvp_eliminated";
  const upkeepPressure = currentDay.resources.primaryReason === "recrutamento e manutencao";

  if (villageDrop <= -1) {
    if (hadHorde) reasons.push("queda de aldeias por pressao da Horda");
    else if (hadPvp || pvpFail) reasons.push("queda de aldeias por pressao PvP");
    else reasons.push("encolhimento territorial no late game");
  }

  if (troopDrop <= -Math.max(150, previousDay.troops.total * 0.18)) {
    if (hadHorde || hadPvp || intercepted) reasons.push("tropas gastas em confronto");
    else if (marchStarted) reasons.push("tropas drenadas para a marcha final");
    else if (upkeepPressure) reasons.push("reposicao militar travada por manutencao");
    else reasons.push("desgaste militar sem reposicao suficiente");
  }

  if (influenceDrop <= -Math.max(80, previousDay.influence.value * 0.08)) {
    if (gateFail) reasons.push("falha de gate do Portal por influencia insuficiente");
    else if (etaFail) reasons.push("marcha tardia congelou a conversao final em score");
    else if (intercepted) reasons.push("interceptacao no Exodus quebrou o fechamento final");
    else if (villageDrop <= -1) reasons.push("perda territorial derrubou a base de score");
    else if (marchStarted) reasons.push("marcha para o Portal travou crescimento estrutural");
    else reasons.push("colapso logistico ou de score no fim da run");
  }

  return [...new Set(reasons)];
}

function buildVisualMilestones(days, record, options) {
  const firstGateDay = days.find((day) => day.day >= 90 && day.endgame.portalEligible)?.day ?? null;
  const arrivalDay = Math.min(options.worldDays, Math.round((record.marchStartDay ?? options.worldDays) + (record.etaHours ?? 0) / 24));

  const milestones = [
    { day: record.secondVillageDay, key: "second_village", title: "2a aldeia fundada", detail: "Primeiro salto territorial confirmado pela run." },
    { day: record.firstVillage100Day, key: "first_100", title: "1a aldeia 100/100", detail: "A capital ou vila foco fechou o primeiro teto estrutural." },
    { day: 91, key: "exodus_start", title: "Inicio do Exodus", detail: "A fase final do mundo ficou ativa." },
    { day: record.marchStartDay, key: "march_start", title: "Marcha iniciada", detail: `A run iniciou a marcha final com ETA ${record.etaHours}h.` },
    { day: firstGateDay, key: "portal_gate", title: "Gate do Portal", detail: `A run passou do corte de ${options.portalCut} de influencia.` },
  ].filter((entry) => Number.isFinite(entry.day) && entry.day >= 1 && entry.day <= options.worldDays);

  if (record.enteredPortal) {
    milestones.push({
      day: arrivalDay,
      key: "portal_entry",
      title: "Entrada no Portal",
      detail: `Entrada confirmada com ${record.influenceD120} de influencia.`,
    });
  } else if (record.portalBlockReason === "influencia_insuficiente") {
    milestones.push({
      day: arrivalDay,
      key: "portal_fail_influence",
      title: "Falha por influencia insuficiente",
      detail: `A run chegou sem bater o gate de ${options.portalCut}.`,
    });
  } else if (record.portalBlockReason === "eta_late") {
    milestones.push({
      day: arrivalDay,
      key: "portal_fail_eta",
      title: "Falha por ETA",
      detail: "A marcha final nao conseguiu tocar o Portal a tempo.",
    });
  } else if (record.portalBlockReason === "intercepted") {
    milestones.push({
      day: arrivalDay,
      key: "portal_fail_intercepted",
      title: "Falha por interceptacao",
      detail: "A linha final foi quebrada antes da entrada no Portal.",
    });
  } else if (record.portalBlockReason === "pvp_eliminated") {
    milestones.push({
      day: arrivalDay,
      key: "portal_fail_pvp",
      title: "Falha por eliminacao PvP",
      detail: "O soberano caiu antes de fechar a corrida final.",
    });
  }

  for (const milestone of milestones) {
    const target = days[milestone.day - 1];
    if (!target) continue;
    target.visualMilestones.push({
      ...milestone,
      priority: VISUAL_MILESTONE_PRIORITY[milestone.key] ?? 99,
    });
  }

  for (const day of days) {
    day.visualMilestones.sort((left, right) => left.priority - right.priority || left.title.localeCompare(right.title));
  }
}

function buildCheckpointSummary(currentDay, previousDay, record, options) {
  const economy = classifyEconomyState(currentDay);
  const expansion = classifyExpansionState(currentDay, previousDay, record);
  const military = classifyMilitaryState(currentDay, previousDay);
  const influence = classifyInfluenceState(currentDay, record);
  const finalRisk = classifyFinalRisk(currentDay, previousDay, record, options);
  const collapseReasons = explainCheckpointCollapses(previousDay, currentDay, record);

  return {
    economy,
    expansion,
    military,
    influence,
    finalRisk,
    collapseReasons,
    oneLine: `economia ${economy} | expansao ${expansion} | militar ${military} | influencia ${influence} | risco ${finalRisk}`,
  };
}

function formatVisualMilestones(dayEntry) {
  if (!dayEntry.visualMilestones || dayEntry.visualMilestones.length === 0) {
    return "";
  }

  return dayEntry.visualMilestones.map((entry) => `[MARCO] ${entry.title}`).join(" + ");
}

function collectCriticalDays(run) {
  return run.dailyTimeline.filter((day) => {
    const hasMilestone = (day.visualMilestones?.length ?? 0) > 0;
    const checkpoint = run.milestoneDays.find((entry) => entry.day === day.day);
    const hasCollapse = (checkpoint?.checkpointSummary.collapseReasons?.length ?? 0) > 0;
    return hasMilestone || hasCollapse;
  });
}

function createNormalizedResourceSeed(record) {
  const profile = record.profile ?? { buildBias: 1, expansionBias: 1, logisticsBias: 1 };
  return {
    materials: round(1800 + (record.explorationBonus ?? 0) * 65 + profile.buildBias * 320),
    supplies: round(1600 + profile.expansionBias * 280),
    energy: round(1200 + profile.logisticsBias * 260),
    influence: round(220 + (record.skillFactor ?? 1) * 45),
  };
}

function buildRunAudit(run, record, helpers, options) {
  const progression = helpers.hydrateRecordForProgression(record);
  const auditRecord = {
    ...record,
    profile: progression.profile,
    skillFactor: record.skillFactor ?? 1,
    aggression: record.aggression ?? 1,
    defense: record.defense ?? 1,
  };
  const byDay = helpers.groupTimelineByDay(record.actionTimeline);
  const syntheticEvents = buildSyntheticTimelineMap(record);
  const plannerState = helpers.createPlannerState(record);
  const featuredDays = [];
  const normalizedResources = createNormalizedResourceSeed(auditRecord);

  let previousInfluence = 0;
  let previousTroops = helpers.troopsAtDay(progression, 1);
  let previousVillageCount = 1;
  let previousEconomy = buildEconomyState(auditRecord, plannerState.levels, previousVillageCount, normalizedResources, previousTroops);

  for (let day = 1; day <= options.worldDays; day += 1) {
    const dayEvents = mergeDayEvents(byDay.get(day), syntheticEvents.get(day));
    const levelsBefore = { ...plannerState.levels };
    const resourcesBefore = cloneResources(normalizedResources);
    const influenceBefore = previousInfluence;
    const troopBefore = previousTroops;
    const villageBefore = previousVillageCount;
    const actions = helpers.buildConcreteDayActions(record, day, plannerState, dayEvents);
    const upgrades = parseUpgradeActions(actions, levelsBefore);
    const villageTarget = helpers.villageCountAtDay(progression, day);
    const troopsNow = helpers.troopsAtDay(progression, day);
    const troopDelta = troopsNow - troopBefore;
    const influenceNow = helpers.influenceAtDay(progression, day);
    const economyAfter = buildEconomyState(auditRecord, plannerState.levels, villageTarget, normalizedResources, troopsNow);
    const influenceDelta = influenceNow.total - influenceBefore;

    const spend = { materials: 0, supplies: 0, energy: 0, influence: 0 };
    for (const upgrade of upgrades) {
      addResourceBucket(spend, upgrade.cost);
    }

    if (troopDelta > 0) {
      spend.materials += round(troopDelta * 0.62);
      spend.supplies += round(troopDelta * 0.94);
      spend.energy += round(troopDelta * 0.48);
    }

    const confrontations = [];
    const emptyCityEvents = [];
    const questsCompleted = [];
    const questBlocks = [];
    const tribeInteractions = [];

    for (const event of dayEvents) {
      if (event.type === "horde") {
        confrontations.push({
          type: "horde",
          against: "Horda do Apocalipse",
          result: record.villagesLostToHorde > 0 ? "perdeu aldeias" : "defendeu sem perda estrutural",
          losses: {
            villages: record.villagesLostToHorde,
            troops: troopDelta < 0 ? Math.abs(troopDelta) : Math.round(troopsNow * 0.06),
          },
          consequence: record.villagesLostToHorde > 0 ? `Imperio perdeu ${record.villagesLostToHorde} aldeia(s) no pico da Horda.` : "Muralha e timing seguraram a fase critica.",
        });
      } else if (event.type === "pvp") {
        confrontations.push({
          type: "pvp",
          against: "Outro soberano",
          result: "pressao sofrida",
          losses: {
            villages: 1,
            troops: Math.round(Math.max(0, troopBefore - troopsNow) * 0.45),
          },
          consequence: "Late game abriu perda territorial confirmada pela simulacao.",
        });
      } else if (event.type === "outcome" && !record.enteredPortal && record.portalBlockReason === "intercepted") {
        confrontations.push({
          type: "intercept",
          against: "linha de interceptacao",
          result: "marcha quebrada",
          losses: {
            villages: 0,
            troops: Math.round(troopsNow * 0.18),
          },
          consequence: "A run nao conseguiu converter marcha em entrada no Portal.",
        });
      } else if (event.type === "empty_city") {
        emptyCityEvents.push({
          action: "ocupacao",
          result: "sucesso",
          cost: {
            materials: 120,
            supplies: 160,
            energy: 90,
            influence: 150,
          },
          impact: "+1 aldeia ativa",
        });
      } else if (event.type === "quest") {
        const questIndex = Number(normalizeText(event.action).match(/Quest (\d)\/3/)?.[1] ?? 0);
        questsCompleted.push({
          quest: questIndex,
          reward: QUEST_REWARDS[questIndex] ?? QUEST_REWARDS[1],
        });
      } else if (event.type === "tribe") {
        tribeInteractions.push({
          type: "ativacao",
          effect: "+200 de score tribal no endgame",
        });
      }
    }

    for (let questIndex = 0; questIndex < 3; questIndex += 1) {
      const questDay = [20, 52, 84][questIndex];
      if (day === questDay && !record.questStates?.[questIndex]) {
        questBlocks.push({
          quest: questIndex + 1,
          reason: "Gate do simulador nao foi fechado nessa run.",
        });
      }
    }

    if (day === 91 && !record.tribeDome) {
      tribeInteractions.push({
        type: "sem_ativacao",
        effect: "Fluxo tribal nao converteu em bonus no late game.",
      });
    }

    for (const completed of questsCompleted) {
      addResourceBucket(normalizedResources, completed.reward);
    }

    for (const cityEvent of emptyCityEvents) {
      addResourceBucket(spend, cityEvent.cost);
    }

    normalizedResources.materials = Math.max(0, normalizedResources.materials + economyAfter.production.materials - spend.materials);
    normalizedResources.supplies = Math.max(0, normalizedResources.supplies + economyAfter.production.supplies - spend.supplies - economyAfter.upkeep);
    normalizedResources.energy = Math.max(0, normalizedResources.energy + economyAfter.production.energy - spend.energy - economyAfter.villageConsumptionEnergy);
    normalizedResources.influence = Math.max(0, normalizedResources.influence + economyAfter.production.influence - spend.influence);

    const summary = [
      `Influencia ${influenceNow.total} (${influenceDelta >= 0 ? "+" : ""}${influenceDelta})`,
      `aldeias ${villageTarget}`,
      `tropas ${troopsNow}`,
      upgrades.length > 0 ? `${upgrades.length} upgrade(s)` : "sem upgrade estrutural",
      confrontations.length > 0 ? `${confrontations.length} confronto(s)` : "sem confronto",
    ].join(" | ");

    const dayEntry = {
      day,
      phase: phaseLabelForDay(day),
      playerId: record.id,
      resources: {
        balance: cloneResources(normalizedResources),
        production: cloneResources(economyAfter.production),
        spend: cloneResources(spend),
        upkeep: {
          supplies: economyAfter.upkeep,
          energy: economyAfter.villageConsumptionEnergy,
        },
        net: {
          materials: economyAfter.production.materials - spend.materials,
          supplies: economyAfter.production.supplies - spend.supplies - economyAfter.upkeep,
          energy: economyAfter.production.energy - spend.energy - economyAfter.villageConsumptionEnergy,
          influence: economyAfter.production.influence - spend.influence,
        },
        primaryReason: summarizeResourceReason(
          economyAfter.production,
          spend,
          economyAfter.upkeep,
          economyAfter.villageConsumptionEnergy,
          upgrades,
          confrontations,
          questsCompleted,
          emptyCityEvents,
        ),
      },
      buildings: {
        villageCount: villageTarget,
        upgrades,
        levels: { ...plannerState.levels },
      },
      influence: {
        value: influenceNow.total,
        delta: influenceDelta,
        components: {
          buildings: influenceNow.building,
          military: influenceNow.military,
          council: influenceNow.council,
          quests: influenceNow.quests,
          wonders: influenceNow.wonders,
          tribe: influenceNow.tribe,
        },
      },
      troops: {
        total: troopsNow,
        created: Math.max(0, troopDelta),
        lost: Math.max(0, -troopDelta),
        byType: null,
        note: "O motor atual nao persiste tipos individuais de tropa para a simulacao sazonal.",
      },
      confrontations,
      emptyCities: emptyCityEvents,
      quests: {
        completed: questsCompleted,
        blocked: questBlocks,
      },
      tribe: {
        active: Boolean(record.tribeDome && day >= 91),
        interactions: tribeInteractions,
      },
      endgame: {
        phaseStarted: day === (record.groupingDay ?? 90),
        portalEligible: influenceNow.total >= options.portalCut,
        marchStarted: day === record.marchStartDay,
        arrivalDay: Math.min(options.worldDays, Math.round((record.marchStartDay ?? options.worldDays) + (record.etaHours ?? 0) / 24)),
        enteredPortal: record.enteredPortal && day === Math.min(options.worldDays, Math.round((record.marchStartDay ?? options.worldDays) + (record.etaHours ?? 0) / 24)),
        failureReason: !record.enteredPortal && day === Math.min(options.worldDays, Math.round((record.marchStartDay ?? options.worldDays) + (record.etaHours ?? 0) / 24))
          ? record.portalBlockReason
          : null,
      },
      actions,
      events: dayEvents,
      visualMilestones: [],
      humanSummary: summary,
    };

    featuredDays.push(dayEntry);
    previousInfluence = influenceNow.total;
    previousTroops = troopsNow;
    previousVillageCount = villageTarget;
    previousEconomy = economyAfter;
    void previousEconomy;
    void villageBefore;
  }

  buildVisualMilestones(featuredDays, record, options);

  const milestoneDays = MILESTONE_DAYS.map((day) => {
    const currentDay = featuredDays[day - 1];
    const previousCheckpointDay = [...MILESTONE_DAYS].filter((candidate) => candidate < day).pop() ?? null;
    const previousDay = previousCheckpointDay ? featuredDays[previousCheckpointDay - 1] : null;
    return {
      ...currentDay,
      checkpointSummary: buildCheckpointSummary(
        { ...currentDay, allDays: featuredDays },
        previousDay ? { ...previousDay, allDays: featuredDays } : null,
        record,
        options,
      ),
    };
  });

  return {
    scenarioId: run.scenarioId,
    seed: run.seed,
    focusProfile: run.focusProfile,
    representative: {
      id: record.id,
      branch: record.branch,
      skillPreset: record.skillPreset,
      secondVillageDay: record.secondVillageDay,
      firstVillage100Day: record.firstVillage100Day,
      marchStartDay: record.marchStartDay,
      etaHours: record.etaHours,
      result: record.enteredPortal ? "entered_portal" : "failed",
      outcomeReason: describeOutcomeReason(record),
    },
    milestoneDays,
    dailyTimeline: featuredDays,
  };
}

function buildHumanReport(audit) {
  const lines = [];
  lines.push("# KingsWorld - Auditoria de Temporada");
  lines.push("");
  lines.push("- Esta auditoria mostra o que a temporada realmente registrou por run representativa, dia a dia.");
  lines.push("- Onde o simulador atual nao persiste granularidade fina, o arquivo marca isso explicitamente em vez de inventar regra nova.");
  lines.push("");
  lines.push("## Limites conhecidos");
  lines.push("");
  for (const warning of audit.warnings) {
    lines.push(`- ${warning}`);
  }
  lines.push("");

  const featured = audit.featuredPlayer;
  if (featured) {
    lines.push("## Jogador em foco");
    lines.push("");
    lines.push(`- Cenario: ${featured.scenarioId}`);
    lines.push(`- Seed: ${featured.seed}`);
    lines.push(`- Jogador: ${featured.representative.id}`);
    lines.push(`- Perfil: ${featured.focusProfile}`);
    lines.push(`- Branch: ${featured.representative.branch}`);
    lines.push(`- Resultado: ${featured.representative.outcomeReason}`);
    lines.push("");

    const featuredCriticalDays = collectCriticalDays(featured);
    if (featuredCriticalDays.length > 0) {
      lines.push("### Dias criticos do jogador em foco");
      lines.push("");
      for (const day of featuredCriticalDays) {
        const checkpoint = featured.milestoneDays.find((entry) => entry.day === day.day);
        const collapseText = checkpoint?.checkpointSummary.collapseReasons?.join("; ") || "";
        const milestoneText = day.visualMilestones?.map((entry) => `${entry.title}: ${entry.detail}`).join(" | ") || "";
        lines.push(`- D${day.day}: ${[milestoneText, collapseText].filter(Boolean).join(" | ")}`);
      }
      lines.push("");
    }

    lines.push("| Dia | Fase | Recursos | Infl. | Tropas | Eventos | Resumo |");
    lines.push("| ---: | --- | --- | ---: | ---: | --- | --- |");
    for (const day of featured.dailyTimeline) {
      const visualText = formatVisualMilestones(day);
      const baseEventText = day.events.length > 0 ? day.events.map((event) => event.action).join(" + ") : "Sem marco novo";
      const eventText = [visualText, baseEventText].filter(Boolean).join(" + ");
      lines.push(`| ${day.day} | ${day.phase} | ${toMarkdownResourceLine(day.resources.balance)} | ${day.influence.value} | ${day.troops.total} | ${eventText} | ${day.humanSummary} |`);
    }
    lines.push("");

    lines.push("### Checkpoints jogaveis do jogador em foco");
    lines.push("");
    lines.push("| Dia | Economia | Expansao | Militar | Influencia | Risco final | Colapsos |");
    lines.push("| ---: | --- | --- | --- | --- | --- | --- |");
    for (const day of featured.milestoneDays) {
      lines.push(`| ${day.day} | ${day.checkpointSummary.economy} | ${day.checkpointSummary.expansion} | ${day.checkpointSummary.military} | ${day.checkpointSummary.influence} | ${day.checkpointSummary.finalRisk} | ${day.checkpointSummary.collapseReasons.join("; ") || "-"} |`);
    }
    lines.push("");
  }

  lines.push("## Marcos por run");
  lines.push("");
  for (const run of audit.runs) {
    lines.push(`### ${run.scenarioId}`);
    lines.push("");
    lines.push(`- Representante: ${run.representative.id}`);
    lines.push(`- Resultado: ${run.representative.outcomeReason}`);
    lines.push(`- 2a aldeia: D${run.representative.secondVillageDay} | 1a aldeia 100/100: D${run.representative.firstVillage100Day} | Marcha: D${run.representative.marchStartDay} | ETA ${run.representative.etaHours}h`);
    lines.push("");

    const criticalDays = collectCriticalDays(run);
    if (criticalDays.length > 0) {
      lines.push("- Dias criticos:");
      for (const day of criticalDays) {
        const checkpoint = run.milestoneDays.find((entry) => entry.day === day.day);
        const parts = [];
        if ((day.visualMilestones?.length ?? 0) > 0) {
          parts.push(day.visualMilestones.map((entry) => entry.title).join(" + "));
        }
        if ((checkpoint?.checkpointSummary.collapseReasons?.length ?? 0) > 0) {
          parts.push(checkpoint.checkpointSummary.collapseReasons.join("; "));
        }
        lines.push(`- D${day.day}: ${parts.join(" | ")}`);
      }
      lines.push("");
    }

    lines.push("| Dia | Infl. | Aldeias | Tropas | Recursos | Leitura jogavel | Colapsos |");
    lines.push("| ---: | ---: | ---: | ---: | --- | --- | --- |");
    for (const day of run.milestoneDays) {
      lines.push(`| ${day.day} | ${day.influence.value} | ${day.buildings.villageCount} | ${day.troops.total} | ${toMarkdownResourceLine(day.resources.balance)} | ${day.checkpointSummary.oneLine} | ${day.checkpointSummary.collapseReasons.join("; ") || "-"} |`);
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function buildEndgameReport(audit, options) {
  const runs = audit.runs.map((run) => {
    const daily = run.dailyTimeline;
    const arrivalDay = daily.find((day) => day.endgame.enteredPortal || day.endgame.failureReason);
    const eligibleOn90 = daily.find((day) => day.day === 90)?.endgame.portalEligible ?? false;
    const eligibleOn120 = daily.find((day) => day.day === 120)?.endgame.portalEligible ?? false;
    return {
      scenarioId: run.scenarioId,
      seed: run.seed,
      playerId: run.representative.id,
      marchStartDay: run.representative.marchStartDay,
      etaHours: run.representative.etaHours,
      eligibleOn90,
      eligibleOn120,
      arrivalDay: arrivalDay?.day ?? null,
      enteredPortal: run.representative.result === "entered_portal",
      failureReason: run.representative.result === "entered_portal" ? null : arrivalDay?.endgame.failureReason ?? "unknown",
      outcomeReason: run.representative.outcomeReason,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    outputBasename: options.outputBasename,
    summary: {
      totalRuns: runs.length,
      enteredPortal: runs.filter((run) => run.enteredPortal).length,
      failed: runs.filter((run) => !run.enteredPortal).length,
      lateEta: runs.filter((run) => run.failureReason === "eta_late").length,
      intercepted: runs.filter((run) => run.failureReason === "intercepted").length,
      insufficientInfluence: runs.filter((run) => run.failureReason === "influencia_insuficiente").length,
      pvpEliminated: runs.filter((run) => run.failureReason === "pvp_eliminated").length,
    },
    runs,
  };
}

function scanInvalid(value, path, errors) {
  if (typeof value === "number" && !Number.isFinite(value)) {
    errors.push(`${path}: numero nao finito.`);
    return;
  }

  if (value === undefined) {
    errors.push(`${path}: undefined.`);
    return;
  }

  if (typeof value === "string" && /(NaN|undefined|null)/i.test(value)) {
    errors.push(`${path}: token invalido em string.`);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanInvalid(entry, `${path}[${index}]`, errors));
    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    scanInvalid(entry, `${path}.${key}`, errors);
  }
}

function validateAuditStructure(timelineFull, endgameReport) {
  const errors = [];
  const warnings = [...AUDIT_WARNINGS];

  if (!Array.isArray(timelineFull?.runs) || timelineFull.runs.length === 0) {
    errors.push("timeline_full.runs: vazio.");
  }

  for (const run of timelineFull?.runs ?? []) {
    if (!Array.isArray(run.dailyTimeline) || run.dailyTimeline.length !== 120) {
      errors.push(`timeline_full.${run.scenarioId}.dailyTimeline: esperado 120 dias.`);
      continue;
    }

    run.dailyTimeline.forEach((dayEntry, index) => {
      if (dayEntry.day !== index + 1) {
        errors.push(`timeline_full.${run.scenarioId}.dailyTimeline[${index}].day: sequencia invalida.`);
      }
    });
  }

  if (!Array.isArray(endgameReport?.runs) || endgameReport.runs.length === 0) {
    errors.push("endgame_report.runs: vazio.");
  }

  scanInvalid(timelineFull, "timeline_full", errors);
  scanInvalid(endgameReport, "endgame_report", errors);

  return {
    status: errors.length === 0 ? "PASS" : "FAIL",
    errors,
    warnings,
  };
}

export function buildSeasonAuditArtifacts({ runs, helpers, options }) {
  const representativeRuns = runs.map((run) => {
    const record = helpers.selectRepresentativeRecord(run);
    return buildRunAudit(run, record, helpers, options);
  });

  const featuredPlayer =
    representativeRuns.find((run) => run.scenarioId.endsWith("perfect")) ??
    representativeRuns[0] ??
    null;

  const timelineFull = {
    generatedAt: new Date().toISOString(),
    outputBasename: options.outputBasename,
    source: "simulate-season-v2",
    warnings: [...AUDIT_WARNINGS],
    featuredPlayer,
    runs: representativeRuns,
  };

  const endgameReport = buildEndgameReport(timelineFull, options);
  const validation = validateAuditStructure(timelineFull, endgameReport);

  return {
    timelineFull,
    timelineHuman: buildHumanReport(timelineFull),
    endgameReport,
    validation: {
      ...validation,
      generatedAt: new Date().toISOString(),
      outputBasename: options.outputBasename,
    },
  };
}
