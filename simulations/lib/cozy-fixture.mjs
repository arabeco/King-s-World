// Test-only Postgres fixture. Never imported by the application.
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";

export async function createCozyDatabase(options={}) {
  const db = await PGlite.create();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create type world_status as enum ('open','running','finalized');
    create type world_phase as enum ('phase_1','phase_2','closed');
    create table users(id uuid primary key default gen_random_uuid(), auth_user_id uuid unique, username text unique not null,
      email text unique not null, account_status text not null default 'active');
    create table worlds(id uuid primary key default gen_random_uuid(), slug text unique not null,name text not null,
      status world_status default 'open',phase world_phase default 'phase_1', day_number integer default 0,
      starts_at timestamptz not null default now(),phase_2_starts_at timestamptz default now()+interval '20 days',
      ends_at timestamptz default now()+interval '120 days',finalized_at timestamptz,
      registration_opens_at timestamptz default now(),player_cap integer default 25, map_width integer default 81,map_height integer default 81,
      base_move_time_minutes integer default 45,road_move_time_minutes integer default 15,
      runtime_started boolean default false,runtime_real_time_enabled boolean default false,runtime_anchor_day integer default 0,
      runtime_anchor_started_at timestamptz, sandbox_enabled boolean default false,
      season_mode text default 'classic' check(season_mode in ('classic','express')),speed_multiplier integer default 1,join_code text unique default ('KW-'||upper(substr(md5(random()::text),1,6))),
      created_by_user_id uuid references users(id),joins_closed_at timestamptz,manual_start_at timestamptz,updated_at timestamptz default now(),
      check(ends_at>phase_2_starts_at),check(phase_2_starts_at>starts_at));
    create table world_players(id uuid primary key default gen_random_uuid(),world_id uuid not null references worlds(id),
      user_id uuid not null references users(id),status text default 'alive',is_alive_cached boolean default true,is_ai boolean default false,joined_at timestamptz default now(),
      current_capital_site_id uuid,power_score_cached integer default 0,tribe_id uuid,unique(world_id,user_id));
    create function generate_world_join_code() returns text language sql as $$select 'KW-'||upper(substr(md5(random()::text),1,6))$$;
    create function kw_world_tick(uuid) returns jsonb language sql as $$select '{"legacy":true}'::jsonb$$;
    create function kw_abandoned_tick(uuid) returns jsonb language sql as $$select '{"legacy":true}'::jsonb$$;
  `);
  const migration = await readFile(
    new URL("../../55_SQL_COZY_STRATEGY.sql", import.meta.url),
    "utf8",
  );
  await db.exec(migration);
  if(options.influenceMigration!==false)await db.exec(await readFile(new URL('../../58_SQL_COZY_ZERO_INFLUENCE.sql',import.meta.url),'utf8'));
  return db;
}

const identifier = (name) => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name))
    throw new Error("Invalid test SQL identifier");
  return '"' + name + '"';
};

// Narrow PostgREST transport for exercising the real Next routes and SQL RPCs.
// It is deliberately local, ephemeral, and labelled fixture in test reports.
export async function startCozyRest(db, port = 0, auth = null) {
  const server = createServer(async (req, res) => {
    res.setHeader("content-type", "application/json");
    try {
      const url = new URL(req.url, "http://localhost");
      // Optional local Auth transport for production-mode memory QA; never imported by the app.
      if(auth&&url.pathname==='/auth/v1/user'){
        if(req.headers.authorization!==`Bearer ${auth.accessToken}`){res.writeHead(401);res.end(JSON.stringify({message:'Invalid fixture token'}));return;}
        res.end(JSON.stringify(auth.user));return;
      }
      const path = url.pathname.replace("/rest/v1/", "");
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const body = raw ? JSON.parse(raw) : null;
      let rows;
      if (path.startsWith("rpc/")) {
        const entries = Object.entries(body ?? {});
        const sql = `select public.${identifier(path.slice(4))}(${entries.map(([key], i) => `${identifier(key)} => $${i + 1}`).join(",")}) as result`;
        const result = await db.query(
          sql,
          entries.map(([, value]) =>
            typeof value === "object" && value !== null
              ? JSON.stringify(value)
              : value,
          ),
        );
        rows = result.rows[0]?.result ?? null;
      } else {
        const table = identifier(path);
        const values = [];
        const filters = [];
        for (const [key, value] of url.searchParams) {
          if (["select", "limit", "order", "on_conflict"].includes(key))
            continue;
          if (value.startsWith("eq.")) {
            values.push(value.slice(3));
            filters.push(`${identifier(key)}=$${values.length}`);
          } else if (value.startsWith("in.(")) {
            const items = value
              .slice(4, -1)
              .split(",")
              .map((v) => v.replace(/^"|"$/g, ""));
            filters.push(
              `${identifier(key)} in (${items
                .map((v) => {
                  values.push(v);
                  return "$" + values.length;
                })
                .join(",")})`,
            );
          } else throw new Error("Unsupported fixture filter");
        }
        const where = filters.length ? " where " + filters.join(" and ") : "";
        if (req.method === "GET") {
          const select = url.searchParams.get("select") ?? "*";
          const columns =
            select === "*" ? "*" : select.split(",").map(identifier).join(",");
          const limit = Math.min(
            1000,
            Math.max(1, Number(url.searchParams.get("limit") ?? 1000)),
          );
          rows = (
            await db.query(
              `select ${columns} from ${table}${where} limit ${limit}`,
              values,
            )
          ).rows;
        } else if (req.method === "POST") {
          rows = [];
          for (const row of Array.isArray(body) ? body : [body]) {
            const entries = Object.entries(row);
            const keys = entries.map(([key]) => identifier(key));
            const conflict = url.searchParams
              .get("on_conflict")
              ?.split(",")
              .map(identifier) ?? ['"id"'];
            const result = await db.query(
              `insert into ${table}(${keys.join(",")}) values(${keys.map((_, i) => "$" + (i + 1)).join(",")}) on conflict(${conflict.join(",")}) do update set ${keys.map((key) => `${key}=excluded.${key}`).join(",")} returning *`,
              entries.map(([, v]) => v),
            );
            rows.push(...result.rows);
          }
        } else if (req.method === "PATCH") {
          const set = Object.entries(body).map(([key, value]) => {
            values.push(value);
            return `${identifier(key)}=$${values.length}`;
          });
          rows = (
            await db.query(
              `update ${table} set ${set.join(",")}${where} returning *`,
              values,
            )
          ).rows;
        } else throw new Error("Unsupported fixture method");
      }
      res.statusCode = 200;
      res.end(JSON.stringify(rows));
    } catch (error) {
      res.statusCode = 400;
      res.end(
        JSON.stringify({
          code: error.code ?? "FIXTURE",
          message: error.message,
          details: null,
          hint: null,
        }),
      );
    }
  });
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
