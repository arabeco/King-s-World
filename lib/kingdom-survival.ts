"use client";

import type { VillageSummary } from "@/lib/mock-data";

export type CrownRiskBand = "safe" | "warning" | "danger" | "game_over";

export type DefensePillar = {
  id: "wall" | "troops" | "wonders" | "supply";
  label: string;
  value: number;
};

export type KingdomSurvivalState = {
  gameOver: boolean;
  kingAlive: boolean;
  kingAtCapital: boolean;
  capitalVillageId: string | null;
  capitalName: string;
  capitalUnderAttack: boolean;
  capitalWallLevel: number;
  capitalPalaceLevel: number;
  capitalDefenseScore: number;
  capitalDefenseLabel: string;
  defensePillars: DefensePillar[];
  topDefensePillar: DefensePillar["id"];
  crownRiskBand: CrownRiskBand;
  reasons: string[];
  headline: string;
  detail: string;
};

type BuildKingdomSurvivalInput = {
  villages: VillageSummary[];
  activeAlerts: string[];
  sovereignty: {
    kingAlive: boolean;
  };
  // Pilares de defesa multi-fonte (opcionais — retrocompatível).
  // Cada build tem o seu caminho para a defesa, não só muralha.
  defense?: {
    capitalStationedTroops?: number;   // ⚔️ posto/militar
    wondersControlled?: number;        // 🏛️ metrópole
    councilHeroes?: number;            // 🏛️ metrópole
    surplusSupplies?: number;          // 🌾 celeiro/logístico
  };
  // Rei em trânsito (transferência de capital ativa) → defesa cai pela metade.
  // É o trade-off de mover preventivamente: ficou exposto.
  kingInTransit?: boolean;
};

export function buildKingdomSurvivalState(input: BuildKingdomSurvivalInput): KingdomSurvivalState {
  const capital =
    input.villages.find((village) => village.type === "Capital") ??
    input.villages.find((village) => village.kingHere) ??
    input.villages[0] ??
    null;

  const capitalWallLevel = Math.max(0, Math.floor(capital?.buildingLevels.wall ?? 0));
  const capitalPalaceLevel = Math.max(0, Math.floor(capital?.buildingLevels.palace ?? capital?.palaceLevel ?? 0));
  const attackedVillages = input.villages.filter((village) => village.underAttack).length;
  const capitalUnderAttack = Boolean(capital?.underAttack);
  const kingAlive = input.sovereignty.kingAlive;
  const kingAtCapital = Boolean(capital?.kingHere);

  // --- Defesa multi-pilar ---
  // Cada build tem o seu caminho para sobreviver à horda, não só muralha.
  const def = input.defense ?? {};
  // 🧱 Muralha + palácio (bastião) — base, como antes
  const wallPillar = capitalWallLevel * 7 + capitalPalaceLevel * 3 + (capital?.type === "Capital" ? 12 : 0);
  // ⚔️ Tropas estacionadas na capital (posto/militar) — até ~30 pts
  const troopsPillar = Math.min(30, Math.floor((def.capitalStationedTroops ?? 0) / 40));
  // 🏛️ Maravilhas + heróis de conselho (metrópole) — até ~28 pts
  const wondersPillar = Math.min(28, (def.wondersControlled ?? 0) * 10 + (def.councilHeroes ?? 0) * 3);
  // 🌾 Excedente de suprimento convertível em defesa emergencial (celeiro) — até ~22 pts
  const supplyPillar = Math.min(22, Math.floor((def.surplusSupplies ?? 0) / 350));

  const defensePillars: DefensePillar[] = [
    { id: "wall",    label: "Muralha",    value: Math.round(wallPillar) },
    { id: "troops",  label: "Tropas",     value: Math.round(troopsPillar) },
    { id: "wonders", label: "Maravilhas", value: Math.round(wondersPillar) },
    { id: "supply",  label: "Suprimento", value: Math.round(supplyPillar) },
  ];
  const topDefensePillar = [...defensePillars].sort((a, b) => b.value - a.value)[0]?.id ?? "wall";

  // Score combinado — muralha domina mas os outros pilares somam de verdade.
  // Rei em trânsito → defesa total cai pela metade (capital fica exposta).
  const inTransitMult = input.kingInTransit ? 0.5 : 1;
  const capitalDefenseScore = Math.max(0, Math.min(100,
    Math.round((wallPillar + troopsPillar + wondersPillar + supplyPillar) * inTransitMult)
  ));
  const capitalDefenseLabel =
    capitalDefenseScore >= 84 ? "Ultimo Bastiao" : capitalDefenseScore >= 62 ? "Fortaleza Viva" : capitalDefenseScore >= 42 ? "Segurando" : "Fragil";
  const frontierCollapse = attackedVillages >= 3;
  const hostileAlerts = input.activeAlerts.some((entry) => /horda|cerco|press|ataque|fronteira|ruptura/i.test(entry));

  const reasons: string[] = [];
  if (!kingAlive) reasons.push("o rei caiu");
  if (capitalUnderAttack) reasons.push("a capital esta sob ataque");
  if (!kingAtCapital && kingAlive) reasons.push("o rei nao esta protegido na capital");
  if (capitalDefenseScore <= 35) reasons.push("a defesa da capital ainda e fragil");
  else if (capitalDefenseScore <= 55) reasons.push("a defesa da capital ainda nao segura tudo sozinha");
  if (frontierCollapse) reasons.push("a frente abriu largura demais para defender");
  if (hostileAlerts) reasons.push("o mundo ja esta sinalizando pressao hostil");
  if (input.kingInTransit) reasons.push("o rei esta em transito — capital exposta");

  // Base compartilhada por todos os returns
  const base = {
    kingAlive,
    kingAtCapital,
    capitalVillageId: capital?.id ?? null,
    capitalName: capital?.name ?? "Capital",
    capitalUnderAttack,
    capitalWallLevel,
    capitalPalaceLevel,
    capitalDefenseScore,
    capitalDefenseLabel,
    defensePillars,
    topDefensePillar,
    reasons,
  };

  if (!kingAlive) {
    return {
      ...base,
      gameOver: true,
      crownRiskBand: "game_over",
      headline: "O rei morreu",
      detail: "A Coroa caiu. Esta run terminou porque a Capital nao segurou o suficiente antes do golpe final.",
    };
  }

  if (capitalUnderAttack || (!kingAtCapital && frontierCollapse) || (capitalDefenseScore <= 42 && hostileAlerts)) {
    return {
      ...base,
      gameOver: false,
      crownRiskBand: "danger",
      headline: "A Coroa corre risco real",
      detail: "Se a Capital quebrar agora, voce sente a derrota antes do fim chegar. Defender e mais importante que abrir outra frente.",
    };
  }

  if (capitalDefenseScore <= 66 || attackedVillages >= 2 || hostileAlerts) {
    return {
      ...base,
      gameOver: false,
      crownRiskBand: "warning",
      headline: "A Capital entrou no radar da guerra",
      detail: "Ainda ha margem, mas a defesa e a preparacao da Capital ja importam mais do que conforto lateral.",
    };
  }

  return {
    ...base,
    gameOver: false,
    crownRiskBand: "safe",
    headline: "A Coroa esta protegida",
    detail: "O rei ainda esta seguro na Capital. A defesa aguenta e o risco nao virou crise.",
  };
}
