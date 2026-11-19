import { applyCozyAction, getCozyComputed, getCozyTiles } from "./engine";
import type { CozyAction, CozyPayload } from "./types";

/**
 * Actions the phone can't foresee: they depend on the player's collection, other
 * players' saved states, or the season archive. These wait for the server.
 */
function needsServer(type: string): boolean {
  return ["king_choose", "ascend", "alliance_gift", "read_reports", "notice_seen", "start_world"].includes(type)
    || type.startsWith("alliance_") || type.startsWith("sanctuary_pact_");
}

/**
 * Runs the same rules the server runs, on the last confirmed snapshot, so the screen can
 * change the moment the player taps. The server stays the authority: its answer replaces
 * this prediction, and a rejection undoes it. Returns null when the result can't be foreseen.
 */
export function predictCozyPayload(base: CozyPayload, action: CozyAction | { type: "start_world" }, now: number): CozyPayload | null {
  if (needsServer(action.type) || base.computed.readOnly || !base.computed.started || base.state.founding) return null;
  try {
    const { state, shared } = applyCozyAction(structuredClone(base.state), structuredClone(base.shared), base.world,
      structuredClone(action) as CozyAction, now);
    const computed = getCozyComputed(state, shared, base.world, now);
    if (base.computed.playerThreats) computed.playerThreats = base.computed.playerThreats;
    return { ...base, state, shared, computed, tiles: getCozyTiles(state, shared, base.world), serverNow: now };
  } catch {
    return null;
  }
}
