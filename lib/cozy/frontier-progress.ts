import type {CozyShared,CozyState} from "./types";

export const FRONTIER_VICTORY_TARGET = 6;

export function prepareFrontierProgress(state: CozyState, shared: CozyShared) {
  const feats = state.progression?.feats;
  if (!feats || feats.frontier) return;
  // Existing preview saves can recover victories from successful combat receipts with a known site.
  const victories = new Set<string>();
  for (const {kind,title,positive,location} of state.reports) {
    if (kind==="combat" && (title==="Cidade pronta para anexar" || title==="Acampamento vencido") && positive && location)
      victories.add(`${location.q},${location.r}`);
  }
  feats.frontier = {
    victories: [...victories].slice(0,FRONTIER_VICTORY_TARGET),
    resourceAreaClaimed: state.quests.includes("defense") ||
      Object.values(shared.areas ?? {}).some(area=>area.owners.includes(state.playerId)),
  };
}

export function militaryVictoryProgress(state: CozyState) {
  const frontier = state.progression?.feats.frontier;
  const count = Math.min(FRONTIER_VICTORY_TARGET,frontier ? frontier.victories.length : state.hordesWon);
  const max = state.progression?.balance?.militaryVictoryMax ?? 0;
  return {count,target:FRONTIER_VICTORY_TARGET,points:Math.floor(count/FRONTIER_VICTORY_TARGET*max),max};
}

export function recordFrontierVictory(state: CozyState, site: string) {
  const victories = state.progression?.feats.frontier?.victories;
  if (!victories || victories.length >= FRONTIER_VICTORY_TARGET || victories.includes(site)) return 0;
  const before = militaryVictoryProgress(state).points;
  victories.push(site);
  return militaryVictoryProgress(state).points-before;
}
