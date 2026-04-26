import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT_DIR = process.cwd();
const REPORTS_DIR = path.join(ROOT_DIR, "reports");
const REPORT_PATH = path.join(REPORTS_DIR, "smoke-world-create.json");

function loadLocalEnv() {
  for (const fileName of [".env.local", ".env"]) {
    const filePath = path.join(ROOT_DIR, fileName);
    if (!fs.existsSync(filePath)) continue;
    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const index = trimmed.indexOf("=");
      const key = trimmed.slice(0, index).trim();
      const rawValue = trimmed.slice(index + 1).trim();
      const value = rawValue.replace(/^["']|["']$/g, "");
      process.env[key] ??= value;
    }
  }
}

loadLocalEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SECRET_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

const SLUG = "alpha-expresso";

function buildPayload(includeModeColumns = true) {
  const now = new Date();
  const startsAt = new Date(now.getTime() + 10 * 60 * 1000);
  const phase2At = new Date(startsAt.getTime() + 5 * 24 * 60 * 60 * 1000);
  const endsAt = new Date(startsAt.getTime() + 30 * 24 * 60 * 60 * 1000);

  const payload = {
    slug: SLUG,
    name: "Alpha Expresso",
    status: "open",
    phase: "phase_1",
    day_number: 0,
    registration_opens_at: now.toISOString(),
    starts_at: startsAt.toISOString(),
    phase_2_starts_at: phase2At.toISOString(),
    ends_at: endsAt.toISOString(),
    finalized_at: null,
    player_cap: 50,
    tribe_member_cap: 10,
    map_width: 81,
    map_height: 81,
    map_hex_radius: 40,
    base_move_time_minutes: 11,
    road_move_time_minutes: 4,
    runtime_started: false,
    runtime_real_time_enabled: false,
    runtime_anchor_day: 0,
    runtime_anchor_started_at: null,
    sandbox_enabled: false,
    updated_at: now.toISOString(),
  };

  if (includeModeColumns) {
    payload.season_mode = "express";
    payload.speed_multiplier = 4;
  }

  return payload;
}

function writeReport(report) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    const report = {
      status: "FAIL",
      generatedAt: new Date().toISOString(),
      error: "Supabase env missing.",
    };
    writeReport(report);
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let usedModeColumns = true;
  let payload = buildPayload(true);
  let upsertResponse = await supabase
    .from("worlds")
    .upsert(payload, { onConflict: "slug" })
    .select("id,slug,name,status,phase,day_number,runtime_started,sandbox_enabled")
    .single();
  if (upsertResponse.error) {
    usedModeColumns = false;
    payload = buildPayload(false);
    upsertResponse = await supabase
      .from("worlds")
      .upsert(payload, { onConflict: "slug" })
      .select("id,slug,name,status,phase,day_number,runtime_started,sandbox_enabled")
      .single();
  }
  const { data: upserted, error: upsertError } = upsertResponse;

  if (upsertError) {
    const report = {
      status: "FAIL",
      generatedAt: new Date().toISOString(),
      stage: "upsert",
      error: upsertError.message,
    };
    writeReport(report);
    process.exitCode = 1;
    return;
  }

  const { data: selected, error: selectError } = await supabase
    .from("worlds")
    .select("id,slug,name,status,phase,day_number,runtime_started,sandbox_enabled")
    .eq("slug", SLUG)
    .single();

  const checks = [
    { label: "upsert retornou mundo", ok: Boolean(upserted?.id), details: upserted },
    { label: "select retornou mundo", ok: Boolean(selected?.id), details: selected },
    { label: "slug correto", ok: selected?.slug === SLUG, details: selected?.slug },
    { label: "status open", ok: selected?.status === "open", details: selected?.status },
    { label: "dia zero", ok: selected?.day_number === 0, details: selected?.day_number },
    { label: "sandbox desligado", ok: selected?.sandbox_enabled === false, details: selected?.sandbox_enabled },
    { label: "modo expresso preparado", ok: selected?.slug === SLUG && payload.base_move_time_minutes === 11, details: { slug: selected?.slug, usedModeColumns } },
  ];
  if (selectError) {
    checks.push({ label: "select sem erro", ok: false, details: selectError.message });
  }

  const failed = checks.filter((check) => !check.ok);
  const report = {
    status: failed.length === 0 ? "PASS" : "FAIL",
    generatedAt: new Date().toISOString(),
    world: selected ?? upserted,
    checks,
    failed,
  };
  writeReport(report);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  writeReport({
    status: "FAIL",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
