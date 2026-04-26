import type { CSSProperties } from "react";

import { getVillageDefenseLevel, type TerrainModifiers } from "@/core/GameBalance";
import { TERRAIN_META, type CityOriginKind, type TerrainKind } from "@/lib/cities";
import {
  axialDistance,
  axialKey,
  axialNeighbor,
  axialRound,
  axialToPixel,
  hexCorners,
  type AxialCoord,
  type PixelPoint,
} from "@/lib/hex-grid";
import type { BoardSite } from "@/lib/mock-data";
import type {
  CityDefenseAllocations,
  CityDefenseProtocol,
  HeroBuildId,
  ImperialVillageClaim,
} from "@/lib/imperial-state";
import type { CombatArmy, CombatResult } from "@/lib/combat-engine";
import {
  CORE_RING_LIMIT,
  MID_RING_LIMIT,
  WORLD_HEX_RADIUS,
  WORLD_HEX_TILE_SIZE_PX,
} from "@/lib/world-map-config";
import {
  DISTRICT_IDS,
  HOTSPOT_META,
  HOTSPOT_TARGET,
} from "./strategic-map-config";
import type {
  BuiltWorld,
  DistrictId,
  DistrictLabel,
  Faction,
  FrontierLine,
  Hotspot,
  HotspotKind,
  MapSite,
  MapZone,
  StrategicNodeState,
  StoredMapMovement,
  TroopSelection,
  WorldHexTile,
} from "./strategic-map-types";

const ZERO_AXIAL: AxialCoord = { q: 0, r: 0 };
export function parseLegacyCoord(coord: string): AxialCoord {
  const normalized = coord.includes(":") ? coord : coord.replace(",", ":");
  const [sq, sr] = normalized.split(":");
  const q = Number.parseInt(sq ?? "", 10);
  const r = Number.parseInt(sr ?? "", 10);
  if (Number.isNaN(q) || Number.isNaN(r)) {
    return { q: 0, r: 0 };
  }
  return { q, r };
}

export function formatLegacyCoord(coord: AxialCoord): string {
  return `${String(coord.q).padStart(2, "0")}:${String(coord.r).padStart(2, "0")}`;
}

export function zoneForDistance(distance: number): MapZone {
  if (distance <= CORE_RING_LIMIT) {
    return "core";
  }
  if (distance <= MID_RING_LIMIT) {
    return "mid";
  }
  return "outer";
}

export function districtForCoord(coord: AxialCoord): DistrictId {
  if (coord.q === 0 && coord.r === 0) {
    return "A";
  }

  const x = Math.sqrt(3) * (coord.q + coord.r / 2);
  const y = 1.5 * coord.r;
  const angle = Math.atan2(y, x);
  const normalized = angle < 0 ? angle + Math.PI * 2 : angle;
  const sector = Math.floor(normalized / (Math.PI / 3)) % 6;
  return DISTRICT_IDS[sector] ?? "A";
}

export function clampAxialToRadius(coord: AxialCoord): AxialCoord {
  const distance = axialDistance(coord, ZERO_AXIAL);
  if (distance <= WORLD_HEX_RADIUS) {
    return coord;
  }

  const factor = WORLD_HEX_RADIUS / Math.max(1, distance);
  return axialRound({
    q: coord.q * factor,
    r: coord.r * factor,
  });
}

export function normalizeAxial(site: BoardSite): AxialCoord {
  const raw = site.axial && Number.isFinite(site.axial.q) && Number.isFinite(site.axial.r)
    ? { q: site.axial.q, r: site.axial.r }
    : parseLegacyCoord(site.coord);

  return clampAxialToRadius(raw);
}

export function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

export function classifyFaction(site: BoardSite, tribeName: string): Faction {
  if (site.relation === "Proprio") {
    return "self";
  }
  if (site.owner === tribeName) {
    return "tribe";
  }
  if (site.relation === "Aliado") {
    return "ally";
  }
  if (site.relation === "Inimigo") {
    return "enemy";
  }

  if (site.occupationKind === "abandoned_city") {
    return "abandoned";
  }

  if (site.occupationKind === "frontier_ruins" || site.occupationKind === "wild_empty" || site.occupationKind === "hotspot") {
    return "neutral";
  }

  const hint = `${site.type} ${site.state} ${site.owner}`.toLowerCase();
  if (hint.includes("aband") || hint.includes("devast") || hint.includes("ruina") || site.owner === "Neutro") {
    return "abandoned";
  }

  return "neutral";
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function findBoardSiteByCoord(sites: BoardSite[], targetCoord: string): BoardSite | null {
  return sites.find((site) => axialKey(normalizeAxial(site)) === targetCoord) ?? null;
}

export function combatArmyHeadcount(army: CombatArmy): number {
  return Object.values(army).reduce((sum, value) => sum + Math.max(0, Math.floor(Number(value) || 0)), 0);
}

export function heroPowerForVillage(heroId: string | "none" | undefined, heroBuild: HeroBuildId | undefined): number {
  if (!heroId || heroId === "none") return 0;
  if (heroBuild === "discipline") return 18;
  if (heroBuild === "leadership") return 16;
  if (heroBuild === "logistics") return 11;
  if (heroBuild === "lore") return 9;
  return 12;
}

export function buildVillageImperialResponseDefenders(
  deployed: number,
  defenseLevel: number,
  protocol: CityDefenseProtocol | undefined,
): CombatArmy {
  const troops = Math.max(0, Math.floor(deployed));
  if (troops <= 0) return {};
  const guardsRatio = protocol === "alarm" ? 0.54 : protocol === "recall" ? 0.68 : 0.6;
  const archersRatio = defenseLevel >= 4 ? (protocol === "alarm" ? 0.34 : 0.26) : 0.12;
  const ballistaRatio = defenseLevel >= 7 ? (protocol === "alarm" ? 0.11 : 0.08) : 0.02;
  return {
    guards: Math.max(0, Math.round(troops * guardsRatio)),
    archers: Math.max(0, Math.round(troops * archersRatio)),
    ballistae: Math.max(0, Math.round(troops * ballistaRatio)),
  };
}

export type OwnedVillageDefenseContext = {
  village: ImperialVillageClaim;
  buildingLevels: Record<string, number>;
  localDefenders: CityDefenseAllocations;
  deployedTroops: number;
  heroId?: string | "none";
  heroBuild?: HeroBuildId;
  defenseProtocol?: CityDefenseProtocol;
};

export function buildTargetDefense(site: BoardSite | null, movement: StoredMapMovement, currentDay: number, ownedVillage?: OwnedVillageDefenseContext | null): {
  defenders: CombatArmy;
  localDefenders: CombatArmy;
  imperialResponseDefenders: CombatArmy;
  wallLevel: number;
  defenderHeroPower: number;
  defenderBuildBonus: number;
  responseReadiness: number;
  responseWindowLabel: string;
  resources: Record<string, number>;
} {
  const coord = movement.targetCoord.split(",");
  const q = Number.parseInt(coord[0] ?? "0", 10);
  const r = Number.parseInt(coord[1] ?? "0", 10);
  const distance = axialDistance({ q, r }, ZERO_AXIAL);
  if (ownedVillage) {
    const wallLevel = Math.max(1, getVillageDefenseLevel(ownedVillage.buildingLevels));
    const localDefenders: CombatArmy = {
      guards: Math.max(0, Math.floor(ownedVillage.localDefenders.guards ?? 0)),
      archers: Math.max(0, Math.floor(ownedVillage.localDefenders.archers ?? 0)),
      ballistae: Math.max(0, Math.floor(ownedVillage.localDefenders.ballistae ?? 0)),
    };
    const imperialResponseDefenders = buildVillageImperialResponseDefenders(
      ownedVillage.deployedTroops,
      wallLevel,
      ownedVillage.defenseProtocol,
    );
    const defenders: CombatArmy = {
      guards: (localDefenders.guards ?? 0) + (imperialResponseDefenders.guards ?? 0),
      archers: (localDefenders.archers ?? 0) + (imperialResponseDefenders.archers ?? 0),
      ballistae: (localDefenders.ballistae ?? 0) + (imperialResponseDefenders.ballistae ?? 0),
    };
    const responseReadiness = clampNumber(
      0.24 +
        Math.min(0.16, ownedVillage.deployedTroops / 280) +
        (ownedVillage.defenseProtocol === "alarm" ? 0.18 : ownedVillage.defenseProtocol === "hold" ? 0.08 : -0.1) +
        Math.min(0.08, wallLevel * 0.01),
      0.08,
      0.78,
    );
    const responseWindowLabel =
      responseReadiness >= 0.58 ? "resposta imediata da guarnicao imperial" :
      responseReadiness >= 0.34 ? "resposta parcial da guarnicao imperial" :
      "resposta tardia da guarnicao imperial";
    return {
      defenders,
      localDefenders,
      imperialResponseDefenders,
      wallLevel,
      defenderHeroPower: heroPowerForVillage(ownedVillage.heroId, ownedVillage.heroBuild),
      defenderBuildBonus: clampNumber((wallLevel - 2) * 0.03 + combatArmyHeadcount(localDefenders) / 800, 0, 0.28),
      responseReadiness,
      responseWindowLabel,
      resources: {
        materials: Math.max(0, Math.floor(ownedVillage.village.materials ?? 0)),
        supplies: Math.max(0, Math.floor(ownedVillage.village.supplies ?? 0)),
      },
    };
  }

  const classId = site?.cityClass ?? site?.recommendedCityClass ?? movement.meta.settlementRecommendedClass ?? "neutral";
  const classMultiplier =
    classId === "bastiao" ? 1.34 :
    classId === "posto_avancado" ? 1.18 :
    classId === "metropole" ? 1.08 :
    classId === "celeiro" ? 0.94 :
    1;
  const terrainMultiplier =
    site?.terrainKind === "ironridge" ? 1.16 :
    site?.terrainKind === "frontier_pass" ? 1.08 :
    site?.terrainKind === "riverlands" ? 0.96 :
    1;
  const dayPressure = clampNumber(0.72 + currentDay / 120, 0.72, 1.72);
  const base = Math.round((18 + distance * 4.5 + currentDay * 0.42) * classMultiplier * terrainMultiplier * dayPressure);
  const wallLevel = clampNumber(
    Math.round((classId === "bastiao" ? 4 : classId === "posto_avancado" ? 3 : 2) + currentDay / 30 + distance / 8),
    1,
    10,
  );
  const localShare =
    classId === "bastiao" ? 0.82 :
    classId === "posto_avancado" ? 0.76 :
    classId === "metropole" ? 0.68 :
    classId === "celeiro" ? 0.62 :
    0.65;
  const responseReadiness = clampNumber(
    0.2 +
      (classId === "bastiao" ? 0.16 : classId === "posto_avancado" ? 0.12 : classId === "metropole" ? 0.08 : 0.04) +
      (site?.terrainKind === "frontier_pass" ? 0.06 : site?.terrainKind === "ironridge" ? -0.04 : site?.terrainKind === "riverlands" ? 0.04 : 0) +
      Math.max(0, 0.16 - distance * 0.012) +
      Math.min(0.1, currentDay / 420),
    0.08,
    0.46,
  );
  const responseWindowLabel =
    responseReadiness >= 0.38 ? "resposta rapida" :
    responseReadiness >= 0.24 ? "resposta limitada" :
    "resposta tardia";
  const localBase = Math.max(12, Math.round(base * localShare));
  const responseBase = Math.max(0, Math.round(base * responseReadiness));
  const localDefenders: CombatArmy = {
    guards: Math.max(8, Math.round(localBase * 0.95)),
    archers: Math.max(3, Math.round(localBase * 0.42)),
    ballistae: Math.max(0, Math.round((localBase - 24) / 18)),
  };
  const imperialResponseDefenders: CombatArmy = {
    guards: Math.max(0, Math.round(responseBase * 0.78)),
    archers: Math.max(0, Math.round(responseBase * 0.36)),
    ballistae: Math.max(0, Math.round((responseBase - 34) / 24)),
  };
  const defenders: CombatArmy = {
    guards: (localDefenders.guards ?? 0) + (imperialResponseDefenders.guards ?? 0),
    archers: (localDefenders.archers ?? 0) + (imperialResponseDefenders.archers ?? 0),
    ballistae: (localDefenders.ballistae ?? 0) + (imperialResponseDefenders.ballistae ?? 0),
  };

  return {
    defenders,
    localDefenders,
    imperialResponseDefenders,
    wallLevel,
    defenderHeroPower: classId === "bastiao" || classId === "posto_avancado" ? 26 : 14,
    defenderBuildBonus: clampNumber((wallLevel - 3) * 0.025 + (classMultiplier - 1) * 0.22 + responseReadiness * 0.08, 0, 0.26),
    responseReadiness,
    responseWindowLabel,
    resources: {
      materials: Math.round((650 + distance * 55 + currentDay * 9) * (classId === "metropole" ? 1.2 : 1)),
      supplies: Math.round((560 + distance * 44 + currentDay * 7) * (classId === "celeiro" ? 1.25 : 1)),
    },
  };
}

export function subtractArmyLosses(pool: TroopSelection, losses: CombatArmy): TroopSelection {
  return {
    militia: Math.max(0, pool.militia - Math.max(0, Math.floor(losses.militia ?? 0))),
    shooters: Math.max(0, pool.shooters - Math.max(0, Math.floor(losses.shooters ?? 0))),
    scouts: Math.max(0, pool.scouts - Math.max(0, Math.floor(losses.scouts ?? 0))),
    machinery: Math.max(0, pool.machinery - Math.max(0, Math.floor(losses.machinery ?? 0))),
  };
}

export function mergeLoot(resources: { materials: number; supplies: number; influence: number }, loot: Record<string, number>) {
  return {
    ...resources,
    materials: resources.materials + Math.max(0, Math.floor(loot.materials ?? loot.wood ?? loot.iron ?? 0)),
    supplies: resources.supplies + Math.max(0, Math.floor(loot.supplies ?? loot.food ?? 0)),
  };
}

export function buildBattleLogLine(result: CombatResult, q: number, r: number): string {
  const lootMaterials = result.recursosSaqueados.materials ?? 0;
  const lootSupplies = result.recursosSaqueados.supplies ?? 0;
  const report = result.battleReport;
  const outcome =
    result.vencedor === "atacante"
      ? `Ataque venceu em ${q}:${r}`
      : result.vencedor === "defensor"
        ? `Ataque repelido em ${q}:${r}`
        : `Ataque recuou em ${q}:${r}`;
  return `${outcome}: local ${report.defenderLocalTotal}, resposta ${report.defenderImperialResponseTotal} (${report.defenderResponseWindowLabel}), +${result.scoreMilitarAtacanteFinal} SM, saque ${lootMaterials}M/${lootSupplies}S.`;
}

export function terrainKindForDistrict(district: DistrictId, roll: number): TerrainKind {
  switch (district) {
    case "A":
      return roll % 3 === 0 ? "riverlands" : "crown_heartland";
    case "B":
      return roll % 2 === 0 ? "riverlands" : "crown_heartland";
    case "C":
      return roll % 3 === 0 ? "ashen_fields" : "frontier_pass";
    case "D":
      return roll % 4 === 0 ? "riverlands" : "ironridge";
    case "E":
      return roll % 3 === 0 ? "ashen_fields" : "ironridge";
    default:
      return roll % 2 === 0 ? "frontier_pass" : "ashen_fields";
  }
}

export function terrainKindForCoord(coord: AxialCoord): TerrainKind {
  const district = districtForCoord(coord);
  const seed = hashSeed(`terrain:${coord.q},${coord.r}`);
  return terrainKindForDistrict(district, seed);
}

export function occupationKindForRoll(roll: number): CityOriginKind {
  if (roll < 28) {
    return "abandoned_city";
  }
  if (roll < 62) {
    return "frontier_ruins";
  }
  return "wild_empty";
}

export function buildHexWorld(): BuiltWorld {
  const coords: AxialCoord[] = [];
  for (let q = -WORLD_HEX_RADIUS; q <= WORLD_HEX_RADIUS; q += 1) {
    const rMin = Math.max(-WORLD_HEX_RADIUS, -q - WORLD_HEX_RADIUS);
    const rMax = Math.min(WORLD_HEX_RADIUS, -q + WORLD_HEX_RADIUS);
    for (let r = rMin; r <= rMax; r += 1) {
      coords.push({ q, r });
    }
  }

  const baseLayout = {
    orientation: "pointy" as const,
    size: WORLD_HEX_TILE_SIZE_PX,
    origin: { x: 0, y: 0 },
  };

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const coord of coords) {
    const center = axialToPixel(coord, baseLayout);
    minX = Math.min(minX, center.x - WORLD_HEX_TILE_SIZE_PX);
    maxX = Math.max(maxX, center.x + WORLD_HEX_TILE_SIZE_PX);
    minY = Math.min(minY, center.y - WORLD_HEX_TILE_SIZE_PX);
    maxY = Math.max(maxY, center.y + WORLD_HEX_TILE_SIZE_PX);
  }

  const padding = WORLD_HEX_TILE_SIZE_PX * 2;
  const shiftedLayout = {
    orientation: "pointy" as const,
    size: WORLD_HEX_TILE_SIZE_PX,
    origin: {
      x: padding - minX,
      y: padding - minY,
    },
  };

  const tiles: WorldHexTile[] = [];
  const centerByKey = new Map<string, PixelPoint>();

  for (const coord of coords) {
    const center = axialToPixel(coord, shiftedLayout);
    const corners = hexCorners(coord, shiftedLayout);
    const points = corners.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
    const distance = axialDistance(coord, ZERO_AXIAL);
    const zone = zoneForDistance(distance);
    const district = districtForCoord(coord);
    const terrainKind = terrainKindForCoord(coord);
    const coordKey = axialKey(coord);

    tiles.push({
      q: coord.q,
      r: coord.r,
      coordKey,
      distance,
      zone,
      district,
      terrainKind,
      isCentralThrone: distance <= 3,
      center,
      points,
    });

    centerByKey.set(coordKey, center);
  }

  const tileByKey = new Map(tiles.map((tile) => [tile.coordKey, tile] as const));
  const frontierLines: FrontierLine[] = [];

  for (const tile of tiles) {
    for (let direction = 0; direction < 6; direction += 1) {
      const neighborCoord = axialNeighbor({ q: tile.q, r: tile.r }, direction);
      const neighbor = tileByKey.get(axialKey(neighborCoord));
      if (!neighbor || neighbor.district === tile.district) {
        continue;
      }
      if (tile.coordKey > neighbor.coordKey) {
        continue;
      }

      frontierLines.push({
        id: `${tile.coordKey}-${neighbor.coordKey}`
          + "",
        x1: tile.center.x,
        y1: tile.center.y,
        x2: neighbor.center.x,
        y2: neighbor.center.y,
      });
    }
  }

  const width = Math.ceil(maxX - minX + padding * 2);
  const height = Math.ceil(maxY - minY + padding * 2);
  const centerPoint = centerByKey.get(axialKey(ZERO_AXIAL)) ?? { x: width / 2, y: height / 2 };
  const labelRadius = Math.min(width, height) * 0.34;
  const districtLabels: DistrictLabel[] = DISTRICT_IDS.map((district, index) => {
    const angle = (index + 0.5) * (Math.PI / 3);
    return {
      district,
      x: centerPoint.x + Math.cos(angle) * labelRadius,
      y: centerPoint.y + Math.sin(angle) * labelRadius,
    };
  });

  return {
    width,
    height,
    layout: shiftedLayout,
    tiles,
    centerByKey,
    districtLabels,
    frontierLines,
    centerPoint,
  };
}

export function generateAmbientSites(worldId: string, existing: Set<string>): MapSite[] {
  const generated: MapSite[] = [];
  let seed = hashSeed(worldId);

  const nextRand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed;
  };

  const target = 42;
  let guard = 0;

  while (generated.length < target && guard < 20000) {
    guard += 1;

    const q = (nextRand() % (WORLD_HEX_RADIUS * 2 + 1)) - WORLD_HEX_RADIUS;
    const r = (nextRand() % (WORLD_HEX_RADIUS * 2 + 1)) - WORLD_HEX_RADIUS;

    if (axialDistance({ q, r }, ZERO_AXIAL) > WORLD_HEX_RADIUS) {
      continue;
    }

    const coordKey = axialKey({ q, r });
    if (existing.has(coordKey)) {
      continue;
    }
    existing.add(coordKey);

    const terrainKind = terrainKindForCoord({ q, r });
    const terrainMeta = TERRAIN_META[terrainKind];
    const occupationKind = occupationKindForRoll(nextRand() % 100);
    const index = generated.length + 1;
    if (occupationKind === "wild_empty") {
      continue;
    }

    const abandoned = occupationKind === "abandoned_city";

    generated.push({
      id: `ambient-${index}`,
      name: abandoned ? `Cidade Ruinosa ${index}` : `Fundacao Instavel ${index}`,
      owner: "Neutro",
      type: abandoned ? "Cidade" : "Colonia",
      relation: "Neutro",
      occupationKind,
      terrainKind,
      terrainLabel: terrainMeta.label,
      recommendedCityClass: abandoned ? "neutral" : terrainMeta.recommendedCityClass,
      coord: formatLegacyCoord({ q, r }),
      axial: { q, r },
      state: abandoned ? "Cidade abandonada com muralhas antigas" : "Ruinas leves prontas para estabilizacao",
      q,
      r,
      coordKey,
      faction: abandoned ? "abandoned" : "neutral",
    });
  }

  return generated;
}

export function terrainBonusForKind(kind: HotspotKind): TerrainModifiers {
  if (kind === "oasis") {
    return {
      terrainProductionMultiplier: 1.08,
      terrainMovementMultiplier: 1.06,
    };
  }
  if (kind === "ruins") {
    return {
      terrainCombatMultiplier: 1.08,
      terrainCostMultiplier: 0.96,
    };
  }
  return {
    terrainProductionMultiplier: 1.12,
    terrainCostMultiplier: 0.94,
  };
}

export function generateHotspots(worldId: string, world: BuiltWorld): Hotspot[] {
  let seed = hashSeed(`${worldId}:hotspots:v1`);
  const nextRand = () => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return seed;
  };

  const candidates = world.tiles.filter((tile) => !tile.isCentralThrone && tile.distance > 3);
  const byDistrict = new Map<DistrictId, WorldHexTile[]>();
  for (const district of DISTRICT_IDS) {
    byDistrict.set(district, candidates.filter((tile) => tile.district === district));
  }

  const selectedKeys = new Set<string>();
  const hotspots: Hotspot[] = [];
  const requiredByDistrict = Math.floor(HOTSPOT_TARGET / DISTRICT_IDS.length);

  const pickKind = (): HotspotKind => {
    const roll = nextRand() % 3;
    if (roll === 0) return "oasis";
    if (roll === 1) return "ruins";
    return "rare_mine";
  };

  const makeHotspot = (tile: WorldHexTile, index: number): Hotspot => {
    const kind = pickKind();
    const label = HOTSPOT_META[kind].label;
    return {
      id: `hotspot-${index}-${tile.coordKey}`
        + "",
      q: tile.q,
      r: tile.r,
      coordKey: tile.coordKey,
      district: tile.district,
      kind,
      name: `${label} ${index + 1}`
        + "",
      terrainBonus: terrainBonusForKind(kind),
    };
  };

  let serial = 0;

  for (const district of DISTRICT_IDS) {
    const pool = [...(byDistrict.get(district) ?? [])];
    let guard = 0;
    while (pool.length && guard < 800 && hotspots.length < HOTSPOT_TARGET) {
      guard += 1;
      if (hotspots.filter((entry) => entry.district === district).length >= requiredByDistrict) {
        break;
      }

      const idx = nextRand() % pool.length;
      const tile = pool.splice(idx, 1)[0];
      if (!tile || selectedKeys.has(tile.coordKey)) {
        continue;
      }

      selectedKeys.add(tile.coordKey);
      hotspots.push(makeHotspot(tile, serial));
      serial += 1;
    }
  }

  const leftovers = candidates.filter((tile) => !selectedKeys.has(tile.coordKey));
  while (hotspots.length < HOTSPOT_TARGET && leftovers.length) {
    const idx = nextRand() % leftovers.length;
    const tile = leftovers.splice(idx, 1)[0];
    if (!tile) {
      continue;
    }
    selectedKeys.add(tile.coordKey);
    hotspots.push(makeHotspot(tile, serial));
    serial += 1;
  }

  return hotspots;
}

export function markerBorderClass(faction: Faction): string {
  switch (faction) {
    case "self":
      return "border-yellow-300/95";
    case "tribe":
      return "border-rose-300/95";
    case "ally":
      return "border-violet-300/95";
    case "enemy":
      return "border-emerald-300/95";
    case "abandoned":
      return "border-amber-300/95";
    default:
      return "border-sky-300/90";
  }
}

export function markerFillClass(faction: Faction): string {
  switch (faction) {
    case "self":
      return "bg-yellow-300";
    case "tribe":
      return "bg-rose-400";
    case "ally":
      return "bg-violet-400";
    case "enemy":
      return "bg-emerald-400";
    case "abandoned":
      return "bg-amber-400";
    default:
      return "bg-sky-400";
  }
}

export function labelClass(faction: Faction): string {
  switch (faction) {
    case "self":
      return "border-yellow-300/80 bg-yellow-400/20 text-yellow-50";
    case "tribe":
      return "border-rose-300/80 bg-rose-500/20 text-rose-100";
    case "ally":
      return "border-violet-300/80 bg-violet-500/20 text-violet-100";
    case "enemy":
      return "border-emerald-300/80 bg-emerald-500/20 text-emerald-100";
    case "abandoned":
      return "border-amber-300/80 bg-amber-500/20 text-amber-100";
    default:
      return "border-sky-300/70 bg-sky-500/20 text-sky-100";
  }
}

export function markerGlowStyle(faction: Faction, selected: boolean, muted: boolean): CSSProperties {
  const blur = selected ? 18 : 12;
  const spread = selected ? 6 : 2;
  const opacity = muted ? 0.16 : selected ? 0.92 : 0.6;

  const color =
    faction === "self"
      ? `rgba(253, 224, 71, ${opacity})`
      : faction === "tribe"
        ? `rgba(251, 113, 133, ${opacity})`
        : faction === "ally"
          ? `rgba(167, 139, 250, ${opacity})`
          : faction === "enemy"
            ? `rgba(74, 222, 128, ${opacity})`
            : faction === "abandoned"
              ? `rgba(251, 191, 36, ${opacity})`
              : `rgba(56, 189, 248, ${opacity})`;

  return {
    boxShadow: `0 0 ${blur}px ${spread}px ${color}`,
  };
}

export function cityMicroSurfaceStyle(faction: Faction): CSSProperties {
  const accent =
    faction === "self"
      ? "rgba(34,211,238,0.86)"
      : faction === "enemy"
        ? "rgba(251,113,133,0.82)"
        : faction === "ally"
          ? "rgba(167,139,250,0.82)"
          : faction === "tribe"
            ? "rgba(244,114,182,0.78)"
            : faction === "abandoned"
              ? "rgba(251,191,36,0.76)"
              : "rgba(148,163,184,0.72)";

  return {
    background: `linear-gradient(135deg, rgba(2,6,23,0.88), rgba(15,23,42,0.62)), radial-gradient(circle at 50% 0%, ${accent}, rgba(2,6,23,0) 58%)`,
    borderColor: accent,
    boxShadow: `0 0 0 1px rgba(255,255,255,0.08), 0 0 24px ${accent.replace("0.", "0.")}`,
  };
}

export function factionInfluenceColor(faction: Faction, opacity: number): string {
  if (faction === "self") return `rgba(253, 224, 71, ${opacity})`;
  if (faction === "tribe") return `rgba(251, 113, 133, ${opacity})`;
  if (faction === "ally") return `rgba(167, 139, 250, ${opacity})`;
  if (faction === "enemy") return `rgba(74, 222, 128, ${opacity})`;
  if (faction === "abandoned") return `rgba(251, 191, 36, ${opacity})`;
  return `rgba(56, 189, 248, ${opacity})`;
}

export function influenceRadiusForSite(site: MapSite): number {
  if (site.faction === "self") return isVillageSite(site) ? 3 : 2;
  if (site.faction === "tribe") return isVillageSite(site) ? 3 : 2;
  if (site.faction === "ally") return isVillageSite(site) ? 2 : 1;
  if (site.faction === "enemy") return isVillageSite(site) ? 3 : 2;
  if (site.faction === "abandoned") return 1;
  return 1;
}

export function influenceWeight(site: MapSite, distance: number): number {
  const base =
    site.faction === "self"
      ? 1.18
      : site.faction === "tribe"
        ? 1.08
        : site.faction === "ally"
          ? 0.96
          : site.faction === "enemy"
            ? 1.02
            : site.faction === "abandoned"
              ? 0.72
              : 0.64;

  const siteBonus =
    site.type.toLowerCase().includes("capital")
      ? 0.28
      : isVillageSite(site)
        ? 0.18
        : 0;

  return Math.max(0.16, base + siteBonus - distance * 0.28);
}

export function isVillageSite(site: MapSite): boolean {
  const haystack = `${site.type} ${site.name}`.toLowerCase();
  return (
    haystack.includes("capital") ||
    haystack.includes("colonia") ||
    haystack.includes("aldeia") ||
    haystack.includes("cidade") ||
    haystack.includes("cidadela") ||
    haystack.includes("citadel") ||
    haystack.includes("outpost")
  );
}

export function siteMarkerText(site: MapSite): string {
  const typeText = site.type.toLowerCase();
  if (typeText.includes("capital")) return "K";
  if (typeText.includes("cidadela") || typeText.includes("citadel")) return "C";
  if (typeText.includes("ruina") || typeText.includes("ruin")) return "R";
  if (typeText.includes("colonia") || typeText.includes("cidade") || typeText.includes("outpost")) return "V";
  return site.name.slice(0, 1).toUpperCase();
}

export function cityIconSrcForSite(site: MapSite): string {
  const typeText = site.type.toLowerCase();
  if (typeText.includes("capital")) return "/cities/capital-icon.png";

  const cityClass = site.cityClass ?? site.recommendedCityClass ?? "neutral";
  if (cityClass === "metropole") return "/cities/metropole-icon.png";
  if (cityClass === "posto_avancado") return "/cities/postoavancado-icon.png";
  if (cityClass === "bastiao") return "/cities/bastiao-icon.png";
  if (cityClass === "celeiro") return "/cities/celeiro-icon.png";
  return "/cities/neutra-icon.png";
}

export function cityDetailImageSrc(site: MapSite | null, hotspot: Hotspot | null, portalEligible: boolean): string {
  if (site) {
    const typeText = site.type.toLowerCase();
    if (typeText.includes("capital")) return "/images/capital.jpg";
    if (site.faction === "enemy") return "/images/cidade.jpg";
    if (site.occupationKind === "abandoned_city") return "/images/cidade.jpg";
    const cityClass = site.cityClass ?? site.recommendedCityClass ?? "neutral";
    if (cityClass === "metropole") return "/images/metropole.jpg";
    if (cityClass === "posto_avancado") return "/images/posto.jpg";
    if (cityClass === "bastiao") return "/images/bastiao.jpg";
    if (cityClass === "celeiro") return "/images/celeiro.jpg";
    return "/images/cidade.jpg";
  }

  if (hotspot) {
    return "/images/card-opportunity.jpg";
  }

  return portalEligible ? "/images/portal-open.png" : "/images/portal-closed.jpg";
}

export function strategicNodeTone(state: StrategicNodeState): {
  chip: string;
  ring: string;
  glow: string;
  route: string;
  pulse: string;
} {
  if (state === "owned") {
    return {
      chip: "border-cyan-200/80 bg-cyan-400/20 text-cyan-50",
      ring: "rgba(186,230,253,0.75)",
      glow: "0 0 0 1px rgba(186,230,253,0.4), 0 0 18px rgba(34,211,238,0.42)",
      route: "rgba(34,211,238,0.52)",
      pulse: "rgba(34,211,238,0.26)",
    };
  }
  if (state === "enemy") {
    return {
      chip: "border-rose-300/80 bg-rose-500/20 text-rose-50",
      ring: "rgba(253,164,175,0.75)",
      glow: "0 0 0 1px rgba(253,164,175,0.34), 0 0 18px rgba(244,63,94,0.36)",
      route: "rgba(251,113,133,0.42)",
      pulse: "rgba(244,63,94,0.24)",
    };
  }
  if (state === "pressured") {
    return {
      chip: "border-amber-300/80 bg-amber-500/18 text-amber-50",
      ring: "rgba(252,211,77,0.78)",
      glow: "0 0 0 1px rgba(252,211,77,0.34), 0 0 18px rgba(245,158,11,0.34)",
      route: "rgba(245,158,11,0.46)",
      pulse: "rgba(245,158,11,0.24)",
    };
  }
  if (state === "connected") {
    return {
      chip: "border-emerald-300/80 bg-emerald-500/16 text-emerald-50",
      ring: "rgba(110,231,183,0.72)",
      glow: "0 0 0 1px rgba(110,231,183,0.3), 0 0 16px rgba(16,185,129,0.28)",
      route: "rgba(52,211,153,0.38)",
      pulse: "rgba(16,185,129,0.18)",
    };
  }
  if (state === "discovered") {
    return {
      chip: "border-slate-200/55 bg-slate-200/10 text-slate-100",
      ring: "rgba(226,232,240,0.56)",
      glow: "0 0 0 1px rgba(226,232,240,0.18)",
      route: "rgba(148,163,184,0.26)",
      pulse: "rgba(148,163,184,0.14)",
    };
  }
  return {
    chip: "border-slate-500/55 bg-slate-700/30 text-slate-300",
    ring: "rgba(100,116,139,0.4)",
    glow: "0 0 0 1px rgba(100,116,139,0.16)",
    route: "rgba(71,85,105,0.2)",
    pulse: "rgba(71,85,105,0.1)",
  };
}

export function createClaimedVillageName(index: number): string {
  return `Nova Cidade ${index}`;
}

