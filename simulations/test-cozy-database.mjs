import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createCozyDatabase } from "./lib/cozy-fixture.mjs";

const db = await createCozyDatabase();
let checks = 0;
async function check(name, fn) {
  await fn();
  checks++;
  console.log("PASS", name);
}
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const user = async (name) =>
  (
    await one("insert into users(username,email) values($1,$2) returning id", [
      name,
      `${name}@test.invalid`,
    ])
  ).id;
const owner = await user("owner"),
  ally = await user("ally"),
  outsider = await user("outsider");
const world = (
  await one(
    "insert into worlds(slug,name,rules_version,created_by_user_id,player_cap,join_code) values('cozy','Cozy test',2,$1,2,'KW-TEST01') returning id",
    [owner],
  )
).id;
const legacy = (
  await one(
    "insert into worlds(slug,name) values('legacy','Historic save') returning id",
  )
).id;
const call = async (fn, params) => {
  const entries = Object.entries(params);
  return (
    await one(
      `select ${fn}(${entries.map(([k], i) => `${k}=>$${i + 1}`).join(",")}) as result`,
      entries.map(([, v]) =>
        v && typeof v === "object" ? JSON.stringify(v) : v,
      ),
    )
  ).result;
};
try {
  await check('Influence migration keeps existing seasons legacy, defaults new seasons to zero and freezes their model',async()=>{
    const older=await createCozyDatabase({influenceMigration:false});
    try{
      const old=(await older.query("insert into worlds(slug,name,rules_version) values('old-cozy','Existing Cozy',2) returning id")).rows[0].id;
      const patch=await readFile(new URL('../58_SQL_COZY_ZERO_INFLUENCE.sql',import.meta.url),'utf8');await older.exec(patch);await older.exec(patch);
      assert.equal((await older.query('select influence_version from worlds where id=$1',[old])).rows[0].influence_version,1);
      const fresh=(await older.query("insert into worlds(slug,name,rules_version) values('fresh-cozy','Fresh Cozy',2) returning influence_version")).rows[0];assert.equal(fresh.influence_version,2);
      await assert.rejects(()=>older.query('update worlds set influence_version=2 where id=$1',[old]),/COZY_INFLUENCE_VERSION_IMMUTABLE/);
    }finally{await older.close();}
  });
  await check('Legacy global clock advances v1 only and leaves a running Cozy world unchanged',async()=>{
    await db.exec(`create function public.kw_tick_worlds() returns setof uuid language plpgsql security definer as $$declare w record; begin for w in select * from public.worlds where runtime_started = true loop update public.worlds set day_number=day_number+1 where id=w.id;return next w.id;end loop;end $$;`);
    await db.query('update worlds set runtime_started=true where id in ($1,$2)',[world,legacy]);
    const patch=await readFile(new URL('../57_SQL_COZY_LEGACY_CLOCK_GUARD.sql',import.meta.url),'utf8');await db.exec(patch);await db.exec(patch);
    const rows=(await db.query('select public.kw_tick_worlds() as id')).rows;assert.deepEqual(rows.map(r=>r.id),[legacy]);
    assert.equal((await one('select day_number from worlds where id=$1',[world])).day_number,0);
    assert.equal((await one('select day_number from worlds where id=$1',[legacy])).day_number,1);
    await db.exec('drop function public.kw_tick_worlds()');
  });
  await check('Global legacy schedulers keep their implementation but reject direct client execution',async()=>{
    await db.exec("create function public.kw_tick_worlds() returns text language sql security definer as $$select 'legacy-scheduler'$$;");
    const original=await one("select md5(prosrc) as hash from pg_proc where oid='public.kw_tick_worlds()'::regprocedure");
    await db.exec(await readFile(new URL('../56_SQL_COZY_SCHEDULER_HARDENING.sql',import.meta.url),'utf8'));
    const current=await one("select md5(prosrc) as hash from pg_proc where oid='public.kw_tick_worlds()'::regprocedure");assert.equal(current.hash,original.hash);
    for(const role of ['anon','authenticated']){
      await db.exec(`set role ${role}`);
      try{await assert.rejects(()=>db.query('select public.kw_tick_worlds()'),/permission denied/);}finally{await db.exec('reset role');}
    }
    await db.exec('set role service_role');try{assert.equal((await one('select public.kw_tick_worlds() as result')).result,'legacy-scheduler');}finally{await db.exec('reset role');}
  });
  await check('Legacy user schema remains compatible without bypassing existing account restrictions',async()=>{
    await db.exec('begin; alter table users drop column account_status;');
    try{
      const created=await call('kw_cozy_create',{p_user_id:owner,p_name:'Legacy user compatibility',p_mode:'normal'});assert(created.id);
      await db.exec('alter table users add column deletion_requested_at timestamptz;');
      await db.query('update users set deletion_requested_at=now() where id=$1',[owner]);
      await assert.rejects(()=>call('kw_cozy_create',{p_user_id:owner,p_name:'Unavailable account',p_mode:'normal'}),/COZY_ACCOUNT_UNAVAILABLE/);
    }finally{await db.exec('rollback');}
    await db.exec('begin');
    try{await db.query("update users set account_status='banned' where id=$1",[owner]);await assert.rejects(()=>call('kw_cozy_create',{p_user_id:owner,p_name:'Banned account',p_mode:'normal'}),/COZY_ACCOUNT_UNAVAILABLE/);}finally{await db.exec('rollback');}
  });
  await check(
    "Migration can be applied twice and retains legacy rules",
    async () => {
      await db.exec(
        await readFile(
          new URL("../55_SQL_COZY_STRATEGY.sql", import.meta.url),
          "utf8",
        ),
      );
      assert.equal(
        (await one("select rules_version from worlds where id=$1", [legacy]))
          .rules_version,
        1,
      );
      assert.deepEqual(
        (await one("select kw_world_tick($1) as result", [legacy])).result,
        { legacy: true },
      );
      assert.notDeepEqual(
        (await one("select kw_world_tick($1) as result", [world])).result,
        { legacy: true },
      );
    },
  );
  await check(
    "Direct authenticated snapshot writes and reward RPC are denied",
    async () => {
      await db.exec("set role authenticated");
      try {
        await assert.rejects(
          () => db.query("select * from kw_cozy_player_states"),
          /permission denied/,
        );
        await assert.rejects(
          () => db.query("select kw_cozy_account($1)", [owner]),
          /permission denied/,
        );
      } finally {
        await db.exec("reset role");
      }
      const { rows } = await db.query(
        "select relrowsecurity from pg_class where relname in ('kw_cozy_player_states','kw_cozy_world_states','kw_cozy_commands','kw_cozy_rewards')",
      );
      assert.equal(rows.length, 4);
      assert(rows.every((r) => r.relrowsecurity));
    },
  );
  await check(
    "World creation and creator membership commit atomically",
    async () => {
      const standard=await call('kw_cozy_create',{p_user_id:owner,p_name:'Classic schema compatibility',p_mode:'normal'});
      assert.equal((await one('select season_mode from worlds where id=$1',[standard.id])).season_mode,'classic');
      assert.equal((await one('select player_cap from worlds where id=$1',[standard.id])).player_cap,20);
      const created = await call("kw_cozy_create", {
        p_user_id: owner,
        p_name: "Atomic kingdom",
        p_mode: "express",
      });
      assert.equal(
        (
          await one(
            "select count(*)::int as n from world_players where world_id=$1 and user_id=$2",
            [created.id, owner],
          )
        ).n,
        1,
      );
      assert.equal(
        (
          await one("select rules_version from worlds where id=$1", [
            created.id,
          ])
        ).rules_version,
        2,
      );
      const before = (await one("select count(*)::int as n from worlds")).n;
      await assert.rejects(
        () =>
          call("kw_cozy_create", {
            p_user_id: owner,
            p_name: "x",
            p_mode: "normal",
          }),
        /INVALID_WORLD/,
      );
      assert.equal(
        (await one("select count(*)::int as n from worlds")).n,
        before,
      );
    },
  );
  const actor = await call("kw_cozy_join", {
    p_world_id: world,
    p_user_id: owner,
  });
  let friend;
  await check(
    "Invite and capacity checks are atomic; joining is idempotent",
    async () => {
      await assert.rejects(
        () =>
          call("kw_cozy_join", {
            p_world_id: world,
            p_user_id: ally,
            p_join_code: "WRONG",
          }),
        /INVITE_REQUIRED/,
      );
      friend = await call("kw_cozy_join", {
        p_world_id: world,
        p_user_id: ally,
        p_join_code: "KW-TEST01",
      });
      assert.equal(
        await call("kw_cozy_join", { p_world_id: world, p_user_id: owner }),
        actor,
      );
      await assert.rejects(
        () =>
          call("kw_cozy_join", {
            p_world_id: world,
            p_user_id: outsider,
            p_join_code: "KW-TEST01",
          }),
        /WORLD_FULL/,
      );
    },
  );
  await check("Only owner starts world; retries preserve clock", async () => {
    await assert.rejects(
      () => call("kw_cozy_start", { p_world_id: world, p_user_id: ally }),
      /OWNER_REQUIRED/,
    );
    await call("kw_cozy_start", { p_world_id: world, p_user_id: owner });
    const a = await one("select starts_at from worlds where id=$1", [world]);
    await call("kw_cozy_start", { p_world_id: world, p_user_id: owner });
    assert.deepEqual(
      await one("select starts_at from worlds where id=$1", [world]),
      a,
    );
  });
  const state = {
    version: 2,
    playerId: actor,
    playerName: "Owner",
    settledAt: Date.now(),
    resources: { gold: 100, materials: 100, supplies: 100 },
    portalCrossedAt: null,
    seasonXp: 100,
  };
  const commit = {
    p_world_id: world,
    p_user_id: owner,
    p_actor_player_id: actor,
    p_expected_shared_revision: -1,
    p_expected_world_status: "running",
    p_shared: { version: 2, claims: {}, deposits: { mine: { remaining: 1 } } },
    p_players: [
      { playerId: actor, expectedRevision: -1, state, influence: 100 },
    ],
    p_request_id: "request-0001",
    p_action_hash: "a".repeat(64),
  };
  await check(
    "Atomic state commit plus idempotent request receipt",
    async () => {
      assert.equal((await call("kw_cozy_commit", commit)).status, "committed");
      assert.equal((await call("kw_cozy_commit", commit)).status, "duplicate");
      assert.equal(
        (await one("select count(*)::int as n from kw_cozy_commands")).n,
        1,
      );
      await assert.rejects(
        () =>
          call("kw_cozy_commit", { ...commit, p_action_hash: "b".repeat(64) }),
        /REQUEST_REUSED/,
      );
    },
  );
  await check(
    "Stale concurrent deposit claim cannot overwrite winner",
    async () => {
      const winner = {
        ...commit,
        p_expected_shared_revision: 0,
        p_request_id: "request-0002",
        p_shared: { ...commit.p_shared, deposits: { mine: { remaining: 0 } } },
        p_players: [
          { playerId: actor, expectedRevision: 0, state, influence: 100 },
        ],
      };
      assert.equal((await call("kw_cozy_commit", winner)).status, "committed");
      const loser = {
        ...winner,
        p_user_id: ally,
        p_actor_player_id: friend,
        p_request_id: "request-0003",
        p_players: [
          {
            playerId: friend,
            expectedRevision: -1,
            state: { ...state, playerId: friend },
            influence: 100,
          },
        ],
      };
      assert.equal((await call("kw_cozy_commit", loser)).status, "conflict");
      assert.equal(
        (await one("select count(*)::int as n from kw_cozy_player_states")).n,
        1,
      );
      assert.equal(
        (await one("select state_json from kw_cozy_world_states")).state_json
          .deposits.mine.remaining,
        0,
      );
    },
  );
  await check(
    "Cross-account actor spoofing and early finalization rejected",
    async () => {
      await assert.rejects(
        () => call("kw_cozy_commit", { ...commit, p_user_id: outsider }),
        /MEMBERSHIP_REQUIRED/,
      );
      await assert.rejects(
        () =>
          call("kw_cozy_commit", {
            ...commit,
            p_expected_shared_revision: 1,
            p_request_id: null,
            p_players: [
              { playerId: actor, expectedRevision: 1, state, influence: 100 },
            ],
            p_finalize: true,
          }),
        /SEASON_NOT_FINISHED/,
      );
    },
  );
  await check(
    "Final ranking and account rewards persist exactly once",
    async () => {
      await db.query(
        "update worlds set starts_at=now()-interval '121 days',runtime_anchor_started_at=now()-interval '121 days' where id=$1",
        [world],
      );
      const final = {
        ...commit,
        p_expected_shared_revision: 1,
        p_request_id: null,
        p_players: [
          {
            playerId: actor,
            expectedRevision: 1,
            state: { ...state, portalCrossedAt: Date.now() - 86400000 },
            influence: 1800,
          },
        ],
        p_finalize: true,
      };
      assert.equal((await call("kw_cozy_commit", final)).status, "committed");
      const before = await call("kw_cozy_account", { p_user_id: owner });
      assert.equal(before.account.seals, 1);
      assert.equal(before.account.trophies, 1);
      assert.equal(before.account.seasons, 1);
      assert.equal(before.history[0].rank, 1);
      await call("kw_cozy_commit", final);
      assert.deepEqual(
        await call("kw_cozy_account", { p_user_id: owner }),
        before,
      );
    },
  );
  await check(
    "Read receipts persist after closure without changing economy, rewards or history",
    async () => {
      const before = await one(
        "select * from kw_cozy_player_states where world_player_id=$1",
        [actor],
      );
      const sharedBefore = await one(
        "select * from kw_cozy_world_states where world_id=$1",
        [world],
      );
      const accountBefore = await call("kw_cozy_account", { p_user_id: owner });
      const receipt = {
        p_world_id: world,
        p_user_id: owner,
        p_actor_player_id: actor,
        p_expected_shared_revision: sharedBefore.revision,
        p_expected_player_revision: before.revision,
        p_read_at: Date.now(),
        p_request_id: "read-final-0001",
        p_action_hash: "a".repeat(64),
      };
      await assert.rejects(
        () => call("kw_cozy_read_reports", { ...receipt, p_user_id: outsider }),
        /MEMBERSHIP_REQUIRED/,
      );
      assert.equal(
        (
          await call("kw_cozy_read_reports", {
            ...receipt,
            p_expected_shared_revision: -1,
          })
        ).status,
        "conflict",
      );
      await assert.rejects(
        () =>
          call("kw_cozy_read_reports", {
            ...receipt,
            p_read_at: Date.now() + 60_000,
          }),
        /INVALID_RECEIPT/,
      );
      await db.exec("set role authenticated");
      try {
        await assert.rejects(
          () => call("kw_cozy_read_reports", receipt),
          /permission denied/,
        );
      } finally {
        await db.exec("reset role");
      }
      assert.equal(
        (await call("kw_cozy_read_reports", receipt)).status,
        "committed",
      );
      const after = await one(
        "select * from kw_cozy_player_states where world_player_id=$1",
        [actor],
      );
      assert.deepEqual(after.state_json, {
        ...before.state_json,
        readAt: receipt.p_read_at,
      });
      assert.equal(Number(after.revision), Number(before.revision) + 1);
      const sharedAfter = await one(
        "select * from kw_cozy_world_states where world_id=$1",
        [world],
      );
      assert.equal(
        Number(sharedAfter.revision),
        Number(sharedBefore.revision) + 1,
      );
      assert.deepEqual(sharedAfter.state_json, sharedBefore.state_json);
      assert.deepEqual(
        await call("kw_cozy_account", { p_user_id: owner }),
        accountBefore,
      );
      assert.equal(
        (await one("select status from worlds where id=$1", [world])).status,
        "finalized",
      );
      assert.equal(
        (
          await call("kw_cozy_read_reports", {
            ...receipt,
            p_read_at: receipt.p_read_at + 1,
          })
        ).status,
        "duplicate",
      );
      assert.deepEqual(
        await one(
          "select * from kw_cozy_player_states where world_player_id=$1",
          [actor],
        ),
        after,
      );
      await assert.rejects(
        () =>
          call("kw_cozy_read_reports", {
            ...receipt,
            p_action_hash: "b".repeat(64),
          }),
        /REQUEST_REUSED/,
      );
    },
  );
  console.log(
    `PASS ${checks} database scenarios (local Postgres/PGlite; not remote Supabase).`,
  );
} finally {
  await db.close();
}
