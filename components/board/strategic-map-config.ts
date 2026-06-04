import type { TerrainKind } from "@/lib/cities";
import { MID_RING_LIMIT } from "@/lib/world-map-config";
import type { DistrictId, HotspotKind, MapZone, TroopTypeId, ZoomLevel } from "./strategic-map-types";

export const WORLD_MAP_IMAGE_SRC = "/world/main-map0.png";

export const ZOOM_LEVEL_SCALE: Record<ZoomLevel, number> = {
  1: 0.46,
  2: 0.92,
  3: 1.48,
  4: 2.28,
};

export const WORLD_OVERVIEW_ZOOM = ZOOM_LEVEL_SCALE[1];
export const DEFAULT_WORLD_ZOOM = ZOOM_LEVEL_SCALE[4];
export const DETAIL_ZOOM_THRESHOLD = ZOOM_LEVEL_SCALE[4];
export const MACRO_VISION_THRESHOLD = 0.92;
export const MICRO_VISION_THRESHOLD = 2.15;
export const FOG_VISUAL_DISABLED = false;

export const MAP_IMAGE_CALIBRATION = {
  x: -1,
  y: 0,
  scale: 1,
};

export const DETAIL_RING_LIMIT = MID_RING_LIMIT - 1;
export const HOTSPOT_TARGET = 30;
export const PHASE4_REGROUP_SPEED_MULT = 5;
export const INTERNAL_AID_SPEED_MULT = 5;
export const THRONE_TOOLTIP = "Trono de Kingsworld - acesso condicionado a Influencia minima de 1500";
export const PLAYER_VILLAGE_CAP = 10;
export const EXPLORATION_ACTION_COST_BASE = 40;

export const DISTRICT_IDS: DistrictId[] = ["A", "B", "C", "D", "E", "F"];

export const TROOP_ORDER: TroopTypeId[] = ["militia", "shooters", "scouts", "machinery"];

export const TROOP_LABELS: Record<TroopTypeId, { label: string; short: string; qualityWeight: number }> = {
  militia: { label: "Milicia", short: "MI", qualityWeight: 1 },
  shooters: { label: "Atiradores", short: "AT", qualityWeight: 1.4 },
  scouts: { label: "Batedores", short: "BD", qualityWeight: 1.8 },
  machinery: { label: "Maquinaria", short: "MQ", qualityWeight: 2.8 },
};

export const TILE_STYLE_BY_ZONE: Record<MapZone, { fill: string; stroke: string }> = {
  outer: {
    fill: "rgba(15, 23, 42, 0.32)",
    stroke: "rgba(148, 163, 184, 0.22)",
  },
  mid: {
    fill: "rgba(30, 41, 59, 0.34)",
    stroke: "rgba(125, 211, 252, 0.24)",
  },
  core: {
    fill: "rgba(56, 189, 248, 0.16)",
    stroke: "rgba(186, 230, 253, 0.36)",
  },
};

export const DISTRICT_META: Record<DistrictId, { tint: string; badge: string }> = {
  A: { tint: "rgba(56, 189, 248, 0.05)", badge: "border-cyan-300/55 bg-cyan-400/15 text-cyan-100" },
  B: { tint: "rgba(52, 211, 153, 0.05)", badge: "border-emerald-300/55 bg-emerald-400/15 text-emerald-100" },
  C: { tint: "rgba(147, 197, 253, 0.05)", badge: "border-blue-300/55 bg-blue-400/15 text-blue-100" },
  D: { tint: "rgba(196, 181, 253, 0.05)", badge: "border-violet-300/55 bg-violet-400/15 text-violet-100" },
  E: { tint: "rgba(251, 191, 36, 0.05)", badge: "border-amber-300/55 bg-amber-400/15 text-amber-100" },
  F: { tint: "rgba(244, 114, 182, 0.05)", badge: "border-pink-300/55 bg-pink-400/15 text-pink-100" },
};

export const HOTSPOT_META: Record<HotspotKind, { icon: string; label: string; chipClass: string }> = {
  oasis: { icon: "O", label: "Oasis", chipClass: "border-cyan-300/80 bg-cyan-500/30 text-cyan-100" },
  ruins: { icon: "R", label: "Ruinas", chipClass: "border-amber-300/80 bg-amber-500/30 text-amber-100" },
  rare_mine: { icon: "M", label: "Mina Rara", chipClass: "border-emerald-300/80 bg-emerald-500/30 text-emerald-100" },
};

export const TERRAIN_VISUAL_META: Record<TerrainKind, { tint: string; badgeClass: string; short: string }> = {
  crown_heartland: {
    tint: "rgba(120, 184, 120, 0.06)",
    badgeClass: "border-slate-200/60 bg-slate-200/10 text-slate-100",
    short: "Metro",
  },
  riverlands: {
    tint: "rgba(66, 153, 104, 0.06)",
    badgeClass: "border-cyan-300/60 bg-cyan-400/10 text-cyan-100",
    short: "Celeiro",
  },
  frontier_pass: {
    tint: "rgba(116, 123, 138, 0.08)",
    badgeClass: "border-amber-300/60 bg-amber-400/10 text-amber-100",
    short: "Posto",
  },
  ironridge: {
    tint: "rgba(98, 107, 124, 0.08)",
    badgeClass: "border-rose-300/60 bg-rose-400/10 text-rose-100",
    short: "Bastiao",
  },
  ashen_fields: {
    tint: "rgba(106, 138, 96, 0.05)",
    badgeClass: "border-sky-300/45 bg-sky-400/8 text-sky-100",
    short: "Neutra",
  },
};
