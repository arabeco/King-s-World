import assert from "node:assert/strict";
import {loadCozyEngine} from "./lib/load-cozy-engine.mjs";
import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCozyDatabase, startCozyRest } from "./lib/cozy-fixture.mjs";
const root = fileURLToPath(new URL("..", import.meta.url));
const db = await createCozyDatabase();
for(const name of ['66_SQL_ROYAL_ATTRIBUTES.sql','67_SQL_ACCOUNT_APPEARANCE.sql','68_SQL_COLLECTION_WALLET.sql','69_SQL_KING_GAMEPLAY_PROGRESSION.sql','70_SQL_COLLECTION_SEASON_REWARDS.sql'])await db.exec(await readFile(path.join(root,name),'utf8'));

const rest = await startCozyRest(db);
const port = Number(process.env.COZY_TEST_PORT ?? 3317),
  base = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  [
    path.join(root, "node_modules/next/dist/bin/next"),
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  {
    cwd: root,
    windowsHide: true,
    env: {
      ...process.env,
      NEXT_DIST_DIR: ".next-cozy-test",
      NEXT_PUBLIC_SUPABASE_URL: rest.url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture-public",
      SUPABASE_SECRET_KEY: "fixture-service",
      SUPABASE_SERVICE_ROLE_KEY: "fixture-service",
      COZY_CRON_SECRET: "fixture-scheduler-secret-32-characters",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let log = "";
server.stdout.on("data", (b) => (log += b));
server.stderr.on("data", (b) => (log += b));
let checks = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function check(name, fn) {
  if(process.env.COZY_REWARDS_ONLY&&!name.startsWith('Season rewards v2'))return;
  if(process.env.COZY_CLOSING_ONLY&&!name.startsWith('Closing MVP'))return;
  if(process.env.COZY_COMPETITIVE_ONLY&&!name.startsWith('Competitive HTTP combat'))return;
  if(process.env.COZY_ECONOMIC_ONLY&&!name.startsWith('Economic Express through HTTP'))return;
  await fn();
  checks++;
  console.log("PASS", name);
}
async function req(url, body, who = "1", method = body ? "POST" : "GET") {
  const response = await fetch(base + url, {
    method,
    headers: {
      cookie: `kw_dev_auth=${who}`,
      "x-kw-smoke": "1",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60000),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON ${response.status} ${text.slice(0, 200)}`);
  }
  return { status: response.status, data };
}
const command = (world, action, requestId = crypto.randomUUID(), who = "1") =>
  req(`/api/worlds/${world}/cozy`, { action, requestId }, who);
// Existing long gameplay fixtures represent players who already completed the screen guides.
// The pristine kingdom below exercises real first visits without these preferences.
async function experiencedScreenGuides(surface,currentSlug){
 // These fixtures represent existing players; complete the actual coronation command
 // before testing a different screen, rather than clicking through an open modal.
 const unprepared=await db.query("select w.slug,u.id as user_id,u.username,u.email,s.state_json from kw_cozy_player_states s join worlds w on w.id=s.world_id join users u on u.id=s.user_id where s.state_json#>>'{king,profileId}' is null and w.status='running' and w.slug=$1",[currentSlug]);
 for(const row of unprepared.rows){
  const who=row.email==='afonso.dev@kingsworld.local'?'1':row.email?.endsWith('@kingsworld.local')&&row.email.startsWith('smoke_')?row.email.split('@')[0].slice(6):null;
  if(!who)continue;
  const result=await command(row.slug,{type:'king_choose',profileId:'builder',nickname:row.username.slice(0,24)},crypto.randomUUID(),who);
  assert.equal(result.status,200,JSON.stringify({response:result.data,who,fixtureUser:row.user_id,fixtureName:row.username}));
 }

 const ids=(await db.query('select id from world_players')).rows.map(row=>row.id);
 await surface.addInitScript(({ids,screens})=>{
  for(const id of ids)for(const screen of screens)localStorage.setItem(`kw-screen-help:v1:${screen}:${id}`,"seen");
 },{ids,screens:['map','infrastructure','military','government','council','achievements','city','alliance','crown','cities','resources','orders','reports','influence']});
}
const reports = path.join(root, "reports/cozy");
await mkdir(reports, { recursive: true });
// Only the disposable local database is used to move an encounter to its arrival boundary.
async function arriveGuardianFixture(slug,payload){
 const order=payload.state.orders.find(o=>o.sanctuaryPactId);assert(order);
 // Real orders arrive after their last settlement. A synthetic arrival at
 // Date.now() can equal that snapshot on a fast run and skip the shared event
 // boundary; UUID iteration order would then affect the fixture assertion.
 const at=Math.max(Date.now(),payload.state.settledAt)+25;order.arrivesAt=at;
 const pact=payload.shared.sanctuaryPacts.find(p=>p.id===order.sanctuaryPactId);
 pact.guardian.attempts.find(a=>a.orderId===order.id).arrivesAt=at;
 await db.query('update kw_cozy_player_states set state_json=$1::jsonb,revision=revision+1 where world_player_id=$2',[JSON.stringify(payload.state),payload.state.playerId]);
 await db.query('update kw_cozy_world_states set state_json=$1::jsonb,revision=revision+1 where world_id=$2',[JSON.stringify(payload.shared),payload.world.id]);
 await sleep(Math.max(0,at-Date.now()+1));
 const result=await req(`/api/worlds/${slug}/cozy`);assert.equal(result.status,200,JSON.stringify(result.data));return result.data;
}
// Active mid-season pact in the disposable database. Never changes remote data or real clocks.
async function towerRaidFixture(kind='provisions'){
 const made=await req('/api/worlds/create',{name:'Defesa das torres',mode:'normal'});assert.equal(made.status,200);
 const slug=made.data.world.slug;assert.equal((await req('/api/worlds/join',{code:made.data.world.joinCode},'second')).status,200);
 const owner=(await command(slug,{type:'start_world'})).data,guest=(await req(`/api/worlds/${slug}/cozy`,null,'second')).data;
 const players=[owner,guest],now=Date.now(),day=86400000,starts=now-15*day,completedAt=now-day;
 const tower=owner.computed.sanctuaries[1],pactId='tower-raid-fixture',group='tower-guard-fixture';
 const shared=owner.shared;
 shared.alliances=[{id:group,name:'Guarda da Torre',founderId:owner.state.playerId,members:players.map(p=>p.state.playerId),createdAt:starts}];
 shared.sanctuaryPacts=[{id:pactId,sanctuaryId:tower.id,ownerPlayerId:owner.state.playerId,allianceId:group,kind,createdAt:completedAt-3600000,completedAt,until:completedAt+7*day,contributions:{[owner.state.playerId]:kind==='provisions'?{gold:100,materials:500}:{materials:600,supplies:400}},guardian:{power:80,attempts:[]},raids:{version:1,waves:[{day:20,arrivesAt:starts+19*day,power:80,defenders:[]}]}}];
 await db.query('update worlds set starts_at=$1,runtime_anchor_started_at=$1 where id=$2',[new Date(starts).toISOString(),owner.world.id]);
 for(const payload of players){
  const state=payload.state;state.createdAt=starts;state.citySystemsAt=starts;state.settledAt=now;state.allianceId=group;state.supportSentAt=null;state.orders=[];
  state.resources={gold:5000,materials:5000,supplies:5000};state.army={militia:1000,shooters:0,scouts:0,machinery:0};state.sanctuaryVisits={[tower.id]:completedAt-1};state.cities.forEach(c=>{c.life.lastSocialDay=16;c.life.contentment=70;});
  await db.query('update kw_cozy_player_states set state_json=$1::jsonb,revision=revision+1 where world_player_id=$2',[JSON.stringify(state),state.playerId]);
 }
 await db.query('update kw_cozy_world_states set state_json=$1::jsonb,revision=revision+1 where world_id=$2',[JSON.stringify(shared),owner.world.id]);
 return {slug,worldId:owner.world.id,players,pactId,tower,group};
}
async function arriveTowerRaidFixture(f){
 const current=(await req(`/api/worlds/${f.slug}/cozy`)).data;
 const due=Date.now()-1000,day=86400000,starts=due-19*day,pact=current.shared.sanctuaryPacts.find(p=>p.id===f.pactId);
 pact.completedAt=due-2*day;pact.createdAt=pact.completedAt-3600000;pact.until=pact.completedAt+7*day;
 pact.raids.waves[0].arrivesAt=due;for(const defender of pact.raids.waves[0].defenders)defender.at=due-3600000;
 await db.query('update worlds set starts_at=$1,runtime_anchor_started_at=$1 where id=$2',[new Date(starts).toISOString(),f.worldId]);
 for(const payload of f.players){
  const state=(await db.query('select state_json from kw_cozy_player_states where world_player_id=$1',[payload.state.playerId])).rows[0].state_json;
  state.createdAt=starts;state.citySystemsAt=starts;state.settledAt=due-1000;state.hordesResolved=[];state.sanctuaryVisits={[f.tower.id]:pact.completedAt-1};
  if(state.supportSentAt!==null)state.supportSentAt=due-3600000;
  state.cities.forEach(c=>{c.life.lastSocialDay=20;});
  await db.query('update kw_cozy_player_states set state_json=$1::jsonb,revision=revision+1 where world_player_id=$2',[JSON.stringify(state),state.playerId]);
 }
 await db.query('update kw_cozy_world_states set state_json=$1::jsonb,revision=revision+1 where world_id=$2',[JSON.stringify(current.shared),f.worldId]);
 const response=await req(`/api/worlds/${f.slug}/cozy`);assert.equal(response.status,200,JSON.stringify(response.data));return response.data;
}
async function removeTowerRaidFixture(f){await db.query('delete from world_players where world_id=$1',[f.worldId]);await db.query('delete from worlds where id=$1',[f.worldId]);}
let browser;
try {
  for (let i = 0; i < 90; i++) {
    try {
      await fetch(base + "/login", { signal: AbortSignal.timeout(3000) });
      break;
    } catch {}
    if (i === 89) throw new Error("Next did not start");
    await sleep(1000);
  }
  let slug, code, snapshot, actorId;
  await check("Local auth redirects retain the incoming origin for native WebViews",async()=>{
    const response=await fetch(base+'/lobby',{redirect:'manual'});assert.equal(response.status,307);
    const destination=new URL(response.headers.get('location'),base);assert.equal(destination.origin,base);assert.equal(destination.pathname,'/login');
    const signedIn=await fetch(base+'/login',{redirect:'manual',headers:{cookie:'kw_dev_auth=1'}});
    assert.equal(signedIn.status,307);assert.equal(new URL(signedIn.headers.get('location'),base).origin,base);
    for(const method of ['GET','POST']){
      const api=await fetch(base+'/api/worlds/unknown/cozy',{method,redirect:'manual'});
      assert.equal(api.status,401);assert.equal((await api.json()).code,'UNAUTHORIZED');assert.equal(api.headers.get('location'),null);
    }
  });

  await check(
    "Create new world registers version2 and creator membership",
    async () => {
      const result = await req("/api/worlds/create", {
        name: "Jardim das Coroas",
        mode: "normal",
      });
      assert.equal(result.status, 200, JSON.stringify(result.data));
      slug = result.data.world.slug;
      code = result.data.world.joinCode;
      snapshot = (await req(`/api/worlds/${slug}/cozy`)).data;
      assert(snapshot.canStart);
      assert.equal(snapshot.state.version, 2);
      assert.equal(snapshot.world.influenceVersion,2);
      assert.equal(snapshot.state.progression.version,2);
      assert.deepEqual(snapshot.computed.influence,{infrastructure:0,government:0,military:0,society:0,legacy:0,total:0});
      assert.equal(snapshot.computed.started, false);
      actorId = snapshot.state.playerId;
      const startingResources = structuredClone(snapshot.state.resources);
      const welcomeRead = await command(slug, { type: "read_reports" });
      assert.equal(
        welcomeRead.status,
        200,
        "The welcome report can be read before the world starts",
      );
      snapshot = (await req(`/api/worlds/${slug}/cozy`)).data;
      assert.equal(snapshot.computed.unreadReports, 0);
      assert(snapshot.state.readAt > 0);
      assert.equal(snapshot.computed.started, false);
      assert.deepEqual(snapshot.state.resources, startingResources);
    },
  );
  await check(
    "Another account needs invite, cannot start, and can join before start",
    async () => {
      assert.equal(
        (await req(`/api/worlds/${slug}/cozy`, null, "second")).status,
        403,
      );
      const joined = await req("/api/worlds/join", { code }, "second");
      assert.equal(joined.status, 200, JSON.stringify(joined.data));
      assert.equal(
        (
          await command(
            slug,
            { type: "start_world" },
            crypto.randomUUID(),
            "second",
          )
        ).status,
        403,
      );
      const other = (await req(`/api/worlds/${slug}/cozy`, null, "second"))
        .data;
      assert.equal(other.players.length, 2);
    },
  );
  await check(
    "Start and server-authoritative recruitment survive reload and duplicate POST",
    async () => {
      const started = await command(slug, { type: "start_world" });
      assert.equal(started.status, 200, JSON.stringify(started.data));
      snapshot = started.data;
      const requestId = crypto.randomUUID();
      const before = snapshot.state.army.militia;
      const first = await command(
        slug,
        { type: "recruit", troop: "militia", amount: 5 },
        requestId,
      );
      assert.equal(first.status, 200, JSON.stringify(first.data));
      assert.equal(first.data.state.army.militia, before + 5);
      const repeat = await command(
        slug,
        { type: "recruit", troop: "militia", amount: 5 },
        requestId,
      );
      assert.equal(repeat.data.state.army.militia, before + 5);
      const mismatch = await command(
        slug,
        { type: "recruit", troop: "militia", amount: 1 },
        requestId,
      );
      assert.equal(mismatch.status, 409);
      snapshot = (await req(`/api/worlds/${slug}/cozy`)).data;
      assert.equal(snapshot.state.army.militia, before + 5);
    },
  );
  await check(
    "Legacy mutation routes cannot change the new season",
    async () => {
      for (const [route, method] of [
        ["attack", "POST"],
        ["imperial-state", "PUT"],
        ["runtime", "POST"],
        ["participants/ai-fill", "POST"],
      ]) {
        const result = await req(
          `/api/worlds/${slug}/${route}`,
          { materials: 999999, troops: { militia: 99999 } },
          "1",
          method,
        );
        assert.equal(result.status, 409, route + JSON.stringify(result.data));
      }
    },
  );
  await check(
    "Invalid actions and foreign origin do not alter troop counts",
    async () => {
      assert.equal(
        (await command(slug, { type: "recruit", troop: "militia", amount: -1 }))
          .status,
        422,
      );
      assert.equal(
        (await command(slug, { type: "set_resources", gold: 999999 })).status,
        422,
      );
      const response = await fetch(`${base}/api/worlds/${slug}/cozy`, {
        method: "POST",
        headers: {
          cookie: "kw_dev_auth=1",
          "Content-Type": "application/json",
          Origin: "https://elsewhere.invalid",
        },
        body: JSON.stringify({
          action: { type: "recruit", troop: "militia", amount: 1 },
          requestId: crypto.randomUUID(),
        }),
      });
      assert.equal(response.status, 403);
      assert.equal(
        (await req(`/api/worlds/${slug}/cozy`)).data.state.army.militia,
        snapshot.state.army.militia,
      );
    },
  );
  await check("Concurrent actions use CAS without lost updates", async () => {
    const before = (await req(`/api/worlds/${slug}/cozy`)).data.state.army
      .militia;
    const replies = await Promise.all([
      command(slug, { type: "recruit", troop: "militia", amount: 1 }),
      command(slug, { type: "recruit", troop: "militia", amount: 1 }),
    ]);
    for (const r of replies)
      assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(
      (await req(`/api/worlds/${slug}/cozy`)).data.state.army.militia,
      before + 2,
    );
  });
  await check(
    "Research, exploration and decree commands persist with explicit arrival times",
    async () => {
      let r = await command(slug, { type: "research", research: "military" });
      assert.equal(r.status, 200, JSON.stringify(r.data));
      assert(r.data.state.orders.some((o) => o.kind === "research"));
      const tile = r.data.tiles.find((t) => !t.revealed);
      r = await command(slug, { type: "explore", q: tile.q, r: tile.r });
      assert.equal(r.status, 200, JSON.stringify(r.data));
      assert(r.data.state.orders.some((o) => o.kind === "explore"));
      const decree = r.data.computed.decree;
      r = await command(slug, {
        type: "decree",
        decreeId: decree.id,
        optionId: decree.options[0].id,
      });
      assert.equal(r.status, 200);
      assert.equal(r.data.computed.decree, null);
    },
  );
  await check("Area reserve persists after annexation, retry and exhaustion",async()=>{
    const f=(await req(`/api/worlds/${slug}/cozy`)).data,oldState=structuredClone(f.state),oldShared=structuredClone(f.shared);
    const cellsFor=t=>{const q0=Math.floor((t.q+40)/8)*8-40,r0=Math.floor((t.r+40)/8)*8-40,ids=[];for(let q=q0;q<q0+8&&q<=40;q++)for(let r=r0;r<r0+8&&r<=40;r++)ids.push(`${q},${r}`);return ids;};
    const t=f.tiles.find(t=>t.clue.includes('brilho')&&cellsFor(t).every(id=>!f.shared.claims[id]||f.shared.claims[id].playerId===actorId));assert(t);
    const id=`gold:${Math.floor((t.q+40)/8)}:${Math.floor((t.r+40)/8)}`;
    f.state.explored=[...new Set([...f.state.explored,t.id])];
    f.shared.areas??={};f.shared.territories??={};f.shared.areas[id]={id,resource:'gold',cells:cellsFor(t),owners:[],annexedAt:null,reserve:{id,resource:'gold',capacity:200,remaining:200,surveys:3,contributors:[actorId]}};
    try{
      await db.query("update kw_cozy_player_states set state_json=$1::jsonb,revision=revision+1 where world_player_id=$2",[JSON.stringify(f.state),actorId]);
      await db.query("update kw_cozy_world_states set state_json=$1::jsonb,revision=revision+1 where world_id=$2",[JSON.stringify(f.shared),f.world.id]);
      const requestId=crypto.randomUUID(),action={type:'area_annex',q:t.q,r:t.r};
      const annex=await command(slug,action,requestId);assert.equal(annex.status,200,JSON.stringify(annex.data));
      const duplicate=await command(slug,action,requestId);assert.equal(duplicate.status,200);assert.equal(duplicate.data.shared.areas[id].owners.length,1);
      const land=structuredClone(annex.data.shared.territories);
      const collect=await command(slug,{type:'collect',q:t.q,r:t.r});assert.equal(collect.status,200,JSON.stringify(collect.data));
      assert.equal(collect.data.shared.areas[id].reserve.remaining,0);assert.deepEqual(collect.data.shared.territories,land);
      assert.equal(collect.data.state.orders.find(o=>o.kind==='collect').collectAmount,200);
      const reload=(await req(`/api/worlds/${slug}/cozy`)).data;assert.equal(reload.shared.areas[id].reserve.remaining,0);assert.deepEqual(reload.shared.territories,land);
    }finally{
      await db.query("update kw_cozy_player_states set state_json=$1::jsonb,revision=revision+1 where world_player_id=$2",[JSON.stringify(oldState),actorId]);
      await db.query("update kw_cozy_world_states set state_json=$1::jsonb,revision=revision+1 where world_id=$2",[JSON.stringify(oldShared),f.world.id]);
    }
  });
  await check("Offline city separation commits ownership, hero and independent city together",async()=>{
    const created=await req('/api/worlds/create',{name:'Crise local de teste',mode:'normal'});assert.equal(created.status,200,JSON.stringify(created.data));
    const testSlug=created.data.world.slug;let f;
    try{
      const start=await command(testSlug,{type:'start_world'});assert.equal(start.status,200);f=start.data;
      const past=Date.now()-8*86400000,capital=f.state.cities[0];
      f.state.createdAt=past;f.state.citySystemsAt=past;f.state.settledAt=past;capital.life={contentment:70,lastDecisionDay:null,lastSocialDay:1,unrestDays:0};
      const colony={...structuredClone(capital),id:'api-crisis-city',name:'Cidade em ruptura',q:capital.q+4,capital:false,heroId:'api-city-hero',life:{contentment:20,lastDecisionDay:null,lastSocialDay:1,unrestDays:0}};
      f.state.cities.push(colony);f.state.heroes.push({id:'api-city-hero',name:'Guardião',role:'administrator',cityId:colony.id});
      const capitalLand=`${capital.q+1},${capital.r}`,colonyLand=`${colony.q+1},${colony.r}`;
      f.shared.claims[`${colony.q},${colony.r}`]={playerId:f.state.playerId,cityId:colony.id,name:colony.name};
      f.shared.territories={...(f.shared.territories??{}),[capitalLand]:f.state.playerId,[colonyLand]:f.state.playerId};
      f.shared.territoryCities={...(f.shared.territoryCities??{}),[capitalLand]:{playerId:f.state.playerId,cityId:capital.id},[colonyLand]:{playerId:f.state.playerId,cityId:colony.id}};
      f.shared.areas={...(f.shared.areas??{}),territoryRelease:{id:'territoryRelease',resource:'materials',cells:[colonyLand],owners:[f.state.playerId],ownerCities:{[f.state.playerId]:colony.id},annexedAt:past,reserve:{id:'territoryRelease',resource:'materials',capacity:100,remaining:37,surveys:3,contributors:[f.state.playerId]}}};
      await db.query('update kw_cozy_world_states set state_json=$1::jsonb,revision=revision+1 where world_id=$2',[JSON.stringify(f.shared),f.world.id]);

      await db.query("update worlds set starts_at=$1,runtime_anchor_started_at=$1 where id=$2",[new Date(past).toISOString(),f.world.id]);
      await db.query("update kw_cozy_player_states set state_json=$1::jsonb,revision=revision+1 where world_player_id=$2",[JSON.stringify(f.state),f.state.playerId]);
      const response=await req(`/api/worlds/${testSlug}/cozy`);assert.equal(response.status,200,JSON.stringify(response.data));const saved=response.data,id=`${colony.q},${colony.r}`;
      assert.equal(saved.state.cities.length,1);assert.equal(saved.shared.claims[id],undefined);assert.equal(saved.shared.independentCities[id].city.name,colony.name);assert.equal(saved.state.heroes[0].cityId,null);
      assert(saved.state.reports.some(r=>r.title.includes('se tornou independente')));
      assert.equal(saved.shared.territories[colonyLand],undefined);assert.equal(saved.shared.territories[capitalLand],f.state.playerId);assert(saved.shared.independentCities[id].territory.includes(colonyLand));assert(saved.state.knownTerritories.includes(colonyLand));assert.deepEqual(saved.shared.areas.territoryRelease.owners,[]);assert.equal(saved.shared.areas.territoryRelease.reserve.remaining,37);

      const again=(await req(`/api/worlds/${testSlug}/cozy`)).data;assert.equal(again.shared.territories[colonyLand],undefined);assert.equal(again.shared.territories[capitalLand],f.state.playerId);assert.equal(again.shared.areas.territoryRelease.reserve.remaining,37);assert(again.state.knownTerritories.includes(colonyLand));assert.equal(again.state.cities.length,1);assert.equal(again.shared.claims[id],undefined);assert.equal(again.shared.independentCities[id].at,saved.shared.independentCities[id].at);
    }finally{if(f){await db.query('delete from world_players where world_id=$1',[f.world.id]);await db.query('delete from worlds where id=$1',[f.world.id]);}}
  });
  await check('A surviving city loses building levels, infrastructure and production after a real horde, once across reload',async()=>{
    const created=await req('/api/worlds/create',{name:'Dano estrutural',mode:'express'});assert.equal(created.status,200);const slug=created.data.world.slug;let f;
    try{
      const started=await command(slug,{type:'start_world'});assert.equal(started.status,200);f=started.data;const E=loadCozyEngine(),firstDay=f.computed.nextHorde.day;
      const past=Date.now()-(firstDay-1)*f.computed.dayMs-1000,city=f.state.cities[0];f.state.createdAt=past;f.state.citySystemsAt=past;f.state.settledAt=past;city.sectors={administration:10,economy:10,society:10,recruitment:10,defense:0};city.life={contentment:70,lastDecisionDay:null,lastSocialDay:1,unrestDays:0};f.state.army={militia:0,shooters:0,scouts:0,machinery:0};
      const before=E.getCozyComputed(f.state,f.shared,{...f.world,startsAt:past},past);
      await db.query('update worlds set starts_at=$1,runtime_anchor_started_at=$1 where id=$2',[new Date(past).toISOString(),f.world.id]);await db.query('update kw_cozy_player_states set state_json=$1::jsonb,revision=revision+1 where world_player_id=$2',[JSON.stringify(f.state),f.state.playerId]);
      const response=await req(`/api/worlds/${slug}/cozy`);assert.equal(response.status,200,JSON.stringify(response.data));const saved=response.data,hit=saved.state.cities[0];assert.equal(saved.state.cities.length,1);assert.equal(hit.integrity,75);assert.equal(Object.values(hit.sectors).reduce((sum,v)=>sum+v,0),37);assert(saved.computed.influence.infrastructure<before.influence.infrastructure);assert.equal(saved.computed.influence.infrastructure,saved.computed.influenceDetails.cities[hit.id]);assert(saved.computed.productionPerDay.materials<before.productionPerDay.materials);assert(saved.state.reports.some(r=>r.kind==='horde'&&r.body.includes('→')));
      const reread=(await req(`/api/worlds/${slug}/cozy`)).data;assert.deepEqual(reread.state.cities[0].sectors,hit.sectors);assert.equal(reread.computed.influence.infrastructure,saved.computed.influence.infrastructure);assert.equal(reread.state.cities[0].integrity,75);
    }finally{if(f){await db.query('delete from world_players where world_id=$1',[f.world.id]);await db.query('delete from worlds where id=$1',[f.world.id]);}}
  });
  await check('Resolved support persists once for both player orders and mismatched progression is rejected',async()=>{
    for(const reverse of [false,true]){
      const created=await req('/api/worlds/create',{name:'Apoio reconhecido',mode:'normal'});assert.equal(created.status,200);
      const testSlug=created.data.world.slug;let f;
      try{
        assert.equal((await req('/api/worlds/join',{code:created.data.world.joinCode},'second')).status,200);
        f=(await command(testSlug,{type:'start_world'})).data;
        const g=(await req(`/api/worlds/${testSlug}/cozy`,null,'second')).data;
        const players=[f,g].sort((a,b)=>a.state.playerId.localeCompare(b.state.playerId));
        const supporter=players[reverse?1:0],recipient=players[reverse?0:1],wave=Date.now()-1000,past=wave-19*86400000;
        const shared=f.shared;
        shared.support=[{id:'used-once',allianceId:'test-alliance',requesterId:recipient.state.playerId,supporterId:supporter.state.playerId,waveDay:20,arrivesAt:wave,requestedAt:wave-2000,acceptedAt:wave-1500,power:100}];
        await db.query('update worlds set starts_at=$1,runtime_anchor_started_at=$1 where id=$2',[new Date(past).toISOString(),f.world.id]);
        for(const v of players){
          v.state.createdAt=past;v.state.citySystemsAt=past;v.state.settledAt=wave-1000;v.state.hordesResolved=[];
          for(const c of v.state.cities)c.life.lastSocialDay=20;
          await db.query('update kw_cozy_player_states set state_json=$1::jsonb,revision=revision+1 where world_player_id=$2',[JSON.stringify(v.state),v.state.playerId]);
        }
        await db.query('update kw_cozy_world_states set state_json=$1::jsonb,revision=revision+1 where world_id=$2',[JSON.stringify(shared),f.world.id]);
        const first=await req(`/api/worlds/${testSlug}/cozy`);assert.equal(first.status,200,JSON.stringify(first.data));
        const stored=(await db.query('select state_json from kw_cozy_player_states where world_player_id=$1',[supporter.state.playerId])).rows[0].state_json;
        assert.deepEqual(stored.progression.feats.supports,['used-once']);
        await req(`/api/worlds/${testSlug}/cozy`,null,'second');
        const again=(await db.query('select state_json from kw_cozy_player_states where world_player_id=$1',[supporter.state.playerId])).rows[0].state_json;
        assert.deepEqual(again.progression.feats.supports,['used-once']);
        const original=first.data.state;const invalid=structuredClone(original);delete invalid.progression;
        await db.query('update kw_cozy_player_states set state_json=$1::jsonb where world_player_id=$2',[JSON.stringify(invalid),original.playerId]);
        const rejected=await req(`/api/worlds/${testSlug}/cozy`);assert.equal(rejected.status,409);assert.equal(rejected.data.code,'INFLUENCE_VERSION_MISMATCH');
        const untouched=(await db.query('select state_json from kw_cozy_player_states where world_player_id=$1',[original.playerId])).rows[0].state_json;
        assert.equal(untouched.progression,undefined,'A mismatched save cannot be silently rebuilt');
      }finally{if(f){await db.query('delete from world_players where world_id=$1',[f.world.id]);await db.query('delete from worlds where id=$1',[f.world.id]);}}
    }
  });
  await check('Alliance approvals, contributions and atomic shared project rewards persist through the API',async()=>{
    const created=await req('/api/worlds/create',{name:'Projetos de cinco reinos',mode:'normal'});assert.equal(created.status,200);
    const testSlug=created.data.world.slug;let f;
    try{
      assert.equal((await req('/api/worlds/join',{code:created.data.world.joinCode},'second')).status,200);
      f=(await command(testSlug,{type:'start_world'})).data;
      let g=(await req(`/api/worlds/${testSlug}/cozy`,null,'second')).data;
      const group=(await command(testSlug,{type:'alliance_create',name:'Pacto dos Rios'})).data.state.allianceId;
      assert.equal((await command(testSlug,{type:'alliance_settings',admission:'approval'})).status,200);
      assert.equal((await command(testSlug,{type:'alliance_join',allianceId:group},crypto.randomUUID(),'second')).status,422);
      assert.equal((await command(testSlug,{type:'alliance_request',allianceId:group},crypto.randomUUID(),'second')).status,200);
      assert.equal((await command(testSlug,{type:'alliance_respond',playerId:g.state.playerId,accept:true})).status,200);
      assert.equal((await req(`/api/worlds/${testSlug}/cozy`,null,'second')).data.state.allianceId,null);
      assert.equal((await command(testSlug,{type:'alliance_join',allianceId:group},crypto.randomUUID(),'second')).status,200);
      assert.equal((await command(testSlug,{type:'alliance_project_start',kind:'defense'},crypto.randomUUID(),'second')).status,422);
      for(const state of [f.state,g.state]){
        const current=(await db.query('select state_json from kw_cozy_player_states where world_player_id=$1',[state.playerId])).rows[0].state_json;
        current.resources={gold:2000,materials:2000,supplies:2000};
        await db.query('update kw_cozy_player_states set state_json=$1::jsonb,revision=revision+1 where world_player_id=$2',[JSON.stringify(current),state.playerId]);
      }
      const started=await command(testSlug,{type:'alliance_project_start',kind:'defense'});assert.equal(started.status,200);
      const project=started.data.shared.allianceProjects[0],receipt=crypto.randomUUID(),donation={type:'alliance_project_contribute',projectId:project.id,resource:'materials',amount:100};
      const duplicated=await Promise.all([command(testSlug,donation,receipt,'second'),command(testSlug,donation,receipt,'second')]);assert(duplicated.every(r=>r.status===200),JSON.stringify(duplicated));
      let saved=(await req(`/api/worlds/${testSlug}/cozy`)).data;
      assert.equal(saved.shared.allianceProjects[0].contributions[g.state.playerId].materials,100);
      assert.equal((await command(testSlug,{...donation,amount:'max'},crypto.randomUUID(),'second')).status,200);
      const funded=await command(testSlug,{type:'alliance_project_contribute',projectId:project.id,resource:'supplies',amount:'max'});assert.equal(funded.status,200);
      assert(funded.data.computed.allianceDefenseBonus>0);
      const stored=(await db.query('select state_json from kw_cozy_player_states where world_player_id=$1',[g.state.playerId])).rows[0].state_json;
      assert.deepEqual(stored.progression.feats.projects,[project.id],'Every contributor is recognized in the same committed snapshot');
      assert.equal(stored.allianceProjectReceipts[project.id],'completed');
      const retry=await command(testSlug,{type:'alliance_project_contribute',projectId:project.id,resource:'supplies',amount:50});assert.equal(retry.status,422);
      saved=(await req(`/api/worlds/${testSlug}/cozy`,null,'second')).data;assert.equal(saved.computed.influenceDetails.conquests.projects,1);assert.equal(saved.computed.influenceDetails.conquests.cooperation,0);
    }finally{if(f){await db.query('delete from world_players where world_id=$1',[f.world.id]);await db.query('delete from worlds where id=$1',[f.world.id]);}}
  });
  if(process.env.COZY_SKIP_BROWSER!=="1")await check('Two mobile players invite, decline, request approval and accept through Crown alerts',async()=>{
    const created=await req('/api/worlds/create',{name:'Convites no celular',mode:'normal'});assert.equal(created.status,200);
    const testSlug=created.data.world.slug;let f;
    try{
      assert.equal((await req('/api/worlds/join',{code:created.data.world.joinCode},'second')).status,200);
      f=(await command(testSlug,{type:'start_world'})).data;
      const group=(await command(testSlug,{type:'alliance_create',name:'Pacto dos Cedros'})).data.state.allianceId;
      const {chromium}=await import('playwright');browser=await chromium.launch({headless:true});
      const ownerContext=await browser.newContext({viewport:{width:360,height:640}}),guestContext=await browser.newContext({viewport:{width:360,height:640},extraHTTPHeaders:{'x-kw-smoke':'1'}});
      await ownerContext.addCookies([{name:'kw_dev_auth',value:'1',url:base}]);await guestContext.addCookies([{name:'kw_dev_auth',value:'second',url:base}]);
      await experiencedScreenGuides(ownerContext,testSlug);await experiencedScreenGuides(guestContext,testSlug);
      const owner=await ownerContext.newPage(),guest=await guestContext.newPage(),url=`${base}/world/${testSlug}/intelligence`;
      await owner.goto(url,{waitUntil:'networkidle'});await owner.getByRole('navigation',{name:'Áreas do reino'}).getByRole('button',{name:'Aliança',exact:true}).click();
      await owner.getByRole('tab',{name:'Membros',exact:true}).click();
      await owner.getByLabel('Entrada na aliança',{exact:true}).selectOption('approval');
      await owner.waitForFunction(()=>document.querySelector('#alliance-admission')?.value==='approval');
      await owner.getByRole('button',{name:/^Convidar /}).click();await owner.getByText('Convite enviado',{exact:true}).waitFor();
      await guest.goto(url,{waitUntil:'networkidle'});const invited=guest.getByRole('button',{name:'Aliança: 1 convite de aliança',exact:true});await invited.waitFor();
      assert.equal(await guest.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
      await guest.getByRole('button',{name:'Ordens do reino: Sem ordens',exact:true}).waitFor();
      await guest.screenshot({path:path.join(reports,'mobile-alliance-invitation-crown-360.png')});
      await invited.click();await guest.getByRole('button',{name:'Recusar convite de Pacto dos Cedros',exact:true}).click();
      await guest.getByRole('button',{name:'Buscar aliança',exact:true}).click();
      await guest.getByRole('button',{name:'Pedir entrada em Pacto dos Cedros',exact:true}).click();await guest.getByText('Pedido enviado. Aguardando o líder.',{exact:true}).waitFor();
      await owner.reload({waitUntil:'networkidle'});await owner.getByRole('button',{name:'Aliança: 1 pedido de entrada',exact:true}).click();
      await owner.getByRole('tab',{name:/^Membros/}).click();await owner.getByRole('region',{name:'Pedidos de entrada',exact:true}).getByRole('button',{name:/^Aprovar /}).click();
      const beforeAccept=(await req(`/api/worlds/${testSlug}/cozy`,null,'second')).data;assert.equal(beforeAccept.state.allianceId,null);
      await guest.reload({waitUntil:'networkidle'});await guest.getByRole('button',{name:'Aliança: 1 convite de aliança',exact:true}).click();
      await guest.getByRole('button',{name:'Aceitar convite de Pacto dos Cedros',exact:true}).click();await guest.getByRole('heading',{name:'Pedidos de apoio',exact:true}).waitFor();
      const accepted=(await req(`/api/worlds/${testSlug}/cozy`,null,'second')).data;assert.equal(accepted.state.allianceId,group);assert.equal(accepted.shared.alliances[0].members.length,2);
      await guest.getByRole('tab',{name:'Membros',exact:true}).click();await guest.screenshot({path:path.join(reports,'mobile-alliance-members-360.png')});
      assert.equal(await guest.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    }finally{
      if(browser){await browser.close();browser=null;}
      if(f){await db.query('delete from world_players where world_id=$1',[f.world.id]);await db.query('delete from worlds where id=$1',[f.world.id]);}
    }
  });
  await check('Tower recognition persists on arrival and duplicate receipts never spend twice or award influence',async()=>{
    const created=await req('/api/worlds/create',{name:'Torres do mundo',mode:'normal'});assert.equal(created.status,200);
    const testSlug=created.data.world.slug;let f;
    try{
      f=(await command(testSlug,{type:'start_world'})).data;
      const tower=[...f.computed.sanctuaries].sort((a,b)=>a.supplyCost-b.supplyCost)[0];
      const action={type:'sanctuary_explore',sanctuaryId:tower.id},receipt=crypto.randomUUID();
      const sent=await command(testSlug,action,receipt);assert.equal(sent.status,200,JSON.stringify(sent.data));
      assert(Math.abs(sent.data.state.resources.supplies-(f.state.resources.supplies-tower.supplyCost))<1);
      const duplicate=await command(testSlug,action,receipt);assert.equal(duplicate.status,200);
      assert.equal(duplicate.data.state.orders.filter(o=>o.sanctuaryId===tower.id).length,1);
      assert(Math.abs(duplicate.data.state.resources.supplies-sent.data.state.resources.supplies)<1);
      const before=duplicate.data,at=Date.now();before.state.orders.find(o=>o.sanctuaryId===tower.id).arrivesAt=at;
      await db.query('update kw_cozy_player_states set state_json=$1::jsonb,revision=revision+1 where world_player_id=$2',[JSON.stringify(before.state),before.state.playerId]);
      const done=(await req(`/api/worlds/${testSlug}/cozy`)).data;
      assert.equal(done.state.sanctuaryVisits[tower.id],at);assert.deepEqual(done.state.explored,f.state.explored);
      assert.equal(done.computed.influence.legacy,f.computed.influence.legacy);
      const reloaded=(await req(`/api/worlds/${testSlug}/cozy`)).data;assert.equal(reloaded.state.sanctuaryVisits[tower.id],at);
      assert.equal(reloaded.state.reports.filter(r=>r.title==='Torre reconhecida').length,1);
      assert.equal((await command(testSlug,action)).status,422);
    }finally{if(f){await db.query('delete from world_players where world_id=$1',[f.world.id]);await db.query('delete from worlds where id=$1',[f.world.id]);}}
  });
  await check('Shared tower funding commits all contributors, rejects duplicate spending and drops the benefit on departure',async()=>{
    const created=await req('/api/worlds/create',{name:'Sintonia conjunta',mode:'normal'});assert.equal(created.status,200);const testSlug=created.data.world.slug;let f;
    try{
      assert.equal((await req('/api/worlds/join',{code:created.data.world.joinCode},'second')).status,200);
      f=(await command(testSlug,{type:'start_world'})).data;
      const group=(await command(testSlug,{type:'alliance_create',name:'Guardiões da torre'})).data.state.allianceId;
      assert.equal((await command(testSlug,{type:'alliance_join',allianceId:group},undefined,'second')).status,200);
      const actor=(await req(`/api/worlds/${testSlug}/cozy`)).data,other=(await req(`/api/worlds/${testSlug}/cozy`,null,'second')).data;
      const tower=actor.computed.sanctuaries[1];
      for(const payload of [actor,other]){payload.state.sanctuaryVisits={[tower.id]:Date.now()};payload.state.resources={gold:5000,materials:5000,supplies:5000};payload.state.army={militia:250,shooters:0,scouts:0,machinery:0};await db.query('update kw_cozy_player_states set state_json=$1::jsonb,revision=revision+1 where world_player_id=$2',[JSON.stringify(payload.state),payload.state.playerId]);}
      const started=await command(testSlug,{type:'sanctuary_pact_start',sanctuaryId:tower.id,kind:'defense',scope:'alliance'});assert.equal(started.status,200,JSON.stringify(started.data));const pact=started.data.shared.sanctuaryPacts.at(-1),receipt=crypto.randomUUID();
      const action={type:'sanctuary_pact_contribute',pactId:pact.id,resource:'materials',amount:100};
      const duplicate=await Promise.all([command(testSlug,action,receipt,'second'),command(testSlug,action,receipt,'second')]);for(const result of duplicate)assert.equal(result.status,200,JSON.stringify(result.data));
      const once=(await req(`/api/worlds/${testSlug}/cozy`)).data.shared.sanctuaryPacts.find(p=>p.id===pact.id);assert.equal(once.contributions[other.state.playerId].materials,100);
      assert.equal((await command(testSlug,{type:'sanctuary_pact_contribute',pactId:pact.id,resource:'materials',amount:'max'})).status,200);
      const completed=await command(testSlug,{type:'sanctuary_pact_contribute',pactId:pact.id,resource:'supplies',amount:'max'});assert.equal(completed.status,200,JSON.stringify(completed.data));
      assert.equal(completed.data.shared.sanctuaryPacts.find(p=>p.id===pact.id).completedAt,null,'Funding alone cannot activate new guarded pacts');
      const challengeId=crypto.randomUUID(),challenge={type:'sanctuary_pact_challenge',pactId:pact.id};
      const challenged=await command(testSlug,challenge,challengeId);assert.equal(challenged.status,200,JSON.stringify(challenged.data));
      const replay=await command(testSlug,challenge,challengeId);assert.equal(replay.status,200);assert.equal(replay.data.state.orders.filter(o=>o.sanctuaryPactId===pact.id).length,1);
      const victory=await arriveGuardianFixture(testSlug,replay.data);assert.equal(victory.shared.sanctuaryPacts.find(p=>p.id===pact.id).guardian.attempts[0].outcome,'won');
      const stored=(await db.query('select state_json from kw_cozy_player_states where world_player_id=$1',[other.state.playerId])).rows[0].state_json;
      assert.equal(stored.sanctuaryPactReceipts[pact.id],'completed');assert(stored.sanctuaryBenefits.some(b=>b.pactId===pact.id));
      const benefited=(await req(`/api/worlds/${testSlug}/cozy`,null,'second')).data;assert.equal(benefited.computed.sanctuaryBonuses.defense,.1);assert.equal(benefited.computed.influence.legacy,0);
      const left=(await command(testSlug,{type:'alliance_leave'},undefined,'second')).data;assert.equal(left.computed.sanctuaryBonuses.defense,0);assert.equal(left.state.sanctuaryPactReceipts[pact.id],'completed');
      const personal=(await command(testSlug,{type:'sanctuary_pact_start',sanctuaryId:tower.id,kind:'provisions',scope:'solo'})).data.shared.sanctuaryPacts.at(-1);
      const reserved=(await command(testSlug,{type:'sanctuary_pact_contribute',pactId:personal.id,resource:'materials',amount:100})).data;
      const cancelId=crypto.randomUUID(),cancel={type:'sanctuary_pact_cancel',pactId:personal.id};
      const canceled=(await command(testSlug,cancel,cancelId)).data,repeated=(await command(testSlug,cancel,cancelId)).data;
      assert.equal(canceled.state.sanctuaryPactReceipts[personal.id],'refunded');assert(Math.abs(canceled.state.resources.materials-reserved.state.resources.materials-100)<1);assert(Math.abs(repeated.state.resources.materials-canceled.state.resources.materials)<1);
    }finally{if(f){await db.query('delete from world_players where world_id=$1',[f.world.id]);await db.query('delete from worlds where id=$1',[f.world.id]);}}
  });
  await check('Guardian arrival precedes a simultaneous horde for every contributor, independently of player sort order',async()=>{
    for(const reverse of [false,true]){
      const created=await req('/api/worlds/create',{name:'Guarda simultânea',mode:'normal'});assert.equal(created.status,200);const testSlug=created.data.world.slug;let f;
      try{
        assert.equal((await req('/api/worlds/join',{code:created.data.world.joinCode},'second')).status,200);
        f=(await command(testSlug,{type:'start_world'})).data;const g=(await req(`/api/worlds/${testSlug}/cozy`,null,'second')).data;
        const players=[f,g].sort((a,b)=>a.state.playerId.localeCompare(b.state.playerId)),champion=players[reverse?1:0],recipient=players[reverse?0:1],wave=Date.now()-1000,past=wave-19*86400000;
        const tower=f.computed.sanctuaries[1],id='boundary-pact',orderId='boundary-guardian',group='guardian-group';
        const shared=f.shared;shared.alliances=[{id:group,name:'Guarda',founderId:champion.state.playerId,members:players.map(p=>p.state.playerId),createdAt:past}];
        shared.sanctuaryPacts=[{id,sanctuaryId:tower.id,ownerPlayerId:champion.state.playerId,allianceId:group,kind:'defense',createdAt:past,contributions:{[champion.state.playerId]:{materials:600,supplies:400}},completedAt:null,until:null,guardian:{power:80,attempts:[{orderId,playerId:champion.state.playerId,arrivesAt:wave}]}}];
        await db.query('update worlds set starts_at=$1,runtime_anchor_started_at=$1 where id=$2',[new Date(past).toISOString(),f.world.id]);
        for(const payload of players){
          const actor=payload.state.playerId===champion.state.playerId;
          payload.state.createdAt=past;payload.state.citySystemsAt=past;payload.state.settledAt=wave-1000;payload.state.allianceId=group;payload.state.sanctuaryVisits={[tower.id]:past};payload.state.hordesResolved=[];
          payload.state.army={militia:actor?250:3,shooters:0,scouts:0,machinery:0};payload.state.cities[0].sectors.defense=actor?1:4;payload.state.cities[0].life.lastSocialDay=20;
          payload.state.orders=actor?[{id:orderId,kind:'attack',sanctuaryPactId:id,q:tower.q,r:tower.r,createdAt:wave-3600000,arrivesAt:wave}]:[];
          await db.query('update kw_cozy_player_states set state_json=$1::jsonb,revision=revision+1 where world_player_id=$2',[JSON.stringify(payload.state),payload.state.playerId]);
        }
        await db.query('update kw_cozy_world_states set state_json=$1::jsonb,revision=revision+1 where world_id=$2',[JSON.stringify(shared),f.world.id]);
        const response=await req(`/api/worlds/${testSlug}/cozy`);assert.equal(response.status,200,JSON.stringify(response.data));
        const saved=(await db.query('select state_json from kw_cozy_player_states where world_player_id=$1',[recipient.state.playerId])).rows[0].state_json;
        assert.equal(saved.hordesWon,1,'75 base defense requires the just-activated 10% tower benefit to beat 80');assert.equal(saved.cities[0].integrity??100,100);
        const reread=(await req(`/api/worlds/${testSlug}/cozy`)).data;assert.equal(reread.shared.sanctuaryPacts[0].completedAt,wave);
      }finally{if(f){await db.query('delete from world_players where world_id=$1',[f.world.id]);await db.query('delete from worlds where id=$1',[f.world.id]);}}
    }
  });
  await check('Tower defense receipts are atomic, preserve departed support and settle all recipients exactly once',async()=>{
    const f=await towerRaidFixture();
    try{
      const before=(await req(`/api/worlds/${f.slug}/cozy`)).data;
      const action={type:'sanctuary_pact_defend',pactId:f.pactId,waveDay:20,power:999999},receipt=crypto.randomUUID();
      const responses=await Promise.all([command(f.slug,action,receipt),command(f.slug,action,receipt)]);for(const r of responses)assert.equal(r.status,200,JSON.stringify(r.data));
      const after=(await req(`/api/worlds/${f.slug}/cozy`)).data,wave=after.shared.sanctuaryPacts[0].raids.waves[0];
      assert.equal(wave.defenders.length,1);assert.equal(wave.defenders[0].power,before.computed.supportOffer);assert.equal(after.state.resources.gold,before.state.resources.gold);assert.equal(after.state.cooperation,before.state.cooperation);
      assert.equal((await command(f.slug,{type:'sanctuary_pact_defend',pactId:f.pactId,waveDay:20},crypto.randomUUID(),'second')).status,200);
      assert.equal((await command(f.slug,{type:'alliance_leave'},crypto.randomUUID(),'second')).status,200);
      const arrived=await arriveTowerRaidFixture(f);assert.equal(arrived.shared.sanctuaryPacts[0].raids.waves[0].outcome,'won');
      const guest=(await req(`/api/worlds/${f.slug}/cozy`,null,'second')).data;assert.equal(guest.computed.sanctuaryBonuses.provisions,0);assert.equal(guest.state.reports.filter(r=>r.title==='Torre protegida').length,1);assert.equal(guest.state.progression.feats.supports.length,0);
      const again=(await req(`/api/worlds/${f.slug}/cozy`)).data;assert.equal(again.state.sanctuaryRaidReceipts.length,1);assert.equal(again.state.reports.filter(r=>r.title==='Torre protegida').length,1);
    }finally{await removeTowerRaidFixture(f);}
  });
  await check('A tower defeat removes the defense buff before every simultaneous realm horde regardless of owner sort order',async()=>{
    for(const reverse of [false,true]){
      const f=await towerRaidFixture('defense');
      try{
        const shared=(await req(`/api/worlds/${f.slug}/cozy`)).data.shared,sorted=[...f.players].sort((a,b)=>a.state.playerId.localeCompare(b.state.playerId));
        shared.sanctuaryPacts[0].ownerPlayerId=sorted[reverse?1:0].state.playerId;
        await db.query('update kw_cozy_world_states set state_json=$1::jsonb,revision=revision+1 where world_id=$2',[JSON.stringify(shared),f.worldId]);
        for(const payload of sorted){
          const state=(await db.query('select state_json from kw_cozy_player_states where world_player_id=$1',[payload.state.playerId])).rows[0].state_json;
          state.army={militia:3,shooters:0,scouts:0,machinery:0};state.cities[0].sectors.defense=4;
          await db.query('update kw_cozy_player_states set state_json=$1::jsonb,revision=revision+1 where world_player_id=$2',[JSON.stringify(state),state.playerId]);
        }
        const arrived=await arriveTowerRaidFixture(f);assert.equal(arrived.shared.sanctuaryPacts[0].raids.waves[0].outcome,'lost');
        for(const payload of sorted){
          const state=(await db.query('select state_json from kw_cozy_player_states where world_player_id=$1',[payload.state.playerId])).rows[0].state_json;
          assert.equal(state.hordesWon,0,'75 defense must not use the tower bonus already lost in this wave');assert.equal(state.cities[0].integrity,75,'Only the ordinary horde damages the city');assert.equal(state.sanctuaryRaidReceipts.length,1);
        }
      }finally{await removeTowerRaidFixture(f);}
    }
  });
  if(process.env.COZY_SKIP_BROWSER!=="1")await check('Mobile tower threats show preparation, support and victory or loss without map navigation',async()=>{
    for(const defend of [true,false]){
      const f=await towerRaidFixture();
      const {chromium}=await import('playwright');browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:360,height:640}});
      try{
        await experiencedScreenGuides(page,f.slug);await page.addInitScript(id=>localStorage.setItem(`kw-screen-help:v1:torres:${id}`,'seen'),f.players[0].state.playerId);
        await page.context().addCookies([{name:'kw_dev_auth',value:'1',url:base}]);await page.goto(`${base}/world/${f.slug}/intelligence`,{waitUntil:'networkidle'});
        await page.getByRole('button',{name:'Conquistas',exact:true}).click();
        await page.getByRole('button',{name:/Torres sob ameaça/}).click();
        const defense=page.getByRole('region',{name:`Defesa da torre: ${f.tower.name}`,exact:true});await defense.getByText('Horda a caminho',{exact:true}).waitFor();
        await defense.scrollIntoViewIfNeeded();await defense.locator('img').evaluateAll(items=>Promise.all(items.map(async image=>{image.loading='eager';await image.decode();})));
        await page.screenshot({path:path.join(reports,'mobile-tower-threat-360.png')});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
        await page.getByRole('button',{name:'Fechar painel',exact:true}).click();
        if(defend){
          await page.getByRole('navigation',{name:'Áreas do reino'}).getByRole('button',{name:'Aliança',exact:true}).click();
          const support=page.waitForResponse(r=>r.url().includes('/cozy')&&r.request().method()==='POST'&&r.request().postDataJSON()?.action?.type==='sanctuary_pact_defend');
          await defense.getByRole('button',{name:/^Defender /}).click();assert.equal((await support).status(),200);
          await defense.getByRole('button',{name:/^Defender /}).waitFor();assert.equal(await defense.getByRole('button',{name:/^Defender /}).isEnabled(),false);
          await defense.getByText(/^Apoio confirmado/).waitFor();
        }
        const resolved=await arriveTowerRaidFixture(f);assert.equal(resolved.shared.sanctuaryPacts[0].raids.waves[0].outcome,defend?'won':'lost');
        assert.equal(resolved.state.army.militia,975,'Only the existing 2.5% realm-horde loss applies');assert.equal(resolved.state.cities[0].integrity??100,100);
        await page.reload({waitUntil:'networkidle'});
        if(defend)await page.getByRole('navigation',{name:'Áreas do reino'}).getByRole('button',{name:'Aliança',exact:true}).click();
        else{
          await page.getByRole('button',{name:'Conquistas',exact:true}).click();
          const outer=page.getByRole('dialog',{name:'Conquistas',exact:true}).locator('details').filter({has:page.getByText('Torres do mundo',{exact:true})});await outer.locator(':scope > summary').click();
          await page.locator(`details[data-tower-pact="${f.tower.id}"]`).locator(':scope > summary').click();
        }
        await defense.getByText(defend?'Torre protegida':'Bônus interrompido',{exact:true}).waitFor();await defense.scrollIntoViewIfNeeded();
        assert.equal(resolved.computed.sanctuaryBonuses.provisions,defend?.1:0);
        if(!defend)assert.equal(await page.getByRole('button',{name:'Iniciar pacto da aliança',exact:true}).isEnabled(),true);
        await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(reports,defend?'mobile-tower-raid-won-390.png':'mobile-tower-raid-lost-390.png')});
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
      }finally{await browser.close();browser=null;await removeTowerRaidFixture(f);}
    }
  });
  if(process.env.COZY_SKIP_BROWSER!=="1")await check('A pristine mobile kingdom shows zero in all five areas across reload',async()=>{
    const created=await req('/api/worlds/create',{name:'Primeira Coroa',mode:'normal'});assert.equal(created.status,200);
    const pristine=(await req(`/api/worlds/${created.data.world.slug}/cozy`)).data;
    const {chromium}=await import('playwright');browser=await chromium.launch({headless:true});
    const page=await browser.newPage({viewport:{width:360,height:640}});
    await page.context().addCookies([{name:'kw_dev_auth',value:'1',url:base}]);
    try{

      let releaseEntry;const entryGate=new Promise(resolve=>releaseEntry=resolve);
      await page.route(`**/api/worlds/${created.data.world.slug}/cozy`,async route=>{if(route.request().method()==='GET')await entryGate;await route.continue();});
      await page.goto(`${base}/world/${created.data.world.slug}/intelligence`,{waitUntil:'domcontentloaded'});
      try{
        const entry=page.getByRole('status',{name:'Carregando reino',exact:true});await entry.waitFor();
        assert.equal(await entry.getByRole('progressbar').getAttribute('aria-valuenow'),null,'Unknown network progress must not display a made-up percentage');
        await page.screenshot({path:path.join(reports,'mobile-loading-360.png')});
      }finally{releaseEntry();}

      const firstRoyal=page.getByRole('dialog',{name:'Seu governante',exact:true});await firstRoyal.waitFor();await firstRoyal.getByRole('button',{name:'Iniciar meu reinado',exact:true}).click();await firstRoyal.waitFor({state:'hidden'});
      await page.getByRole('dialog',{name:'Como comandar seu reino',exact:true}).getByRole('button',{name:'Fechar ajuda',exact:true}).click();
      for(let i=0;i<2;i++){
        if(i)await page.reload({waitUntil:'networkidle'});
        const hud=page.getByRole('button',{name:'Influência: 0 de 2500',exact:true});await hud.waitFor();
        await hud.click();if(!i)await page.getByRole('dialog',{name:'Como acompanhar sua influência',exact:true}).getByRole('button',{name:'Fechar ajuda',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.waitFor();
        for(const label of ['Infraestrutura','Governo','Militar','Conselho','Conquistas'])await dialog.getByText(label,{exact:true}).waitFor();
        assert.equal(await dialog.getByText('0 / 500',{exact:true}).count(),5);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
        if(!i)await page.screenshot({path:path.join(reports,'mobile-zero-influence-360.png')});
        await page.getByRole('button',{name:'Fechar painel',exact:true}).click();
      }
      const started=(await command(created.data.world.slug,{type:'start_world'})).data;
      await page.reload({waitUntil:'networkidle'});
      let helpPosts=0;
      page.on('request',request=>{if(request.method()==='POST'&&request.url().includes('/cozy'))helpPosts++;});
      const guides=[['Infraestrutura','Como evoluir suas cidades'],['Militar','Como preparar seu exército'],['Governo','Como conduzir seu governo'],['Conselho','Como decidir no Conselho'],['Conquistas','Como acompanhar suas conquistas']];
      for(const [button,title] of guides){
       await page.getByRole('button',{name:button,exact:true}).click();
       const help=page.getByRole('dialog',{name:title,exact:true});await help.waitFor();
       assert.equal(await help.getByRole('button',{name:'Próximo',exact:true}).count(),1);
       await help.getByRole('button',{name:'Próximo',exact:true}).click();
       await help.getByRole('button',{name:'Próximo',exact:true}).click();
       await help.getByRole('button',{name:'Entendi',exact:true}).click();
       await help.waitFor({state:'hidden'});
       await page.getByRole('button',{name:title,exact:true}).click();await help.waitFor();
       await page.keyboard.press('Escape');await help.waitFor({state:'hidden'});
       await page.getByRole('button',{name:'Fechar painel',exact:true}).click();
      }
      assert.equal(helpPosts,0,'Opening, skipping and reopening screen guides cannot send game commands');
      await page.reload({waitUntil:'networkidle'});
      await page.getByRole('button',{name:'Conquistas',exact:true}).click();
      assert.equal(await page.getByRole('dialog',{name:'Como acompanhar suas conquistas',exact:true}).count(),0,'Seen guide stays closed after reload');
      const conquests=page.getByRole('dialog',{name:'Conquistas',exact:true});await conquests.waitFor();
      const preparation=conquests.getByLabel('Próxima Maravilha',{exact:true});await preparation.waitFor();
      await preparation.getByRole('button',{name:'Preparar esta cidade',exact:true}).click();
      await page.getByRole('region',{name:'Cidade Capital',exact:true}).waitFor();
      const cityHelp=page.getByRole('dialog',{name:'Como cuidar da sua cidade',exact:true});await cityHelp.waitFor();
      await cityHelp.getByRole('button',{name:'Pular',exact:true}).click();
      await page.getByRole('tab',{name:'Decisões',exact:true}).waitFor();
      await page.getByRole('navigation',{name:'Áreas do reino'}).getByRole('button',{name:'Coroa',exact:true}).click();
      await page.getByRole('button',{name:'Conquistas',exact:true}).click();await conquests.waitFor();
      const towerSection=conquests.locator('details').filter({has:page.getByText('Torres do mundo',{exact:true})});
      await towerSection.locator(':scope > summary').click();
      const firstHelp=page.getByRole('dialog',{name:'Como funcionam as torres',exact:true});await firstHelp.waitFor();
      await firstHelp.locator('img').evaluateAll(items=>Promise.all(items.map(image=>image.decode())));
      await page.screenshot({path:path.join(reports,'mobile-tower-first-visit-360.png')});
      for(let step=0;step<3;step++)await firstHelp.getByRole('button',{name:'Próximo',exact:true}).click();
      await firstHelp.getByRole('button',{name:'Entendi',exact:true}).click();await firstHelp.waitFor({state:'hidden'});
      await conquests.getByRole('button',{name:'Como funcionam as torres',exact:true}).click();await firstHelp.waitFor();
      await firstHelp.getByRole('button',{name:'Pular',exact:true}).click();
      assert.equal((await req(`/api/worlds/${created.data.world.slug}/cozy`)).data.state.orders.length,0,'Tutorial controls do not send game commands');

      const tower=[...started.computed.sanctuaries].sort((a,b)=>a.supplyCost-b.supplyCost)[0];
      const card=conquests.getByRole('article',{name:`Torre: ${tower.name}`,exact:true});
      const post=page.waitForResponse(r=>r.url().includes('/cozy')&&r.request().method()==='POST'&&r.request().postDataJSON()?.action?.type==='sanctuary_explore');
      await card.getByRole('button',{name:`Explorar ${tower.name}`,exact:true}).click();
      assert.equal((await post).status(),200);
      await card.getByText('Expedição a caminho',{exact:true}).waitFor();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
      await card.locator('img').evaluateAll(items=>Promise.all(items.map(async image=>{image.loading='eager';await image.decode();})));
      await page.getByRole('button',{name:'Fechar confirmação',exact:true}).click();
      await page.screenshot({path:path.join(reports,'mobile-tower-expedition-360.png')});
      console.log('STEP First-visit guides and tower recognition passed');
      const after=(await req(`/api/worlds/${created.data.world.slug}/cozy`)).data;
      assert(after.state.orders.some(o=>o.sanctuaryId===tower.id));assert.equal(after.computed.influence.legacy,0);
      const due=Date.now();after.state.orders.find(o=>o.sanctuaryId===tower.id).arrivesAt=due;after.state.resources={gold:5000,materials:5000,supplies:5000};after.state.army={militia:250,shooters:0,scouts:0,machinery:0};
      await db.query('update kw_cozy_player_states set state_json=$1::jsonb,revision=revision+1 where world_player_id=$2',[JSON.stringify(after.state),after.state.playerId]);
      await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'Conquistas',exact:true}).click();await conquests.waitFor();
      await conquests.locator('details').filter({has:page.getByText('Torres do mundo',{exact:true})}).locator(':scope > summary').click();
      assert.equal(await firstHelp.count(),0,'A seen first-visit guide stays dismissed after reload');
      await card.locator('summary').filter({hasText:'Sintonia da torre'}).click();
      await card.getByRole('button',{name:'Produção de suprimentos',exact:true}).click();
      const towerCommand=async(button,type)=>{const response=page.waitForResponse(r=>r.url().includes('/cozy')&&r.request().method()==='POST'&&r.request().postDataJSON()?.action?.type===type);await button.click();assert.equal((await response).status(),200);};
      await towerCommand(card.getByRole('button',{name:'Iniciar pacto do reino',exact:true}),'sanctuary_pact_start');
      await towerCommand(card.getByRole('button',{name:'Contribuir máximo de ouro na torre',exact:true}),'sanctuary_pact_contribute');
      await card.getByRole('button',{name:'Cancelar e devolver reservas',exact:true}).click();
      await card.getByRole('button',{name:'Manter pacto',exact:true}).click();
      await card.getByRole('button',{name:'Cancelar e devolver reservas',exact:true}).click();
      await towerCommand(card.getByRole('button',{name:'Confirmar cancelamento',exact:true}),'sanctuary_pact_cancel');
      const refunded=(await req(`/api/worlds/${created.data.world.slug}/cozy`)).data;assert.equal(Object.values(refunded.state.sanctuaryPactReceipts).filter(x=>x==='refunded').length,1);assert.equal(refunded.state.resources.gold,5000);
      await towerCommand(card.getByRole('button',{name:'Iniciar pacto do reino',exact:true}),'sanctuary_pact_start');
      await towerCommand(card.getByRole('button',{name:'Contribuir máximo de ouro na torre',exact:true}),'sanctuary_pact_contribute');
      await towerCommand(card.getByRole('button',{name:'Contribuir máximo de materiais na torre',exact:true}),'sanctuary_pact_contribute');
      await card.getByText('Guardiões aguardando',{exact:true}).waitFor();
      await towerCommand(card.getByRole('button',{name:/Enviar exército aos guardiões/}),'sanctuary_pact_challenge');
      const queued=(await req(`/api/worlds/${created.data.world.slug}/cozy`)).data;
      const resolved=await arriveGuardianFixture(created.data.world.slug,queued);assert(resolved.shared.sanctuaryPacts.some(p=>p.guardian?.attempts.some(a=>a.outcome==='won')));
      await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'Conquistas',exact:true}).click();await conquests.waitFor();
      await conquests.locator('details').filter({has:page.getByText('Torres do mundo',{exact:true})}).locator(':scope > summary').click();
      await card.locator('summary').filter({hasText:'Sintonia da torre'}).click();
      await card.getByText('Benefício ativo',{exact:true}).waitFor();
      const active=(await req(`/api/worlds/${created.data.world.slug}/cozy`)).data;assert.equal(active.computed.sanctuaryBonuses.provisions,.1);assert.equal(active.computed.influence.legacy,0);
      console.log('STEP Mobile tower funded and guardian resolved');
      const visibleBonus=card.locator('[data-cozy-bonus="provisions"]:visible');await visibleBonus.waitFor();
      assert.equal(await visibleBonus.getAttribute('aria-label'),'Bônus: +10% Produção de suprimentos');
      assert.equal(await card.locator('[data-cozy-bonus="provisions"]:visible svg[data-map-art="uiSupplies"]').count(),1,'Every percent names and depicts its effect');
      await card.locator('img').evaluateAll(items=>Promise.all(items.map(async image=>{image.loading='eager';await image.decode();})));
      const dismiss=page.getByRole('button',{name:'Fechar confirmação',exact:true});if(await dismiss.count())await dismiss.click();
      await card.scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(reports,'mobile-tower-pact-active-360.png')});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);

    }finally{
      await browser.close();browser=null;
      await db.query('delete from world_players where world_id=$1',[pristine.world.id]);await db.query('delete from worlds where id=$1',[pristine.world.id]);
    }
  });
  if (process.env.COZY_SKIP_BROWSER !== "1")
    await check(
      "Mobile game viewport, panel navigation, real commands and safe retries",
      async () => {
        // A multi-city save exercises selection and upgrades against distinct IDs.
        // This fixture exists only in this local PostgreSQL test process.
        const fixture = (await req(`/api/worlds/${slug}/cozy`)).data;
        const capital = fixture.state.cities[0];
        const occupied = new Set(Object.keys(fixture.shared.claims));
        for (const order of fixture.state.orders)
          if (order.q !== undefined) occupied.add(`${order.q},${order.r}`);
        const offsets = [
          [3, 0],
          [-3, 2],
          [0, 3],
          [0, -3],
          [3, -3],
        ];
        const extraCities = [
          { id: "fixture-city-river", name: "Vila do Rio" },
          { id: "fixture-city-watch", name: "Vigia" },
        ].map((entry, index) => {
          const offset = offsets.find(
            ([q, r]) =>
              Math.abs(capital.q + q) <= 40 &&
              Math.abs(capital.r + r) <= 40 &&
              !occupied.has(`${capital.q + q},${capital.r + r}`),
          );
          assert(offset, "Fixture needs an unclaimed city location");
          const city = {
            ...structuredClone(capital),
            ...entry,
            capital: false,
            heroId: null,
            life:{...structuredClone(capital.life),contentment:index===0?28:70,lastSocialDay:fixture.computed.day,unrestDays:0},
            q: capital.q + offset[0],
            r: capital.r + offset[1],
            wonder: false,
            sectors: {
              administration: 1,
              economy: 2 + index,
              society: 1,
              recruitment: 1,
              defense: 1,
            },
          };
          occupied.add(`${city.q},${city.r}`);
          fixture.shared.claims[`${city.q},${city.r}`] = {
            playerId: actorId,
            cityId: city.id,
            name: city.name,
          };
          return city;
        });
        fixture.state.cities.push(...extraCities);
        // Revealed cartography fixture, confined to this disposable PostgreSQL world.
        fixture.state.explored=[...new Set([...fixture.state.explored,...fixture.tiles.filter(t=>!t.ownerId&&t.q!==0&&t.r!==0).map(t=>t.id)])];
        await db.query(
          "update kw_cozy_player_states set state_json=$1::jsonb, revision=revision+1 where world_player_id=$2",
          [JSON.stringify(fixture.state), actorId],
        );
        await db.query(
          "update kw_cozy_world_states set state_json=$1::jsonb, revision=revision+1 where world_id=$2",
          [JSON.stringify(fixture.shared), fixture.world.id],
        );
        const { chromium } = await import("playwright");
        browser = await chromium.launch({ headless: true });
        const errors = [];
        const page = await browser.newPage({
          viewport: { width: 1440, height: 1100 },
        });
        await experiencedScreenGuides(page,slug);
        page.on("pageerror", async (e) => {errors.push(e.message);await writeFile(path.join(reports,"browser-errors.json"),JSON.stringify(errors,null,2));});
        await page
          .context()
          .addCookies([{ name: "kw_dev_auth", value: "1", url: base }]);
        await page.goto(`${base}/world/${slug}/intelligence`, {
          waitUntil: "networkidle",
        });
        const navigation = page.getByRole("navigation", {
          name: "Áreas do reino",
        });
        await navigation.waitFor();
        const resourceHeader=page.getByRole("button",{name:"Tesouro do reino",exact:true});
        for(const art of ["gold","uiMaterials","uiSupplies"])assert.equal(await resourceHeader.locator(`svg[data-map-art="${art}"]`).count(),1);
        const closePanel = async () => {
          await page
            .getByRole("button", { name: "Fechar painel", exact: true })
            .click();
          await page.getByRole("dialog").waitFor({ state: "hidden" });
        };
        const checkedSymbolSources=new Set();
        const assertImages = async (label) => {
          const sources=await page.locator('svg[data-map-art] image').evaluateAll(items=>[...new Set(items.map(item=>item.getAttribute("href")))]);
          for(const source of sources){
            if(checkedSymbolSources.has(source))continue;
            const response=await fetch(new URL(source,base),{headers:{accept:"image/webp"}});
            assert.equal(response.status,200,`${label}: cropped artwork loads`);
            assert(response.headers.get("content-type")?.startsWith("image/"));
            if(source.startsWith("/_next/image"))assert((await response.arrayBuffer()).byteLength<200000,`${label}: symbols use optimized delivery`);
            checkedSymbolSources.add(source);
          }
          const images = page.locator("img");
          const oversizedIcons=await page.locator('img[data-game-art="true"]').evaluateAll(items=>items.filter(image=>{
            const url=new URL(image.src,location.href),width=Number(image.getAttribute('width'));
            return url.pathname==='/_next/image'&&Number(url.searchParams.get('w'))>Math.max(128,width*4);
          }).map(image=>image.src));
          assert.deepEqual(oversizedIcons,[],`${label}: fixed-size icons cannot request oversized fallback images`);
          await images.evaluateAll((items) => {
            // Audit all mounted asset URLs, including cards below a panel's
            // scroll position that Next normally loads lazily.
            for (const image of items) image.loading = "eager";
            return Promise.all(
              items.map((image) => image.decode().catch(() => {})),
            );
          });
          const broken = await images.evaluateAll((items) =>
            items
              .filter((image) => !image.complete || image.naturalWidth === 0)
              .map((image) => image.currentSrc || image.src),
          );
          assert.deepEqual(
            broken,
            [],
            `${label}: all mounted artwork must load`,
          );
        };
        const assertViewport = async (label) => {
          const dimensions = await page.evaluate(() => ({
            documentWidth: document.documentElement.scrollWidth,
            documentHeight: document.documentElement.scrollHeight,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
          }));
          assert(
            dimensions.documentWidth <= dimensions.viewportWidth + 1,
            `${label}: document overflows horizontally ${JSON.stringify(dimensions)}`,
          );
          assert(
            dimensions.documentHeight <= dimensions.viewportHeight + 1,
            `${label}: game requires document scrolling ${JSON.stringify(dimensions)}`,
          );
        };
        const assertPanelFits = async (label) => {
          const dialog = page.getByRole("dialog").last();
          await dialog.waitFor();
          await dialog.evaluate((element) =>
            Promise.all(
              element.getAnimations().map((animation) => animation.finished),
            ),
          );
          const bounds = await dialog.boundingBox();
          const viewport = page.viewportSize();
          assert(bounds, `${label}: dialog must be visible`);
          assert(
            bounds.x >= -1 &&
              bounds.y >= -1 &&
              bounds.x + bounds.width <= viewport.width + 1 &&
              bounds.y + bounds.height <= viewport.height + 1,
            `${label}: dialog leaves the screen ${JSON.stringify(bounds)}`,
          );
          const content = await dialog.evaluate((element) => ({
            width: element.clientWidth,
            scrollWidth: element.scrollWidth,
          }));
          assert(
            content.scrollWidth <= content.width + 1,
            `${label}: panel content overflows horizontally ${JSON.stringify(content)}`,
          );
          await assertViewport(label);
          await assertImages(label);
        };
        await assertViewport("Desktop game");
        const panorama = page.getByRole("region", {
          name: "Panorama do reino",
        });
        const assertPanoramaFits = async (label, count) => {
          assert.equal(
            await panorama.locator("[data-realm-city]").count(),
            count,
          );
          const panoramaBounds = await panorama.boundingBox();
          assert(panoramaBounds);
          for (const marker of await panorama
            .locator("[data-realm-city]")
            .all()) {
            const bounds = await marker.boundingBox();
            assert(
              bounds &&
                bounds.x >= panoramaBounds.x - 1 &&
                bounds.y >= panoramaBounds.y - 1 &&
                bounds.x + bounds.width <=
                  panoramaBounds.x + panoramaBounds.width + 1 &&
                bounds.y + bounds.height <=
                  panoramaBounds.y + panoramaBounds.height + 1,
              `${label}: a city marker or label is clipped by the panorama ${JSON.stringify(bounds)}`,
            );
          }
        };
        await panorama.waitFor();
        assert.equal(await panorama.locator('svg[data-map-art="settlementSmall"]').count(),3,"Initial cities use the completed small-settlement artwork, including the capital");
        assert.equal(await panorama.locator("[data-realm-city]").count(), 3);
        assert.equal(
          await panorama.getByRole("gridcell").count(),
          0,
          "The kingdom panorama has no hexagons",
        );
        assert.equal(
          await page.getByRole("button", { name: /^Evoluir / }).count(),
          0,
          "City upgrades belong in the internal city view",
        );
        assert.equal(await navigation.getByRole("button").count(), 5);
        for (const name of [
          "Infraestrutura",
          "Militar",
          "Governo",
          "Conselho",
          "Conquistas",
        ]) {
          assert.equal(
            await page
              .getByRole("button", { name, exact: true })
              .locator('[data-game-art="true"]')
              .count(),
            1,
            `${name}: the Crown command uses the existing artwork`,
          );
        }
        assert.equal(
          await navigation.locator('[data-game-art="true"]').count(),
          5,
          "All navigation destinations use the existing artwork",
        );
        await assertImages("Desktop crown");
        await page.screenshot({
          path: path.join(reports, "desktop.png"),
          fullPage: true,
        });
        await page
          .getByRole("button", { name: "Militar", exact: true })
          .click();
        await assertPanelFits("Military");
        await page.getByRole('tab',{name:'Recrutamento',exact:true}).focus();
        await page.keyboard.press('End');
        await page.getByRole('tabpanel',{name:'Defesa',exact:true}).waitFor();
        assert.equal(await page.getByRole('tab',{name:'Defesa',exact:true}).evaluate(el=>el===document.activeElement),true);
        await closePanel();
  await page.getByRole('button',{name:'Governo',exact:true}).click();
  await page.getByRole('tab',{name:'Pesquisas',exact:true}).click();
  await page.getByRole('button',{name:'Ver pesquisa Muralhas do reino',exact:true}).click();
  await page.getByRole('button',{name:'Pesquisar Muralhas do reino',exact:true}).waitFor();
  await closePanel();
        await page.getByRole('button',{name:'Militar',exact:true}).click();
        await page.getByRole('tab',{name:'Defesa',exact:true}).click();
        await page.getByRole('button',{name:`Cuidar da defesa de ${capital.name}`,exact:true}).click();
        await page.getByRole('dialog',{name:'Defesa',exact:true}).waitFor();
        const defenseSheet=page.getByRole('dialog',{name:'Defesa',exact:true});
        assert.equal(await defenseSheet.getByText(capital.name,{exact:true}).count(),1);
        assert.equal(await defenseSheet.locator(`[aria-label="Nível ${capital.sectors.defense} de 10"]`).count(),1,'The reorganized header retains the selected city and its actual defense level');
        await page.getByRole('button',{name:'Fechar setor',exact:true}).click();
        await page.getByRole('button',{name:'Voltar',exact:true}).click();
        await navigation.getByRole('button',{name:'Coroa',exact:true}).click();
        await page.getByRole('button',{name:'Militar',exact:true}).click();
        const before = (await req(`/api/worlds/${slug}/cozy`)).data.state.army
          .militia;
        const confirmation = page.getByRole("status", {
          name: "Ação confirmada",
          exact: true,
        });
        const crownCommand = async (action, trigger) => {
          const reply = page.waitForResponse(
            (response) =>
              response.url().endsWith("/cozy") &&
              response.request().method() === "POST",
          );
          await trigger();
          const response = await reply;
          const request = response.request().postDataJSON();
          assert.deepEqual(request.action, action);
          const data = await response.json();
          assert.equal(response.status(), 200, JSON.stringify(data));
          await confirmation.waitFor();
          await page
            .getByRole("button", { name: "Fechar confirmação", exact: true })
            .click();
          await confirmation.waitFor({ state: "hidden" });
          return { data, request };
        };
        // Hold the actual successful reply after the database commit. A local
        // animation or optimistic state must not claim success before the reply.
        let releaseFirstReply;
        let committedFirstReply;
        const firstReplyGate = new Promise((resolve) => {
          releaseFirstReply = resolve;
        });
        const firstCommit = new Promise((resolve) => {
          committedFirstReply = resolve;
        });
        let holdFirstPost = true;
        await page.route("**/api/worlds/*/cozy", async (route) => {
          if (route.request().method() !== "POST" || !holdFirstPost)
            return route.continue();
          holdFirstPost = false;
          const response = await route.fetch();
          committedFirstReply(response.status());
          await firstReplyGate;
          await route.fulfill({ response });
        });
        const browserReply = page.waitForResponse(
          (r) => r.url().endsWith("/cozy") && r.request().method() === "POST",
        );
        await page
          .getByRole("button", { name: "Recrutar 1 Milícia", exact: true })
          .click();
        assert.equal(await firstCommit, 200);
        try {
          assert.equal(
            await confirmation.count(),
            0,
            "No success notice before the server reply arrives",
          );
        } finally {
          releaseFirstReply();
        }
        assert.equal(
          (await browserReply).status(),
          200,
          "Browser action must succeed",
        );
        await confirmation.waitFor();
        await page.unroute("**/api/worlds/*/cozy");
        assert.equal(
          (await req(`/api/worlds/${slug}/cozy`)).data.state.army.militia,
          before + 1,
        );
        // Simulate a proxy failure AFTER the real transaction committed.
        let failAfterCommit = true;
        await page.route("**/api/worlds/*/cozy", async (route) => {
          if (route.request().method() === "POST" && failAfterCommit) {
            failAfterCommit = false;
            const actual = await route.fetch();
            assert.equal(actual.status(), 200);
            await route.fulfill({
              status: 503,
              contentType: "application/json",
              body: JSON.stringify({
                error: "Falha transitória de confirmação",
              }),
            });
          } else await route.continue();
        });
        await page
          .getByRole("button", { name: "Recrutar 1 Milícia", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Confirmar resultado", exact: true })
          .waitFor();
        assert.equal(
          await confirmation.count(),
          0,
          "An uncertain 503 must not show a success notice",
        );
        assert.equal(
          (await req(`/api/worlds/${slug}/cozy`)).data.state.army.militia,
          before + 2,
        );
        await page.unroute("**/api/worlds/*/cozy");
        const retried = page.waitForResponse(
          (r) => r.url().endsWith("/cozy") && r.request().method() === "POST",
        );
        await page
          .getByRole("button", { name: "Confirmar resultado", exact: true })
          .click();
        assert.equal((await retried).status(), 200);
        await confirmation.waitFor();
        assert.equal(
          (await req(`/api/worlds/${slug}/cozy`)).data.state.army.militia,
          before + 2,
          "Retry must not recruit twice",
        );
        await page
          .getByRole("button", { name: "Fechar confirmação", exact: true })
          .click();
        await confirmation.waitFor({ state: "hidden" });
        await page
          .getByRole("button", { name: "Ver pesquisa militar", exact: true })
          .first()
          .click();
        await page
          .getByRole("dialog", { name: "Governo", exact: true })
          .waitFor();
        assert.equal(
          await page
            .getByRole("tab", { name: "Pesquisas", exact: true })
            .getAttribute("aria-selected"),
          "true",
          "A locked troop leads directly to the research tab",
        );
        await assertPanelFits("Military research shortcut");
        await closePanel();
        for (const name of ["Governo", "Conselho", "Conquistas"]) {
          await page.getByRole("button", { name, exact: true }).click();
          await assertPanelFits(name);
          if (name === "Governo") {
            await page
              .getByRole("tab", { name: "Pesquisas", exact: true })
              .click();
            await assertImages("Government research");
          }
          await closePanel();
        }
        await navigation
          .getByRole("button", { name: "Mundo", exact: true })
          .click();
        await page
          .getByRole("grid", { name: "Territórios próximos" })
          .waitFor();
        await assertViewport("Desktop world map");
        await page.screenshot({
          path: path.join(reports, "map-desktop.png"),
          fullPage: true,
        });
        await navigation
          .getByRole("button", { name: "Coroa", exact: true })
          .click();
        await navigation.getByRole('button',{name:'Coroa',exact:true}).click();
        // The old selectable royal profiles were replaced by the collection.
        // Current stat/equipment/crest choice, network recovery and persistence
        // are exercised against the real API in test-collection-ui.mjs.
        assert.equal(await page.getByRole('dialog',{name:'Seu governante',exact:true}).count(),0);
        for (const viewport of [
          { width: 390, height: 844 },
          { width: 360, height: 640 },
        ]) {
          await page.setViewportSize(viewport);
          const label = `${viewport.width}x${viewport.height}`;
          await assertViewport(`${label} crown`);
          await assertImages(`${label} crown`);
          await assertPanoramaFits(label, 3);
          const updates=page.getByRole('region',{name:'Acontecimentos do reino',exact:true});
          const updateCards=updates.getByRole('button');assert(await updateCards.count()>2);
          await updateCards.last().scrollIntoViewIfNeeded();
          assert(await updates.locator('div').first().evaluate(el=>el.scrollLeft>0),'Realm cards scroll sideways without moving the page');
          await page.screenshot({path:path.join(reports,`mobile-return-cards-${viewport.width}.png`)});
          await updateCards.first().scrollIntoViewIfNeeded();

          await page.screenshot({
            path: path.join(
              reports,
              viewport.width === 390 ? "mobile.png" : "mobile-small.png",
            ),
            fullPage: true,
          });
          if (viewport.width === 390) {
            const treasuryTrigger = page.getByRole("button", {
              name: "Tesouro do reino",
              exact: true,
            });
            await treasuryTrigger.click();
            await assertPanelFits(`${label} treasury`);
            const treasury = page.getByRole("region", {
              name: "Recursos do reino",
              exact: true,
            });
            assert.equal(await treasury.getByRole("article").count(), 1);
            assert.equal(await treasury.getByRole("tab",{name:"Materiais",exact:true}).getAttribute("aria-selected"),"true");
            await treasury
              .getByText("24 h reais", { exact: true })
              .waitFor();
            await page.screenshot({
              path: path.join(reports, "mobile-treasury.png"),
              fullPage: true,
            });
            await page.keyboard.press("Escape");
            await page.getByRole("dialog").waitFor({ state: "hidden" });
            await page.waitForFunction(
              () =>
                document.activeElement?.getAttribute("aria-label") ===
                "Tesouro do reino",
            );
            await treasuryTrigger.click();
            await page
              .getByRole("button", {
                name: "Evoluir cidades",
                exact: true,
              })
              .click();
            await page
              .getByRole("dialog", { name: "Infraestrutura", exact: true })
              .waitFor();
            await assertPanelFits(`${label} treasury to city production`);
            await closePanel();
            await treasuryTrigger.click();
            await page.getByRole("tab",{name:"Ouro",exact:true}).click();
            await page
              .getByRole("button", {
                name: "Usar ouro no Governo",
                exact: true,
              })
              .click();
            await page
              .getByRole("dialog", { name: "Governo", exact: true })
              .waitFor();
            assert.equal(
              await page
                .getByRole("tab", { name: "Heróis", exact: true })
                .getAttribute("aria-selected"),
              "true",
            );
            await closePanel();
            await treasuryTrigger.click();
            await page.getByRole("tab",{name:"Suprimentos",exact:true}).click();
            await page
              .getByRole("button", {
                name: "Explorar por recursos",
                exact: true,
              })
              .click();
            await page
              .getByRole("grid", { name: "Territórios próximos" })
              .waitFor();
            assert.equal(await page.getByRole("dialog").count(), 0);
            await navigation
              .getByRole("button", { name: "Coroa", exact: true })
              .click();
          }
          for (const name of [
            "Infraestrutura",
            "Militar",
            "Governo",
            "Conselho",
            "Conquistas",
          ]) {
            const control = page.getByRole("button", { name, exact: true });
            const target = await control.boundingBox();
            assert(
              target && target.width >= 44 && target.height >= 44,
              `${label} ${name}: primary control needs a finger-sized target`,
            );
            await control.click();
            await assertPanelFits(`${label} ${name}`);
            const panel = page.getByRole("dialog", { name, exact: true });
            assert(
              (await panel.locator('img[data-game-art="true"]').count()) > 0,
              `${label} ${name}: the Crown panel uses the game's existing artwork`,
            );
            const screenName = {
              Infraestrutura: "infrastructure",
              Militar: "military",
              Governo: "government",
              Conselho: "council",
              Conquistas: "achievements",
            }[name];
            const captureCrown = async (suffix = "") => {
              await page.screenshot({
                path: path.join(
                  reports,
                  `mobile-${screenName}${suffix}${viewport.width === 360 ? "-small" : ""}.png`,
                ),
                fullPage: true,
              });
            };
            if(name==="Militar"){
              await panel.getByRole('tab',{name:'Defesa',exact:true}).click();
              await assertPanelFits(`${label} Military defense`);
              assert(await panel.getByRole('tabpanel',{name:'Defesa',exact:true}).isVisible());
              assert.equal(await panel.getByText(/Integridade ·/).count(),fixture.state.cities.length);
              assert.equal(await panel.getByRole('button',{name:/Cuidar da defesa de/}).count(),fixture.state.cities.length);
              await captureCrown('-defense');
              await panel.getByRole('tab',{name:'Recrutamento',exact:true}).click();
            }
            if (name === "Governo") {
              assert.equal(
                await panel
                  .getByRole("tab", { name: "Heróis", exact: true })
                  .getAttribute("aria-selected"),
                "true",
                "The Crown Government menu starts with heroes",
              );
              await captureCrown();
              await panel
                .getByRole("tab", { name: "Pesquisas", exact: true })
                .click();
              assert.equal(
                await panel
                  .getByRole("tab", { name: "Pesquisas", exact: true })
                  .getAttribute("aria-selected"),
                "true",
              );
              await assertPanelFits(`${label} Government research`);
              await captureCrown("-research");
            } else if (name === "Conquistas") {
              assert.equal(
                await panel
                  .getByRole("tab", { name: "Conquistas", exact: true })
                  .getAttribute("aria-selected"),
                "true",
                "Achievements opens with the player's Legacy objectives",
              );
              await panel
                .getByRole("heading", { name: "Maravilhas 0/2", exact: true })
                .waitFor();
              const wonders = panel.getByRole("progressbar", {
                name: "Maravilhas construídas",
                exact: true,
              });
              assert.equal(await wonders.getAttribute("aria-valuenow"), "0");
              assert.equal(await wonders.getAttribute("aria-valuemax"), "2");
              const legacyTabRail = panel.getByRole("tablist", {
                name: "Conquistas",
                exact: true,
              });
              const legacyRailBounds = await legacyTabRail.boundingBox();
              assert(legacyRailBounds);
              await captureCrown();
              for (const tabName of ["Vitória", "Ranking"]) {
                const tab = panel.getByRole("tab", {
                  name: tabName,
                  exact: true,
                });
                await tab.click();
                assert.equal(await tab.getAttribute("aria-selected"), "true");
                await assertPanelFits(`${label} Achievements ${tabName}`);
                const railBounds = await legacyTabRail.boundingBox();
                assert(
                  railBounds &&
                    Math.abs(railBounds.y - legacyRailBounds.y) <= 1,
                  `${label}: switching to ${tabName} keeps the tab rail in place`,
                );
                await captureCrown(`-${tabName.toLowerCase()}`);
              }
              await panel
                .getByRole("tab", { name: "Conquistas", exact: true })
                .click();
              const expansionClaim = panel.getByRole("button", {
                name: "Receber 50 de Conquistas: Três cidades, um reino",
                exact: true,
              });
              if (viewport.width === 390) {
                const beforeClaim = (await req(`/api/worlds/${slug}/cozy`))
                  .data;
                assert.equal(
                  beforeClaim.state.quests.includes("expansion"),
                  false,
                );
                assert.equal(await expansionClaim.isEnabled(), true);
                const claim = await crownCommand(
                  { type: "quest", questId: "expansion" },
                  () => expansionClaim.click(),
                );
                assert.equal(
                  claim.data.computed.influence.legacy,
                  beforeClaim.computed.influence.legacy + 50,
                  "The completed three-city quest grants 50 Legacy",
                );
                const repeatedClaim = await req(
                  `/api/worlds/${slug}/cozy`,
                  claim.request,
                );
                assert.equal(repeatedClaim.status, 200);
                assert.equal(
                  repeatedClaim.data.computed.influence.legacy,
                  claim.data.computed.influence.legacy,
                  "Retrying the quest receipt never grants another 50 Legacy",
                );
                assert.equal(
                  (await command(slug, { type: "quest", questId: "expansion" }))
                    .status,
                  422,
                  "An already claimed quest cannot be claimed as a new action",
                );
              }
              const persistedClaim = (await req(`/api/worlds/${slug}/cozy`))
                .data;
              assert.equal(
                persistedClaim.state.quests.filter((id) => id === "expansion")
                  .length,
                1,
                "The claim survives later reads as a single completed objective",
              );
              assert.equal(await expansionClaim.count(), 0);
            } else {
              await captureCrown();
            }
            if (name === "Conselho" && viewport.width === 390) {
              const original = (await req(`/api/worlds/${slug}/cozy`)).data
                .state.counselors;
              const alternative=original[0]==='helena'?'tomas':'helena';
              const counselorName=id=>id==='helena'?'Helena':'Tomás';
              const chooseCounselor=async id=>{
                await panel.getByRole('button',{name:/^Política /}).click();
                await panel.locator('[aria-label="Escolher conselheiro"]').getByRole('button',{name:new RegExp('^'+counselorName(id)+' ')}).click();
              };
              const changed=await crownCommand({type:'counselor',slot:0,counselorId:alternative},()=>chooseCounselor(alternative));
              assert.deepEqual(changed.data.state.counselors,[alternative,original[1]]);
              assert.deepEqual((await req(`/api/worlds/${slug}/cozy`)).data.state.counselors,[alternative,original[1]]);
              await crownCommand({type:'counselor',slot:0,counselorId:original[0]},()=>chooseCounselor(original[0]));
              assert.deepEqual((await req(`/api/worlds/${slug}/cozy`)).data.state.counselors,original);
            }

            if (name === "Infraestrutura") {
              assert.equal(
                await page
                  .getByRole("dialog")
                  .getByRole("button", { name: /^Evoluir / })
                  .count(),
                0,
                "Infrastructure is the multi-city summary",
              );
              const productionDetails = page
                .getByRole("dialog")
                .locator('details[aria-label="Produção de todas as cidades"]');
              assert.equal(await productionDetails.count(), 1);
              assert.equal(
                await productionDetails.getAttribute("open"),
                null,
                "City cards stay primary; production is closed by default",
              );
              const infrastructure = (await req(`/api/worlds/${slug}/cozy`))
                .data.computed.influence.infrastructure;
              const influenceBar=page.getByRole('dialog').getByRole('progressbar',{name:'Influência de Infraestrutura',exact:true});
              assert.equal(await influenceBar.count(),1,'One visible infrastructure meter in the fixed header');
              assert.equal(Number(await influenceBar.getAttribute('value')),infrastructure);
              assert.equal(Number(await influenceBar.getAttribute('max')),500);

            }
            await closePanel();
          }
          await page
            .getByRole("button", { name: "Infraestrutura", exact: true })
            .click();
          await page
            .getByRole("dialog")
            .getByRole("button", {
              name: "Ver cidade Vila do Rio",
              exact: true,
            })
            .click();
          await page.getByRole("dialog").waitFor({ state: "hidden" });
          const riverView = page.getByRole("region", {
            name: "Cidade Vila do Rio",
            exact: true,
          });
          await riverView.waitFor();
          await assertImages(`${label} city interior`);
          await riverView.getByRole('heading',{name:'Vila do Rio',exact:true}).waitFor();
          const sectorTab = riverView.getByRole("tab", {
            name: "Setores",
            exact: true,
          });
          const decisionsTab = riverView.getByRole("tab", {
            name: "Decisões",
            exact: true,
          });
          assert.equal(await sectorTab.getAttribute("aria-selected"), "true");
          const sectorNames = [
            "Administração",
            "Economia",
            "Sociedade",
            "Recrutamento",
            "Defesa",
          ];
          const cityPayload=(await req(`/api/worlds/${slug}/cozy`)).data;
          const citySnapshot=cityPayload.state.cities.find(city=>city.id===extraCities[0].id);
          const cityInfrastructure=cityPayload.computed.influenceDetails.cities[extraCities[0].id];
          await riverView.getByLabel(`Influência desta cidade: ${cityInfrastructure} pontos`,{exact:true}).waitFor();
          const cityLandCount=1+Object.entries(cityPayload.shared.territories??{}).filter(([cell,owner])=>owner===cityPayload.state.playerId&&!cityPayload.shared.claims[cell]&&cityPayload.shared.territoryCities?.[cell]?.cityId===citySnapshot.id).length;
          await riverView.getByLabel(`Território desta cidade: ${cityLandCount} hexágonos`,{exact:true}).waitFor();

          await riverView.getByLabel(`Infraestrutura do reino: ${cityPayload.computed.influence.infrastructure} de 500`,{exact:true}).waitFor();
          for (const sectorName of sectorNames) {
            const card = riverView.getByRole("button", {
              name: `Ver setor ${sectorName}`,
              exact: true,
            });
            await card.waitFor();
            const sectorId = await card.getAttribute("data-sector");
            const expectedLevel = citySnapshot.sectors[sectorId];
            const badge = card.locator("[data-sector-level]");
            assert.equal(await badge.count(), 1);
            assert.equal(
              await badge.getAttribute("data-sector-level"),
              String(expectedLevel),
            );
            assert.equal(
              await badge.getAttribute("aria-label"),
              `Nível ${expectedLevel} de 10`,
            );
            assert.match(
              decodeURIComponent(
                await badge.locator("img").getAttribute("src"),
              ),
              new RegExp(
                `/icons/${String(expectedLevel).padStart(2, "0")}\\.png`,
              ),
              "The circular level uses the original numbered PNG",
            );
            assert.equal(await card.locator("p").count(), 0);
            assert.equal(await card.locator("small").count(),1,"Every city sector has a current, concrete metric");
            assert(
              !/Organiza a cidade|Produz alimento|Cuida do povo|Mais vagas|Protege o reino/.test(
                await card.innerText(),
              ),
              "Sector explanations belong in the detail view, not below every card",
            );
          }
          assert.equal(
            await riverView.getByRole("button", { name: /^Evoluir / }).count(),
            0,
            "Upgrade details stay inside the selected sector card",
          );
          await decisionsTab.click();
          assert.equal(
            await decisionsTab.getAttribute("aria-selected"),
            "true",
          );
          assert.equal(
            await riverView
              .getByRole("button", { name: /^Ver setor / })
              .count(),
            0,
            "Local decisions are a separate city tab",
          );
          await riverView
            .getByRole("button", { name: "Dar um nome à cidade", exact: true })
            .waitFor();
          await assertImages(`${label} city decisions`);
          await assertViewport(`${label} city decisions`);
          await page.screenshot({
            path: path.join(
              reports,
              viewport.width === 390
                ? "mobile-city-decisions.png"
                : "mobile-city-decisions-small.png",
            ),
            fullPage: true,
          });
          if(viewport.width===360){
            const before=(await req(`/api/worlds/${slug}/cozy`)).data;
            const local=before.computed.cityLife[extraCities[0].id],choice=local.decision.options[0];assert(choice);
            const reply=page.waitForResponse(response=>response.url().endsWith('/cozy')&&response.request().method()==='POST'&&response.request().postDataJSON()?.action?.type==='city_decision');
            await riverView.getByRole('button',{name:`Decidir: ${choice.label}`,exact:true}).click();
            const response=await reply;assert.equal(response.status(),200);const saved=await response.json();
            assert.equal(saved.computed.cityLife[extraCities[0].id].decision,null);
            assert.equal(saved.state.cities.find(c=>c.id===extraCities[0].id).life.contentment,Math.min(100,local.contentment+choice.contentment));
            const request=response.request().postDataJSON(),retry=await req(`/api/worlds/${slug}/cozy`,request);assert.equal(retry.status,200);
            const reloaded=(await req(`/api/worlds/${slug}/cozy`)).data;assert.equal(reloaded.computed.cityLife[extraCities[0].id].decision,null);
            assert.equal(reloaded.state.cities.find(c=>c.id===extraCities[0].id).life.contentment,saved.state.cities.find(c=>c.id===extraCities[0].id).life.contentment);
          }
          // Once-per-owner renaming is exercised through the current UI and
          // reload in test-collection-ui.mjs; no obsolete two-renames fixture.
          await sectorTab.click();
          const administrationCard = riverView.getByRole("button", {
            name: "Ver setor Administração",
            exact: true,
          });
          await administrationCard.click();
          await assertPanelFits(`${label} administration details`);
          const administrationDialog = page.getByRole("dialog", {
            name: "Administração",
            exact: true,
          });
          await administrationDialog.waitFor();
          await administrationDialog.getByRole("region",{name:"Prévia da evolução",exact:true}).waitFor();
          const functionDescription=administrationDialog.getByText(/Organiza a cidade e aumenta a produção de materiais/);
          assert.equal(await functionDescription.isVisible(),false,'General sector explanation starts collapsed');
          await administrationDialog.getByText('Função do setor',{exact:true}).click();
          await administrationDialog
            .getByText(/Organiza a cidade e aumenta a produção de materiais/)
            .waitFor();
          await page.screenshot({
            path: path.join(
              reports,
              viewport.width === 390
                ? "mobile-city-sector.png"
                : "mobile-city-sector-small.png",
            ),
            fullPage: true,
          });
          await page.keyboard.press("Escape");
          await administrationDialog.waitFor({ state: "hidden" });
          await page.waitForFunction(
            () =>
              document.activeElement?.getAttribute("aria-label") ===
              "Ver setor Administração",
          );
          assert(
            await administrationCard.evaluate(
              (element) => element === document.activeElement,
            ),
            "Closing sector details returns focus to its card",
          );
          assert.equal(
            await navigation
              .getByRole("button", { name: "Cidades", exact: true })
              .getAttribute("aria-current"),
            "page",
          );
          await assertViewport(`${label} infrastructure to city`);
          if (viewport.width === 390) {
            const prior = (await req(`/api/worlds/${slug}/cozy`)).data;
            assert(
              !prior.state.orders.some(
                (order) =>
                  order.kind === "upgrade" &&
                  order.cityId === extraCities[0].id,
              ),
            );
            await administrationCard.click();
            await administrationDialog.waitFor();
            const upgradeReply = page.waitForResponse(
              (response) =>
                response.url().endsWith("/cozy") &&
                response.request().method() === "POST",
            );
            await administrationDialog
              .getByRole("button", {
                name: "Evoluir Administração",
                exact: true,
              })
              .click();
            const response = await upgradeReply;
            assert.equal(
              response.status(),
              200,
              "City upgrade must reach the real engine",
            );
            assert.equal(
              response.request().postDataJSON().action.cityId,
              extraCities[0].id,
            );
            const saved = (await req(`/api/worlds/${slug}/cozy`)).data;
            await administrationDialog.waitFor({ state: "hidden" });
            await confirmation.waitFor();
            const worksite=riverView.getByLabel('Obra em andamento',{exact:true});await worksite.waitFor();
            const sprite=worksite.locator('svg[data-map-art="cityConstructionStage1"] image');
            const source=await sprite.getAttribute('href');assert(source.includes('/_next/image?')&&source.includes('w=256'));
            const delivered=await fetch(base+source,{headers:{accept:'image/webp'}});assert.equal(delivered.status,200);
            assert(delivered.headers.get('content-type')?.includes('image/'));
            assert((await delivered.arrayBuffer()).byteLength<200000,'A city construction preview must not download its full-resolution source');
            await assertImages(`${label} city after upgrade`);
            assert(
              saved.state.orders.some(
                (order) =>
                  order.kind === "upgrade" &&
                  order.cityId === extraCities[0].id &&
                  order.sector === "administration",
              ),
            );
            assert(
              !saved.state.orders.some(
                (order) =>
                  order.kind === "upgrade" && order.cityId === capital.id,
              ),
              "The selected colony must not upgrade the capital",
            );
            await page.screenshot({
              path: path.join(reports, "mobile-city-feedback.png"),
              fullPage: true,
            });
            await page
              .getByRole("button", { name: "Fechar confirmação", exact: true })
              .click();
            await confirmation.waitFor({ state: "hidden" });
            await worksite.scrollIntoViewIfNeeded();
            await page.screenshot({path:path.join(reports,'mobile-city-construction.png')});
            await page.screenshot({
              path: path.join(reports, "mobile-city.png"),
              fullPage: true,
            });
          }
          if (viewport.width === 360)
            await page.screenshot({
              path: path.join(reports, "mobile-city-small.png"),
              fullPage: true,
            });
          await page
            .getByRole("button", { name: "Voltar", exact: true })
            .click();
          const collection = page.getByRole("region", {
            name: "Cidades do reino",
            exact: true,
          });
          await collection.waitFor();
          assert.equal(
            await collection
              .getByRole("button", { name: /^Ver cidade / })
              .count(),
            3,
          );
          for (const cityButton of await collection
            .getByRole("button", { name: /^Ver cidade / })
            .all()) {
            const levels = cityButton.locator("[data-city-sector]");
            assert.equal(
              await levels.count(),
              5,
              "Every city shows all five sector levels",
            );
            for (const level of await levels.all()) {
              assert.match(
                await level.getAttribute("aria-label"),
                /: nível \d+ de 10$/,
              );
              const levelNumber = Number(
                (await level.getAttribute("aria-label")).match(
                  /: nível (\d+) de 10$/,
                )[1],
              );
              assert.equal(Number(await level.locator('strong').innerText()),levelNumber,'Compact city strips show the actual numeric level');
              assert.equal(await level.locator('[data-game-art="true"]').count(),1,'Each level retains the sector icon');

            }
          }
          await assertViewport(`${label} all cities`);
          await assertImages(`${label} all cities`);
          await page.screenshot({
            path: path.join(
              reports,
              viewport.width === 390
                ? "mobile-cities.png"
                : "mobile-cities-small.png",
            ),
            fullPage: true,
          });
          assert.equal(
            await collection
              .getByRole("group", { name: "Filtrar cidades", exact: true })
              .count(),
            0,
          );
          await navigation
            .getByRole("button", { name: "Coroa", exact: true })
            .click();
          if (viewport.width === 390) {
            const savedOrders = (await req(`/api/worlds/${slug}/cozy`)).data
              .state.orders;
            const openOrders = async () => {
              await page.getByRole("button", { name: /^Ordens do reino:/ }).click();
              await page
                .getByRole("region", { name: "Ordens do reino", exact: true })
                .waitFor();
              await assertPanelFits(`${label} orders`);
            };
            await openOrders();
            const ordersRegion = page.getByRole("region", {
              name: "Ordens do reino",
              exact: true,
            });
            assert.equal(
              await ordersRegion.getByRole("article").count(),
              savedOrders.length,
            );
            assert.equal(
              await ordersRegion.getByRole("progressbar").count(),
              savedOrders.length,
            );
            for(const [filter,kind] of [['Cidades','upgrade'],['Pesquisa','research']]){
              await ordersRegion.getByRole('button',{name:new RegExp(`^${filter}`)}).click();
              assert.equal(await ordersRegion.getByRole('article').count(),savedOrders.filter(o=>o.kind===kind).length);
            }
            await ordersRegion.getByRole('button',{name:/^Todas/}).click();
            await page.screenshot({
              path: path.join(reports, "mobile-orders.png"),
              fullPage: true,
            });
            await ordersRegion
              .getByRole("article")
              .filter({
                has: page.getByRole("heading", { name: /Administração/ }),
              })
              .getByRole("button", { name: /^Ver ordem:/ })
              .click();
            await riverView.waitFor();
            await page.getByRole('dialog',{name:'Administração',exact:true}).waitFor();
            await page.getByRole('button',{name:'Fechar setor',exact:true}).click();
            await navigation
              .getByRole("button", { name: "Coroa", exact: true })
              .click();
            await openOrders();
            await ordersRegion
              .getByRole("article")
              .filter({
                has: page.getByRole("heading", { name: /Doutrina militar/ }),
              })
              .getByRole("button", { name: /^Ver ordem:/ })
              .click();
            await page
              .getByRole("dialog", { name: "Governo", exact: true })
              .waitFor();
            assert.equal(
              await page
                .getByRole("tab", { name: "Pesquisas", exact: true })
                .getAttribute("aria-selected"),
              "true",
            );
            await closePanel();
            await openOrders();
            const exploration = savedOrders.find(
              (order) => order.kind === "explore",
            );
            assert(exploration);
            await ordersRegion
              .getByRole("article")
              .filter({
                has: page.getByRole("heading", { name: /Exploração/ }),
              })
              .getByRole("button", { name: /^Ver ordem:/ })
              .click();
            await page
              .getByRole("button", { name: "Fechar território", exact: true })
              .waitFor();
            await page
              .getByRole("dialog")
              .getByText(`${exploration.q}, ${exploration.r}`, {
                exact: false,
              })
              .waitFor();
            assert.equal(
              await navigation
                .getByRole("button", { name: "Mundo", exact: true })
                .getAttribute("aria-current"),
              "page",
            );
            await page
              .getByRole("button", { name: "Fechar território", exact: true })
              .click();
            await navigation
              .getByRole("button", { name: "Coroa", exact: true })
              .click();
          }
          await navigation
            .getByRole("button", { name: "Cidades", exact: true })
            .click();
          await collection
            .getByRole("button", {
              name: "Ver cidade Vila do Rio",
              exact: true,
            })
            .click();
          await riverView.waitFor();
          await page
            .getByRole("button", { name: "Voltar", exact: true })
            .click();
          await collection
            .getByRole("button", { name: "Ver cidade Vigia", exact: true })
            .click();
          await page
            .getByRole("region", { name: "Cidade Vigia", exact: true })
            .waitFor();
          await assertViewport(`${label} selected second colony`);
          await navigation
            .getByRole("button", { name: "Mundo", exact: true })
            .click();
          await page
            .getByRole("grid", { name: "Territórios próximos" })
            .waitFor();
          await assertViewport(`${label} map`);
          await page
            .getByRole("button", { name: "Localizar", exact: true })
            .click();
          await assertPanelFits(`${label} locate map`);
          const advancedCoords=page.getByRole('dialog',{name:'Localizar no mundo',exact:true}).locator('details');
          assert.equal(await advancedCoords.getAttribute('open'),null,'Coordinate entry is secondary and collapsed');
          await advancedCoords.locator('summary').click();
          await page
            .getByLabel("Coordenadas", { exact: true })
            .fill("999, 999");
          await page.getByRole("button", { name: "Ir", exact: true }).click();
          await page
            .getByRole("alert")
            .filter({ hasText: "Use duas coordenadas" })
            .waitFor();
          await page
            .getByRole("button", { name: "Recursos", exact: true })
            .click();
          const locatorPanel=page.getByRole('dialog',{name:'Localizar no mundo',exact:true});
          await advancedCoords.locator('summary').click();
          const panelColor=await locatorPanel.evaluate(node=>getComputedStyle(node).backgroundColor);
          const channels=panelColor.match(/[\d.]+/g)?.slice(0,3).map(Number);assert(channels?.length===3&&channels.every(c=>c<100),'Map sheets retain a dark readable palette');
          await locatorPanel.getByLabel('Buscar destino conhecido',{exact:true}).fill('destino-inexistente-987');
          await locatorPanel.getByText('Nenhum destino conhecido corresponde à busca.',{exact:true}).waitFor();
          await locatorPanel.getByRole('button',{name:'Limpar busca',exact:true}).click();
          await locatorPanel.getByRole('button',{name:'Cidades',exact:true}).click();
          await locatorPanel.getByLabel('Buscar destino conhecido',{exact:true}).fill('Vila do Rio');
          assert.equal(await locatorPanel.locator('[data-map-destination]').count(),1);
          await page.screenshot({path:path.join(reports,`map-locate-city-${viewport.width}.png`),fullPage:true});
          await locatorPanel.getByLabel('Buscar destino conhecido',{exact:true}).fill('');
          await locatorPanel.getByRole('button',{name:'Viagens',exact:true}).click();
          assert(await locatorPanel.locator('[data-map-destination]').count()>0,'Active journeys can be found without issuing another order');
          await assertPanelFits(`${label} map destinations`);
          await page
            .getByRole("button", { name: "Fechar localização", exact: true })
            .click();
          await page.getByRole("dialog").waitFor({ state: "hidden" });
          await page
            .getByRole("button", { name: "Centralizar na capital", exact: true })
            .click();
          await page.locator('[data-centered="true"]').click();
          await assertPanelFits(`${label} capital territory`);
          await page
            .getByRole("button", { name: "Fechar território", exact: true })
            .click();
          await page.getByRole("dialog").waitFor({ state: "hidden" });
          await page
            .getByRole("button", { name: "Centralizar na capital" })
            .click();
          const scales=page.getByLabel('Escala do mapa',{exact:true});
          await scales.getByRole('button',{name:'Mundo',exact:true}).click();
          assert.equal(await scales.getByRole('button',{name:'Mundo',exact:true}).getAttribute('aria-pressed'),'true');
          assert(await page.getByRole('button',{name:'Afastar mapa',exact:true}).isDisabled());
          await page.getByRole('button',{name:'Restaurar visão da capital'}).click();
          await scales.getByRole('button',{name:'Região',exact:true}).click();
          assert.equal(await scales.getByRole('button',{name:'Região',exact:true}).getAttribute('aria-pressed'),'true');
          if(viewport.width===390)await page.screenshot({path:path.join(reports,'map-region.png'),fullPage:true});
          assert(await page.locator('[data-map-journey]').count()>0,'Existing orders have indicative routes');
          assert(await page.locator('[data-resource-region]').count()>0,'Revealed real deposits form resource regions');
          await scales.getByRole('button',{name:'Detalhe',exact:true}).click();
          if(viewport.width===390){
            const before=await page.locator('svg[aria-label="Mapa dos reinos"]').getAttribute('viewBox');
            await page.getByRole('button',{name:'Aproximar mapa',exact:true}).click();
            const after=await page.locator('svg[aria-label="Mapa dos reinos"]').getAttribute('viewBox');
            assert(Number(after.split(' ')[2])<Number(before.split(' ')[2]),'Plus button zooms in');
            assert.equal(await page.getByRole('dialog').count(),0,'Zoom does not open a territory');
            await page.getByRole('button',{name:'Restaurar visão da capital'}).click();
          }
          const rememberedScale=await page.locator('[data-map-scale]').getAttribute('data-map-scale');
          const rememberedCenter=await page.locator('[data-centered="true"]').getAttribute('data-cozy-tile');
          await navigation.getByRole('button',{name:'Coroa',exact:true}).click();
          await navigation.getByRole('button',{name:'Mundo',exact:true}).click();
          await page.waitForFunction(expected=>document.querySelector('[data-map-scale]')?.getAttribute('data-map-scale')===expected,rememberedScale);
          await page.waitForFunction(expected=>document.querySelector('[data-centered="true"]')?.getAttribute('data-cozy-tile')===expected,rememberedCenter);
          const centerTile = page.locator('[data-centered="true"]');
          const tileName = await centerTile.getAttribute("aria-label");
          await centerTile.click();
          await assertPanelFits(`${label} tapped territory`);
          await page.keyboard.press("Escape");
          await page.getByRole("dialog").waitFor({ state: "hidden" });
          await page.waitForFunction(
            () =>
              document.activeElement?.getAttribute("aria-selected") === "true",
          );
          assert.equal(
            await page.evaluate(() =>
              document.activeElement?.getAttribute("aria-label"),
            ),
            tileName,
          );
          const tileBounds = await centerTile.boundingBox();
          assert(tileBounds);
          await page.mouse.move(
            tileBounds.x + tileBounds.width / 2,
            tileBounds.y + tileBounds.height / 2,
          );
          await page.mouse.down();
          await page.mouse.move(
            tileBounds.x + tileBounds.width / 2 + 90,
            tileBounds.y + tileBounds.height / 2,
            { steps: 8 },
          );
          await page.mouse.up();
          assert.notEqual(
            await centerTile.getAttribute("aria-label"),
            tileName,
            "Dragging must move the map",
          );
          assert.equal(
            await page.getByRole("dialog").count(),
            0,
            "Dragging must not open a territory",
          );
          await page
            .getByRole("button", { name: "Centralizar na capital" })
            .click();
          if (viewport.width === 390) {
            await page.screenshot({
              path: path.join(reports, "map-mobile.png"),
              fullPage: true,
            });
          }
          await navigation
            .getByRole("button", { name: "Aliança", exact: true })
            .click();
          await assertViewport(`${label} alliance`);
          await assertImages(`${label} alliance`);
          await page.screenshot({
            path: path.join(
              reports,
              `mobile-alliance${viewport.width === 360 ? "-small" : ""}.png`,
            ),
            fullPage: true,
          });
          await navigation.getByRole("button", { name: /^Relatos/ }).click();
          await assertViewport(`${label} reports`);
          await assertImages(`${label} reports`);
          if (viewport.width === 390) {
            const reportsRegion = page.getByRole("region", {
              name: "Relatos do reino",
              exact: true,
            });
            await reportsRegion.getByText('Em dia',{exact:true}).waitFor();
            const beforeRead=(await req(`/api/worlds/${slug}/cozy`)).data;
            assert.equal(beforeRead.computed.unreadReports,0,'Opening reports automatically acknowledges the visible history');
            assert.equal(
              await reportsRegion.locator("details").count(),
              beforeRead.state.reports.length,
            );
            const search=reportsRegion.getByRole('searchbox',{name:'Buscar relatos',exact:true});
            const example=beforeRead.state.reports[0];
            await search.fill(example.title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleUpperCase('pt-BR'));
            await reportsRegion.getByLabel(`Ler relato: ${example.title}`,{exact:true}).waitFor();
            await reportsRegion.getByRole('button',{name:'Limpar busca de relatos',exact:true}).click();
            assert.equal(await search.evaluate(el=>el===document.activeElement),true);
            const actionable=beforeRead.state.reports.find(r=>['economy','horde','council'].includes(r.kind));assert(actionable);
            await search.fill(actionable.title);
            const record=reportsRegion.locator('details').filter({has:page.getByLabel(`Ler relato: ${actionable.title}`,{exact:true})}).first();
            await record.locator('summary').click();
            const follow=record.getByRole('button',{name:actionable.kind==='economy'?'Conferir recursos':actionable.kind==='horde'?'Conferir defesa do reino':'Voltar ao Conselho',exact:true});
            const shortcuts=[];const collect=request=>{if(request.method()==='POST'&&request.url().endsWith('/cozy'))shortcuts.push(request.postDataJSON());};page.on('request',collect);
            try{
              await follow.click();await page.getByRole('dialog').waitFor();await assertPanelFits('Report follow-up');await closePanel();
              assert.equal(await search.inputValue(),actionable.title);assert.equal(await record.getAttribute('open'),'');
              assert.equal((await req(`/api/worlds/${slug}/cozy`)).data.state.readAt,beforeRead.state.readAt);
              assert.deepEqual(shortcuts,[],'A report shortcut must not issue a second acknowledgement or economic action');
            }finally{page.off('request',collect);}
            await search.fill('zzzz nenhum relato com esta palavra zzzz');
            await reportsRegion.getByRole('heading',{name:'Nenhum relato encontrado',exact:true}).waitFor();
            assert.equal(await reportsRegion.locator('details').count(),0);
            await reportsRegion.getByRole('button',{name:'Ver todos os relatos',exact:true}).click();
            assert.equal(await search.inputValue(),'');
            assert.equal(await reportsRegion.locator('details').count(),beforeRead.state.reports.length);
            await reportsRegion.getByRole('button',{name:/^Não lidos/}).click();
            await reportsRegion.getByRole('heading',{name:'Tudo em dia',exact:true}).waitFor();assert.equal(await reportsRegion.locator('details').count(),0);
            await reportsRegion.getByRole('button',{name:'Ver todos os relatos',exact:true}).click();
            await reportsRegion.getByRole('combobox',{name:'Assunto dos relatos',exact:true}).selectOption('battles');
            assert.equal(await reportsRegion.locator('details').count(),beforeRead.state.reports.filter(report=>['combat','horde'].includes(report.kind)).length);
            await reportsRegion.getByRole('combobox',{name:'Assunto dos relatos',exact:true}).selectOption('all');
            assert.equal(await reportsRegion.locator('details').count(),beforeRead.state.reports.length);
            await page.screenshot({path:path.join(reports,'mobile-reports.png'),fullPage:true});
            const afterRead=(await req(`/api/worlds/${slug}/cozy`)).data;assert.equal(afterRead.computed.unreadReports,0);assert.equal(afterRead.state.reports.length,beforeRead.state.reports.length,'Acknowledgement preserves history');
            await page.reload({ waitUntil: "networkidle" });
            await navigation
              .getByRole("button", { name: "Relatos", exact: true })
              .click();
            await reportsRegion.waitFor();
            assert.equal(
              await reportsRegion
                .locator('details[data-unread="true"]')
                .count(),
              0,
            );
            assert.equal(
              await reportsRegion.locator("details").count(),
              beforeRead.state.reports.length,
            );
            assert.equal(await reportsRegion.getByRole('button',{name:'Marcar todos os relatos como lidos',exact:true}).count(),0,'Read acknowledgement requires no manual bulk action');
            await assertViewport(`${label} reports after reload`);
          }
          await navigation
            .getByRole("button", { name: "Coroa", exact: true })
            .click();
        }
        // A full ten-city kingdom must still fit the smallest supported portrait
        // viewport. Restore the save before the season finalization scenario.
        const threeCities = (await req(`/api/worlds/${slug}/cozy`)).data;
        const tenCities = structuredClone(threeCities);
        const usedCoordinates = new Set(Object.keys(tenCities.shared.claims));
        for (let index = 0; index < 7; index++) {
          let q = -30 + index * 4;
          const r = -30;
          while (usedCoordinates.has(`${q},${r}`)) q++;
          const city = {
            ...structuredClone(capital),
            id: `fixture-city-full-${index}`,
            name: `Vale ${index + 1}`,
            capital: false,
            heroId: null,
            q,
            r,
          };
          usedCoordinates.add(`${q},${r}`);
          tenCities.state.cities.push(city);
          tenCities.shared.claims[`${q},${r}`] = {
            playerId: actorId,
            cityId: city.id,
            name: city.name,
          };
        }
        const saveFixture = async (value) => {
          await db.query(
            "update kw_cozy_player_states set state_json=$1::jsonb, revision=revision+1 where world_player_id=$2",
            [JSON.stringify(value.state), actorId],
          );
          await db.query(
            "update kw_cozy_world_states set state_json=$1::jsonb, revision=revision+1 where world_id=$2",
            [JSON.stringify(value.shared), value.world.id],
          );
        };
        await check('Unfinished achievement shortcuts navigate without submitting or claiming anything',async()=>{
          const baseline=(await req(`/api/worlds/${slug}/cozy`)).data,beginner=structuredClone(baseline);
          const capital=beginner.state.cities.find(city=>city.capital);assert(capital);
          for(const sector of Object.keys(capital.sectors))capital.sectors[sector]=1;
          beginner.state.cities=[capital];beginner.state.orders=[];beginner.state.quests=[];beginner.state.decreesSigned=[];beginner.state.hordesWon=0;beginner.state.explored=[];
          for(const research of Object.keys(beginner.state.research))beginner.state.research[research]=0;
          beginner.shared.claims=Object.fromEntries(Object.entries(beginner.shared.claims).filter(([,claim])=>claim.playerId!==actorId||claim.cityId===capital.id));
          const writes=[];const capture=request=>{if(request.url().endsWith('/cozy')&&request.method()==='POST')writes.push(request.postData());};
          try{
            await saveFixture(beginner);await page.setViewportSize({width:360,height:640});await page.reload({waitUntil:'networkidle'});page.on('request',capture);
            for(const [name,target] of [['Uma cidade para chamar de lar','cities'],['Três cidades, um reino','map'],['Além da neblina','map'],['Conhecimento compartilhado','research'],['O reino permanece','military'],['A voz da Coroa','council']]){
              await navigation.getByRole('button',{name:'Coroa',exact:true}).click();
              await page.getByRole('button',{name:'Conquistas',exact:true}).click();
              await page.getByRole('button',{name:`Avançar missão: ${name}`,exact:true}).click();
              if(target==='cities')await page.getByRole('button',{name:`Ver cidade ${capital.name}`,exact:true}).waitFor();
              else if(target==='map')await page.getByRole('grid',{name:'Territórios próximos',exact:true}).waitFor();
              else{
                await page.getByRole('dialog',{name:target==='research'?'Governo':target==='military'?'Militar':'Conselho',exact:true}).waitFor();
                if(target==='research')assert.equal(await page.getByRole('tab',{name:'Pesquisas',exact:true}).getAttribute('aria-selected'),'true');
              }
              await assertViewport(`Achievement shortcut ${name}`);
              if(await page.getByRole('dialog').count())await closePanel();
            }
            assert.equal(writes.length,0,'Shortcut navigation cannot spend resources or claim a reward');
          }finally{page.off('request',capture);await saveFixture(baseline);await page.reload({waitUntil:'networkidle'});}
        });
        await check('Contextual council and Government direct care to a critical colony before a damaged capital without spending',async()=>{
          const baseline=(await req(`/api/worlds/${slug}/cozy`)).data,context=structuredClone(baseline);
          const critical=context.state.cities.find(city=>!city.capital);assert(critical);
          context.state.cities.forEach(city=>{city.life.contentment=70;city.integrity=100;});
          context.state.cities.find(city=>city.capital).integrity=40;critical.life.contentment=20;critical.life.unrestDays=5;
          context.state.decreesSigned=[];
          const writes=[],capture=request=>{if(request.method()==='POST'&&request.url().endsWith('/cozy'))writes.push(request.postDataJSON());};page.on('request',capture);
          try{
            await saveFixture(context);await page.setViewportSize({width:360,height:640});await page.reload({waitUntil:'networkidle'});
            await page.getByRole('button',{name:'Governo',exact:true}).click();
            const status=page.getByRole('complementary',{name:'Estado do reino',exact:true});await status.getByText('Crise no reino',{exact:true}).waitFor();
            await status.getByRole('button',{name:`Cuidar de ${critical.name}`,exact:true}).click();
            await page.getByRole('region',{name:`Cidade ${critical.name}`,exact:true}).waitFor();assert.equal(await page.getByRole('tab',{name:'Decisões',exact:true}).getAttribute('aria-selected'),'true');
            await navigation.getByRole('button',{name:'Coroa',exact:true}).click();await page.getByRole('button',{name:'Conselho',exact:true}).click();
            await page.getByRole('heading',{name:'As cidades pedem uma resposta',exact:true}).waitFor();
            await page.getByText('Priorizar a confiança das cidades',{exact:true}).waitFor();
            const live=(await req(`/api/worlds/${slug}/cozy`)).data;
            assert(live.computed.decree.body.includes(critical.name));assert.equal(live.state.decreesSigned.length,0);
            await assertPanelFits('Contextual council 360');await page.screenshot({path:path.join(reports,'mobile-council-context-360.png')});
            assert.deepEqual(writes,[],'Context and care shortcuts cannot sign a decree or repair a city');await closePanel();
          }finally{page.off('request',capture);await saveFixture(baseline);await page.reload({waitUntil:'networkidle'});}
        });
        await check('Council city care and ready-first achievements show real next steps without automatic actions',async()=>{
          const baseline=(await req(`/api/worlds/${slug}/cozy`)).data,care=structuredClone(baseline),city=care.state.cities.find(c=>!c.capital)??care.state.cities[0];
          for(const c of care.state.cities)c.life.contentment=70;city.life.contentment=20;care.state.quests=[];
          if(care.computed.decree)care.state.decreesSigned.push(care.computed.decree.day);
          const writes=[],capture=request=>{if(request.method()==='POST'&&request.url().endsWith('/cozy'))writes.push(request.postDataJSON());};page.on('request',capture);
          try{
            await saveFixture(care);await page.setViewportSize({width:360,height:640});await page.reload({waitUntil:'networkidle'});
            await page.getByRole('button',{name:'Conselho',exact:true}).click();
            const cities=page.getByRole('region',{name:'Cidades que precisam de cuidado',exact:true});await cities.getByRole('button',{name:`Cuidar de ${city.name}`,exact:true}).scrollIntoViewIfNeeded();
            await assertPanelFits('Council city care 360');await page.screenshot({path:path.join(reports,'mobile-council-city-care-360.png')});
            await cities.getByRole('button',{name:`Cuidar de ${city.name}`,exact:true}).click();
            await page.getByRole('region',{name:`Cidade ${city.name}`,exact:true}).waitFor();assert.equal(await page.getByRole('tab',{name:'Decisões',exact:true}).getAttribute('aria-selected'),'true');
            await navigation.getByRole('button',{name:'Coroa',exact:true}).click();await page.getByRole('button',{name:'Conquistas',exact:true}).click();
            const achievements=page.getByRole('dialog',{name:'Conquistas',exact:true}),first=achievements.getByRole('article').first();
            await first.getByText('Pronta para receber',{exact:true}).waitFor();
            assert.equal(await first.getByRole('button',{name:/^Receber /}).isEnabled(),true);
            const snapshot=(await req(`/api/worlds/${slug}/cozy`)).data;assert.equal(snapshot.state.quests.length,0);
            await assertPanelFits('Ready achievements 360');await page.screenshot({path:path.join(reports,'mobile-achievements-ready-first-360.png')});
            assert.deepEqual(writes,[],'Viewing care and ready rewards cannot apply a decision or claim a reward');await closePanel();
          }finally{page.off('request',capture);await saveFixture(baseline);await page.reload({waitUntil:'networkidle'});}
        });
        await check('Military and Government funding shortcuts preserve spending and select the correct resource',async()=>{
          const baseline=(await req(`/api/worlds/${slug}/cozy`)).data,poor=structuredClone(baseline);
          poor.state.resources.gold=0;poor.state.resources.materials=0;poor.state.orders=[];
          const writes=[],capture=request=>{if(request.method()==='POST'&&request.url().endsWith('/cozy'))writes.push(request.postDataJSON());};
          page.on('request',capture);
          try{
            await saveFixture(poor);await page.setViewportSize({width:360,height:640});await page.reload({waitUntil:'networkidle'});
            await page.getByRole('button',{name:'Militar',exact:true}).click();
            const militia=page.getByRole('article',{name:'Milícia',exact:true});await militia.getByRole('button',{name:'Ver materiais e produção',exact:true}).click();
            const treasury=page.getByRole('dialog',{name:'Tesouro do reino',exact:true});await treasury.waitFor();
            assert.equal(await treasury.getByRole('tab',{name:'Materiais',exact:true}).getAttribute('aria-selected'),'true');await closePanel();
            await page.getByRole('button',{name:'Governo',exact:true}).click();
            await page.getByRole('button',{name:/^Escolher herói para vaga /}).first().click();await page.getByRole('button',{name:'Ver ouro e onde encontrar',exact:true}).click();await treasury.waitFor();
            assert.equal(await treasury.getByRole('tab',{name:'Ouro',exact:true}).getAttribute('aria-selected'),'true');
            await treasury.getByRole('button',{name:'Ver pesquisas',exact:true}).click();
            assert.equal(await page.getByRole('tab',{name:'Pesquisas',exact:true}).getAttribute('aria-selected'),'true');
            await assertPanelFits('Government funding 360');await page.screenshot({path:path.join(reports,'mobile-government-funding-360.png')});
            await page.getByRole('button',{name:/^Ver pesquisa /}).first().click();await page.getByRole('button',{name:'Ver tesouro',exact:true}).click();await treasury.waitFor();
            assert.equal(await treasury.getByRole('tab',{name:'Ouro',exact:true}).getAttribute('aria-selected'),'true');await closePanel();
            await page.getByRole('button',{name:'Militar',exact:true}).click();await page.getByRole('tab',{name:'Defesa',exact:true}).click();
            const defense=page.getByRole('tabpanel',{name:'Defesa',exact:true});
            assert.equal(await defense.getByRole('article').first().getAttribute('aria-label'),'Preparação para a próxima horda');
            const prepare=await defense.getByRole('button',{name:'Preparar tropas',exact:true}).boundingBox(),dialog=await page.getByRole('dialog').boundingBox();
            await page.screenshot({path:path.join(reports,'mobile-military-readiness-360.png')});
            assert(prepare&&dialog&&prepare.y>=dialog.y&&prepare.y+prepare.height<=dialog.y+dialog.height,'The defense preparation action must fit inside the phone dialog');
            await defense.getByRole('button',{name:'Encontrar aliados',exact:true}).click();await page.getByRole('region',{name:'Aliança do reino',exact:true}).waitFor();
            assert.deepEqual(writes,[],'Funding and defense shortcuts only navigate; they cannot recruit, research or donate');
          }finally{page.off('request',capture);await saveFixture(baseline);await page.reload({waitUntil:'networkidle'});}
        });
        await check('Alliance creation, real support, cooldown and deliberate exit work on mobile',async()=>{
          const baseline=(await req(`/api/worlds/${slug}/cozy`)).data;
          const other=(await req(`/api/worlds/${slug}/cozy`,null,'second')).data;
          assert.equal(baseline.state.allianceId,null);
          try{
            await page.setViewportSize({width:360,height:640});await page.reload({waitUntil:'networkidle'});
            await navigation.getByRole('button',{name:'Aliança',exact:true}).click();
            await page.getByLabel('Nome da sua aliança',{exact:true}).fill('Guardiões do Vale');
            const created=page.waitForResponse(r=>r.url().endsWith('/cozy')&&r.request().method()==='POST');
            await page.getByRole('button',{name:'Criar aliança',exact:true}).click();assert.equal((await created).status(),200);
            await page.getByRole('heading',{name:'Pedidos de apoio',exact:true}).waitFor();
            const group=(await req(`/api/worlds/${slug}/cozy`)).data.state.allianceId;assert(group);
            assert.equal((await command(slug,{type:'alliance_join',allianceId:group},crypto.randomUUID(),'second')).status,200);
            assert.equal((await command(slug,{type:'support_request'},crypto.randomUUID(),'second')).status,200);
            // A persisted cooldown explains a disabled action before any request is sent.
            const cooling=(await req(`/api/worlds/${slug}/cozy`)).data;
            cooling.state.supportSentAt=Date.now();await saveFixture(cooling);
            await page.reload({waitUntil:'networkidle'});try{await navigation.waitFor();}catch(error){await page.screenshot({path:path.join(reports,'alliance-reload-failure.png')});await writeFile(path.join(reports,'alliance-reload-failure.txt'),await page.locator('body').innerText());throw error;}await navigation.getByRole('button',{name:'Aliança',exact:true}).click();
            const ally=cooling.players.find(p=>p.playerId===other.state.playerId);assert(ally);
            const support=page.getByRole('button',{name:`Apoiar ${ally.playerName}`,exact:true});
            await support.waitFor();assert.equal(await support.isDisabled(),true);
            await page.getByText(/Você poderá apoiar outro aliado em/).waitFor();await assertViewport('Alliance cooldown 360');
            cooling.state.supportSentAt=null;await saveFixture(cooling);
            await page.reload({waitUntil:'networkidle'});await navigation.getByRole('button',{name:'Aliança',exact:true}).click();
            assert.equal(await support.isEnabled(),true);
            const offer=(await req(`/api/worlds/${slug}/cozy`)).data.computed.supportOffer;
            await page.getByText('Seu apoio acrescenta',{exact:true}).waitFor();
            await page.screenshot({path:path.join(reports,'mobile-alliance-help-360.png')});
            const accepted=page.waitForResponse(r=>r.url().endsWith('/cozy')&&r.request().method()==='POST');
            await support.click();assert.equal((await accepted).status(),200);await page.getByText('Apoiado',{exact:true}).waitFor();
            const confirmed=(await req(`/api/worlds/${slug}/cozy`)).data;
            assert(confirmed.shared.support.some(s=>s.supporterId===baseline.state.playerId&&s.requesterId===other.state.playerId&&s.power===offer),'The promised support must match the actual server-confirmed power');
            // Exercise actual project costs and completion on the smallest phone viewport.
            const fundedFixture=(await req(`/api/worlds/${slug}/cozy`)).data;
            fundedFixture.state.resources.materials=2000;fundedFixture.state.resources.supplies=2000;await saveFixture(fundedFixture);
            await page.reload({waitUntil:'networkidle'});await navigation.getByRole('button',{name:'Aliança',exact:true}).click();
            await page.getByRole('tab',{name:'Projetos',exact:true}).click();
            const defenseProject=page.locator('article').filter({has:page.getByRole('heading',{name:'Bastião dos aliados',exact:true})});
            await defenseProject.getByRole('button',{name:'Iniciar projeto',exact:true}).click();
            await page.getByText('Projeto em preparação',{exact:true}).waitFor();
            const poor=(await req(`/api/worlds/${slug}/cozy`)).data;poor.state.resources.materials=0;await saveFixture(poor);
            await page.reload({waitUntil:'networkidle'});await navigation.getByRole('button',{name:'Aliança',exact:true}).click();await page.getByRole('tab',{name:'Projetos',exact:true}).click();
            await page.getByText('Sem materiais no tesouro. Ajude com outro recurso.',{exact:true}).waitFor();
            assert.equal(await page.getByRole('button',{name:'Contribuir máximo de materiais',exact:true}).isDisabled(),true);
            assert.equal(await page.getByRole('button',{name:'Contribuir máximo de suprimentos',exact:true}).isEnabled(),true);
            await assertViewport('Alliance shortage 360');await page.screenshot({path:path.join(reports,'mobile-alliance-shortage-360.png')});
            poor.state.resources.materials=2000;await saveFixture(poor);
            await page.reload({waitUntil:'networkidle'});await navigation.getByRole('button',{name:'Aliança',exact:true}).click();await page.getByRole('tab',{name:'Projetos',exact:true}).click();
            await assertViewport('Alliance project 360');await assertImages('Alliance project 360');
            const firstContribution=await page.getByRole('button',{name:'Contribuir máximo de materiais',exact:true}).boundingBox(),bottomNavigation=await navigation.boundingBox();
            await page.screenshot({path:path.join(reports,'mobile-alliance-project-360.png')});
            assert(firstContribution&&bottomNavigation&&firstContribution.y>=0&&firstContribution.y+firstContribution.height<=bottomNavigation.y,`The first project contribution must fit above the phone navigation without scrolling: ${JSON.stringify({firstContribution,bottomNavigation})}`);
            for(const resource of ['materiais','suprimentos']){
              const response=page.waitForResponse(r=>r.url().endsWith('/cozy')&&r.request().method()==='POST');
              await page.getByRole('button',{name:`Contribuir máximo de ${resource}`,exact:true}).click();assert.equal((await response).status(),200);
              if(resource==='materiais'){await page.getByText('1/2 metas completas',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Contribuir máximo de materiais',exact:true}).count(),0);await page.screenshot({path:path.join(reports,'mobile-alliance-project-progress-360.png')});}
            }
            await page.getByText('Bônus ativo',{exact:true}).waitFor();
            const completed=(await req(`/api/worlds/${slug}/cozy`)).data;assert(completed.computed.allianceDefenseBonus>0);assert.equal(completed.computed.influenceDetails.conquests.projects,1);
            if(await page.getByRole('button',{name:'Fechar confirmação',exact:true}).count())await page.getByRole('button',{name:'Fechar confirmação',exact:true}).click();
            await page.screenshot({path:path.join(reports,'mobile-alliance-bonus-360.png')});await assertViewport('Alliance active bonus 360');
            await page.getByRole('tab',{name:'Visão geral',exact:true}).click();
            await page.getByRole('region',{name:'Bônus da aliança',exact:true}).waitFor();
            await page.getByText(`Sua defesa já inclui +${completed.computed.allianceDefenseBonus} do projeto da aliança.`,{exact:true}).waitFor();
            await page.getByRole('tab',{name:'Membros',exact:true}).click();
            await page.getByText('Sair desta aliança',{exact:true}).click();
            assert.equal((await req(`/api/worlds/${slug}/cozy`)).data.state.allianceId,group,'Expanding exit details must not send a command');
            const exit=page.getByRole('button',{name:'Confirmar saída da aliança',exact:true});await exit.waitFor();
            await exit.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(reports,'mobile-alliance-exit-360.png')});await assertViewport('Alliance exit 360');
            const left=page.waitForResponse(r=>r.url().endsWith('/cozy')&&r.request().method()==='POST');await exit.click();assert.equal((await left).status(),200);
            await page.getByRole('button',{name:'Criar aliança',exact:true}).waitFor();
            const after=(await req(`/api/worlds/${slug}/cozy`)).data;assert.equal(after.state.allianceId,null);assert.equal(after.shared.alliances.find(a=>a.id===group).founderId,other.state.playerId);
          }finally{
            await saveFixture(baseline);
            await db.query('update kw_cozy_player_states set state_json=$1::jsonb,revision=revision+1 where world_player_id=$2',[JSON.stringify(other.state),other.state.playerId]);
            await page.reload({waitUntil:'networkidle'});
          }
        });
        await check('Defense shortcuts open recovery decisions and distinguish permanent capital from colonies',async()=>{
          const baseline=(await req(`/api/worlds/${slug}/cozy`)).data;
          const damaged=structuredClone(baseline);
          for(const city of damaged.state.cities)city.integrity=60;
          try{
            await saveFixture(damaged);
            for(const viewport of [{width:390,height:844},{width:360,height:640}]){
              await page.setViewportSize(viewport);await page.reload({waitUntil:'networkidle'});
              await page.getByRole('button',{name:'Governo',exact:true}).click();
              const firstCare=damaged.state.cities.find(city=>(damaged.computed.cityLife[city.id]?.contentment??100)<35||(city.integrity??100)<100);
              await page.getByRole('button',{name:`Cuidar de ${firstCare.name}`,exact:true}).click();
              assert.equal(await page.getByRole('tab',{name:'Decisões',exact:true}).getAttribute('aria-selected'),'true');
              for(const target of [damaged.state.cities.find(city=>city.capital),damaged.state.cities.find(city=>!city.capital)]){
                assert(target);
                await navigation.getByRole('button',{name:'Coroa',exact:true}).click();
                await page.getByRole('button',{name:'Militar',exact:true}).click();
                await page.getByRole('tab',{name:'Defesa',exact:true}).click();
                await page.getByRole('button',{name:`Cuidar da defesa de ${target.name}`,exact:true}).click();
                const city=page.getByRole('region',{name:`Cidade ${target.name}`,exact:true});
                await city.waitFor();assert.equal(await city.getByRole('tab',{name:'Decisões',exact:true}).getAttribute('aria-selected'),'true');
                const warning=target.capital?'A capital permanece no reino, mesmo após uma derrota.':'Novos ataques podem causar a perda desta colônia.';
                await city.getByText(warning,{exact:false}).waitFor();
                assert.equal(await page.getByRole('dialog').count(),0,'Recovery opens decisions directly rather than stacking a sector sheet');
                await assertViewport(`Recovery ${viewport.width} ${target.name}`);
                await page.screenshot({path:path.join(reports,`mobile-recovery-${target.capital?'capital':'colony'}-${viewport.width}.png`)});
              }
            }
          }finally{await saveFixture(baseline);await page.reload({waitUntil:'networkidle'});}
        });
        try {
          await saveFixture(tenCities);
          await page.setViewportSize({ width: 360, height: 640 });
          await page.reload({ waitUntil: "networkidle" });
          await panorama.waitFor();
          await assertViewport("Ten-city kingdom 360x640");
          await assertImages("Ten-city kingdom");
          await assertPanoramaFits("Ten-city kingdom 360x640", 10);
          await page.screenshot({
            path: path.join(reports, "mobile-full-realm.png"),
            fullPage: true,
          });
        } finally {
          await saveFixture(threeCities);
        }
        await check(
          "First steps lead to city, recruitment and exploration from saved progress",
          async () => {
            const baseline = (await req(`/api/worlds/${slug}/cozy`)).data;
            const beginner = structuredClone(baseline);
            beginner.state.cities = [beginner.state.cities[0]];
            for (const sector of Object.keys(beginner.state.cities[0].sectors))
              beginner.state.cities[0].sectors[sector] = 0;
            beginner.state.army = {
              militia: 25,
              shooters: 0,
              scouts: 0,
              machinery: 0,
            };
            beginner.state.orders = [];
            beginner.state.explored = [];
            try {
              await saveFixture(beginner);
              await page.setViewportSize({ width: 390, height: 844 });
              await page.reload({ waitUntil: "networkidle" });
              await page
                .getByRole("button", { name: new RegExp(`^Evoluir ${beginner.state.cities[0].name}$`) })
                .waitFor();
              await page.screenshot({
                path: path.join(reports, "mobile-first-steps.png"),
                fullPage: true,
              });
              await page
                .getByRole("button", { name: new RegExp(`^Evoluir ${beginner.state.cities[0].name}$`) })
                .click();
              await page.getByRole('dialog',{name:'Próximos passos do reino',exact:true}).getByRole('button',{name:'Ver melhoria',exact:true}).click();
              await page
                .getByRole("dialog", {
                  name: "Economia",
                  exact: true,
                })
                .waitFor();
              await page.getByRole('button',{name:'Fechar setor',exact:true}).click();
              beginner.state.cities[0].sectors.administration = 1;
              await saveFixture(beginner);
              await page.reload({ waitUntil: "networkidle" });
              await page
                .getByRole("button", { name: /Reforce seu exército/ })
                .click();
              await page.getByRole('dialog',{name:'Próximos passos do reino',exact:true}).getByRole('button',{name:'Ver recrutamento',exact:true}).click();
              await page
                .getByRole("dialog", { name: "Militar", exact: true })
                .waitFor();
              await closePanel();
              beginner.state.army.militia = 26;
              await saveFixture(beginner);
              await page.reload({ waitUntil: "networkidle" });
              await page
                .getByRole("button", {
                  name: /Explore seu primeiro território/,
                })
                .click();
              await page.getByRole('dialog',{name:'Próximos passos do reino',exact:true}).getByRole('button',{name:'Ver mundo',exact:true}).click();
              await page
                .getByRole("grid", { name: "Territórios próximos" })
                .waitFor();
              const current=(await req(`/api/worlds/${slug}/cozy`)).data;
              beginner.state.decreesSigned=[current.computed.decree?.day??current.computed.day];
              beginner.state.orders=[{id:"active-guidance-explore",kind:"explore",q:1,r:0,createdAt:Date.now(),arrivesAt:Date.now()+4*3600000}];
              await saveFixture(beginner);
              await page.reload({waitUntil:"networkidle"});
              const waiting=page.getByRole("button",{name:/Exploração em curso/});
              await waiting.waitFor();await waiting.click();
              const guide=page.getByRole('dialog',{name:'Próximos passos do reino',exact:true});
              await guide.getByRole('button',{name:'Acompanhar ordens',exact:true}).waitFor();
              assert.equal(await guide.getByRole('button',{name:'Ver mundo',exact:true}).count(),0,'An active exploration is tracked instead of repeated');
              await guide.getByRole('button',{name:'Fechar próximos passos',exact:true}).click();
              beginner.state.orders=[];
              beginner.state.explored = ["1,0"];
              await saveFixture(beginner);
              await page.reload({ waitUntil: "networkidle" });
              assert.equal(await page.getByRole('button',{name:'Explore seu primeiro território',exact:true}).count(),0);
              await page.getByRole('button',{name:new RegExp(`^Evoluir ${beginner.state.cities[0].name}$`)}).waitFor();
              assert.equal(
                await page
                  .getByText("PRIMEIROS PASSOS", { exact: true })
                  .count(),
                0,
              );
            } finally {
              await saveFixture(baseline);
              await page.reload({ waitUntil: "networkidle" });
            }
          },
        );
        await check(
          "Crown hires, assignments, research and decree choices persist from the UI",
          async () => {
            // Isolate actionable states from the main journey. These changes
            // exist only in this local database and are restored in finally;
            // the previous arrival/finalization scenarios keep their orders.
            const baseline = (await req(`/api/worlds/${slug}/cozy`)).data;
            const actionable = structuredClone(baseline);
            actionable.state.resources.gold = 1500;
            actionable.state.orders = [];
            actionable.state.decreesSigned = [];
            const captureActionable = async (name, heading) => {
              for (const viewport of [
                { width: 390, height: 844 },
                { width: 360, height: 640 },
              ]) {
                await page.setViewportSize(viewport);
                if(heading)await page.getByRole('dialog').last().getByRole('heading',{name:heading,exact:true}).scrollIntoViewIfNeeded();
                else await page.getByRole('region',{name:'Pesquisa selecionada: Cultivo e ofícios',exact:true}).scrollIntoViewIfNeeded();
                await assertPanelFits(
                  `${viewport.width}x${viewport.height} ${name}`,
                );
                for(const select of await page.getByRole('dialog').last().locator('select:visible').all()){
                  const colors=await select.evaluate(el=>{const css=getComputedStyle(el);return {color:css.color,background:css.backgroundColor,height:el.getBoundingClientRect().height};});
                  const luminance=color=>{const channels=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{const c=v/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;};
                  const a=luminance(colors.color),b=luminance(colors.background);assert((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,'Hero city selector keeps readable text contrast');assert(colors.height>=44,'Hero assignment remains touch-sized');
                }

                await page.screenshot({
                  path: path.join(
                    reports,
                    `mobile-${name}${viewport.width === 360 ? "-small" : ""}.png`,
                  ),
                  fullPage: true,
                });
              }
            };
            try {
              await saveFixture(actionable);
              await page.reload({ waitUntil: "networkidle" });
              await page
                .getByRole("button", { name: "Governo", exact: true })
                .click();
              const government = page.getByRole("dialog", {
                name: "Governo",
                exact: true,
              });
              const beforeHire = (await req(`/api/worlds/${slug}/cozy`)).data;
              await government.getByRole('button',{name:/^Escolher herói para vaga /}).first().click();
              const hired = await crownCommand(
                { type: "hire", role: "engineer" },
                () =>
                  government
                    .getByRole("button", {
                      name: "Contratar Engenheiro",
                      exact: true,
                    })
                    .click(),
              );
              assert.equal(
                hired.data.state.heroes.length,
                beforeHire.state.heroes.length + 1,
              );
              assert.equal(
                hired.data.state.resources.gold,
                beforeHire.state.resources.gold - beforeHire.computed.heroCost,
                "Hiring deducts the authoritative gold price exactly once",
              );
              const hero = hired.data.state.heroes.find(
                (entry) =>
                  !beforeHire.state.heroes.some(
                    (prior) => prior.id === entry.id,
                  ),
              );
              assert(hero);
              assert.equal(hero.role, "engineer");
              assert.equal(hero.cityId, null);
              const destination = extraCities[0].id;
              await government.getByRole('button',{name:`Gerenciar ${hero.name}`,exact:true}).click();
              const heroCity = government.getByRole("combobox", {
                name: `Cidade de ${hero.name}`,
                exact: true,
              });
              const assigned = await crownCommand(
                { type: "assign", heroId: hero.id, cityId: destination },
                () => heroCity.selectOption(destination),
              );
              assert.equal(
                assigned.data.state.heroes.find((entry) => entry.id === hero.id)
                  .cityId,
                destination,
              );
              assert.equal(
                assigned.data.state.cities.find(
                  (city) => city.id === destination,
                ).heroId,
                hero.id,
              );
              assert.equal(
                assigned.data.state.resources.gold,
                hired.data.state.resources.gold,
              );
              assert.deepEqual(
                assigned.data.state.cities
                  .filter((city) => city.id !== destination)
                  .map((city) => city.heroId),
                hired.data.state.cities
                  .filter((city) => city.id !== destination)
                  .map((city) => city.heroId),
                "Assignment changes only the chosen city's hero",
              );
              await government.getByRole('button',{name:`Gerenciar ${hero.name}`,exact:true}).click();await captureActionable("government-roster", hero.name);
              await government.getByRole('button',{name:`Ver cidade de ${hero.name}`,exact:true}).click();
              await page.getByRole('region',{name:`Cidade ${extraCities[0].name}`,exact:true}).waitFor();
              assert.equal(await page.getByRole('tab',{name:'Decisões',exact:true}).getAttribute('aria-selected'),'true');
              await navigation.getByRole('button',{name:'Coroa',exact:true}).click();
              await page.getByRole('button',{name:'Governo',exact:true}).click();
              await government.getByRole('button',{name:`Gerenciar ${hero.name}`,exact:true}).click();
              const released = await crownCommand(
                { type: "assign", heroId: hero.id, cityId: null },
                () => heroCity.selectOption(""),
              );
              assert.equal(
                released.data.state.heroes.find((entry) => entry.id === hero.id)
                  .cityId,
                null,
              );
              assert.equal(
                released.data.state.cities.find(
                  (city) => city.id === destination,
                ).heroId,
                null,
              );
              assert.equal(
                released.data.state.resources.gold,
                hired.data.state.resources.gold,
              );
              await page.reload({ waitUntil: "networkidle" });
              await page
                .getByRole("button", { name: "Governo", exact: true })
                .click();
              await government.getByRole('button',{name:`Gerenciar ${hero.name}`,exact:true}).click();
              assert.equal(
                await heroCity.inputValue(),
                "",
                "Released heroes remain in reserve after reload",
              );
              await page.getByRole('button',{name:'Fechar detalhes do governo',exact:true}).click();
              await government.getByRole('tab',{name:'Pesquisas',exact:true}).click();
              await government.getByRole('button',{name:'Ver pesquisa Cultivo e ofícios',exact:true}).click();
              const researchButton = government.getByRole("button", {
                name: "Pesquisar Cultivo e ofícios",
                exact: true,
              });
              assert.equal(await researchButton.isEnabled(), true);
              await captureActionable(
                "government-research-ready",
                null,
              );
              const beforeResearch = (await req(`/api/worlds/${slug}/cozy`))
                .data;
              const preview=await government.getByRole('region',{name:'Pesquisa selecionada: Cultivo e ofícios',exact:true}).locator('time').getAttribute('datetime');
              const researched = await crownCommand(
                { type: "research", research: "economy" },
                () => researchButton.click(),
              );
              assert.equal(
                researched.data.state.resources.gold,
                beforeResearch.state.resources.gold -
                  beforeResearch.computed.researchCosts.economy,
                "Research deducts its displayed server price once",
              );
              const researchOrders = researched.data.state.orders.filter(
                (order) => order.kind === "research",
              );
              assert.equal(researchOrders.length, 1);
              assert.equal(researchOrders[0].research, "economy");
              assert.equal(Number(preview.slice(2,-1))*1000,researchOrders[0].arrivesAt-researchOrders[0].createdAt,'Displayed research time must match the committed order');
              assert(researchOrders[0].arrivesAt > researchOrders[0].createdAt);
              assert.equal(
                researched.data.state.research.economy,
                beforeResearch.state.research.economy,
              );
              await government.getByRole('button',{name:'Ver pesquisa Cultivo e ofícios',exact:true}).click();
              assert.equal(await researchButton.isDisabled(),true,'An active research disables the selected purchase action');
              for (const button of await government
                .getByRole("button", { name: /^Pesquisar / })
                .all()) {
                assert.equal(
                  await button.isDisabled(),
                  true,
                  "A running research blocks another purchase",
                );
              }
              const persistedResearch = (await req(`/api/worlds/${slug}/cozy`))
                .data;
              assert.deepEqual(
                persistedResearch.state.orders.filter(
                  (order) => order.kind === "research",
                ),
                researchOrders,
              );
              assert.equal(
                persistedResearch.state.resources.gold,
                researched.data.state.resources.gold,
              );
              await closePanel();
              await page
                .getByRole("button", { name: "Conselho", exact: true })
                .click();
              const council = page.getByRole("dialog", {
                name: "Conselho",
                exact: true,
              });
              const pendingDecree = (await req(`/api/worlds/${slug}/cozy`)).data
                .computed.decree;
              assert(pendingDecree);
              assert.equal(
                await council
                  .locator("button[aria-pressed]").filter({has:page.locator("strong")})
                  .count(),
                2,
              );
              await captureActionable("council-decree", pendingDecree.title);
              const beforeDecree = (await req(`/api/worlds/${slug}/cozy`)).data;
              const choice = pendingDecree.options.find(
                (option) => option.id === "care",
              );
              assert(choice);
              await council.getByRole("button", { name: choice.label, exact: true }).click();
              const signed = await crownCommand(
                {
                  type: "decree",
                  decreeId: pendingDecree.id,
                  optionId: choice.id,
                },
                () =>
                  council
                    .getByRole("button", {
                      name: "Assinar",
                      exact: true,
                    })
                    .click(),
              );
              assert.equal(signed.data.computed.decree, null);
              assert.equal(
                signed.data.state.decreesSigned.filter(
                  (day) => day === pendingDecree.day,
                ).length,
                1,
              );
              const contentment = choice.effects.satisfaction;
              assert.equal(
                signed.data.state.satisfaction,
                Math.min(100, beforeDecree.state.satisfaction + contentment),
              );
              const passiveMaterials =
                (beforeDecree.computed.productionPerDay.materials *
                  (signed.data.state.settledAt -
                    beforeDecree.state.settledAt)) /
                beforeDecree.computed.dayMs;
              assert(
                Math.abs(
                  signed.data.state.resources.materials -
                    beforeDecree.state.resources.materials -
                    passiveMaterials -
                    80,
                ) < 0.000001,
                "The decree grants 80 materials in addition to ordinary production",
              );
              const consequence = signed.data.state.reports.find(
                (entry) =>
                  entry.kind === "council" &&
                  !beforeDecree.state.reports.some(
                    (prior) => prior.id === entry.id,
                  ),
              );
              assert(consequence);
              assert.equal(consequence.title, "Decreto assinado");
              assert(consequence.body.includes(choice.label));
              assert(
                consequence.body.includes(
                  `+${contentment} de contentamento e +80 materiais`,
                ),
              );
              assert.equal(
                await council
                  .locator("button[aria-pressed]").filter({has:page.locator("strong")})
                  .count(),
                0,
              );
              assert.equal(
                (await req(`/api/worlds/${slug}/cozy`)).data.computed.decree,
                null,
              );
              assert.equal(
                (
                  await command(slug, {
                    type: "decree",
                    decreeId: pendingDecree.id,
                    optionId: choice.id,
                  })
                ).status,
                422,
                "A signed decree cannot apply its consequences twice",
              );
            } finally {
              // Stop client polling before restoring; revisions keep increasing
              // so no stale request can overwrite the recovered main save.
              await page.close();
              await saveFixture(baseline);
              const restored = (
                await db.query(
                  "select state_json from kw_cozy_player_states where world_player_id=$1",
                  [actorId],
                )
              ).rows[0].state_json;
              assert.deepEqual(
                restored,
                baseline.state,
                "The isolated UI scenario restores the main save",
              );
            }
          },
        );
        assert.deepEqual(errors, []);
        await browser.close();
        browser = null;
      },
    );
  await check(
    "Offline season finalization saves all players and one trophy, repeat reads keep rewards",
    async () => {
      const id = snapshot.world.id;
      await db.query(
        "update worlds set starts_at=now()-interval '121 days',runtime_anchor_started_at=now()-interval '121 days' where id=$1",
        [id],
      );
      // Settle fixture states from the historical start to exercise unattended catch-up.
      await db.query(
        "update kw_cozy_player_states set state_json=jsonb_set(jsonb_set(state_json,'{settledAt}',to_jsonb((extract(epoch from now()-interval '121 days')*1000)::bigint)),'{createdAt}',to_jsonb((extract(epoch from now()-interval '121 days')*1000)::bigint)) where world_id=$1",
        [id],
      );
      assert.equal((await fetch(base + "/api/cron/cozy")).status, 401);
      const tick = await fetch(base + "/api/cron/cozy", {
        headers: {
          authorization: "Bearer fixture-scheduler-secret-32-characters",
        },
      });
      assert.equal(tick.status, 200, await tick.text());
      assert.equal(
        (await db.query("select status from worlds where id=$1", [id])).rows[0]
          .status,
        "finalized",
      );
      const result = await req(`/api/worlds/${slug}/cozy`);
      assert.equal(result.status, 200, JSON.stringify(result.data));
      assert.equal(result.data.world.status, "finalized");
      assert(result.data.computed.readOnly);
      const account = (await req("/api/me/cozy")).data;
      assert.equal(account.account.seasons, 1);
      assert.equal(account.hallOfFame.length, 1);
      await req(`/api/worlds/${slug}/cozy`);
      assert.deepEqual((await req("/api/me/cozy")).data, account);
    },
  );
  if(process.env.COZY_SKIP_BROWSER!=="1")await check('Account history recovers from errors and timeout, fits mobile and reopens its real kingdom',async()=>{
    const {chromium}=await import('playwright');browser=await chromium.launch({headless:true});
    const page=await browser.newPage({viewport:{width:360,height:640}});
        await experiencedScreenGuides(page,slug);
    await page.context().addCookies([{name:'kw_dev_auth',value:'1',url:base}]);
    let phase='error',release,arrived;
    const gate=new Promise(r=>release=r),arrival=new Promise(r=>arrived=r);
    await page.route('**/api/me/cozy',async route=>{
      if(phase==='error')await route.fulfill({status:503,json:{error:'Histórico temporariamente indisponível'}});
      else if(phase==='hang'){arrived();await gate;try{await route.abort();}catch{/* The browser timed out first. */}}
      else await route.continue();
    });
    try{
      await page.goto(base+'/profile',{waitUntil:'domcontentloaded'});
      const panel=page.getByRole('region',{name:'Histórico da conta',exact:true});await panel.waitFor();
      try{await panel.getByText('Histórico temporariamente indisponível',{exact:true}).waitFor();}catch(error){await page.screenshot({path:path.join(reports,'account-failure-360.png')});throw error;}
      await panel.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(reports,'account-error-360.png')});
      await page.clock.install();phase='hang';await panel.getByRole('button',{name:'Tentar consultar novamente',exact:true}).click();await arrival;
      await page.clock.runFor(20001);await panel.getByText('A consulta demorou a responder. Tente novamente.',{exact:true}).waitFor();release();
      phase='ready';await panel.getByRole('button',{name:'Tentar consultar novamente',exact:true}).click();
      await panel.getByText('Minhas temporadas',{exact:false}).waitFor();
      const actual=(await req('/api/me/cozy')).data;assert(actual.history.length>0);
      await panel.getByText('Minhas temporadas',{exact:false}).click();
      const link=panel.getByRole('link',{name:`Rever reino: ${actual.history[0].worldName}`,exact:true});
      await link.waitFor();assert.equal(await link.getAttribute('href'),`/world/${actual.history[0].worldId}/intelligence`);
      for(const viewport of [{width:390,height:844},{width:360,height:640}]){
        await page.setViewportSize(viewport);await panel.scrollIntoViewIfNeeded();
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
        await page.screenshot({path:path.join(reports,`account-history-${viewport.width}.png`)});
      }
      await link.click();await page.getByRole('navigation',{name:'Áreas do reino',exact:true}).waitFor();
      assert(page.url().includes(actual.history[0].worldId));
    }finally{release();await browser.close();browser=null;}
  });
  if (process.env.COZY_SKIP_BROWSER !== "1")
    await check(
      "Finalized kingdoms still allow reading reports without changing resources",
      async () => {
        // Leave historical reports unread in this local fixture so the archived
        // season still exercises its permitted, non-economic read command.
        await db.query(
          "update kw_cozy_player_states set state_json=jsonb_set(state_json,'{readAt}','0'::jsonb),revision=revision+1 where world_player_id=$1",
          [actorId],
        );
        const prior = (await req(`/api/worlds/${slug}/cozy`)).data;
        assert(prior.computed.readOnly);
        assert(prior.computed.unreadReports > 0);
        const { chromium } = await import("playwright");
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage({
          viewport: { width: 390, height: 844 },
        });
        await experiencedScreenGuides(page,slug);
        await page
          .context()
          .addCookies([{ name: "kw_dev_auth", value: "1", url: base }]);
        await page.goto(`${base}/world/${slug}/intelligence`, {
          waitUntil: "networkidle",
        });
        const reply=page.waitForResponse(response=>response.url().endsWith('/cozy')&&response.request().method()==='POST'&&response.request().postDataJSON()?.action?.type==='read_reports');
        await page
          .getByRole("navigation", { name: "Áreas do reino", exact: true })
          .getByRole("button", { name: "Relatos", exact: true })
          .click();
        const readReply = await reply;
        assert.equal(readReply.status(), 200);
        await page
          .getByText("Em dia", { exact: true })
          .waitFor();
        const after = (await req(`/api/worlds/${slug}/cozy`)).data;
        assert.equal(after.computed.unreadReports, 0);
        assert.equal(after.world.status, "finalized");
        assert.deepEqual(after.state.resources, prior.state.resources);
        assert.equal(after.state.reports.length, prior.state.reports.length);
        const requestId = readReply.request().postDataJSON().requestId;
        const repeated = await command(
          slug,
          { type: "read_reports" },
          requestId,
        );
        assert.equal(repeated.status, 200);
        assert.equal(repeated.data.state.readAt, after.state.readAt);
        assert.equal(
          (
            await command(
              slug,
              { type: "recruit", troop: "militia", amount: 1 },
              requestId,
            )
          ).status,
          409,
        );
        assert.equal(
          (
            await command(slug, {
              type: "recruit",
              troop: "militia",
              amount: 1,
            })
          ).status,
          422,
          "Reading reports must not reopen economic actions after finalization",
        );
        await browser.close();
        browser = null;
      },
    );
  await check('Economic Express through HTTP: clock, prepaid queue, replay and cancellation survive reload',async()=>{
    const compatible=await req('/api/worlds/create',{name:'Expresso antes da migração',mode:'express'});assert.equal(compatible.status,200,JSON.stringify(compatible.data));
    const oldPayload=(await req(`/api/worlds/${compatible.data.world.slug}/cozy`)).data;assert.equal(oldPayload.world.economyVersion,undefined);assert.equal(oldPayload.computed.dayMs,86400000/4);
    await db.exec(await readFile(new URL('../63_SQL_COZY_EXPRESS_ECONOMY.sql',import.meta.url),'utf8'));
    const made=await req('/api/worlds/create',{name:'Expresso econômico',mode:'express'});assert.equal(made.status,200,JSON.stringify(made.data));
    const id=made.data.world.slug;const started=await command(id,{type:'start_world'});assert.equal(started.status,200,JSON.stringify(started.data));
    const initial=(await req(`/api/worlds/${id}/cozy`)).data;
    assert.equal(initial.world.economyVersion,2);assert.equal(initial.computed.dayMs,86400000);assert.equal(initial.computed.durationDays,30);
    assert.equal(initial.shared.progressionBalance.militaryDivisor,75);
    const receipt=crypto.randomUUID(),action={type:'plan_research',research:'economy',steps:2};
    const first=await command(id,action,receipt);assert.equal(first.status,200,JSON.stringify(first.data));
    assert.equal((await command(id,action,receipt)).status,200);
    let persisted=(await req(`/api/worlds/${id}/cozy`)).data;assert.equal(persisted.state.orders.filter(o=>o.planned).length,2);assert.equal(persisted.state.resources.gold,initial.state.resources.gold-135);
    const plan=persisted.state.orders.find(o=>o.planned&&!o.planned.started),cancelReceipt=crypto.randomUUID();
    assert.equal((await command(id,{type:'cancel_plan',orderId:plan.id},cancelReceipt)).status,200);
    assert.equal((await command(id,{type:'cancel_plan',orderId:plan.id},cancelReceipt)).status,200);
    persisted=(await req(`/api/worlds/${id}/cozy`)).data;assert.equal(persisted.state.orders.length,1);assert.equal(persisted.state.resources.gold,initial.state.resources.gold-50);
    assert.equal(persisted.state.progression.balance.plannedCapacity,12);
    assert.equal(persisted.state.progression.balance.constructionGrowth,1.36);
    assert.equal(persisted.state.progression.balance.councilMeaningfulDecrees,true);
    assert.deepEqual(persisted.state.progression.balance.councilSourceCaps,{decree:160,local:140,stable:200});
    assert.deepEqual(persisted.state.progression.balance.infrastructureWeights,[150,100,70,50,35,25,20,20,15,15]);
    const councilReceipt=crypto.randomUUID(),decreeAction={type:'decree',decreeId:persisted.computed.decree.id,optionId:'care'};
    const decided=await command(id,decreeAction,councilReceipt);assert.equal(decided.status,200,JSON.stringify(decided.data));
    assert.equal((await command(id,decreeAction,councilReceipt)).status,200);
    persisted=(await req(`/api/worlds/${id}/cozy`)).data;
    assert.equal(persisted.state.progression.council.sources.decree,16,'One decree receipt yields credit once');
    if(process.env.COZY_SKIP_BROWSER!=="1"){
      const {chromium}=await import('playwright');browser=await chromium.launch({headless:true});
      try{
        const page=await browser.newPage({viewport:{width:360,height:640}});
        await experiencedScreenGuides(page,id);
        await page.context().addCookies([{name:'kw_dev_auth',value:'1',url:base}]);
        await page.goto(`${base}/world/${id}/intelligence`,{waitUntil:'networkidle'});
        await page.getByRole('button',{name:'Conselho',exact:true}).click();
        const help=page.getByRole('dialog',{name:'Como decidir no Conselho',exact:true});
        if(await help.count())await page.keyboard.press('Escape');
        const panel=page.getByRole('dialog',{name:'Conselho',exact:true});await panel.waitFor();
        await panel.getByRole('button',{name:'Fontes de influência',exact:true}).click();
        const current=(await req(`/api/worlds/${id}/cozy`)).data;
        for(const [label,key] of [['Decretos','decree'],['Cidades','local'],['Constância','stable']]){
          const row=panel.locator('#area-sources>div').filter({has:page.getByText(label,{exact:true})});
          assert.equal(await row.locator('dd').innerText(),`${current.state.progression.council.sources[key]}/${current.state.progression.balance.councilSourceCaps[key]}`);
        }
        assert.equal(await panel.getByRole('progressbar',{name:'Influência de Conselho',exact:true}).getAttribute('value'),String(current.computed.influence.society));
        for(const width of [360,390]){await page.setViewportSize({width,height:740});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await page.screenshot({path:path.join(reports,`mvp-council-${width}.png`)});}
      }finally{await browser.close();browser=null;}
    }
    // Prefund only this API boundary fixture; economy feasibility is measured by normal-resource bots.
    await db.query("update kw_cozy_player_states set state_json=jsonb_set(state_json,'{resources,gold}','10000'::jsonb),revision=revision+1 where world_player_id=$1",[persisted.state.playerId]);
    for(const research of ['military','fortification','exploration']){const response=await command(id,{type:'plan_research',research,steps:4});assert.equal(response.status,200,JSON.stringify(response.data));}
    const full=(await req(`/api/worlds/${id}/cozy`)).data;assert.equal(full.state.orders.filter(o=>o.planned&&!o.planned.started).length,12);
    assert.equal((await command(id,{type:'plan_research',research:'economy',steps:1})).status,422);
    const unchanged=(await req(`/api/worlds/${id}/cozy`)).data;assert.equal(unchanged.state.resources.gold,full.state.resources.gold);

  });
  if(process.env.COZY_SKIP_BROWSER!=="1")await check('Mobile synchronization failure preserves the kingdom and offers a visible safe retry',async()=>{
    const {chromium}=await import('playwright');browser=await chromium.launch({headless:true});
    try{
      const page=await browser.newPage({viewport:{width:360,height:740}});
        await experiencedScreenGuides(page,slug);await page.context().addCookies([{name:'kw_dev_auth',value:'1',url:base}]);
      await page.goto(`${base}/world/${slug}/intelligence`,{waitUntil:'networkidle'});await page.getByRole('navigation',{name:'Áreas do reino'}).waitFor();
      let drop=true;const endpoint=`**/api/worlds/${slug}/cozy`;
      await page.route(endpoint,route=>drop&&route.request().method()==='GET'?route.abort('internetdisconnected'):route.continue());
      await page.getByRole('button',{name:'Menu do reino',exact:true}).click();await page.getByRole('button',{name:'Sincronizar reino',exact:true}).click();
      const warning=page.getByRole('dialog',{name:'Seu mundo',exact:true}).getByRole('alert');await warning.waitFor();assert.match(await warning.innerText(),/Verifique a conexão/);assert.equal(await page.locator('nav[aria-label="Áreas do reino"]').count(),1);
      const retry=page.getByRole('button',{name:'Tentar sincronizar',exact:true});await retry.waitFor();const bounds=await retry.boundingBox();assert(bounds.height>=44);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
      await page.screenshot({path:path.join(reports,'mobile-network-retry-360.png')});
      drop=false;await retry.click();await warning.waitFor({state:'hidden'});await page.unroute(endpoint);await page.getByRole('button',{name:'Fechar painel',exact:true}).click();await page.getByRole('navigation',{name:'Áreas do reino'}).waitFor();
    }finally{await browser.close();browser=null;}
  });
  await check('Competitive HTTP combat: immutable mode, shared arrival, capital transfer, recipient threat and definitive capital selection',async()=>{
    await db.exec(await readFile(new URL('../63_SQL_COZY_EXPRESS_ECONOMY.sql',import.meta.url),'utf8'));
    await db.exec(await readFile(new URL('../65_SQL_COZY_LOBBY.sql',import.meta.url),'utf8'));await db.exec(await readFile(new URL('../74_SQL_COMPETITIVE_WORLD_MODE.sql',import.meta.url),'utf8'));
    const made=await req('/api/worlds/create',{name:'Competitive local API',mode:'express',combatMode:'competitive'});assert.equal(made.status,200,JSON.stringify(made.data));const slug=made.data.world.slug;let a,b;
    try{
      const joined=await req('/api/worlds/join',{code:made.data.world.joinCode},'pvp-defender');assert.equal(joined.status,200,JSON.stringify(joined.data));assert.equal((await command(slug,{type:'start_world'})).status,200);
      for(const who of ['1','pvp-defender']){const chosen=await command(slug,{type:'king_choose',profileId:'builder',nickname:'Account king'},crypto.randomUUID(),who);assert.equal(chosen.status,200,JSON.stringify(chosen.data));}

      a=(await req(`/api/worlds/${slug}/cozy`)).data;b=(await req(`/api/worlds/${slug}/cozy`,undefined,'pvp-defender')).data;assert.equal(a.world.combatMode,'competitive');
      await assert.rejects(()=>db.query("update worlds set combat_mode='cozy' where id=$1",[a.world.id]),/COMBAT_MODE_LOCKED/);
      const city=b.state.cities[0];a.state.explored.push(`${city.q},${city.r}`);a.state.army.militia=500;a.state.resources.supplies=10000;a.state.heroes.push({id:'pvp-occupier',name:'Occupier',role:'general',cityId:null});b.state.army={militia:10,shooters:0,scouts:0,machinery:0};city.sectors.defense=0;city.sectors.economy=5;city.integrity=50;const colony={...structuredClone(city),id:'pvp-replacement',capital:false,q:city.q+1,name:'Capital sucessora',integrity:100};b.state.cities.push(colony);
      const shared=a.shared;shared.claims[`${colony.q},${colony.r}`]={playerId:b.state.playerId,cityId:colony.id,name:colony.name};await db.query('update kw_cozy_world_states set state_json=$1::jsonb,revision=revision+1 where world_id=$2',[JSON.stringify(shared),a.world.id]);
      for(const payload of [a,b])await db.query('update kw_cozy_player_states set state_json=$1::jsonb,revision=revision+1 where world_player_id=$2',[JSON.stringify(payload.state),payload.state.playerId]);
      const action={type:'attack_player',q:city.q,r:city.r,conquest:true,heroId:'pvp-occupier'},receipt=crypto.randomUUID();const sent=await command(slug,action,receipt);assert.equal(sent.status,200,JSON.stringify(sent.data));const order=sent.data.state.orders.find(o=>o.targetPlayerId);assert(order);assert(order.arrivesAt>sent.data.serverNow);const duplicate=await command(slug,action,receipt);assert.equal(duplicate.status,200);assert.equal(duplicate.data.state.orders.filter(o=>o.targetPlayerId).length,1);
      const warned=await req(`/api/worlds/${slug}/cozy`,undefined,'pvp-defender');assert.equal(warned.data.computed.playerThreats.length,1);assert.equal(warned.data.computed.playerThreats[0].cityId,city.id);assert.equal(sent.data.computed.playerThreats.length,0);
      if(process.env.COZY_SKIP_BROWSER!=='1'){
       const {chromium}=await import('playwright');const browser=await chromium.launch();try{
        const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,extraHTTPHeaders:{'x-kw-smoke':'1'}});await context.addCookies([{name:'kw_dev_auth',value:'pvp-defender',url:base}]);await context.addInitScript(id=>{for(const screen of ['crown','military','city'])localStorage.setItem(`kw-screen-help:v1:${screen}:${id}`,'seen');},b.state.playerId);
        const page=await context.newPage();await page.goto(base+`/world/${slug}/intelligence`,{waitUntil:'networkidle'});await page.getByRole('button',{name:`Ataque a caminho de ${city.name}`,exact:true}).tap();await page.getByRole('region',{name:'Ataques de jogadores',exact:true}).waitFor();
        const warning=page.getByRole('button',{name:`Preparar ${city.name} contra ${a.state.playerName}`,exact:true});await warning.waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(reports,'incoming-player-defense-390.png')});await warning.tap();await page.getByRole('region',{name:`Cidade ${city.name}`,exact:true}).waitFor();await page.getByRole('tab',{name:'Decisões',exact:true}).waitFor();
       }finally{await browser.close();}
      }
      async function arrive(payload){const pending=payload.state.orders.find(o=>o.targetPlayerId),at=Math.max(Date.now(),payload.state.settledAt)+30;pending.arrivesAt=at;await db.query('update kw_cozy_player_states set state_json=$1::jsonb,revision=revision+1 where world_player_id=$2',[JSON.stringify(payload.state),payload.state.playerId]);await sleep(Math.max(0,at-Date.now()+1));const result=await req(`/api/worlds/${slug}/cozy`,undefined,'pvp-defender');assert.equal(result.status,200,JSON.stringify(result.data));return result.data;}
      let damaged=await arrive(duplicate.data);assert.equal(damaged.state.cities.find(c=>c.id===city.id).integrity,25);assert.equal(damaged.state.cities.length,2);
      if(process.env.COZY_SKIP_BROWSER!=='1'){
       const {chromium}=await import('playwright');const browser=await chromium.launch();try{
        const context=await browser.newContext({viewport:{width:390,height:844},extraHTTPHeaders:{'x-kw-smoke':'1'}});await context.addCookies([{name:'kw_dev_auth',value:'1',url:base}]);await context.addInitScript(id=>{for(const screen of ['crown','orders','reports','map','military'])localStorage.setItem(`kw-screen-help:v1:${screen}:${id}`,'seen');},a.state.playerId);
        const page=await context.newPage();await page.goto(base+`/world/${slug}/intelligence`,{waitUntil:'networkidle'});await page.getByRole('button',{name:/Ordens do reino:/}).click();await page.getByRole('heading',{name:'Retorno do exército',exact:true}).waitFor();await page.getByText('Retorno em',{exact:true}).waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(reports,'competitive-return-390.png')});
        await page.getByRole('button',{name:'Fechar painel',exact:true}).click();await page.getByRole('button',{name:'Militar',exact:true}).click();
        await page.getByText('Investida retornando',{exact:true}).waitFor();assert.equal(await page.getByText(/disponíveis em casa|Poder em casa|\d+ em marcha/).count(),0);assert.equal(await page.getByRole('button',{name:'Recrutar 1 Milícia',exact:true}).isEnabled(),false,'The single army still occupies its capacity');
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(reports,'military-expedition-390.png')});await page.getByRole('button',{name:'Acompanhar investida',exact:true}).click();await page.getByRole('heading',{name:'Retorno do exército',exact:true}).waitFor();
        await page.getByRole('button',{name:'Fechar painel',exact:true}).click();await page.getByRole('button',{name:'Relatos',exact:true}).click();await page.getByLabel('Ler relato: Ataque causou danos',{exact:true}).click();
        const result=page.getByRole('region',{name:`Resultado em ${city.name}`,exact:true});await result.waitFor();assert.equal(await result.getByRole('meter').count(),2);assert.equal(await result.getByRole('meter',{name:`Integridade de ${city.name}`,exact:true}).getAttribute('aria-valuenow'),'25');
        for(const width of [320,390]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await result.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(reports,`competitive-result-${width}.png`)});}
        await page.getByRole('button',{name:'Ver local da batalha',exact:true}).click();await page.getByRole('button',{name:'Atacar estruturas',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Atacar estruturas',exact:true}).isDisabled(),true);await page.getByText(/Chegada .*Volta/).waitFor();

       }finally{await browser.close();}
      }
      const inTransit=await command(slug,action);assert.equal(inTransit.status,422,'Cannot send a second army before its return');
      const travelling=await req(`/api/worlds/${slug}/cozy`);assert.equal(travelling.status,200);const back=travelling.data.state.orders.find(o=>o.returning);assert(back);back.arrivesAt=Math.max(Date.now(),travelling.data.state.settledAt)+30;await db.query('update kw_cozy_player_states set state_json=$1::jsonb,revision=revision+1 where world_player_id=$2',[JSON.stringify(travelling.data.state),travelling.data.state.playerId]);await sleep(Math.max(0,back.arrivesAt-Date.now()+1));
      const second=await command(slug,action);assert.equal(second.status,200,JSON.stringify(second.data));const fallen=await arrive(second.data);assert.equal(fallen.state.cities.length,1);assert.equal(fallen.state.capitalSelectionPending,true);assert.equal(fallen.state.cities[0].capital,true);assert.equal(fallen.shared.claims[`${city.q},${city.r}`].playerId,a.state.playerId);
      if(process.env.COZY_SKIP_BROWSER!=='1'){
       const {chromium}=await import('playwright');const browser=await chromium.launch();try{const context=await browser.newContext({viewport:{width:390,height:844},extraHTTPHeaders:{'x-kw-smoke':'1'}});await context.addCookies([{name:'kw_dev_auth',value:'pvp-defender',url:base}]);const page=await context.newPage();await context.addInitScript(id=>{for(const screen of ['crown','cities','city'])localStorage.setItem(`kw-screen-help:v1:${screen}:${id}`,'seen');},fallen.state.playerId);await page.goto(base+`/world/${slug}/intelligence`,{waitUntil:'networkidle'});await page.getByRole('button',{name:'Escolher nova capital',exact:true}).click();await page.getByRole('button',{name:'Ver cidade Capital sucessora',exact:true}).click();const chosenReply=page.waitForResponse(r=>r.url().endsWith('/cozy')&&r.request().method()==='POST'&&r.request().postDataJSON()?.action?.type==='capital_choose');await page.getByRole('button',{name:'Confirmar como capital',exact:true}).click();assert.equal((await chosenReply).status(),200);await page.getByRole('button',{name:'Confirmar como capital',exact:true}).waitFor({state:'hidden'});await page.getByRole('status',{name:'Ação confirmada',exact:true}).getByText('Capital sucessora foi confirmada como capital.',{exact:true}).waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(reports,'competitive-capital-successor-390.png')});}finally{await browser.close();}
      }else{const chosen=await command(slug,{type:'capital_choose',cityId:colony.id},crypto.randomUUID(),'pvp-defender');assert.equal(chosen.status,200,JSON.stringify(chosen.data));}
      const result=(await req(`/api/worlds/${slug}/cozy`,undefined,'pvp-defender')).data;assert.equal(result.state.capitalSelectionPending,false);assert.equal(result.state.cities[0].capital,true);const repeat=await command(slug,{type:'capital_choose',cityId:colony.id},crypto.randomUUID(),'pvp-defender');assert.equal(repeat.status,422);
      assert.equal((await req(`/api/worlds/${slug}/cozy`)).data.state.orders.some(o=>o.targetPlayerId),false);
    }finally{if(a){await db.query('delete from world_players where world_id=$1',[a.world.id]);await db.query('delete from worlds where id=$1',[a.world.id]);}}
  });
  await check('Competitive HTTP combat: touch exploration preview, quoted dispatch and private corridor survive reload',async()=>{
    const made=await req('/api/worlds/create',{name:'Exploration route mobile',mode:'express',combatMode:'competitive'});assert.equal(made.status,200,JSON.stringify(made.data));const slug=made.data.world.slug;
    let payload;
    try{
      assert.equal((await command(slug,{type:'start_world'})).status,200);assert.equal((await command(slug,{type:'king_choose',profileId:'builder',nickname:'Scout'})).status,200);
      payload=(await req(`/api/worlds/${slug}/cozy`)).data;payload.state.resources.supplies=10000;
      await db.query('update kw_cozy_player_states set state_json=$1::jsonb,revision=revision+1 where world_player_id=$2',[JSON.stringify(payload.state),payload.state.playerId]);
      const E=loadCozyEngine(),R=loadCozyEngine('exploration-route'),M=loadCozyEngine('map-presentation'),origin=payload.state.cities[0];let target;
      for(const dq of [10,-10,15,-15])for(const dr of [0,3,-3]){
       const candidate={q:origin.q+dq,r:origin.r+dr};if(target||payload.tiles.some(t=>t.q===candidate.q&&t.r===candidate.r))continue;
       try{E.applyCozyAction(payload.state,payload.shared,payload.world,{type:'explore',...candidate},payload.serverNow);target=candidate;}catch{}
      }
      assert(target,'A legal destination outside current map knowledge exists');
      let dispatched;
      if(process.env.COZY_SKIP_BROWSER!=='1'){
       const {chromium}=await import('playwright');const browser=await chromium.launch();try{
        const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,extraHTTPHeaders:{'x-kw-smoke':'1'}});await context.addCookies([{name:'kw_dev_auth',value:'1',url:base}]);
        await context.addInitScript(({playerId,worldId,target})=>{for(const screen of ['crown','map','orders'])localStorage.setItem(`kw-screen-help:v1:${screen}:${playerId}`,'seen');localStorage.setItem(`kw-cozy-map:${worldId}:${playerId}`,JSON.stringify({center:target,scale:1}));},{playerId:payload.state.playerId,worldId:payload.world.id,target});
        const page=await context.newPage();await page.goto(base+`/world/${slug}/intelligence`,{waitUntil:'networkidle'});await page.getByRole('button',{name:'Mundo',exact:true}).click();
        const map=page.locator('svg[aria-label="Mapa dos reinos"]');await map.waitFor();
        // Convert the chosen ground point through the real SVG camera; use a touch event, not a React hook.
        const point=M.mapPoint(target),spot=await map.evaluate((svg,point)=>{const b=svg.getBoundingClientRect(),v=svg.viewBox.baseVal;return {x:b.x+(point.x-v.x)/v.width*b.width,y:b.y+(point.y-v.y)/v.height*b.height};},point);
        await page.touchscreen.tap(spot.x,spot.y);await page.getByRole('button',{name:'Explorar caminho',exact:false}).waitFor();await page.locator('[data-exploration-preview="true"]').waitFor();
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(reports,'exploration-corridor-preview-390.png')});
        const sent=page.waitForResponse(r=>r.url().endsWith('/cozy')&&r.request().method()==='POST'&&r.request().postDataJSON()?.action?.type==='explore');await page.getByRole('button',{name:'Explorar caminho',exact:false}).tap();const reply=await sent;assert.equal(reply.status(),200);dispatched=await reply.json();
        assert(dispatched.state.orders.some(o=>o.explorationPath?.length>5));
        const blockedExplore=page.getByRole('button',{name:'Explorar caminho',exact:false});
        await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(button=>button.textContent.includes('Explorar caminho')&&button.getAttribute('aria-disabled')==='true'));
        let repeatedExplorations=0;
        const countExplorations=request=>{if(request.method()==='POST'&&request.url().endsWith('/cozy')&&request.postDataJSON()?.action?.type==='explore')repeatedExplorations++;};
        page.on('request',countExplorations);
        await blockedExplore.click({force:true});
        await page.getByRole('status').filter({hasText:/Exploração em andamento/}).waitFor();
        assert.equal(repeatedExplorations,0,'A blocked exploration explains the wait without issuing another command');
        page.off('request',countExplorations);
        await page.screenshot({path:path.join(reports,'exploration-busy-feedback-390.png')});

        const order=dispatched.state.orders.find(o=>o.explorationPath),at=Math.max(Date.now(),dispatched.state.settledAt)+30;order.arrivesAt=at;
        await db.query('update kw_cozy_player_states set state_json=$1::jsonb,revision=revision+1 where world_player_id=$2',[JSON.stringify(dispatched.state),dispatched.state.playerId]);await sleep(Math.max(0,at-Date.now()+1));
        await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'Mundo',exact:true}).click();await map.waitFor();
        for(const width of [320,390]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(reports,`exploration-corridor-discovered-${width}.png`)});}
       }finally{await browser.close();}
      }else{
       const sent=await command(slug,{type:'explore',...target});assert.equal(sent.status,200);dispatched=sent.data;const order=dispatched.state.orders.find(o=>o.explorationPath);order.arrivesAt=Math.max(Date.now(),dispatched.state.settledAt)+30;
       await db.query('update kw_cozy_player_states set state_json=$1::jsonb,revision=revision+1 where world_player_id=$2',[JSON.stringify(dispatched.state),dispatched.state.playerId]);await sleep(Math.max(0,order.arrivesAt-Date.now()+1));
      }
      const result=await req(`/api/worlds/${slug}/cozy`);assert.equal(result.status,200);const order=dispatched.state.orders.find(o=>o.explorationPath);
      assert.deepEqual(result.data.state.scoutedCells,R.explorationCorridor(order.explorationPath,payload.computed.worldDiagonalLimit));
      assert.deepEqual(result.data.shared.claims,payload.shared.claims);assert.deepEqual(result.data.shared.territories,payload.shared.territories);
      assert(result.data.tiles.find(t=>t.id===`${target.q},${target.r}`)?.revealed);assert.equal(result.data.state.explored.filter(id=>!payload.state.explored.includes(id)).length,1);
    }finally{if(payload){await db.query('delete from world_players where world_id=$1',[payload.world.id]);await db.query('delete from worlds where id=$1',[payload.world.id]);}}
  });
  await check('Closing MVP: automatic report retry stays silent and a slow acknowledgement never blocks mobile recruitment',async()=>{
    const who='report-reader',made=await req('/api/worlds/create',{name:'Reports recovery mobile',mode:'express'},who);assert.equal(made.status,200,JSON.stringify(made.data));const slug=made.data.world.slug;let payload;
    try{
      assert.equal((await command(slug,{type:'start_world'},crypto.randomUUID(),who)).status,200);assert.equal((await command(slug,{type:'king_choose',profileId:'builder',nickname:'Reader'},crypto.randomUUID(),who)).status,200);
      payload=(await req(`/api/worlds/${slug}/cozy`,undefined,who)).data;
      if(process.env.COZY_SKIP_BROWSER==='1')return;
      const {chromium}=await import('playwright');const browser=await chromium.launch();let release;
      try{
        const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,extraHTTPHeaders:{'x-kw-smoke':'1'}});await context.addCookies([{name:'kw_dev_auth',value:who,url:base}]);await context.addInitScript(id=>{for(const screen of ['crown','reports','military'])localStorage.setItem(`kw-screen-help:v1:${screen}:${id}`,'seen');},payload.state.playerId);
        const page=await context.newPage();let acknowledgementCount=0,delay=false,started;const arrival=new Promise(r=>started=r),gate=new Promise(r=>release=r);
        await page.route('**/api/worlds/*/cozy',async route=>{
          if(route.request().method()==='POST'&&route.request().postDataJSON()?.action?.type==='read_reports'){
            acknowledgementCount++;if(acknowledgementCount===1){await route.fulfill({status:503,json:{error:'Synthetic acknowledgement outage'}});return;}
            if(delay){started();await gate;}
          }await route.continue();
        });
        await page.goto(base+`/world/${slug}/intelligence`,{waitUntil:'networkidle'});
        const recovered=page.waitForResponse(r=>r.url().endsWith('/cozy')&&r.request().method()==='POST'&&r.request().postDataJSON()?.action?.type==='read_reports'&&r.status()===200);
        await page.getByRole('button',{name:'Relatos',exact:true}).tap();const acknowledged=await recovered;assert.equal(acknowledgementCount,2);const marked=await acknowledged.json();assert(marked.state.readAt>=Math.max(...marked.state.reports.map(r=>r.at)));assert.deepEqual((await page.getByRole('alert').allTextContents()).map(t=>t.trim()).filter(Boolean),[]);
        await page.getByRole('button',{name:'Coroa',exact:true}).tap();marked.state.readAt=0;await db.query('update kw_cozy_player_states set state_json=$1::jsonb,revision=revision+1 where world_player_id=$2',[JSON.stringify(marked.state),marked.state.playerId]);delay=true;
        await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'Relatos',exact:true}).tap();await arrival;
        await page.getByRole('button',{name:'Coroa',exact:true}).tap();await page.getByRole('button',{name:'Militar',exact:true}).tap();
        const reply=page.waitForResponse(r=>r.url().endsWith('/cozy')&&r.request().method()==='POST'&&r.request().postDataJSON()?.action?.type==='recruit');const recruit=page.getByRole('button',{name:'Recrutar 1 Milícia',exact:true});assert.equal(await recruit.isEnabled(),true);await recruit.tap();assert.equal((await reply).status(),200);release();
        await page.getByRole('status',{name:'Ação confirmada',exact:true}).waitFor();assert.deepEqual((await page.getByRole('alert').allTextContents()).map(t=>t.trim()).filter(Boolean),[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(reports,'report-ack-recruitment-390.png')});
        const final=await req(`/api/worlds/${slug}/cozy`,undefined,who);assert.equal(final.data.state.army.militia,payload.state.army.militia+1);assert(final.data.state.resources.materials<payload.state.resources.materials);
      }finally{release?.();await browser.close();}
    }finally{if(payload){await db.query('delete from world_players where world_id=$1',[payload.world.id]);await db.query('delete from worlds where id=$1',[payload.world.id]);}}
  });
  await check('Closing MVP: eliminated mobile kingdom remains read-only while season, reports and ranking continue',async()=>{
    for(const name of ['63_SQL_COZY_EXPRESS_ECONOMY.sql','65_SQL_COZY_LOBBY.sql','74_SQL_COMPETITIVE_WORLD_MODE.sql'])await db.exec(await readFile(path.join(root,name),'utf8'));
    const who='fallen-king',other='conquering-king',made=await req('/api/worlds/create',{name:'Season still running',mode:'express',combatMode:'competitive'},who);assert.equal(made.status,200,JSON.stringify(made.data));const slug=made.data.world.slug;let payload;
    try{
      assert.equal((await req('/api/worlds/join',{code:made.data.world.joinCode},other)).status,200);assert.equal((await command(slug,{type:'start_world'},crypto.randomUUID(),who)).status,200);
      for(const user of [who,other])assert.equal((await command(slug,{type:'king_choose',profileId:'builder',nickname:'King'},crypto.randomUUID(),user)).status,200);
      payload=(await req(`/api/worlds/${slug}/cozy`,undefined,who)).data;const enemy=(await req(`/api/worlds/${slug}/cozy`,undefined,other)).data;
      enemy.state.heroes.push({id:'final-occupier',name:'Occupier',role:'general',cityId:null});payload.state.cities[0].integrity=0;
      const C=loadCozyEngine('city-conquest'),moved=C.conquerPlayerCity({attacker:enemy.state,defender:payload.state,shared:payload.shared,world:payload.world,cityId:payload.state.cities[0].id,heroId:'final-occupier',at:Math.max(Date.now(),payload.state.settledAt,enemy.state.settledAt),attackPower:1000,defensePower:1});assert(moved.eliminated);
      for(const state of [moved.attacker,moved.defender])await db.query('update kw_cozy_player_states set state_json=$1::jsonb,revision=revision+1 where world_player_id=$2',[JSON.stringify(state),state.playerId]);await db.query('update kw_cozy_world_states set state_json=$1::jsonb,revision=revision+1 where world_id=$2',[JSON.stringify(moved.shared),payload.world.id]);
      const before=(await req(`/api/worlds/${slug}/cozy`,undefined,who)).data;assert.equal(before.world.status,'running');assert.equal(before.state.finalizedAt,null);assert.equal(before.computed.influence.total,0);
      assert.equal((await command(slug,{type:'recruit',troop:'militia',amount:1},crypto.randomUUID(),who)).status,422);assert.equal((await command(slug,{type:'king_choose',profileId:'builder',nickname:'Revive'},crypto.randomUUID(),who)).status,422);
      if(process.env.COZY_SKIP_BROWSER!=='1'){
        const {chromium}=await import('playwright');const browser=await chromium.launch();try{
          const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,extraHTTPHeaders:{'x-kw-smoke':'1'}});await context.addCookies([{name:'kw_dev_auth',value:who,url:base}]);await context.addInitScript(id=>{for(const screen of ['crown','reports','achievements'])localStorage.setItem(`kw-screen-help:v1:${screen}:${id}`,'seen');},payload.state.playerId);
          const page=await context.newPage();await page.goto(base+`/world/${slug}/intelligence`,{waitUntil:'networkidle'});
          for(const width of [320,390]){await page.setViewportSize({width,height:844});await page.getByRole('region',{name:'Fim do império',exact:true}).waitFor();await page.getByText(/Império derrotado · Dia/).waitFor();assert.equal(await page.getByText('Temporada encerrada',{exact:true}).count(),0);assert.equal(await page.getByRole('img',{name:'Mapa do seu império',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Veja suas conquistas',exact:false}).count(),0);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(reports,`defeated-kingdom-${width}.png`)});}
          await page.getByRole('button',{name:'Ver ranking',exact:true}).tap();await page.getByRole('tab',{name:'Ranking',exact:true}).waitFor();assert.equal(await page.getByRole('tab',{name:'Ranking',exact:true}).getAttribute('aria-selected'),'true');await page.getByRole('button',{name:'Fechar painel',exact:true}).tap();
          await page.getByRole('button',{name:'Ver relatos',exact:true}).tap();await page.getByRole('region',{name:'Relatos do reino',exact:true}).waitFor();await page.reload({waitUntil:'networkidle'});await page.getByRole('heading',{name:'Seu império foi derrotado',exact:true}).waitFor();assert.equal(await page.getByRole('dialog',{name:/governante|sucessor/i}).count(),0);
        }finally{await browser.close();}
      }
      const after=(await req(`/api/worlds/${slug}/cozy`,undefined,who)).data;assert.equal(after.state.cities.length,0);assert.equal(after.state.finalizedAt,null);assert.deepEqual(after.state.resources,before.state.resources);assert.equal(after.world.status,'running');
    }finally{if(payload){await db.query('delete from world_players where world_id=$1',[payload.world.id]);await db.query('delete from worlds where id=$1',[payload.world.id]);}}
  });
  await check('Season rewards v2: five-player Express closing reaches king XP, wallet and mobile inventory once',async()=>{
    for(const name of ['63_SQL_COZY_EXPRESS_ECONOMY.sql','65_SQL_COZY_LOBBY.sql','73_SQL_SEASON_POSITION_REWARDS.sql'])await db.exec(await readFile(path.join(root,name),'utf8'));
    const users=Array.from({length:5},(_,i)=>'season-prize-'+i),name='Prêmios do Expresso',made=await req('/api/worlds/create',{name,mode:'express'},users[0]);assert.equal(made.status,200,JSON.stringify(made.data));const slug=made.data.world.slug;let id;
    try{
      for(const user of users.slice(1))assert.equal((await req('/api/worlds/join',{code:made.data.world.joinCode},user)).status,200);
      assert.equal((await command(slug,{type:'start_world'},crypto.randomUUID(),users[0])).status,200);
      for(const user of users){const current=await req('/api/me/appearance',undefined,user);assert.equal(current.status,200);const selected=await req('/api/me/appearance',{appearance_id:'sovereign-02',revision:current.data.revision},user);assert.equal(selected.status,200,JSON.stringify(selected.data));const chosen=await command(slug,{type:'king_choose',profileId:'builder',nickname:'King',kingId:'sovereign-02'},crypto.randomUUID(),user);assert.equal(chosen.status,200,JSON.stringify(chosen.data));}
      const payloads=[];for(const user of users){const p=await req(`/api/worlds/${slug}/cozy`,undefined,user);assert.equal(p.status,200);payloads.push(p.data);}id=payloads[0].world.id;
      const E=loadCozyEngine(),start=Date.now()-31*86400000,end=start+30*86400000;
      await db.query('update worlds set starts_at=$2,runtime_anchor_started_at=$2 where id=$1',[id,new Date(start).toISOString()]);
      // Representative end-state fixture, not a claim that a bot earned these resources or scores.
      for(const [i,p] of payloads.entries()){
        const state=p.state;state.createdAt=start;state.citySystemsAt=start;state.settledAt=end-60000;state.hordesResolved=[5,10,15,20,25,28];state.hordesWon=6;state.orders=[];state.army={militia:30000,shooters:0,scouts:0,machinery:0};state.research={economy:5,military:5,exploration:5,fortification:5};
        for(const city of state.cities){for(const sector of Object.keys(city.sectors))city.sectors[sector]=10-i*2;city.integrity=100;city.life={contentment:70,lastDecisionDay:30,lastSocialDay:30,unrestDays:0};}
        state.progression.council.merit=[500,430,360,0,0][i];state.quests=['city','expansion','exploration','research','defense','council'];state.progression.feats.wonders=i<3?['one','two']:[];state.progression.feats.collected=i<3?{fixture:100000}:{};state.portalCrossedAt=i<3?start+29*86400000:null;
        const score=E.getCozyComputed(state,p.shared,{...p.world,startsAt:start},end-60000).influence.total;
        assert(i<3?score>=1500:score>=500&&score<1500);assert.equal(state.king.sovereignId,'sovereign-02');
        await db.query('update kw_cozy_player_states set state_json=$1::jsonb,influence=$2,revision=revision+1 where world_player_id=$3',[JSON.stringify(state),score,state.playerId]);
      }
      // Changing the lobby's selected king must not redirect the ended world's XP.
      const selection=await req('/api/me/appearance',undefined,users[0]);assert.equal((await req('/api/me/appearance',{appearance_id:'sovereign-03',revision:selection.data.revision},users[0])).status,200);
      const before=[];for(const user of users){const p=await req('/api/me/collection',undefined,user);assert.equal(p.status,200);before.push(p.data);}assert.equal(before[0].selectedId,'sovereign-03');
      const final=await req(`/api/worlds/${slug}/cozy`,undefined,users[0]);assert.equal(final.status,200,JSON.stringify(final.data));assert.equal(final.data.world.status,'finalized');
      const rows=(await db.query('select final_score,final_rank from kw_cozy_rewards where world_id=$1 order by final_rank',[id])).rows;assert.equal(rows.length,5);assert(rows.every((r,i)=>r.final_rank===i+1));
      const after=[];for(const [i,user] of users.entries()){
        const result=await req('/api/me/collection',undefined,user);assert.equal(result.status,200);const data=result.data,reward=data.seasonRewards.find(r=>r.worldId===id);assert(reward);assert.equal(reward.rulesVersion,2);assert.equal(reward.place,i+1);assert.equal(reward.participants,5);
        assert.equal(reward.gems,[18,17,16,5,5][i]);assert.equal(data.gems,before[i].gems+reward.gems);assert.equal(reward.productIds.length,i<3?1:0);assert.equal(reward.xpPercent,[10,5,0,0,0][i]);
        const earned=before[i].inventory.find(item=>item.id==='sovereign-02').xp,bonus=Math.floor(earned*reward.xpPercent/100);assert(earned>0);assert.equal(reward.kingXp['sovereign-02']??0,bonus);assert.equal(data.inventory.find(item=>item.id==='sovereign-02').xp,earned+bonus);
        for(const untouched of ['sovereign-01','sovereign-03'])assert.equal(data.inventory.find(item=>item.id===untouched).xp,before[i].inventory.find(item=>item.id===untouched).xp);for(const product of reward.productIds)assert.equal(data.inventory.filter(item=>item.id===product).length,1);after.push(data);
      }
      for(const [i,user] of users.entries()){assert.equal((await req(`/api/worlds/${slug}/cozy`,undefined,user)).status,200);const reread=await req('/api/me/collection',undefined,user);assert.deepEqual(reread.data,after[i]);}
      assert.equal((await command(slug,{type:'recruit',troop:'militia',amount:1},crypto.randomUUID(),users[0])).status,422);
      if(process.env.COZY_SKIP_BROWSER!=='1'){
        const {chromium}=await import('playwright');const browser=await chromium.launch();try{
          const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,extraHTTPHeaders:{'x-kw-smoke':'1'}});await context.addCookies([{name:'kw_dev_auth',value:users[0],url:base}]);await context.addInitScript(id=>{for(const screen of ['crown','achievements'])localStorage.setItem(`kw-screen-help:v1:${screen}:${id}`,'seen');},payloads[0].state.playerId);const page=await context.newPage();
          await page.goto(base+`/world/${slug}/intelligence`,{waitUntil:'networkidle'});await page.getByRole('button',{name:'Conquistas',exact:true}).tap();await page.getByRole('tab',{name:'Vitória',exact:true}).tap();await page.getByRole('link',{name:'Ver prêmios da temporada',exact:true}).tap();await page.waitForURL(`**/inventory?season=${id}`);const details=page.getByRole('dialog',{name:`Prêmios de ${name}`,exact:true});await details.waitFor();await details.getByText('Bônus da colocação · +10%',{exact:true}).waitFor();assert.equal(await details.locator('[aria-label="XP de cada rei"]').count(),1);
          for(const width of [320,390]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(reports,`season-prize-v2-${width}.png`)});}
          await details.getByRole('button',{name:'Voltar',exact:true}).tap();await page.reload({waitUntil:'networkidle'});await details.waitFor();await details.getByText('Bônus da colocação · +10%',{exact:true}).waitFor();await details.getByRole('button',{name:'Voltar',exact:true}).tap();
          const unchanged=await req('/api/me/collection',undefined,users[0]);assert.deepEqual(unchanged.data,after[0]);
        }finally{await browser.close();}
      }
      assert.equal((await req('/api/me/collection?season=invalid',undefined,users[0])).status,400);
      const ownOnly=await req(`/api/me/collection?season=${id}`,undefined,users[4]);assert.equal(ownOnly.status,200);assert.equal(ownOnly.data.seasonRewards.find(r=>r.worldId===id).place,5,'A shared world link returns only the requesting player’s award');
      const archives=[];
      try{
        const userId=(await db.query('select user_id from world_players where id=$1',[payloads[0].state.playerId])).rows[0].user_id;
        for(let i=0;i<11;i++){
          const archive=(await db.query("insert into worlds(slug,name,rules_version,season_mode,status,starts_at,phase_2_starts_at,ends_at) values($1,'Historical prize fixture',2,'express','finalized',now()-interval '31 days',now()-interval '10 days',now()-interval '1 day') returning id",['prize-archive-'+i+'-'+crypto.randomUUID()])).rows[0].id;archives.push(archive);
          await db.query("insert into kw_collection_season_rewards(world_id,user_id,gems,product_ids,awarded_at,rules_version) values($1,$2,0,'{}',now()+interval '1 minute',1)",[archive,userId]);
        }
        const recent=await req('/api/me/collection',undefined,users[0]);assert.equal(recent.data.seasonRewards.length,10);assert(!recent.data.seasonRewards.some(r=>r.worldId===id));
        const historical=await req(`/api/me/collection?season=${id}`,undefined,users[0]);assert.equal(historical.status,200);assert.deepEqual(historical.data.seasonRewards.find(r=>r.worldId===id),after[0].seasonRewards.find(r=>r.worldId===id));assert.equal(historical.data.gems,after[0].gems);assert.deepEqual(historical.data.inventory,after[0].inventory);
        const denied=await req(`/api/me/collection?season=${archives[0]}`,undefined,users[4]);assert.equal(denied.status,200);assert(!denied.data.seasonRewards.some(r=>r.worldId===archives[0]));assert(!JSON.stringify(denied.data).includes('Historical prize fixture'),'A historical link cannot expose another account’s receipt or world title');
      }finally{for(const archive of archives)await db.query('delete from worlds where id=$1',[archive]);}
    }finally{if(id){await db.query('delete from world_players where world_id=$1',[id]);await db.query('delete from worlds where id=$1',[id]);}}
  });
  await writeFile(
    path.join(reports,process.env.COZY_REWARDS_ONLY?'integration-season-rewards.json':process.env.COZY_CLOSING_ONLY?'integration-closing.json':process.env.COZY_COMPETITIVE_ONLY?'integration-competitive.json':process.env.COZY_ECONOMIC_ONLY?'integration-economic.json':'integration.json'),
    JSON.stringify(
      {
        scope:
          "Local Next server + real engine + real Postgres SQL through test REST transport; not remote Supabase",
        checks,
        status: "PASS",
      },
      null,
      2,
    ),
  );
  console.log(
    `PASS ${checks} integrated scenarios. Screenshots/reports: reports/cozy`,
  );
} catch (error) {
  await writeFile(path.join(reports, "server.log"), log);
  await writeFile(
    path.join(reports,process.env.COZY_COMPETITIVE_ONLY?'integration-competitive.json':process.env.COZY_ECONOMIC_ONLY?'integration-economic.json':'integration.json'),
    JSON.stringify(
      {
        scope:
          "Local Next server + real engine + real Postgres SQL through test REST transport; not remote Supabase",
        checks,
        status: "FAIL",
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  if (browser) await browser.close();
  server.kill();
  await new Promise((resolve) => {
    server.once("exit", resolve);
    setTimeout(resolve, 2000);
  });
  await rest.close();
  await db.close();
}
