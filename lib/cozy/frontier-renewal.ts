import { syncAreaDeposits } from "./areas";
import { sanctuaryAt } from "./landmarks";
import type { CozyShared } from "./types";

export const FRONTIER_RENEWAL_DAYS = 7;
export const TRADE_ROUTE = { gold: 150, supplies: 60, travelDays: .5, cooldownDays: 2 } as const;
export const TRADE_ROUTE_TRIPS = [1,2,3] as const;

export function renewFrontier(shared: CozyShared, at: number, dayMs: number, isCamp: (id: string) => boolean) {
  const elapsed = FRONTIER_RENEWAL_DAYS * dayMs;
  for (const [id, depletedAt] of Object.entries(shared.depletedAreas ?? {})) {
    if (depletedAt + elapsed > at) continue;
    const area = shared.areas?.[id];
    if (area && area.reserve.remaining === 0) {
      area.reserve.remaining = area.reserve.capacity;
      syncAreaDeposits(shared, area);
    }
    delete shared.depletedAreas![id];
  }
  for (const [id, camp] of Object.entries(shared.npcResistance ?? {})) {
    if (camp.remaining !== 0 || camp.at + elapsed > at || shared.claims[id] ||
        shared.territories?.[id] || shared.independentCities?.[id]) continue;
    const [q, r] = id.split(",").map(Number);
    if (!sanctuaryAt({ q, r }) && isCamp(id)) delete shared.npcResistance![id];
  }
}
