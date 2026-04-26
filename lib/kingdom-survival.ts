"use client";

import type { VillageSummary } from "@/lib/mock-data";

export type CrownRiskBand = "safe" | "warning" | "danger" | "game_over";

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
  const capitalDefenseScore = Math.max(0, Math.min(100, capitalWallLevel * 7 + capitalPalaceLevel * 3 + (capital?.type === "Capital" ? 12 : 0)));
  const capitalDefenseLabel =
    capitalDefenseScore >= 84 ? "Ultimo Bastiao" : capitalDefenseScore >= 62 ? "Fortaleza Viva" : capitalDefenseScore >= 42 ? "Segurando" : "Fragil";
  const frontierCollapse = attackedVillages >= 3;
  const hostileAlerts = input.activeAlerts.some((entry) => /horda|cerco|press|ataque|fronteira|ruptura/i.test(entry));

  const reasons: string[] = [];
  if (!kingAlive) reasons.push("o rei caiu");
  if (capitalUnderAttack) reasons.push("a capital esta sob ataque");
  if (!kingAtCapital && kingAlive) reasons.push("o rei nao esta protegido na capital");
  if (capitalWallLevel <= 4) reasons.push("a muralha da capital ainda e fragil");
  else if (capitalWallLevel <= 6) reasons.push("a muralha da capital ainda nao segura tudo sozinha");
  if (frontierCollapse) reasons.push("a frente abriu largura demais para defender");
  if (hostileAlerts) reasons.push("o mundo ja esta sinalizando pressao hostil");

  if (!kingAlive) {
    return {
      gameOver: true,
      kingAlive,
      kingAtCapital,
      capitalVillageId: capital?.id ?? null,
      capitalName: capital?.name ?? "Capital",
      capitalUnderAttack,
      capitalWallLevel,
      capitalPalaceLevel,
      capitalDefenseScore,
      capitalDefenseLabel,
      crownRiskBand: "game_over",
      reasons,
      headline: "O rei morreu",
      detail: "A Coroa caiu. Esta run terminou porque a Capital nao segurou o suficiente antes do golpe final.",
    };
  }

  if (capitalUnderAttack || (!kingAtCapital && frontierCollapse) || (capitalDefenseScore <= 42 && hostileAlerts)) {
    return {
      gameOver: false,
      kingAlive,
      kingAtCapital,
      capitalVillageId: capital?.id ?? null,
      capitalName: capital?.name ?? "Capital",
      capitalUnderAttack,
      capitalWallLevel,
      capitalPalaceLevel,
      capitalDefenseScore,
      capitalDefenseLabel,
      crownRiskBand: "danger",
      reasons,
      headline: "A Coroa corre risco real",
      detail: "Se a Capital quebrar agora, voce sente a derrota antes do fim chegar. Defender e mais importante que abrir outra frente.",
    };
  }

  if (capitalDefenseScore <= 66 || attackedVillages >= 2 || hostileAlerts) {
    return {
      gameOver: false,
      kingAlive,
      kingAtCapital,
      capitalVillageId: capital?.id ?? null,
      capitalName: capital?.name ?? "Capital",
      capitalUnderAttack,
      capitalWallLevel,
      capitalPalaceLevel,
      capitalDefenseScore,
      capitalDefenseLabel,
      crownRiskBand: "warning",
      reasons,
      headline: "A Capital entrou no radar da guerra",
      detail: "Ainda ha margem, mas a muralha e a preparacao da Capital ja importam mais do que conforto lateral.",
    };
  }

  return {
    gameOver: false,
    kingAlive,
    kingAtCapital,
    capitalVillageId: capital?.id ?? null,
    capitalName: capital?.name ?? "Capital",
    capitalUnderAttack,
    capitalWallLevel,
    capitalPalaceLevel,
    capitalDefenseScore,
    capitalDefenseLabel,
    crownRiskBand: "safe",
    reasons,
    headline: "A Coroa esta protegida",
    detail: "O rei ainda esta seguro na Capital. A muralha aguenta e o risco nao virou crise.",
  };
}
