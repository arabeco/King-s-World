import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT_DIR = process.cwd();
const REPORTS_DIR = path.join(ROOT_DIR, "reports");
const LEVEL6_REPORT_PATH = path.join(REPORTS_DIR, "smoke-level6.json");
const CAMPAIGN_REPORT_PATH = path.join(REPORTS_DIR, "smoke-campaign-code", "latest.json");
const BALANCE_REPORT_PATH = path.join(REPORTS_DIR, "smoke-balance.json");

function runNpm(script) {
  const result = spawnSync("cmd.exe", ["/c", "npm", "run", script], {
    cwd: ROOT_DIR,
    encoding: "utf8",
    env: {
      ...process.env,
      FORCE_COLOR: "0",
      SMOKE_REQUIRE_SUPABASE_PERSISTENCE: "1",
    },
  });

  return {
    script,
    ok: result.status === 0,
    status: result.status ?? 1,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? result.error?.message ?? "").trim(),
  };
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT_DIR, relativePath), "utf8");
}

function pushCheck(checks, label, ok, details = null) {
  checks.push({ label, ok: Boolean(ok), details });
}

function stageByName(campaign, name) {
  return campaign?.stages?.find((stage) => stage.stage === name) ?? null;
}

function sourceIsDedicated(source, tableName) {
  return typeof source === "string" && source === tableName;
}

function inspectCampaignReport(campaign) {
  const checks = [];

  pushCheck(checks, "campanha code smoke ok", campaign?.ok === true);
  pushCheck(checks, "Supabase configurado", campaign?.supabaseConfigured === true);

  const model = campaign?.persistenceModel ?? {};
  pushCheck(checks, "predios usam tabela dedicada", model.buildingSkillsAndLevels === "supabase:village_structure_states", model.buildingSkillsAndLevels);
  pushCheck(checks, "cidade usa tabela dedicada", model.populationJobsAndRecruitment === "supabase:village_city_states", model.populationJobsAndRecruitment);
  pushCheck(checks, "rei usa tabela dedicada", model.kingSelection === "supabase:world_player_king_states", model.kingSelection);
  pushCheck(checks, "exploracao usa tabela dedicada", model.exploredTiles === "supabase:world_player_exploration_states", model.exploredTiles);
  pushCheck(checks, "tropas por site usam tabela dedicada", model.troopStacksBySite === "supabase:site_troop_stacks", model.troopStacksBySite);

  for (const stage of campaign?.stages ?? []) {
    const state = stage.persistence?.supabaseStateRow ?? {};
    const source = stage.persistence?.sourceSummary ?? {};
    pushCheck(checks, `${stage.stage}: snapshot sem rei`, state.snapshot_has_king === false, state.snapshot_has_king);
    pushCheck(checks, `${stage.stage}: snapshot sem predios`, state.snapshot_has_structure === false, state.snapshot_has_structure);
    pushCheck(checks, `${stage.stage}: snapshot sem cidade`, state.snapshot_has_city === false, state.snapshot_has_city);
    pushCheck(checks, `${stage.stage}: snapshot sem exploracao`, state.snapshot_has_exploration === false, state.snapshot_has_exploration);
    pushCheck(checks, `${stage.stage}: source rei dedicada`, sourceIsDedicated(source.king, "world_player_king_states"), source.king);
    pushCheck(checks, `${stage.stage}: source estrutura dedicada`, sourceIsDedicated(source.structure, "village_structure_states"), source.structure);
    pushCheck(checks, `${stage.stage}: source cidade dedicada`, sourceIsDedicated(source.city, "village_city_states"), source.city);
    pushCheck(checks, `${stage.stage}: source exploracao dedicada`, sourceIsDedicated(source.exploration, "world_player_exploration_states"), source.exploration);
  }

  const opening = stageByName(campaign, "opening");
  const mid = stageByName(campaign, "mid");
  const late = stageByName(campaign, "late");
  const final = stageByName(campaign, "final");

  pushCheck(checks, "opening nao obriga rei", opening?.assertions?.some((entry) => entry.label === "opening: kingProfileId" && entry.ok) === true);
  pushCheck(checks, "mid rei persistido", mid?.persistence?.kingRow?.king_profile_id === "aurelian", mid?.persistence?.kingRow);
  pushCheck(checks, "late exploracao persistida", late?.persistence?.explorationRows?.some((row) => row.coord_key === "1:-1") === true);
  pushCheck(checks, "final mundo readOnly", final?.worldMeta?.readOnly === true, final?.worldMeta);
  pushCheck(checks, "final mundo finalized", final?.worldMeta?.status === "finalized", final?.worldMeta);

  return checks;
}

function inspectStaticState() {
  const checks = [];
  const imperialRoute = readText("app/api/worlds/[worldId]/imperial-state/route.ts");
  const imperialPersistence = readText("lib/imperial-persistence.ts");
  const imperialState = readText("lib/imperial-state.ts");
  const gameBalance = readText("core/GameBalance.ts");
  const villageConfig = readText("components/base/village-scene-config.tsx");

  pushCheck(checks, "rota nao seleciona influence_stock", !imperialRoute.includes("influence_stock"));
  pushCheck(checks, "rota nao seleciona energy_stock", !imperialRoute.includes("energy_stock"));
  pushCheck(checks, "strip remove rei do snapshot quando dedicado", imperialPersistence.includes("const KING_SNAPSHOT_KEYS"));
  pushCheck(checks, "strip remove exploracao do snapshot quando dedicado", imperialPersistence.includes("const EXPLORATION_SNAPSHOT_KEYS"));
  pushCheck(checks, "getServerSnapshot cacheado por ref", imperialState.includes("const getServerSnapshot = useMemo(() => () => serverSnapshotRef.current, [])"));
  pushCheck(checks, "core sem influenceStock acumulado", !gameBalance.includes("influenceStock"));
  pushCheck(checks, "cidade sem bonus I/d", !villageConfig.includes("I/d"));

  return checks;
}

function main() {
  const execution = runNpm("smoke:level5");
  const campaign = readJsonIfExists(CAMPAIGN_REPORT_PATH);
  const balance = readJsonIfExists(BALANCE_REPORT_PATH);
  const checks = [
    { label: "smoke:level5 passou", ok: execution.ok, details: execution.ok ? null : execution.stderr || execution.stdout },
    { label: "balance PASS", ok: balance?.status === "PASS", details: balance?.status ?? null },
    ...inspectStaticState(),
    ...inspectCampaignReport(campaign),
  ];
  const failed = checks.filter((check) => !check.ok);
  const report = {
    status: failed.length === 0 ? "PASS" : "FAIL",
    generatedAt: new Date().toISOString(),
    checks,
    failed,
  };

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.writeFileSync(LEVEL6_REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main();
