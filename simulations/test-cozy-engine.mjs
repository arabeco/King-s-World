import assert from "node:assert/strict";
import { loadCozyEngine } from "./lib/load-cozy-engine.mjs";
const E = loadCozyEngine(),
  DAY = 86400000,
  START = 1800000000000;
let checks = 0;
const world = {
  id: "world-test",
  name: "Cozy",
  mode: "classic",
  status: "running",
  startsAt: START,
};
const setup = (w = world, id = "player-a") =>
  E.settleCozyState(
    E.createCozyState(w, id, id, START),
    E.createCozyShared(w),
    w,
    START,
  );
const act = (save, action, now = START, w = world) =>
  E.applyCozyAction(save.state, save.shared, w, action, now);
const settle = (save, now, w = world) =>
  E.settleCozyState(save.state, save.shared, w, now);
const computed = (save, now = START, w = world) =>
  E.getCozyComputed(save.state, save.shared, w, now);
const tiles = (save) => E.getCozyTiles(save.state, save.shared, world);
function test(name, fn) {
  fn();
  checks++;
  console.log("PASS", name);
}

test("Open season is frozen and rejects spending", () => {
  const w = { ...world, status: "open", startsAt: null },
    save = setup(w);
  const next = settle(save, START + DAY * 20, w);
  assert.deepEqual(next.state.resources, save.state.resources);
  assert.throws(
    () => act(save, { type: "recruit", troop: "militia", amount: 1 }, START, w),
    /início/,
  );
});
test("Recruitment only spends materials, respects capacity and rejects malformed batches", () => {
  const save = setup(),
    copy = structuredClone(save),
    next = act(save, { type: "recruit", troop: "militia", amount: 5 });
  assert.deepEqual(save, copy);
  assert.equal(next.state.army.militia, 30);
  assert.equal(next.state.resources.supplies, 500);
  assert.equal(next.state.resources.gold, 350);
  for (const amount of [-1, 0, 2.5, NaN, Infinity, "5", 1000000])
    assert.throws(() =>
      act(save, { type: "recruit", troop: "militia", amount }),
    );
  assert.throws(
    () => act(save, { type: "recruit", troop: "machinery", amount: 1 }),
    /pesquisa/,
  );
  save.state.resources.materials = 1e6;
  assert.equal(
    Object.values(
      act(save, { type: "recruit", troop: "militia", amount: "max" }).state
        .army,
    ).reduce((a, b) => a + b, 0),
    computed(save).armyCapacity,
  );
});
test("Offline production uses upgrade completion time; settling twice is idempotent", () => {
  let save = setup();
  const beforeRate = computed(save).productionPerDay.materials,
    before = save.state.resources.materials;
  const cost = computed(save).upgradeCosts[save.state.cities[0].id].economy;
  save = act(save, {
    type: "upgrade",
    cityId: save.state.cities[0].id,
    sector: "economy",
  });
  const eta = save.state.orders[0].arrivesAt;
  const next = settle(save, START + DAY),
    afterRate = computed(next).productionPerDay.materials;
  const expected =
    before -
    cost +
    (beforeRate * (eta - START)) / DAY +
    (afterRate * (START + DAY - eta)) / DAY;
  assert(Math.abs(next.state.resources.materials - expected) < 1e-6);
  assert.deepEqual(settle(next, START + DAY), next);
  assert.equal(
    next.state.resources.supplies,
    500 + (120 * (eta - START)) / DAY + (170 * (START + DAY - eta)) / DAY,
  );
});
test("Upgrade duration preview matches real orders, engineers and the final deadline", () => {
  for (const mode of ["classic", "express"]) {
    for (const engineer of [false, true]) {
      const w = { ...world, mode },
        save = setup(w),
        city = save.state.cities[0];
      const gameDay = mode === "express" ? DAY / 4 : DAY;
      if (engineer) {
        city.heroId = "engineer-test";
        save.state.heroes.push({
          id: city.heroId,
          name: "Engenheiro",
          role: "engineer",
          cityId: city.id,
        });
      }
      for (const level of [0, 1, 9]) {
        city.sectors.administration = level;
        save.state.resources.materials = 1e6;
        const duration = E.getCozyUpgradeDurationMs(
          save.state,
          city,
          "administration",
          gameDay,
        );
        assert.equal(
          duration,
          Math.round(gameDay * (0.04 + level * 0.014) * (engineer ? 0.75 : 1)),
        );
        const action = {
          type: "upgrade",
          cityId: city.id,
          sector: "administration",
        };
        const order = act(save, action, START, w).state.orders.find(
          (entry) => entry.kind === "upgrade",
        );
        assert.equal(order.arrivesAt - order.createdAt, duration);
      }
      const final = START + gameDay * 120;
      // Preview the actual late-season buildings after all previous hordes settled.
      const finalSave=settle(save,final-gameDay,w);
      const duration = E.getCozyUpgradeDurationMs(
        finalSave.state,
        finalSave.state.cities.find(c=>c.id===city.id),
        "administration",
        gameDay,
      );
      const action = {
        type: "upgrade",
        cityId: city.id,
        sector: "administration",
      };
      assert.equal(
        act(finalSave, action, final - duration, w).state.orders.find(
          (entry) => entry.kind === "upgrade",
        ).arrivesAt,
        final,
      );
      assert.throws(
        () => act(finalSave, action, final - duration + 1, w),
        /tempo para concluir/,
      );
    }
  }
});
test("Infrastructure reaches 500 across ten complete cities; development remains 100 per city", () => {
  const save = setup();
  const capital = save.state.cities[0];
  capital.sectors = Object.fromEntries(
    E.SECTORS.map((sector) => [sector.id, 10]),
  );
  assert.equal(E.getCityInfrastructure(capital), 50);
  assert.equal(E.getCityDevelopment(capital), 100);
  assert.equal(computed(save).influence.infrastructure, 50);
  save.state.cities = Array.from({ length: 10 }, (_, index) => ({
    ...structuredClone(capital),
    id: `city-${index}`,
    capital: index === 0,
  }));
  assert.equal(computed(save).influence.infrastructure, 500);
  save.state.cities[9].sectors.defense = 0;
  assert.equal(E.getCityInfrastructure(save.state.cities[9]), 0);
  assert.equal(E.getCityDevelopment(save.state.cities[9]), 80);
  assert.equal(computed(save).influence.infrastructure, 450);
});
test("Exploration costs only food and reveals on arrival", () => {
  const save = setup(),
    tile = tiles(save).find((t) => t.kind === "unknown");
  const next = act(save, { type: "explore", q: tile.q, r: tile.r });
  assert.deepEqual(next.state.army, save.state.army);
  assert.equal(next.state.resources.materials, save.state.resources.materials);
  assert.equal(next.state.resources.supplies, 500 - tile.exploreCost);
  assert(!next.state.explored.includes(tile.id));
  const arrived = settle(next, next.state.orders[0].arrivesAt);
  assert(arrived.state.explored.includes(tile.id));
  assert.throws(
    () => act(save, { type: "explore", q: Infinity, r: 0 }),
    /válido/,
  );
  assert.throws(() => act(save, { type: "explore", q: 0.5, r: 0 }));
});
test("Collective surveys unlock finite deposits; reservations prevent overspending", () => {
  let save = setup(),
    now = START;
  const tile = tiles(save).find((t) => t.clue.includes("brilho"));
  assert(tile);
  for (let i = 0; i < 3; i++) {
    save = act(save, { type: "explore", q: tile.q, r: tile.r }, now);
    now = save.state.orders[0].arrivesAt;
    save = settle(save, now);
  }
  assert.equal(save.shared.deposits[tile.id].surveys, 3);
  const area=Object.values(save.shared.areas).find(a=>a.reserve.resource==='gold');
  area.reserve.remaining=100;
  save=act(save,{type:'area_annex',q:tile.q,r:tile.r},now);
  const before = save.state.resources.gold;
  save = act(save, { type: "collect", q: tile.q, r: tile.r }, now);
  assert.equal(save.shared.deposits[tile.id].remaining, 0);
  assert.equal(save.state.resources.gold, before);
  const eta = save.state.orders[0].arrivesAt;
  save = settle(save, eta);
  assert.equal(save.state.resources.gold, before + 100);
  assert.throws(
    () => act(save, { type: "collect", q: tile.q, r: tile.r }, eta),
    /esgotado/,
  );
});
test("No PvP and one offensive order; conquest uses paid free hero with surviving margin", () => {
  let save = setup();
  save.state.army.militia = 600;
  save = act(save, { type: "hire", role: "general" });
  const hero = save.state.heroes[0];
  const tile = tiles(save).find((t) => t.clue.includes("Bandeiras"));
  assert(tile);
  assert.throws(() => act(save, { type: "attack", q: 0, r: 0 }), /PvP/);
  save = act(save, {
    type: "attack",
    q: tile.q,
    r: tile.r,
    conquest: true,
    heroId: hero.id,
  });
  assert.equal(save.state.army.militia, 600);
  assert.throws(
    () =>
      act(save, {
        type: "assign",
        heroId: hero.id,
        cityId: save.state.cities[0].id,
      }),
    /reservado/,
  );
  assert.throws(
    () => act(save, { type: "attack", q: tile.q, r: tile.r }),
    /investida/,
  );
  save = settle(save, save.state.orders[0].arrivesAt);
  assert.equal(save.state.cities.length, 2);
  assert.equal(save.state.heroes[0].cityId, save.state.cities[1].id);
  assert.throws(
    () =>
      act(save, { type: "attack", q: tile.q, r: tile.r }, save.state.settledAt),
    /PvP/,
  );
});
test("Hordes defend automatically and never eliminate the capital", () => {
  let save = setup();
  save.state.army.militia = 0;
  save = settle(save, START + 111 * DAY);
  assert.equal(save.state.hordesResolved.length, 6);
  assert.equal(save.state.cities.length, 1);
  assert(save.state.cities[0].capital);
  const next = settle(save, START + 111 * DAY);
  assert.deepEqual(next, save);
});
test("Five equal influence caps and hero assignment uniqueness", () => {
  let save = setup();
  save.state.resources.gold = 1e6;
  for (let i = 0; i < 10; i++) save = act(save, { type: "hire", role: "sage" });
  assert.throws(() => act(save, { type: "hire", role: "sage" }), /dez/);
  save = act(save, {
    type: "assign",
    heroId: save.state.heroes[0].id,
    cityId: save.state.cities[0].id,
  });
  save = act(save, {
    type: "assign",
    heroId: save.state.heroes[1].id,
    cityId: save.state.cities[0].id,
  });
  assert.equal(save.state.heroes.filter((h) => h.cityId).length, 1);
  assert.equal(computed(save).influence.government, 50);
  save.state.cities = Array.from({ length: 10 }, (_, i) => ({
    ...save.state.cities[0],
    id: `city${i}`,
    q: i,
    r: 20,
    sectors: {
      administration: 10,
      economy: 10,
      society: 10,
      recruitment: 10,
      defense: 10,
    },
    heroId: save.state.heroes[i].id,
    wonder: true,
  }));
  save.state.heroes.forEach((h, i) => (h.cityId = `city${i}`));
  save.state.army.machinery = 10000;
  save.state.satisfaction = 100;
  save.state.quests = E.QUESTS.map((q) => q.id);
  save.state.cooperation = 100;
  const score = computed(save).influence;
  for (const [k, v] of Object.entries(score))
    assert.equal(v, k === "total" ? 2500 : 500);
});
test("Counselor choices expose authoritative effects and sign once", () => {
  let save = setup(),
    original = computed(save).decree;
  assert.equal(original.options[0].effects.materials,80);
  assert.equal(original.options[0].resolution,"certain");
  save = act(save, { type: "counselor", slot: 0, counselorId: "tomas" });
  const decree = computed(save).decree;
  assert.notDeepEqual(original.options, decree.options);
  const expected=decree.options.find(o=>o.id==='invest').effects;
  const materialsBefore=save.state.resources.materials,satisfactionBefore=save.state.satisfaction;
  save = act(save, { type: "decree", decreeId: decree.id, optionId: "invest", effects:{materials:999999} });
  assert.equal(save.state.resources.materials,materialsBefore+expected.materials);
  assert.equal(save.state.satisfaction,satisfactionBefore+expected.satisfaction);
  assert.equal(save.state.satisfaction, 65);
  assert.equal(computed(save).decree, null);
  assert.throws(() =>
    act(save, { type: "decree", decreeId: decree.id, optionId: "invest" }),
  );
});
test("Decision preview accounts for satisfaction cap without inventing a reward",()=>{
 const save=setup();save.state.satisfaction=100;
 const decree=computed(save).decree,choice=decree.options.find(o=>o.id==='care');
 assert.equal(choice.effects.satisfaction,0);
 const next=act(save,{type:'decree',decreeId:decree.id,optionId:'care'});
 assert.equal(next.state.satisfaction,100);assert.equal(next.state.resources.materials-save.state.resources.materials,choice.effects.materials);
});
test("Allied support is requested, accepted before horde and limited by cooldown", () => {
  let a = setup(),
    b = setup(world, "player-b");
  a = act(a, { type: "alliance_create", name: "Vila Verde" });
  b.shared = a.shared;
  b = act(b, { type: "alliance_join", allianceId: a.state.allianceId });
  a.shared = b.shared;
  a = act(a, { type: "support_request" });
  b.shared = a.shared;
  b = act(b, { type: "support_send", requestId: a.shared.support[0].id });
  assert(b.shared.support[0].power > 0);
  assert.deepEqual(b.state.army, setup(world, "player-b").state.army);
  assert.throws(
    () => act(b, { type: "support_send", requestId: a.shared.support[0].id }),
    /apoio/,
  );
});
test("1500 influence awards victory immediately in classic and express; loss never revokes it", () => {
  for (const mode of ["classic", "express"]) {
    const w = { ...world, mode }, d = DAY / (mode === "express" ? 4 : 1);
    let save = setup(w);
    save.state.cities = Array.from({ length: 10 }, (_, i) => ({
      ...save.state.cities[0], id: `city${i}`, q: i + 1, r: 20,
      sectors: { administration: 10, economy: 10, society: 10, recruitment: 10, defense: 10 },
    }));
    save.state.army.machinery = 1000;
    save.state.satisfaction = 100;
    save.state.quests = [];
    assert.equal(computed(save, START, w).influence.total, 1500);
    const below = structuredClone(save);below.state.satisfaction = 99.5;
    assert.equal(computed(below, START, w).influence.total,1499);
    assert.equal(settle(below, START, w).state.portalCrossedAt, null);
    const quest = structuredClone(save);quest.state.satisfaction=75;
    assert.equal(computed(quest, START, w).influence.total,1450);
    assert.equal(act(quest,{type:'quest',questId:'city'},START,w).state.portalCrossedAt,START);
    save = settle(save, START, w);
    assert.equal(save.state.portalCrossedAt, START);
    assert.equal(save.state.orders.some(o=>o.kind==='portal'),false);
    assert.deepEqual(settle(save, START, w),save);
    const fallen = structuredClone(save);fallen.state.army.machinery=0;fallen.state.quests=[];fallen.state.cities=[fallen.state.cities[0]];
    assert.equal(settle(fallen, START+d, w).state.portalCrossedAt,START);
    const legacy = structuredClone(save);legacy.state.orders.push({id:'old-portal',kind:'portal',q:0,r:0,arrivesAt:START+d});
    assert.equal(settle(legacy, START+d, w).state.reports.filter(r=>r.title==='Selo de Vitória conquistado').length,1);
    const open={...w,status:'open',startsAt:null};const waiting=structuredClone(save);waiting.state.portalCrossedAt=null;
    assert.equal(settle(waiting, START, open).state.portalCrossedAt,null);
    assert.equal(settle(waiting, START, {...w,startsAt:START+DAY}).state.portalCrossedAt,null);
    save = settle(save, START+120*d,w);
    assert.equal(save.state.finalizedAt, START+120*d);
    assert.deepEqual(settle(save, START+500*d,w),save);
    assert.throws(()=>act(save,{type:'recruit',troop:'militia',amount:1},START+120*d,w),/terminou/);
  }
});
test("Area migration conserves reserves; alliance access is live and exhaustion keeps land",()=>{
 let a=setup(),now=START;
 const groups=new Map();
 for(const t of tiles(a).filter(t=>t.clue.includes('brilho'))){const id=`${Math.floor((t.q+40)/8)},${Math.floor((t.r+40)/8)}`;groups.set(id,[...(groups.get(id)??[]),t]);}
 const [x,y]=[...groups.values()].find(ts=>ts.length>=2);
 delete a.shared.areas;
 a.shared.deposits={
  [x.id]:{id:x.id,resource:'gold',capacity:100,remaining:70,surveys:3,contributors:['player-a']},
  [y.id]:{id:y.id,resource:'gold',capacity:200,remaining:130,surveys:3,contributors:['player-a']},
 };
 a.state.explored=[x.id,y.id];a=settle(a,now);
 const area=Object.values(a.shared.areas)[0];assert.equal(area.reserve.capacity,300);assert.equal(area.reserve.remaining,200);
 assert.deepEqual(settle(a,now),a,'Migration is idempotent');
 assert.throws(()=>act(a,{type:'collect',q:x.q,r:x.r},now),/Anexe/);
 a=act(a,{type:'area_annex',q:x.q,r:x.r},now);
 let b={state:E.createCozyState(world,'player-b','B',now),shared:a.shared};b.state.explored=[x.id,y.id];b=settle(b,now);
 assert.throws(()=>act(b,{type:'area_annex',q:y.q,r:y.r},now),/aliança/);
 b.shared.alliances.push({id:'ally-area',name:'Aliança',founderId:a.state.playerId,members:['player-a','player-b'],createdAt:now});
 b.state.allianceId='ally-area';a.state.allianceId='ally-area';
 b=act(b,{type:'area_annex',q:y.q,r:y.r},now);
 assert.equal(Object.values(b.shared.areas)[0].owners.length,2);
 const noAlliance=structuredClone(b);noAlliance.shared.alliances[0].members=['player-a'];
 assert.throws(()=>act(noAlliance,{type:'collect',q:y.q,r:y.r},now),/aliança/);
 const lands=JSON.stringify(b.shared.territories),cities=JSON.stringify(b.shared.claims);
 b=act(b,{type:'collect',q:y.q,r:y.r},now);
 assert.equal(b.state.orders.find(o=>o.kind==='collect').collectAmount,200);
 assert.equal(Object.values(b.shared.areas)[0].reserve.remaining,0);
 assert.equal(JSON.stringify(b.shared.territories),lands);assert.equal(JSON.stringify(b.shared.claims),cities);
 a.shared=b.shared;assert.throws(()=>act(a,{type:'collect',q:x.q,r:x.r},now),/esgotado/);
 assert.equal(tiles(b).find(t=>t.id===x.id).deposit.remaining,0);
 assert(tiles(b).find(t=>t.id===x.id).territoryOwnerId);
});
test("Sanctuary districts reject new city construction without deleting existing capitals",()=>{
 let save=setup();save.state.cities[0].q=22;save.state.cities[0].r=0;save.shared.claims={};
 save=settle(save,START);save.state.army.militia=10000;save.state.heroes=[{id:'free-hero',name:'Explorador',role:'explorer',cityId:null}];
 const tile=tiles(save).find(t=>t.landmarkId==='sanctuary-1'&&!t.ownerId);assert(tile);
 save.state.explored.push(tile.id);
 assert.throws(()=>act(save,{type:'annex',q:tile.q,r:tile.r,heroId:'free-hero'}),/santuário/);
 assert.equal(settle(save,START).state.cities[0].q,22);
});
test("Local decisions affect one city, charge once and reject foreign or stale choices",()=>{
 let save=setup();save.state.cities.push({...structuredClone(save.state.cities[0]),id:'second-local',q:save.state.cities[0].q+2,capital:false});save=settle(save,START);
 const city=save.state.cities[0],other=save.state.cities[1],view=computed(save).cityLife[city.id],choice=view.decision.options[0];
 const next=act(save,{type:'city_decision',cityId:city.id,decisionId:view.decision.id,optionId:choice.id});
 assert.equal(next.state.resources.supplies,save.state.resources.supplies-choice.cost.supplies);
 assert.equal(next.state.cities[0].life.contentment,city.life.contentment+choice.contentment);
 assert.equal(next.state.cities[1].life.contentment,other.life.contentment);assert.equal(next.state.satisfaction,save.state.satisfaction);
 assert.equal(computed(next).cityLife[city.id].decision,null);
 assert.throws(()=>act(next,{type:'city_decision',cityId:city.id,decisionId:view.decision.id,optionId:choice.id}),/resolvida/);
 assert.throws(()=>act(next,{type:'city_decision',cityId:'foreign',decisionId:view.decision.id,optionId:choice.id}),/cidade/i);
});
test("Temporary city efficiency expires at its exact offline boundary in both rhythms",()=>{
 for(const mode of ['classic','express']){
  const w={...world,mode},d=DAY/(mode==='express'?4:1);let save=setup(w);save=settle(save,START+d,w);
  const city=save.state.cities[0],view=computed(save,START+d,w).cityLife[city.id],base=view.production.materials;
  const buff=act(save,{type:'city_decision',cityId:city.id,decisionId:view.decision.id,optionId:'maintenance'},START+d,w);
  assert.equal(computed(buff,START+d,w).cityLife[city.id].efficiency,105);
  const end=START+4*d,result=settle(buff,end,w),control=settle(save,end,w);
  assert(Math.abs(result.state.resources.materials-control.state.resources.materials-(base*.05*2-80))<1e-6);
  assert.equal(computed(result,end,w).cityLife[city.id].efficiency,100);
  assert.deepEqual(settle(result,end,w),result);
 }
});
test("A social crisis warns, separates a city and releases its hero without resurrecting ownership",()=>{
 let save=setup(),capital=save.state.cities[0];
 const colony={...structuredClone(capital),id:'unhappy-colony',name:'Riacho',q:capital.q+4,capital:false,heroId:'city-hero',wonder:true,life:{contentment:20,lastDecisionDay:null,lastSocialDay:1,unrestDays:0}};
 save.state.cities.push(colony);save.state.heroes.push({id:'city-hero',name:'Herói',role:'administrator',cityId:colony.id});
 save.state.orders.push({id:'late-upgrade',kind:'upgrade',cityId:colony.id,sector:'economy',createdAt:START,arrivesAt:START+9*DAY});save=settle(save,START);
 const earlier=settle(save,START+3*DAY);assert.equal(earlier.state.cities.length,2);assert(earlier.state.reports.some(r=>r.title.includes('movimento separatista')));
 const lost=settle(save,START+7*DAY),id=`${colony.q},${colony.r}`;
 assert.equal(lost.state.cities.length,1);assert.equal(lost.shared.claims[id],undefined);assert.equal(lost.shared.independentCities[id].city.wonder,true);
 assert.equal(lost.state.heroes[0].cityId,null);assert(!lost.state.orders.some(o=>o.id==='late-upgrade'));assert.equal(computed(lost).influence.government,0);
 assert.equal(tiles(lost).find(t=>t.id===id).kind,'abandoned');assert.deepEqual(settle(lost,START+7*DAY),lost);
 const another=settle(lost,START+10*DAY);assert.equal(another.shared.claims[id],undefined);assert.equal(another.state.cities.length,1);
 // A free hero and sufficient surviving strength can recover the real damaged city.
 lost.state.army.militia=10000;const sent=act(lost,{type:'annex',q:colony.q,r:colony.r,heroId:'city-hero'},START+7*DAY);
 const arrived=settle(sent,sent.state.orders.find(o=>o.kind==='attack').arrivesAt),recovered=arrived.state.cities.find(c=>c.name==='Riacho');
 assert(recovered);assert.equal(recovered.wonder,true);assert.deepEqual(recovered.sectors,colony.sectors);assert.equal(arrived.shared.independentCities[id],undefined);
});
test("Relief ends a crisis; legacy migration does not retroactively separate a city",()=>{
 let save=setup(),capital=save.state.cities[0];const colony={...structuredClone(capital),id:'relief-city',q:capital.q+3,capital:false,life:{contentment:30,lastDecisionDay:null,lastSocialDay:1,unrestDays:5}};save.state.cities.push(colony);
 save=settle(save,START);const decision=computed(save).cityLife[colony.id].decision;
 save=act(save,{type:'city_decision',cityId:colony.id,decisionId:decision.id,optionId:'relief'});assert.equal(save.state.cities[1].life.unrestDays,0);
 assert.equal(settle(save,START+8*DAY).state.cities.length,2);
 const legacy=setup();delete legacy.state.citySystemsAt;legacy.state.cities.push({...structuredClone(legacy.state.cities[0]),id:'old-city',q:capital.q+3,capital:false,life:{contentment:10,lastDecisionDay:null}});
 const migrated=settle(legacy,START+8*DAY);assert.equal(migrated.state.cities.length,2);assert.equal(migrated.state.cities[1].life.unrestDays,0);
});
test("Repeated horde defeats damage integrity, can remove a city, and free repairs remain possible",()=>{
 let save=setup(),capital=save.state.cities[0];save.state.army.militia=0;
 save.state.cities.push({...structuredClone(capital),id:'horde-target',name:'Fronteira',q:capital.q+4,capital:false,integrity:25});save=settle(save,START);
 const lost=settle(save,START+19*DAY);assert.equal(lost.state.cities.length,1);assert.equal(lost.shared.independentCities[`${capital.q+4},${capital.r}`].reason,'horde');assert.equal(tiles(lost).find(t=>t.id===`${capital.q+4},${capital.r}`).kind,'npc');
 lost.state.cities[0].integrity=0;lost.state.cities[0].life.contentment=70;lost.state.resources.materials=0;lost.state.resources.supplies=0;
 const view=computed(lost,START+19*DAY).cityLife[capital.id],repaired=act(lost,{type:'city_decision',cityId:capital.id,decisionId:view.decision.id,optionId:'volunteers'},START+19*DAY);
 assert.equal(repaired.state.cities[0].integrity,20);assert(computed(repaired,START+19*DAY).productionPerDay.materials>0);
});
test("Social and structural catch-up is equivalent to daily settlement in both modes",()=>{
 for(const mode of ['classic','express']){
  const w={...world,mode},d=DAY/(mode==='express'?4:1);let initial=setup(w),capital=initial.state.cities[0];
  initial.state.cities.push({...structuredClone(capital),id:'offline-colony',q:capital.q+4,capital:false,life:{contentment:20,lastDecisionDay:null,lastSocialDay:1,unrestDays:0}});initial=settle(initial,START,w);
  const batch=settle(initial,START+10*d,w);let daily=structuredClone(initial);for(let i=1;i<=10;i++)daily=settle(daily,START+i*d,w);
  assert.deepEqual(batch.state.cities,daily.state.cities);assert.deepEqual(batch.shared.claims,daily.shared.claims);assert.deepEqual(batch.shared.independentCities,daily.shared.independentCities);
  for(const resource of ['materials','supplies','gold'])assert(Math.abs(batch.state.resources[resource]-daily.state.resources[resource])<1e-6);
 }
});
test("The original Cozy capital remains protected, including when other cities exist",()=>{
 let save=setup(),capital=save.state.cities[0];capital.life.contentment=20;
 const other={...structuredClone(capital),id:'other-city',q:capital.q+4,capital:false,life:{contentment:70,lastDecisionDay:null,lastSocialDay:1,unrestDays:0}};save.state.cities.push(other);save=settle(save,START);
 const result=settle(save,START+7*DAY);assert.equal(result.state.cities.length,2);assert.equal(result.shared.claims[`${capital.q},${capital.r}`].cityId,capital.id);assert(result.state.cities.find(c=>c.id===capital.id).capital);
 const open=setup({...world,status:'open',startsAt:null});assert.equal(E.nextCityDayAt(open.state,world),START+DAY);
});
test("Royal archetypes save nickname, apply real bonuses and cannot be switched during a reign",()=>{
 const base=setup(),id=base.state.cities[0].id,normal=computed(base).cityLife[id].production.materials;
 const chosen=act(base,{type:'king_choose',profileId:'builder',nickname:'Meu Nick'});
 const guard=act(base,{type:'king_choose',profileId:'guardian',nickname:'Guarda'});assert.equal(computed(guard).defensePower,Math.floor(computed(base).defensePower*1.05));
 const target=tiles(base).find(t=>!t.ownerId&&t.distance>=2),explorer=act(base,{type:'king_choose',profileId:'explorer',nickname:'Viajante'});assert.equal(tiles(explorer).find(t=>t.id===target.id).travelMs,Math.round(target.travelMs*.95));
 assert.equal(chosen.state.king.nickname,'Meu Nick');assert(Math.abs(computed(chosen).cityLife[id].production.materials-normal*1.05)<1e-7);
 assert.throws(()=>act(chosen,{type:'king_choose',profileId:'guardian',nickname:'Outro'}),/reinado/);
 assert.throws(()=>act(base,{type:'king_choose',profileId:'invented',nickname:'Meu Nick'}),/perfil/);
 const w={...world,status:'open',startsAt:null},waiting=setup(w);assert.equal(act(waiting,{type:'king_choose',profileId:'explorer',nickname:'Antes'},START,w).state.king.nickname,'Antes');
});
test("A crushing defeat with only the ruined capital kills the king once and allows succession",()=>{
 let save=act(setup(),{type:'king_choose',profileId:'guardian',nickname:'Primeiro'});save.state.army.militia=0;save.state.cities[0].integrity=25;
 save=settle(save,START+19*DAY);assert.equal(save.state.king.alive,false);assert.equal(save.state.king.history.length,1);assert.equal(save.state.cities.length,1);assert(save.state.cities[0].capital);
 const later=settle(save,START+39*DAY);assert.equal(later.state.king.history.length,1);
 const successor=act(later,{type:'king_choose',profileId:'builder',nickname:'Sucessor'},START+39*DAY);assert.equal(successor.state.king.alive,true);assert.equal(successor.state.king.generation,2);assert.equal(successor.state.king.history[0].nickname,'Primeiro');assert.equal(successor.state.cities[0].integrity,0);
});
test("Research previews preserve existing timing, assigned sages and season deadline in both modes",()=>{
 const {getCozyResearchDurationMs}=loadCozyEngine("catalog");
 for(const mode of ['classic','express'])for(const level of [0,2,4])for(const sages of [0,1,4,5]){
  const w={...world,mode},save=setup(w),d=mode==='express'?DAY/4:DAY;
  save.state.research.economy=level;save.state.resources.gold=100000;
  save.state.heroes=Array.from({length:sages+1},(_,i)=>({id:`sage-${i}`,name:'Sábio',role:'sage',cityId:i<sages?save.state.cities[0].id:null}));
  const preview=getCozyResearchDurationMs(save.state,'economy',d);
  assert.equal(preview,Math.round(d*(0.25+level*0.1)*(1-Math.min(4,sages)*0.15)),'Historical timing must remain identical');
  const order=act(save,{type:'research',research:'economy'},START,w).state.orders.find(order=>order.kind==='research');
  assert.equal(order.arrivesAt-order.createdAt,preview);
  const deadline=computed(save,START,w).endsAt;
  assert.throws(()=>act(save,{type:'research',research:'economy'},deadline-preview+1,w),/tempo/);
 }
});
console.log(`PASS ${checks} engine scenarios.`);
