// Deterministic playtest, not a prediction of player retention or final balance.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { loadCozyEngine } from "./lib/load-cozy-engine.mjs";
const E = loadCozyEngine(),
  DAY = 86400000,
  START = 1800000000000;
function* play(seed, mode, profile, initialShared, playerId, coop, focus) {
  const world = {
      id: `season-${seed}`,
      name: "Playtest",
      mode,
      influenceVersion: 2,
      speedMultiplier: Number(process.env.TEST_SPEED||4),
      status: "running",
      startsAt: START,
    },
    d = DAY / (mode === "express" ? Number(process.env.TEST_SPEED||4) : 1);
  let save = E.settleCozyState(
    E.createCozyState(world, playerId, playerId, START),
    initialShared,
    world,
    START,
  );
  const history = []; const ledger=[];
  let actions = 0; const failures = {};
  for (let day = 1; day <= 120; day++) {
    save.shared = yield {shared:save.shared};
    const now = START + (day - 1) * d;
    save = E.settleCozyState(save.state, save.shared, world, now);
    const realDay=Math.floor((day-1)/(mode==='express'?Number(process.env.TEST_SPEED||4):1));
    if ((day-1)%(mode==='express'?Number(process.env.TEST_SPEED||4):1)!==0 || (profile==='casual' && ![0,2,4,6].includes(realDay%7))) continue;
    const run = (action) => {
      const before={...save.state.resources};
      try {
        save = E.applyCozyAction(save.state, save.shared, world, action, now);
        actions++;
        ledger.push({day,type:action.type,resourcesBefore:before,resourcesAfter:{...save.state.resources}});
        return true;
      } catch (error) { if(error instanceof TypeError || error instanceof ReferenceError) throw error; const key = action.type + ': ' + String(error.message || error); failures[key]=(failures[key]||0)+1;
        return false;
      }
    };
    if(coop) {
      if(!save.state.allianceId) {
        const group=save.shared.alliances[0];
        run(group?{type:'alliance_join',allianceId:group.id}:{type:'alliance_create',name:'Teste cooperativo'});
      }
      const group=save.shared.alliances.find(a=>a.id===save.state.allianceId);
      if(group?.founderId===playerId && day%14===1)run({type:'alliance_project_start',kind:'defense'});
      for(const project of save.shared.allianceProjects??[])if(project.completedAt===null&&project.canceledAt===undefined&&project.allianceId===save.state.allianceId)
        for(const resource of ['materials','supplies'])if(save.state.resources[resource]>1000)run({type:'alliance_project_contribute',projectId:project.id,resource,amount:100});
      const view=E.getCozyComputed(save.state,save.shared,world,now);
      if(view.nextHorde && view.nextHorde.power>view.defensePower)run({type:'support_request'});
      for(const request of save.shared.support)if(request.requesterId!==playerId&&request.supporterId===null&&request.arrivesAt>now)run({type:'support_send',requestId:request.id});
    }
    const towers=E.getCozyComputed(save.state,save.shared,world,now).sanctuaries;
    const tower=towers.find(t=>t.visitedAt===null&&t.arrivesAt===null);
    if(tower && save.state.resources.supplies>tower.supplyCost+500 && !save.state.orders.some(o=>o.kind==='explore'))run({type:'sanctuary_explore',sanctuaryId:tower.id});
    const known=towers.find(t=>t.visitedAt!==null);
    if(known && day%14===1 && (!coop||save.shared.alliances.find(a=>a.id===save.state.allianceId)?.founderId===playerId))run({type:'sanctuary_pact_start',sanctuaryId:known.id,kind:'provisions',scope:coop?'alliance':'solo'});
    for(const pact of save.shared.sanctuaryPacts??[])if(pact.completedAt===null&&pact.canceledAt===undefined&&(pact.ownerPlayerId===playerId||coop&&pact.allianceId===save.state.allianceId)) {
      for(const resource of ['gold','materials','supplies'])if(save.state.resources[resource]>1000)run({type:'sanctuary_pact_contribute',pactId:pact.id,resource,amount:100});
      run({type:'sanctuary_pact_challenge',pactId:pact.id});
    }
    // Two kingdom decisions, and one map choice per daily visit.
    for (let n = 0; n < Number(process.env.FOCUS_BUDGET||12); n++) {
      const { state: s, shared } = save,
        c = E.getCozyComputed(s, shared, world, now),
        ts = E.getCozyTiles(s, shared, world);
      const choices = [];
      // Paid local care: choose recovery first; avoid sacrificing trust for points.
      const urgent=s.cities.map(city=>({city,life:c.cityLife[city.id]})).filter(x=>x.life?.decision&&(x.life.contentment<70||x.life.integrity<100));
      if(urgent[0]) {const x=urgent[0],option=x.life.decision.options.find(o=>Object.entries(o.cost).every(([k,v])=>s.resources[k]>=v));if(option)choices.push({type:'city_decision',cityId:x.city.id,decisionId:x.life.decision.id,optionId:option.id});}

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
        s.research.military < 5 &&
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
      if (process.env.BALANCE_TEST_EXPANSION !== '0' && s.cities.length < 10 && free) {
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
      if (s.heroes.length < 10 && !free && s.resources.gold >= c.heroCost)
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
          s.research[research] < 5 &&
          s.resources.gold >= c.researchCosts[research]
        )
          choices.push({ type: "research", research });
      const upgrades = s.cities
        .flatMap((city) =>
          E.SECTORS.filter(
            (sec) =>
              city.sectors[sec.id] < 10 && affordableUpgrade(city, sec.id),
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
      for(const city of s.cities)if(!city.wonder&&c.influenceDetails.conquests.wonders<2)choices.push({type:'wonder',cityId:city.id});
      if(focus==='council'&&c.influence.society<500)for(const city of s.cities){const decision=c.cityLife[city.id]?.decision;const episode=`local:${city.q},${city.r}:${Math.floor((c.day-1)/6)}`;if(decision&&!s.progression.council.episodes.includes(episode)){const option=decision.options.find(o=>Object.entries(o.cost).every(([k,v])=>s.resources[k]>=v)&&((o.contentment>0&&(city.life?.contentment??0)<100)||(o.productionBonus>(city.life?.productionEffect?.endsAt>now?city.life.productionEffect.bonus:0))));if(option)choices.push({type:'city_decision',cityId:city.id,decisionId:decision.id,optionId:option.id});}}
      const category=a=>a.type==='upgrade'?'infrastructure':a.type==='research'||a.type==='hire'||a.type==='assign'?'government':a.type==='recruit'?'military':a.type==='decree'||a.type==='city_decision'?'council':a.type==='quest'||a.type==='wonder'?'conquests':null;
      const rank=a=>{
       if(a.type==='recruit'&&c.nextHorde&&c.nextHorde.power>c.defensePower)return -100;
       if(a.type==='city_decision'&&s.cities.find(x=>x.id===a.cityId)?.life?.contentment<35)return -100;
       if(a.type==='annex'&&s.cities.length<3)return -20;
       if(focus==='balanced')return 0;
       if(category(a)===focus && n%4!==3)return -10;
       if(focus==='military'&&a.type==='research'&&a.research==='military')return -10;
       return 0;
      };
      choices.sort((a,b)=>rank(a)-rank(b));
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
          (s.cities.length < 10 && t.clue.includes("Telhados")
            ? -20
            : t.clue.includes("brilho")
              ? -10
              : t.clue.includes("Pedras")
                ? -5
                : 0) + t.distance;
        return priority(a) - priority(b);
      });
    if(!s.orders.some(o=>o.kind==="explore")) for (const t of unknown) choices.push({ type: "explore", q: t.q, r: t.r });
    if(!s.orders.some(o=>o.kind==="explore")) for (const choice of choices) if (run(choice)) break;
    assert(Object.values(s.resources).every(v=>Number.isFinite(v)&&v>=0),'Invalid resources');
    assert(c.influence.total===Object.entries(c.influence).filter(([k])=>k!=='total').reduce((sum,[,v])=>sum+v,0),'Invalid score sum');
    const after=E.getCozyComputed(save.state,save.shared,world,now);
    history.push({
      areas:after.influence,
      day,
      score: after.influence.total,
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
    profile, playerId, coop, focus, actions, failures, ledger, influence: E.getCozyComputed(save.state,save.shared,world,START+120*d).influence,
    hordesWon: save.state.hordesWon,
    history,
  };
}


const results=[];
for(const seed of (process.env.QUICK_FOCUS?[1]:[1,2,3]))for(const mode of ['classic','express'])for(const focus of ['balanced','infrastructure','government','military','council','conquests']){
 const w={id:`season-${seed}`,name:'Focus test',mode,influenceVersion:2,status:'running',startsAt:START};
 let shared=E.createCozyShared(w);const g=play(seed,mode,'diario',shared,'bot0',false,focus);let x=g.next();
 while(!x.done){shared=x.value.shared;x=g.next(shared);}
 results.push(x.value);console.log(seed,mode,focus,x.value.score,JSON.stringify(x.value.influence));
}
await writeFile(new URL(`../reports/cozy/focus-comparison-${process.env.TEST_SPEED||4}-${process.env.FOCUS_BUDGET||12}.json`,import.meta.url),JSON.stringify({scope:'Real engine; equal kingdom budget in a run; heuristic solo bots; focuses do not share identical feasible menus',budget:Number(process.env.FOCUS_BUDGET||12),results},null,2));
