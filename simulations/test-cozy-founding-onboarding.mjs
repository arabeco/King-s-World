import assert from "node:assert/strict";
import { loadCozyEngine } from "./lib/load-cozy-engine.mjs";

const engine = loadCozyEngine();
const now = 1800000000000;
for (const mode of ["classic", "express"]) {
  const world = {
    id: "founding-qa", name: "Fundação", status: "open", startsAt: null, mode,
    economyVersion: 3, influenceVersion: 2, foundingOnboarding: true,
  };
  let state = engine.createCozyState(world, "player", "Afonso", now);
  let shared = engine.createCozyShared(world);
  const act = action => ({ state, shared } = engine.applyCozyAction(state, shared, world, action, now));
  const compute = () => engine.getCozyComputed(state, shared, world, now);
  assert.equal(state.cities.length, 0);
  assert.equal(compute().influence.total, 0);
  assert.throws(() => act({ type: "hire", role: "engineer" }), /dois conselheiros/);
  act({ type: "king_choose", profileId: "builder", nickname: "Afonso" });
  act({ type: "counselor", slot: 0, counselorId: "helena" });
  act({ type: "counselor", slot: 1, counselorId: "bento" });
  act({ type: "hire", role: "engineer" });
  const hero = state.heroes[0];
  assert.equal(state.resources.gold, 150);
  assert.equal(compute().influence.government, 30);
  assert.throws(() => act({ type: "hire", role: "engineer" }), /já está na corte/);
  ({ state, shared } = engine.settleCozyState(JSON.parse(JSON.stringify(state)), shared, world, now));
  assert.equal(state.heroes[0].cityId, null);
  assert.equal(engine.getCozyTiles(state, shared, world).filter(tile => tile.foundation?.canFound).length, 12);
  const [first, second] = engine.getCozyTiles(state, shared, world);
  shared.claims[first.id] = { playerId: "other", cityId: "other:capital", name: "Outra capital" };
  const foundation = { type: "found_capital", name: "Vale Verde", heroId: hero.id };
  assert.throws(() => act({ ...foundation, q: first.q, r: first.r }), /terreno mudou/);
  const valid = engine.getCozyTiles(state, shared, world).find(tile => tile.id !== second.id);
  act({ ...foundation, q: valid.q, r: valid.r });
  assert.equal(state.resources.gold, 150);
  assert.equal(state.cities[0].name, "Vale Verde");
  assert.equal(state.cities[0].capital, true);
  assert.equal(state.heroes[0].cityId, state.cities[0].id);
  assert.equal(compute().influence.government, 30);
  assert.throws(() => act({ ...foundation, q: valid.q, r: valid.r }), /temporada|já foi fundada/);
  const decree = compute().decree;
  assert.equal(decree.counselorId, "helena");
  assert.match(decree.body, /Vale Verde/);
  const before = state.resources.materials;
  const signed = { type: "decree", decreeId: decree.id, optionId: "market" };
  act(signed);
  assert.equal(state.resources.materials, before + 80);
  assert.equal(state.resources.supplies, 440);
  assert.equal(compute().decree, null);
  assert.throws(() => act(signed), /temporada|assinado/);
  world.status = "running";
  world.startsAt = now;
  const city = state.cities[0];
  act({ type: "upgrade", cityId: city.id, sector: "defense", expectedLevel: 0 });
  act({ type: "plan_upgrade", cityId: city.id, sector: "economy", expectedLevel: 0 });
  const materials = state.resources.materials;
  assert.throws(() => act({ type: "plan_upgrade", cityId: city.id, sector: "economy", expectedLevel: 0 }), /fila mudou/);
  assert.equal(state.resources.materials, materials, "Uma prévia antiga não autoriza outro preço.");
  const destination = engine.getCozyTiles(state, shared, world).find(tile => !tile.revealed);
  assert(destination);
  act({ type: "explore", q: destination.q, r: destination.r });
  const arrival = state.orders.find(order => order.kind === "explore").arrivesAt;
  const returned = engine.settleCozyState(state, shared, world, arrival);
  assert.deepEqual(returned.state.reports.find(report => report.kind === "exploration").location, { q: destination.q, r: destination.r });
  const legacy = engine.createCozyState({ ...world, foundingOnboarding: undefined }, "legacy", "Outro", now);
  assert.equal(legacy.cities.length, 1);
  assert.equal(legacy.founding, undefined);
  console.log(`PASS ${mode}: saved hire, collision, capital, first decree and legacy isolation`);
}
