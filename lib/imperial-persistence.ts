const VILLAGE_STATE_KEYS = [
  "villageNameByVillage",
  "cityClassByVillage",
  "cityClassLockedByVillage",
  "buildingLevelsByVillage",
  "buildingSkillsByVillage",
  "populationByVillage",
  "productionWorkersByVillage",
  "jobsByVillage",
  "recruitsByVillage",
  "defenseRecruitsByVillage",
  "heroByVillage",
  "heroBuildByVillage",
  "productionFocusByVillage",
  "societyFocusByVillage",
  "barracksFocusByVillage",
  "defenseProtocolByVillage",
  "deployedByVillage",
  "diplomatByVillage",
  "promotedHeroByVillage",
  "constructionLoadByVillage",
];

const STRUCTURE_SNAPSHOT_KEYS = ["buildingSkillsByVillage", "buildingLevelsByVillage"] as const;
const CITY_SNAPSHOT_KEYS = [
  "populationByVillage",
  "productionFocusByVillage",
  "societyFocusByVillage",
  "barracksFocusByVillage",
  "defenseProtocolByVillage",
  "productionWorkersByVillage",
  "jobsByVillage",
  "recruitsByVillage",
  "defenseRecruitsByVillage",
  "deployedByVillage",
] as const;
const KING_SNAPSHOT_KEYS = ["kingProfileId", "kingName"] as const;
const EXPLORATION_SNAPSHOT_KEYS = ["exploredCoordKeys", "discoveriesByCoord"] as const;

type SnapshotStripFlags = {
  structure?: boolean;
  city?: boolean;
  king?: boolean;
  exploration?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function remapRecordKeys<T>(
  source: Record<string, T>,
  aliasMap: Record<string, string>,
): Record<string, T> {
  const next: Record<string, T> = {};
  for (const [key, value] of Object.entries(source)) {
    next[aliasMap[key] ?? key] = value;
  }
  return next;
}

export function normalizeImperialVillageIds<T extends Record<string, unknown>>(
  state: T,
  currentCapitalVillageId: string | null | undefined,
  knownVillageIds: string[] = [],
): T {
  if (!isRecord(state)) return state;

  const sourceCapitalVillageId =
    typeof state.royalCapitalVillageId === "string" ? state.royalCapitalVillageId : null;
  const targetCapitalVillageId =
    currentCapitalVillageId && currentCapitalVillageId.trim().length > 0
      ? currentCapitalVillageId
      : sourceCapitalVillageId;

  if (!sourceCapitalVillageId || !targetCapitalVillageId || sourceCapitalVillageId === targetCapitalVillageId) {
    return state;
  }

  const knownSet = new Set(knownVillageIds.filter((entry) => typeof entry === "string" && entry.length > 0));
  if (knownSet.has(sourceCapitalVillageId) && !knownSet.has(targetCapitalVillageId)) {
    return state;
  }

  const aliasMap: Record<string, string> = {
    [sourceCapitalVillageId]: targetCapitalVillageId,
  };
  const nextState: Record<string, unknown> = { ...state, royalCapitalVillageId: targetCapitalVillageId };

  for (const key of VILLAGE_STATE_KEYS) {
    if (!isRecord(nextState[key])) continue;
    nextState[key] = remapRecordKeys(nextState[key] as Record<string, unknown>, aliasMap);
  }

  if (Array.isArray(nextState.extraVillages)) {
    nextState.extraVillages = nextState.extraVillages.map((entry) => {
      if (!isRecord(entry) || typeof entry.id !== "string") return entry;
      return {
        ...entry,
        id: aliasMap[entry.id] ?? entry.id,
      };
    });
  }

  if (isRecord(nextState.capitalTransfer)) {
    const capitalTransfer = nextState.capitalTransfer as Record<string, unknown>;
    nextState.capitalTransfer = {
      ...capitalTransfer,
      sourceVillageId:
        typeof capitalTransfer.sourceVillageId === "string"
          ? aliasMap[capitalTransfer.sourceVillageId] ?? capitalTransfer.sourceVillageId
          : capitalTransfer.sourceVillageId ?? null,
      targetVillageId:
        typeof capitalTransfer.targetVillageId === "string"
          ? aliasMap[capitalTransfer.targetVillageId] ?? capitalTransfer.targetVillageId
          : capitalTransfer.targetVillageId ?? null,
    };
  }

  return nextState as T;
}

export function stripDedicatedImperialClientState<T extends Record<string, unknown>>(
  state: T,
  flags: SnapshotStripFlags,
): T {
  if (!isRecord(state)) return state;

  const nextState: Record<string, unknown> = { ...state };

  if (flags.structure) {
    for (const key of STRUCTURE_SNAPSHOT_KEYS) {
      delete nextState[key];
    }
  }

  if (flags.city) {
    for (const key of CITY_SNAPSHOT_KEYS) {
      delete nextState[key];
    }
  }

  if (flags.king) {
    for (const key of KING_SNAPSHOT_KEYS) {
      delete nextState[key];
    }
  }

  if (flags.exploration) {
    for (const key of EXPLORATION_SNAPSHOT_KEYS) {
      delete nextState[key];
    }
  }

  return nextState as T;
}
