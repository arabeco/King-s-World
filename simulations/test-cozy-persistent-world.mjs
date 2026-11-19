import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createCozyDatabase } from "./lib/cozy-fixture.mjs";
import { loadCozyEngine } from "./lib/load-cozy-engine.mjs";

const engine = loadCozyEngine();
const { settleWorld } = loadCozyEngine("settlement");
const { seasonDisplay } = loadCozyEngine("season-display");
const { QUESTS } = loadCozyEngine("catalog");
const { ascensionStanding,ascensionRewardAmounts } = loadCozyEngine("ascension-preview");

for (const [score,id] of [[0,"bronze"],[1499,"bronze"],[1500,"bronze"],[1799,"bronze"],[1800,"silver"],
  [2099,"silver"],[2100,"gold"],[2499,"gold"],[2500,"legendary"]]) {
  assert.equal(ascensionStanding(score).medal.id,id);
  assert.equal(ascensionStanding(score).missing,Math.max(0,1500-score));
}
const belowGate = ascensionStanding(1499,2200);
assert.equal(belowGate.medal.label,"Ouro");
assert.equal(belowGate.missing,1);
assert.equal(ascensionStanding(2100,1800).peak,2100);
assert.deepEqual(ascensionRewardAmounts("classic",false),{baseGems:60,conversionGems:0,totalGems:60,refundOffset:0,creditedGems:60,bonusXp:0});
assert.deepEqual(ascensionRewardAmounts("express",true),{baseGems:15,conversionGems:2,totalGems:17,refundOffset:0,creditedGems:17,bonusXp:0});
assert.equal(ascensionRewardAmounts("express",true,20).creditedGems,0);
console.log("PASS prévia da Ascensão: quatro patamares, recorde preservado, meta atual e valores por ritmo.");
const day = 86_400_000;
const startsAt = 1_800_000_000_000;
const {RITE,completedAscensionProofs}=loadCozyEngine("ascension-rite");
for (const mode of ["classic", "express"]) {
  const world = { id: `persistent-${mode}`, name: "Vale", mode, startsAt, status: "running",
    economyVersion: 3, influenceVersion: 2, persistent: true };
  let state = engine.createCozyState(world, "realm", "Afonso", startsAt);
  let shared = engine.createCozyShared(world);
  state.king = { profileId: "builder", nickname: "Afonso", alive: true, generation: 1, history: [] };
  const city = state.cities[0];
  state.cities.push({ ...structuredClone(city), id: "colony", q: city.q + 2, capital: false,
    life: { contentment: 20, lastDecisionDay: null } });
  const act = (action, now) => ({ state, shared } = engine.applyCozyAction(state, shared, world, action, now));
  act({ type: "upgrade", cityId: city.id, sector: "economy" }, startsAt);
  act({ type: "plan_upgrade", cityId: city.id, sector: "economy" }, startsAt);
  const due = startsAt + 19 * day / (mode === "express" ? 4 : 1);
  const returns = due + 3_600_000;
  state.orders.push({ id: "return", kind: "attack", createdAt: due - 1000, arrivesAt: returns,
    q: city.q, r: city.r, returning: true, cargo: { gold: 30 } });
  ({ state, shared } = engine.settleCozyState(state, shared, world, due));
  assert.equal(state.pendingDefenseDay, 20);
  assert(!state.reports.some(report => report.kind === "horde"));
  assert.equal(state.cities[0].sectors.economy, 2);
  const gold = state.resources.gold;
  const player = { playerId: state.playerId, state, influence: 0 };
  const late = startsAt + 365 * day;
  shared = settleWorld([player], shared, world, late);
  state = player.state;
  const computed = engine.getCozyComputed(state, shared, world, late);
  assert.equal(computed.endsAt, null);
  assert.equal(computed.readOnly, false);
  assert.equal(seasonDisplay(computed.day, computed.durationDays, computed.realDurationDays, true).day, 366);
  assert.equal(state.cities.length, 2);
  assert.equal(state.cities[1].life.contentment, 20);
  assert.equal(computed.cityLife.colony.daysToRupture, null);
  assert.equal(state.pendingDefenseDay, undefined);
  assert.equal(state.king.alive, true);
  assert.equal(state.army.militia, 25);
  assert.equal(state.resources.gold, gold + 30);
  assert(state.resources.materials > 10000);
  assert(state.reports.some(report => report.kind === "horde" && report.at === returns));
  assert.equal(state.finalizedAt, null);
  const patrolsOnly = structuredClone(state);
  patrolsOnly.hordesWon = 6;
  const afterPatrols = engine.getCozyComputed(patrolsOnly,shared,world,late);
  assert.equal(afterPatrols.influence.military,computed.influence.military);
  assert(!afterPatrols.questProgress.find(quest=>quest.id==="defense").complete);
  assert.deepEqual(engine.settleCozyState(state, shared, world, late), { state, shared });
  act({ type: "upgrade", cityId: city.id, sector: "defense" }, late);
  assert(state.orders.some(order => order.sector === "defense" && order.arrivesAt > late));
  state.explored = [...new Set([...state.explored, ...engine.getCozyTiles(state, shared, world).map(tile => tile.id)])];
  const site = engine.getCozyTiles(state, shared, world).find(tile => tile.foundation?.canFound);
  assert(site);
  act({ type: "hire", role: "engineer" }, late);
  const responsible = state.heroes[0].id;
  act({ type: "found_city", q: site.q, r: site.r, heroId: responsible }, late);
  const foundation = state.orders.find(order => order.foundation);
  assert(foundation.arrivesAt > late);
  assert.equal(state.heroes[0].cityId, null);
  ({ state, shared } = engine.settleCozyState(state, shared, world, foundation.arrivesAt));
  const founded = state.cities.find(entry => entry.q === site.q && entry.r === site.r);
  assert.equal(founded?.heroId, responsible);
  assert.equal(state.heroes[0].cityId, founded.id);
  assert.equal(state.cities.length, 3);
  assert.equal(state.portalCrossedAt, null);
  assert.throws(() => act({ type: "portal" }, late), /Ascensão/);
  state.quests = QUESTS.map(quest => quest.id);
  state.progression.feats.wonders = ["one", "two"];
  state.army.militia = 100_000;
  state.heroes = Array.from({ length: 10 }, (_, index) => ({
    id: `hero-${index}`, role: "engineer", name: `Herói ${index}`, cityId: null,
  }));
  for (const research of Object.keys(state.research)) state.research[research] = 5;
  state.progression.council.merit = 500;
  ({ state, shared } = engine.settleCozyState(state, shared, world, foundation.arrivesAt));
  assert(state.peakInfluence >= 1500);
  assert.equal(state.portalCrossedAt, null);
  const peak = state.peakInfluence;
  const confirmation={medal:ascensionStanding(engine.getCozyComputed(state,shared,world,foundation.arrivesAt).influence.total,peak).medal.id,
    equipmentId:null,creditedGems:0,refundOffset:0};
  const ally="ally";
  const withAlliance=structuredClone(state);
  withAlliance.allianceId="alliance";
  const occupied=structuredClone(shared);
  const cityCell=`${founded.q},${founded.r}`;
  const freeableCell="10,10",allyCell="11,10";
  occupied.territories={...occupied.territories,[freeableCell]:state.playerId,[allyCell]:ally};
  occupied.territoryCities={...occupied.territoryCities,[freeableCell]:{playerId:state.playerId,cityId:founded.id}};
  const area=loadCozyEngine("areas").discoverResourceArea(occupied,{q:10,r:10},
    {id:"10,10",resource:"gold",remaining:0,capacity:300,surveys:3,contributors:[]},true);
  area.owners=[state.playerId];area.ownerCities={[state.playerId]:founded.id};
  occupied.depletedAreas={[area.id]:foundation.arrivesAt};
  withAlliance.orders.push({id:"collection",kind:"collect",q:10,r:10,collectResource:"gold",collectAmount:140,
    createdAt:foundation.arrivesAt,arrivesAt:foundation.arrivesAt+day});
  occupied.alliances=[{id:"alliance",name:"Vila",founderId:state.playerId,members:[state.playerId,ally],createdAt:startsAt}];
  occupied.support.push({id:"pending",allianceId:"alliance",requesterId:ally,supporterId:state.playerId,power:100,
    waveDay:500,arrivesAt:foundation.arrivesAt+day,acceptedAt:foundation.arrivesAt,requestedAt:startsAt});
  const beforeArchive=structuredClone({state:withAlliance,shared:occupied});
  assert.throws(()=>engine.archiveCozyReign(withAlliance,occupied,{...world,persistent:false},confirmation,foundation.arrivesAt),/arquivado/);
  const riteAt=foundation.arrivesAt;
  const riteState=structuredClone(state);
  riteState.counselors=["helena","ines"];
  riteState.heroes[0].cityId=founded.id;
  riteState.cities.find(city=>city.id===founded.id).heroId=riteState.heroes[0].id;
  riteState.cities.find(city=>city.id===founded.id).life.contentment=72;
  riteState.resources.supplies=10000;
  assert.throws(()=>engine.applyCozyAction(riteState,shared,world,{type:"ascend",confirmation},riteAt),/duas provas/);
  const march=engine.applyCozyAction(riteState,shared,world,{type:"rite_expedition"},riteAt);
  assert.equal(march.state.resources.supplies,riteState.resources.supplies-RITE.expedition.supplies);
  const trial=march.state.orders.find(order=>order.riteExpedition);
  assert.equal(trial.arrivesAt,riteAt+Math.round(RITE.expedition.days*computed.dayMs));
  assert.equal(completedAscensionProofs(march.state).length,0);
  assert.throws(()=>engine.applyCozyAction(march.state,march.shared,world,{type:"rite_expedition"},riteAt),/retorno/);
  const lostInput=structuredClone(march.state);
  lostInput.army.militia=100;
  const lostTrial=engine.settleCozyState(lostInput,march.shared,world,trial.arrivesAt);
  assert(!completedAscensionProofs(lostTrial.state).includes("expedition"));
  assert(lostTrial.state.reports.some(report=>report.title==="Guardiões do Rito resistiram"));
  const wonTrial=engine.settleCozyState(march.state,march.shared,world,trial.arrivesAt);
  assert.deepEqual(completedAscensionProofs(wonTrial.state),["expedition"]);
  const cargo=engine.applyCozyAction(wonTrial.state,wonTrial.shared,world,{type:"rite_provisions"},trial.arrivesAt);
  assert.equal(cargo.state.resources.materials,wonTrial.state.resources.materials-RITE.provisions.materials);
  assert.throws(()=>engine.applyCozyAction(cargo.state,cargo.shared,world,{type:"rite_provisions"},trial.arrivesAt),/já foram/);
  const audience=engine.applyCozyAction(cargo.state,cargo.shared,world,{type:"rite_council",choice:"welcome"},trial.arrivesAt);
  assert.equal(audience.state.cities.find(city=>city.id===founded.id).life.contentment,77);
  assert.deepEqual(completedAscensionProofs(audience.state),["expedition","provisions","council"]);
  const archive=engine.archiveCozyReign(withAlliance,occupied,world,confirmation,foundation.arrivesAt);
  assert.deepEqual({state:withAlliance,shared:occupied},beforeArchive);
  assert.deepEqual(archive.state.cities,state.cities);
  assert.equal(archive.state.ascension.medal,confirmation.medal);
  assert.equal(archive.state.finalScore,archive.influence);
  assert.equal(archive.state.finalizedAt,foundation.arrivesAt);
  assert.equal(archive.state.portalCrossedAt,null);
  assert.equal(archive.shared.claims[cityCell],undefined);
  assert.equal(archive.shared.independentCities?.[cityCell],undefined);
  assert.equal(archive.shared.territories[freeableCell],undefined);
  assert.equal(archive.shared.territories[allyCell],ally);
  assert.equal(archive.shared.areas[area.id].reserve.remaining,140);
  assert.deepEqual(archive.shared.areas[area.id].owners,[]);
  assert.equal(archive.shared.depletedAreas[area.id],undefined);
  assert.deepEqual(archive.state.orders,[]);
  assert.equal(archive.shared.alliances[0].founderId,ally);
  assert.deepEqual(archive.shared.support,[]);
  assert.equal(archive.state.allianceId,null);
  const archiveView=engine.getCozyComputed(archive.state,archive.shared,world,late);
  assert.equal(archiveView.phase,"Reinado arquivado");
  assert.equal(archiveView.influence.total,archive.influence);
  const reread=engine.settleCozyState(archive.state,archive.shared,world,late+day);
  assert.deepEqual(reread,{state:archive.state,shared:archive.shared});
  const neighborAtOldCapital=structuredClone(archive.shared);
  const archivedCapital=archive.state.cities.find(city=>city.capital);
  const oldCapitalCell=`${archivedCapital.q},${archivedCapital.r}`;
  neighborAtOldCapital.claims[oldCapitalCell]={playerId:ally,cityId:"ally:capital",name:"Novo Vale"};
  assert.deepEqual(engine.settleCozyState(archive.state,neighborAtOldCapital,world,late+day).shared,neighborAtOldCapital);
  assert.throws(()=>engine.archiveCozyReign(archive.state,archive.shared,world,confirmation,foundation.arrivesAt),/arquivado/);
  assert.throws(()=>engine.applyCozyAction(archive.state,archive.shared,world,{type:"upgrade",cityId:founded.id,sector:"defense"},late+day),/encerrad|terminou/i);
  state.army.militia = 25;
  ({ state, shared } = engine.settleCozyState(state, shared, world, foundation.arrivesAt));
  assert.equal(state.peakInfluence, peak);
  assert(engine.getCozyComputed(state, shared, world, foundation.arrivesAt).influence.total < peak);
  const seasonal = { ...world, persistent: undefined };
  const old = engine.createCozyState(seasonal, "old", "Antigo", startsAt);
  const result = engine.settleCozyState(old, engine.createCozyShared(seasonal), seasonal, late);
  assert.notEqual(result.state.finalizedAt, null);
  console.log(`PASS ${mode}: um ano de ausência, fila, retorno de tropas, patrulha e expansão após o prazo antigo.`);
}

const db = await createCozyDatabase();
try {
  for (const name of [
    "63_SQL_COZY_EXPRESS_ECONOMY.sql", "64_SQL_COZY_LATE_JOIN.sql", "65_SQL_COZY_LOBBY.sql",
    "74_SQL_COMPETITIVE_WORLD_MODE.sql", "76_SQL_COZY_UNIFIED_RHYTHM.sql",
    "77_SQL_COZY_FOUNDING_ONBOARDING.sql", "78_SQL_COZY_PERSISTENT_WORLD.sql",
    "78_SQL_COZY_PERSISTENT_WORLD.sql",
  ]) await db.exec(await readFile(new URL(`../${name}`, import.meta.url), "utf8"));
  const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
  const owner = (await one("insert into users(username,email) values ('dono','dono@test.invalid') returning id")).id;
  const joined = (await one("insert into users(username,email) values ('visita','visita@test.invalid') returning id")).id;
  const old = (await one("select kw_cozy_create_lobby($1,'Temporada','normal') as world", [owner])).world;
  await db.query("select kw_cozy_start($1,$2)", [old.id, owner]);
  assert(await one("select id from worlds where id = $1 and ends_at is not null and not persistent_cozy", [old.id]));
  const fresh = (await one("select kw_cozy_create_persistent($1,'Vale','express') as world", [owner])).world;
  const fields = await one("select status, ends_at, joins_closed_at, speed_multiplier from worlds where id=$1", [fresh.id]);
  assert.deepEqual(fields, { status: "running", ends_at: null, joins_closed_at: null, speed_multiplier: 4 });
  await db.query("update worlds set starts_at = now() - interval '365 days', runtime_anchor_started_at = now() - interval '365 days' where id = $1", [fresh.id]);
  await assert.rejects(db.query("select kw_cozy_join($1,$2,null)", [fresh.id, joined]), /INVITE_REQUIRED/);
  const member = (await one("select kw_cozy_join($1,$2,$3) as id", [fresh.id, joined, fresh.join_code])).id;
  assert.equal((await one("select kw_cozy_join($1,$2,null) as id", [fresh.id, joined])).id, member);
  const overflow = (await one("insert into users(username,email) values ('lotado','lotado@test.invalid') returning id")).id;
  await db.query("update worlds set player_cap=2 where id=$1", [fresh.id]);
  await assert.rejects(db.query("select kw_cozy_join($1,$2,$3)", [fresh.id, overflow, fresh.join_code]), /WORLD_FULL/);
  await assert.rejects(db.query("update worlds set status='finalized' where id=$1", [fresh.id]), /PERSISTENT_WORLD/);
  await assert.rejects(db.query("update worlds set persistent_cozy=false where id=$1", [fresh.id]), /MODE_LOCKED/);
  const acl = await one("select has_function_privilege('authenticated','kw_cozy_create_persistent(uuid,text,text,text)','execute') as client");
  assert.equal(acl.client, false);
  console.log("PASS SQL: entrada tardia, limite de vagas, privilégios, início e proteção do calendário persistente.");
} finally {
  await db.close();
}
