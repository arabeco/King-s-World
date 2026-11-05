import {MAP_MAX_ZOOM} from "./map-zoom";
import type {CozyCoord, CozyOrder, CozyPayload, CozyTile} from "./types";

export type MapFilter = "all" | "cities" | "resources" | "discoveries" | "journeys";
export type MapDestination = {tile: CozyTile; accesses: number; orders: CozyOrder[]};
export type MapCamera = {center: CozyCoord; scale: number};

/** Keep map captions compact without splitting a Unicode code point. Full names remain in controls. */
export function mapCaption(name: string, max = 16): string {
  const characters = Array.from(name);
  return characters.length > max ? characters.slice(0,max-1).join("")+"…" : name;
}

/** Indicative route: travel is calculated from the nearest current city, not a simulated unit position. */
export function journeyOrigin(cities: CozyCoord[], target: CozyCoord): CozyCoord | null {
  const distance = (city: CozyCoord) => Math.max(Math.abs(city.q-target.q),Math.abs(city.r-target.r),Math.abs(city.q+city.r-target.q-target.r));
  return [...cities].sort((a,b)=>distance(a)-distance(b))[0] ?? null;
}

/** Presentation only: never recover unknown terrain from a search or a cached view. */
export function readMapCamera(raw: string | null): MapCamera | null {
  try {
    const value = JSON.parse(raw ?? "null");
    if (!value || ![value.center?.q, value.center?.r, value.scale].every(Number.isFinite)) return null;
    if (![value.center.q, value.center.r].every((n: number) => Math.abs(n) <= 40)) return null;
    if (value.scale < .03 || value.scale > MAP_MAX_ZOOM) return null;
    return {center: {q: value.center.q, r: value.center.r}, scale: value.scale};
  } catch { return null; }
}

export function mapOwnership(tile: CozyTile, data: CozyPayload): string {
  if (!tile.revealed) return tile.terrainVisible ? "À vista · não explorado" : "Sob a névoa";
  if (tile.reservedSlot) return "Reino disponível";
  const owner = tile.ownerId ?? tile.territoryOwnerId;
  if (!owner) return "Território livre";
  if (owner === data.state.playerId) return "Seu império";
  const player = data.players.find(p => p.playerId === owner);
  const allied = data.state.allianceId && player?.allianceId === data.state.allianceId;
  return `${allied ? "Aliado" : "Império"} · ${player?.playerName ?? "Outro reino"}`;
}

export function mapAreaAccess(tile: CozyTile, playerId: string): string {
  if (!tile.revealed || !tile.deposit) return "";
  if (tile.deposit.remaining <= 0) return "Reserva esgotada · território preservado";
  if (!tile.area) return "Reserva descoberta";
  if (tile.area.canCollect) return tile.area.owners.length===1 && tile.area.owners[0] === playerId ? "Sua área · coleta liberada" : "Área compartilhada · coleta liberada";
  if (tile.area.canAnnex) return tile.area.owners.length ? "Disponível para compartilhar em aliança" : "Disponível para anexar";
  return tile.area.owners.length ? "Área anexada · sem acesso à coleta" : "Explore a reserva para anexar";
}

const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function mapDestinations(data: CozyPayload, filter: MapFilter, search = ""): MapDestination[] {
  const query = normalize(search.trim().replace(/\s*[,;:]\s*/g, ", ")), groups = new Map<string, MapDestination>();
  for (const tile of [...data.tiles].sort((a,b) => a.distance-b.distance || a.id.localeCompare(b.id))) {
    const orders = data.state.orders.filter(o => o.q === tile.q && o.r === tile.r);
    const resource = tile.revealed && !tile.ownerId && !!tile.deposit && tile.deposit.remaining > 0;
    const accepted = filter === "journeys" ? orders.length > 0
      : filter === "cities" ? tile.revealed && tile.kind === "city"
      : filter === "resources" ? resource
      : filter === "discoveries" ? tile.revealed && tile.kind !== "plain" && tile.kind !== "city"
      : tile.revealed || orders.length > 0;
    if (!accepted) continue;
    // An active journey may point into fog, but cannot expose that tile's hidden name or clue.
    const title = tile.revealed ? `${tile.name} ${tile.clue} ${mapOwnership(tile,data)} ${mapAreaAccess(tile,data.state.playerId)}` : "Exploração em andamento";
    if (query && !normalize(`${title} ${tile.q}, ${tile.r}`).includes(query)) continue;
    const group = filter !== "journeys" && resource && tile.area ? `area:${tile.deposit!.resource}:${tile.area.id}` : `tile:${tile.id}`;
    const previous = groups.get(group);
    if (previous) { previous.accesses++; previous.orders.push(...orders); }
    else groups.set(group,{tile,accesses:1,orders:[...orders]});
  }
  return [...groups.values()];
}
