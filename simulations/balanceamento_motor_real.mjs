// Deterministic playtest, not a prediction of player retention or final balance.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { loadCozyEngine } from "./lib/load-cozy-engine.mjs";
const E = loadCozyEngine(),
  DAY = 86400000,
  START = 1800000000000;
function play(seed, mode, profile) {
  const world = {
      id: `season-${seed}`,
      name: "Playtest",
      mode,
      influenceVersion: 2,
      status: "running",
      startsAt: START,
    },
    d = DAY / (mode === "express" ? 4 : 1);
  let save = E.settleCozyState(
    E.createCozyState(world, "playtester", "Playtester", START),
    E.createCozyShared(world),
    world,
    START,
  );
  const history = []; const ledger=[];
  let actions = 0; const failures = {};
  for (let day = 1; day <= 120; day++) {
    const now = START + (day - 1) * d;
    save = E.settleCozyState(save.state, save.shared, world, now);
    const realDay=Math.floor((day-1)/(mode==='express'?4:1));
    if ((day-1)%(mode==='express'?4:1)!==0 || (profile==='casual' && ![0,2,4,6].includes(realDay%7))) continue;
    const run = (action) => {
      const before={...save.state.resources};
      try {
        save = E.applyCozyAction(save.state, save.shared, world, action, now);
        actions++;
        ledger.push({day,type:action.type,resourcesBefore:before,resourcesAfter:{...save.state.resources}});
        return true;
      } catch (error) { const key = action.type + ': ' + String(error.message || error); failures[key]=(failures[key]||0)+1;
        return false;
      }
    };
    // Two kingdom decisions, and one map choice per daily visit.
    for (let n = 0; n < 2; n++) {
      const { state: s, shared } = save,
        c = E.getCozyComputed(s, shared, world, now),
        ts = E.getCozyTiles(s, shared, world);
      const choices = [];
      if (c.canEnterPortal) choices.push({ type: "portal" });
      const ready = c.questProgress.find((q) => q.complete && !q.claimed);
      if (ready) choices.push({ type: "quest", questId: ready.id });
      if (c.decree)
        choices.push({
          type: "decree",
          decreeId: c.decree.id,
          optionId: "care",
        });
      const home = s.cities.find((city) => !city.heroId);
      const free = s.heroes.find(
        (h) => !h.cityId && !s.orders.some((o) => o.heroId === h.id),
      );
      if (home && free)
        choices.push({ type: "assign", heroId: free.id, cityId: home.id });
      const upgrade = (city, sector) => ({
        type: "upgrade",
        cityId: city.id,
        sector,
      });
      const affordableUpgrade = (city, sector) =>
        !s.orders.some((o) => o.kind === "upgrade" && o.cityId === city.id) &&
        s.resources.materials >= c.upgradeCosts[city.id][sector];
      const economic = s.cities.find(
        (city) =>
          city.sectors.economy < 4 && affordableUpgrade(city, "economy"),
      );
      if (economic) choices.push(upgrade(economic, "economy"));
      if (
        s.research.military < 3 &&
        !s.orders.some((o) => o.kind === "research") &&
        s.resources.gold >= c.researchCosts.military
      )
        choices.push({ type: "research", research: "military" });
      const target = Math.max(140, c.nextHorde?.power * 1.3 || 3000);
      const unit =
        s.research.military >= 3
          ? "machinery"
          : s.research.military >= 1
            ? "shooters"
            : "militia";
      if (
        c.armyPower < target &&
        Object.values(s.army).reduce((a, b) => a + b, 0) < c.armyCapacity &&
        s.resources.materials >= c.troopCosts[unit] * 5
      )
        choices.push({ type: "recruit", troop: unit, amount: "max" });
      if (process.env.BALANCE_TEST_EXPANSION !== '0' && s.cities.length < 6 && free) {
        const target = ts
          .filter(
            (t) =>
              t.kind === "abandoned" &&
              t.power * 1.25 <= c.armyPower &&
              !t.ownerId,
          )
          .sort((a, b) => a.distance - b.distance)[0];
        if (target)
          choices.push({
            type: "annex",
            q: target.q,
            r: target.r,
            heroId: free.id,
          });
      }
      if (s.heroes.length < 6 && !free && s.resources.gold >= c.heroCost)
        choices.push({
          type: "hire",
          role:
            s.heroes.length % 3 === 0
              ? "general"
              : s.heroes.length % 3 === 1
                ? "sage"
                : "administrator",
        });
      for (const research of ["economy", "fortification", "exploration"])
        if (
          s.research[research] < (research === "economy" ? 2 : 1) &&
          s.resources.gold >= c.researchCosts[research]
        )
          choices.push({ type: "research", research });
      const upgrades = s.cities
        .flatMap((city) =>
          E.SECTORS.filter(
            (sec) =>
              city.sectors[sec.id] < 8 && affordableUpgrade(city, sec.id),
          ).map((sec) => ({
            city,
            sector: sec.id,
            priority:
              city.sectors[sec.id] +
              (sec.id === "society" ? -2 : sec.id === "recruitment" ? -1 : 0),
          })),
        )
        .sort((a, b) => a.priority - b.priority);
      for (const item of upgrades)
        choices.push(upgrade(item.city, item.sector));
      for (const choice of choices) if (run(choice)) break;
    }
    const { state: s, shared } = save,
      c = E.getCozyComputed(s, shared, world, now),
      ts = E.getCozyTiles(s, shared, world);
    const choices = [];
    const deposits = ts
      .filter((t) => t.kind === "gold" && t.deposit?.remaining > 0)
      .sort((a, b) => a.distance - b.distance);
    if (s.resources.gold < 3500 && deposits[0]) {
      const t = deposits[0];
      if(t.deposit.surveys===3) run({type:'area_annex',q:t.q,r:t.r});
      choices.push({
        type: t.deposit.surveys === 3 ? "collect" : "explore",
        q: t.q,
        r: t.r,
      });
    }
    const unknown = ts
      .filter((t) => !t.revealed)
      .sort((a, b) => {
        const priority = (t) =>
          (s.cities.length < 6 && t.clue.includes("Telhados")
            ? -20
            : t.clue.includes("brilho")
              ? -10
              : t.clue.includes("Pedras")
                ? -5
                : 0) + t.distance;
        return priority(a) - priority(b);
      });
    for (const t of unknown) choices.push({ type: "explore", q: t.q, r: t.r });
    for (const choice of choices) if (run(choice)) break;
    assert(Object.values(s.resources).every(v=>Number.isFinite(v)&&v>=0),'Invalid resources');
    assert(c.influence.total===Object.entries(c.influence).filter(([k])=>k!=='total').reduce((sum,[,v])=>sum+v,0),'Invalid score sum');
    history.push({
      day,
      score: c.influence.total,
      cities: s.cities.length,
      gold: Math.floor(s.resources.gold),
      military: c.armyPower,
      portal: Boolean(s.portalCrossedAt),
    });
  }
  save = E.settleCozyState(save.state, save.shared, world, START + 120 * d);
  return {
    seed,
    mode,
    score: save.state.finalScore,
    cities: save.state.cities.length,
    seal: save.state.portalCrossedAt !== null,
    profile, actions, failures, ledger, influence: E.getCozyComputed(save.state,save.shared,world,START+120*d).influence,
    hordesWon: save.state.hordesWon,
    history,
  };
}
const results=[];
for (const seed of [1,2,3]) for(const mode of ['classic','express']) for(const profile of ['diario','casual']) {
 const r=play(seed,mode,profile);results.push(r);
 console.log(JSON.stringify({seed,mode,profile,score:r.score,influence:r.influence,cities:r.cities,seal:r.seal,actions:r.actions,hordes:r.hordesWon,failures:r.failures}));
}
await mkdir(new URL('../reports/cozy/',import.meta.url),{recursive:true});
await writeFile(new URL('../reports/cozy/real-balance-playtest.json',import.meta.url),JSON.stringify({scope:'Motor real v2 com expansão; sessões em dias reais; bots heurísticos; sem PvP ou aliança',results},null,2));




