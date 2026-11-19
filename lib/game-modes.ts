/**
 * Modos de mundo visíveis para os jogadores.
 *
 * O jogo oferece só dois modos: Clássico (120 dias reais) e Expresso (30 dias reais),
 * ambos Cozy, sem PvP. Os outros modos continuam no código, escondidos atrás de chaves:
 * - PvP/competitivo: NEXT_PUBLIC_KW_SHOW_PVP=1 (tela) e KW_ENABLE_PVP=1 (servidor).
 * - Mundo persistente (sem fim de temporada, com Ascensão): KW_COZY_PERSISTENT_PREVIEW=1.
 */
export const PVP_VISIBLE = process.env.NEXT_PUBLIC_KW_SHOW_PVP === "1";

export function pvpEnabledOnServer(): boolean {
  return process.env.KW_ENABLE_PVP === "1";
}

export function persistentWorldsEnabled(): boolean {
  return process.env.KW_COZY_PERSISTENT_PREVIEW === "1";
}

export function seasonModeLabel(mode: string | undefined, persistent?: boolean): string {
  if (persistent) return mode === "express" ? "Expresso ×4" : "Normal";
  return mode === "express" ? "Expresso · 30 dias" : "Clássico · 120 dias";
}
