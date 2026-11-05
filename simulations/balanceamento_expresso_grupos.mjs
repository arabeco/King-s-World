// Deterministic playtest, not a prediction of player retention or final balance.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { loadCozyEngine } from "./lib/load-cozy-engine.mjs";
const Progression=loadCozyEngine('progression');
const S=loadCozyEngine('settlement'), A=loadCozyEngine('alliances'), P=loadCozyEngine('sanctuary-pacts');
const E = loadCozyEngine(),
  DAY = 86400000,
  START = 1800000000000;
function draw(key){let x=2166136261;for(const c of key)x=Math.imul(x^c.charCodeAt(0),16777619);x^=x>>>16;x=Math.imul(x,0x7feb352d);x^=x>>>15;return (x>>>0)/4294967296;}
export function* play(seed, mode, profile, initialShared, playerId, coop, focus, useTowers, royal, behavior={}) {
  const review=(process.env.BOT_POLICY??'').startsWith('review'),advanced=process.env.BOT_POLICY==='review2',visitRate=behavior.visitRate??(profile==='casual'?.55:.9);
  const world = {
      id: `season-${seed}`,
      name: "Playtest",
      mode,
      influenceVersion: 2,
      speedMultiplier: 1,
      economyVersion: mode==='express'?2:undefined,
      status: "running",
      startsAt: START,
    },
    d = DAY;
  let save = E.settleCozyState(
    E.createCozyState(world, playerId, playerId, START),
    initialShared,
    world,
    START,
  );
  if(royal){save.state.king={profileId:'builder',nickname:playerId,alive:true,generation:1,history:[],attributes:{...royal.attributes},equipment:[...royal.equipment]};}
  else if(process.env.ROYAL_SIM){
   const attrs=process.env.ROYAL_SIM==='veteran'?{administration:8,command:8,exploration:8}:{administration:5,command:5,exploration:5};
   save.state.king={profileId:'builder',nickname:playerId,alive:true,generation:1,history:[],attributes:attrs};
  }
  if(save.state.progression?.balance)save.state.progression.balance.militaryDivisor=Number(process.env.MILITARY_DIVISOR||90);
  const history = []; const ledger=[];
  let actions = 0; const failures = {};
  for (let day = 1; day <= (mode==='express'?30:120); day++) {
    save = yield {state:save.state,shared:save.shared,day};
    const now = START + (day - 1) * d;
    save = E.settleCozyState(save.state, save.shared, world, now);
    const realDay=Math.floor((day-1)/1);
    if ((day-1)%1!==0 || draw(`${seed}:${playerId}:${profile}:visit:${realDay}`)>visitRate) continue;
    let auxiliary=0,kingdom=false;
    const run = (action) => {
      if(!kingdom&&auxiliary>=4)return false;
      const before={...save.state.resources};
      try {
        save = E.applyCozyAction(save.state, save.shared, world, action, now);
        actions++;if(!kingdom)auxiliary++;
        ledger.push({day,type:action.type,resourcesBefore:before,resourcesAfter:{...save.state.resources}});
        return true;
      } catch (error) { if(!(error instanceof E.CozyRuleError))throw error; const key = action.type + ': ' + String(error.message || error); failures[key]=(failures[key]||0)+1;
        return false;
      }
    };
    if(coop){
     if(!save.state.allianceId){const group=save.shared.alliances[0];run(group?{type:'alliance_join',allianceId:group.id}:{type:'alliance_create',name:'Cooperação'});}
     const group=save.shared.alliances.find(a=>a.id===save.state.allianceId);
     if(group?.founderId===playerId){const active=save.shared.allianceProjects?.some(p=>p.allianceId===group.id&&p.canceledAt===undefined&&(p.completedAt===null||p.until>now));if(!active)run({type:'alliance_project_start',kind:'defense'});}
     for(const project of save.shared.allianceProjects??[])if(project.allianceId===save.state.allianceId&&project.completedAt===null&&project.canceledAt===undefined){
      const totals=A.projectTotals(project),cost=A.ALLIANCE_PROJECTS[project.kind].cost;
      for(const resource of ['gold','materials','supplies']){const missing=(cost[resource]??0)-(totals[resource]??0),free=save.state.resources[resource]-(resource==='gold'?150:1000);if(missing>0&&free>=Math.min(100,missing))run({type:'alliance_project_contribute',projectId:project.id,resource,amount:free>=missing?'max':100});}
     }
     const c=E.getCozyComputed(save.state,save.shared,world,now);
     if(c.nextHorde&&c.defensePower<c.nextHorde.power&&!save.shared.support.some(r=>r.requesterId===playerId&&r.waveDay===c.nextHorde.day))run({type:'support_request'});
     for(const request of save.shared.support)if(request.requesterId!==playerId&&request.supporterId===null&&request.arrivesAt>now&&(save.state.supportSentAt===null||save.state.supportSentAt+DAY<=now))run({type:'support_send',requestId:request.id});
    }
    if(useTowers){
     const c=E.getCozyComputed(save.state,save.shared,world,now),towers=c.sanctuaries;
     const tower=towers.find(t=>t.visitedAt===null&&t.arrivesAt===null);
     if(tower&&!towers.some(t=>t.visitedAt!==null)&&save.state.resources.supplies>tower.supplyCost+500&&!save.state.orders.some(o=>o.kind==='explore'))run({type:'sanctuary_explore',sanctuaryId:tower.id});
     const known=towers.find(t=>t.visitedAt!==null);
     const manager=!coop||save.shared.alliances.find(a=>a.id===save.state.allianceId)?.founderId===playerId;
     const available=!(save.shared.sanctuaryPacts??[]).some(p=> (coop?p.allianceId===save.state.allianceId:p.allianceId===null&&p.ownerPlayerId===playerId)&&p.canceledAt===undefined&&(p.completedAt===null||P.pactEffectiveUntil(p)>now));
     if(known&&manager&&available)run({type:'sanctuary_pact_start',sanctuaryId:known.id,kind:c.nextHorde&&c.defensePower<c.nextHorde.power*1.1?'defense':'provisions',scope:coop?'alliance':'solo'});
     for(const pact of save.shared.sanctuaryPacts??[])if(pact.completedAt===null&&pact.canceledAt===undefined&&(coop?pact.allianceId===save.state.allianceId:pact.allianceId===null&&pact.ownerPlayerId===playerId)){
      if(save.state.sanctuaryVisits?.[pact.sanctuaryId]===undefined)continue;
      const totals=P.pactTotals(pact),cost=P.SANCTUARY_PACTS[pact.kind].cost;
      for(const resource of ['gold','materials','supplies']){const missing=(cost[resource]??0)-(totals[resource]??0),free=save.state.resources[resource]-(resource==='gold'?150:1000);if(missing>0&&free>=Math.min(100,missing))run({type:'sanctuary_pact_contribute',pactId:pact.id,resource,amount:free>=missing?'max':100});}
      if(P.pactFunded(pact)&&!pact.guardian?.attempts.some(a=>!a.outcome)&&E.getCozyComputed(save.state,save.shared,world,now).armyPower>=(pact.guardian?.power??Infinity)*1.1)run({type:'sanctuary_pact_challenge',pactId:pact.id});
     }
     for(const threat of E.getCozyComputed(save.state,save.shared,world,now).sanctuaryThreats??[])if(threat.canDefend&&threat.defense<threat.power*1.1&&(save.state.supportSentAt===null||save.state.supportSentAt+DAY<=now))run({type:'sanctuary_pact_defend',pactId:threat.pactId,waveDay:threat.day});
    }
    if(review)for(const city of save.state.cities)if(!city.capital&&(!city.cityClass||city.cityClass==='neutral')){
     const c=E.getCozyComputed(save.state,save.shared,world,now);
     const kind=focus==='military'?'bastiao':focus==='infrastructure'||focus==='government'?'metropole':c.defensePower<(c.nextHorde?.power??0)?'bastiao':save.state.resources.supplies<1000?'celeiro':'metropole';
     run({type:'city_class',cityId:city.id,cityClass:kind});
    }
    kingdom=true;
    // Six to ten kingdom decisions, plus at most four successful auxiliary actions per visit.
    for (let n = 0; n < (behavior.actionBudget??6)+Math.floor(draw(`${seed}:${playerId}:${profile}:budget:${realDay}`)*5); n++) {
      const { state: s, shared } = save,
        c = E.getCozyComputed(s, shared, world, now),
        ts = E.getCozyTiles(s, shared, world);
      const choices = [];
      const urbanReady=s.cities.every(city=>(city.life?.contentment??70)>=60&&(city.integrity??100)>=80)&&(!c.nextHorde||c.defensePower>=c.nextHorde.power*1.1)&&s.cities.reduce((v,city)=>v+E.getCityDevelopment(city),0)/s.cities.length>=55;
      // Paid local care: choose recovery first; avoid sacrificing trust for points.
      const urgent=s.cities.map(city=>({city,life:c.cityLife[city.id]})).filter(x=>x.life?.decision&&(x.life.contentment<70||x.life.integrity<100));
      if(urgent[0]) {const x=urgent[0],option=x.life.decision.options.find(o=>Object.entries(o.cost).every(([k,v])=>s.resources[k]>=v));if(option)choices.push({type:'city_decision',cityId:x.city.id,decisionId:x.life.decision.id,optionId:option.id});}

      if (c.canEnterPortal) choices.push({ type: "portal" });
      const ready = c.questProgress.find((q) => q.complete && !q.claimed);
      if (ready) choices.push({ type: "quest", questId: ready.id });
      if (c.decree && Progression.decreeCareRecognized(s,c.day,c.decree.options.find(o=>o.id==='care').effects.localSatisfaction??{},c.decree.options.find(o=>o.id==='care').effects.satisfaction) && (!s.progression?.balance?.councilSourceCaps || (s.progression.council.sources?.decree??0)<s.progression.balance.councilSourceCaps.decree || s.cities.some(city=>(city.life?.contentment??70)<100)))
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
      const target = Math.max(focus==='military'?Number(process.env.MILITARY_DIVISOR||90)*300:140, c.nextHorde?.power * 1.3 || 3000);
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
        choices.push({ type: 'recruit', troop: unit, amount:behavior.quality==='poor'?5:focus==='military'||c.armyPower<target?'max':5 });
      if (process.env.BALANCE_TEST_EXPANSION !== '0' && s.cities.length < 10 && free && !s.orders.some(o=>o.kind==='attack') && (focus!=='infrastructure'||urbanReady&&s.cities.length<(review?10:6))) {
        const target = ts
          .filter(
            (t) =>
              (t.kind === "abandoned"||(review&&t.kind==="npc"&&t.attackable)) &&
              t.power * 1.25 <= c.armyPower &&
              !t.ownerId,
          )
          .sort((a, b) => a.distance - b.distance)[0];
        if (target)
          choices.push({
            type: target.kind==='npc'?"attack":"annex",
            ...(target.kind==='npc'?{conquest:true}:{}),
            q: target.q,
            r: target.r,
            heroId: free.id,
          });
      }
      const roleCounts=Object.fromEntries(['general','engineer','administrator','explorer','sage'].map(role=>[role,s.heroes.filter(h=>h.role===role).length]));
      const role=focus==='government'&&roleCounts.sage<4?'sage':(focus==='infrastructure'||focus==='conquests')&&roleCounts.engineer<Math.min(3,s.cities.length)?'engineer':focus==='military'&&roleCounts.general<5?'general':roleCounts.general<2?'general':roleCounts.sage<2?'sage':'administrator';
      if (s.heroes.length < 10 && !free && s.resources.gold >= c.heroCost && (focus!=='infrastructure'||urbanReady&&s.cities.length<(review?10:6)||home))
        choices.push({
          type: "hire",
          role:review?role:
            s.heroes.length % 3 === 0
              ? "general"
              : s.heroes.length % 3 === 1
                ? "sage"
                : "administrator",
        });
      for (const research of ["economy", "fortification", "exploration"])
        if (
          s.research[research] < 5 && !s.orders.some(o=>o.kind==="research") &&
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
      for(const city of s.cities)if(!city.wonder&&c.influenceDetails.conquests.wonders<2&&E.getCityDevelopment(city)===100&&s.resources.materials>=c.wonderCost)choices.push({type:'wonder',cityId:city.id});
      if(c.influence.society<500)for(const city of s.cities){const decision=c.cityLife[city.id]?.decision;const episode=`local:${city.q},${city.r}:${Math.floor((c.day-1)/6)}`;if(decision&&!s.progression.council.episodes.includes(episode)){const option=decision.options.find(o=>Object.entries(o.cost).every(([k,v])=>s.resources[k]>=v)&&((o.contentment>0&&(city.life?.contentment??0)<100)||(o.productionBonus>(city.life?.productionEffect?.endsAt>now?city.life.productionEffect.bonus:0))));if(option)choices.push({type:'city_decision',cityId:city.id,decisionId:decision.id,optionId:option.id});}}
      if(mode==='express' && process.env.WITH_PLANS!=='0') {
       for(const city of s.cities)for(const sec of E.SECTORS){
        const lane=s.orders.filter(o=>o.kind==='upgrade'&&o.cityId===city.id);
        const expected=city.sectors[sec.id]+lane.filter(o=>o.sector===sec.id).length;
        const steps=Math.min(4,E.planningCapacity(s)-lane.filter(o=>o.planned&&!o.planned.started).length,10-expected);
        if(steps>0){const cost=Array.from({length:steps},(_,i)=>E.upgradeCost(s,expected+i)).reduce((a,b)=>a+b,0);if(s.resources.materials>=cost)choices.push({type:'plan_upgrade',cityId:city.id,sector:sec.id,steps});if(steps>1&&s.resources.materials>=E.upgradeCost(s,expected))choices.push({type:'plan_upgrade',cityId:city.id,sector:sec.id,steps:1});}
       }
       const lane=s.orders.filter(o=>o.kind==='research');
       for(const research of ['military','economy','fortification','exploration']){
        const expected=s.research[research]+lane.filter(o=>o.research===research).length;
        const steps=Math.min(4,E.planningCapacity(s)-lane.filter(o=>o.planned&&!o.planned.started).length,5-expected);
        if(steps>0){const cost=Array.from({length:steps},(_,i)=>E.researchCost(s,expected+i)).reduce((a,b)=>a+b,0);if(s.resources.gold>=cost)choices.push({type:'plan_research',research,steps});if(steps>1&&s.resources.gold>=E.researchCost(s,expected))choices.push({type:'plan_research',research,steps:1});}
       }
      }
      const category=a=>['upgrade','plan_upgrade'].includes(a.type)?'infrastructure':['research','plan_research'].includes(a.type)||a.type==='hire'||a.type==='assign'?'government':a.type==='recruit'?'military':a.type==='decree'||a.type==='city_decision'?'council':a.type==='quest'||a.type==='wonder'?'conquests':null;
      const order=new Map(choices.map((a,i)=>[a,i]));
      const rank=a=>{
       const noise=(draw(`${seed}:${playerId}:${profile}:${realDay}:${n}:${JSON.stringify(a)}`)-.5)*4;
       const ordinal=order.get(a)*.1;
       if(advanced&&focus==='infrastructure'&&['upgrade','plan_upgrade'].includes(a.type)&&n%4!==3){
        const city=s.cities.find(c=>c.id===a.cityId),queued=s.orders.filter(o=>o.kind==='upgrade'&&o.cityId===city.id&&o.sector===a.sector).length;
        const level=city.sectors[a.sector]+queued,steps=a.type==='plan_upgrade'?(a.steps??1):1;
        const projected={...s,cities:s.cities.map(c=>({...c,sectors:Object.fromEntries(Object.entries(c.sectors).map(([sector,value])=>[sector,Math.min(10,value+s.orders.filter(o=>o.kind==='upgrade'&&o.cityId===c.id&&o.sector===sector).length)]))}))};
        const base=projected.cities.reduce((sum,c)=>sum+Progression.infrastructureContribution(projected,c),0);
        const next={...projected,cities:projected.cities.map(c=>c.id===city.id?{...c,sectors:{...c.sectors,[a.sector]:Math.min(10,c.sectors[a.sector]+steps)}}:c)};
        const gain=next.cities.reduce((sum,c)=>sum+Progression.infrastructureContribution(next,c),0)-base;
        const cost=Array.from({length:steps},(_,i)=>E.upgradeCost(s,level+i)).reduce((sum,n)=>sum+n,0);
        return -5-Math.min(6,1000*gain/(cost+600))+noise*.15;
       }
       if(focus==='infrastructure'&&n%4===1&&a.type==='city_decision'&&(s.progression.council.sources?.local??0)<(s.progression.balance.councilSourceCaps?.local??500)&&!s.progression.council.episodes.includes(`local:${s.cities.find(c=>c.id===a.cityId).q},${s.cities.find(c=>c.id===a.cityId).r}:${Math.floor((c.day-1)/6)}`))return -20+noise;
       if(a.type==='quest')return -8+noise;
       if(a.type==='assign')return -7+noise;
       if(['upgrade','plan_upgrade'].includes(a.type)&&a.sector==='economy'&&s.cities.find(c=>c.id===a.cityId)?.sectors.economy<3)return -15+noise;
       if(a.type==='recruit'&&c.nextHorde&&c.nextHorde.power*(focus==='infrastructure'?1.3:1)>c.defensePower)return -100;
       if(a.type==='city_decision'&&s.cities.find(x=>x.id===a.cityId)?.life?.contentment<35)return -100;
       if((a.type==='annex'||review&&a.type==='attack'&&a.conquest)&&s.cities.length<3)return -20;
       if(focus==='infrastructure'&&urbanReady&&s.cities.length<(review?10:6)&&['annex','hire',...(review?['attack']:[])].includes(a.type))return -6+noise;
       if(focus==='infrastructure'&&a.type==='city_decision'&&((s.cities.find(c=>c.id===a.cityId)?.life?.contentment??70)<60||(s.cities.find(c=>c.id===a.cityId)?.integrity??100)<80))return -20+noise;
       if(focus==='conquests'&&['upgrade','plan_upgrade'].includes(a.type)&&a.cityId===s.cities.find(city=>!city.wonder)?.id&&Object.values(s.cities.find(city=>city.id===a.cityId).sectors).reduce((a,b)=>a+b,0)<50)return -5+noise;
       if(focus==='infrastructure'&&n%2===0&&['upgrade','plan_upgrade'].includes(a.type)&&a.cityId===s.cities.filter(city=>E.getCityDevelopment(city)<100).sort((a,b)=>E.getCityDevelopment(b)-E.getCityDevelopment(a)||a.id.localeCompare(b.id))[0]?.id)return -5+noise;
       // Government specialists develop research before buying another expansion cycle.
       if(focus==='government'&&['research','plan_research'].includes(a.type)&&c.influence.government<450)return -7+noise;
       if(focus==='government'&&(a.type==='annex'||a.type==='attack'&&a.conquest)&&c.influence.government<450)return -6+noise;
       if(focus==='conquests'&&a.type==='wonder')return -6+noise;
       if(focus==='military'&&['upgrade','plan_upgrade'].includes(a.type)&&['defense','recruitment'].includes(a.sector))return -4+ordinal+noise;
       if(focus==='balanced')return ordinal+noise;
       const focusScore=c.influence[focus==='council'?'society':focus==='conquests'?'legacy':focus];
       const source=a.type==='decree'?'decree':a.type==='city_decision'?'local':null;
       const sourceFull=source&&s.progression?.balance?.councilSourceCaps&&(s.progression.council.sources?.[source]??0)>=s.progression.balance.councilSourceCaps[source];
       if(category(a)===focus && focusScore<450 && !sourceFull && (focus==='infrastructure'?n%2===0:n%4!==3))return -4+ordinal+noise;
       if(focus==='military'&&['research','plan_research'].includes(a.type)&&a.research==='military')return -4+noise;
       return ordinal+noise;
      };
      if(behavior.quality==='poor'&&c.decree)choices.push({type:'decree',decreeId:c.decree.id,optionId:'invest'});
      if(advanced&&behavior.quality==='poor'){
       for(let i=choices.length-1;i>=0;i--){const a=choices[i],keep=draw(`${seed}:${playerId}:poor-choice:${day}:${n}:${JSON.stringify(a)}`);
        if((a.type==='decree'&&a.optionId==='care')||(['plan_upgrade','plan_research'].includes(a.type)&&keep<.75)||(a.type==='city_decision'&&keep<.65)||(['annex','attack'].includes(a.type)&&keep<.5))choices.splice(i,1);
        else if(a.type==='city_decision'){const d=c.cityLife[a.cityId]?.decision;if(d?.options.some(o=>o.id==='levy'))a.optionId='levy';}
       }
      }
      choices.sort((a,b)=>behavior.quality==='poor'?draw(`${seed}:${playerId}:${day}:${n}:${JSON.stringify(a)}`)-draw(`${seed}:${playerId}:${day}:${n}:${JSON.stringify(b)}`):rank(a)-rank(b));
      if(behavior.quality==='poor'&&draw(`${seed}:${playerId}:neglect:${day}:${n}`)<.3)continue;
      for (const choice of choices) if (run(choice)) break;
    }
    kingdom=false;
    const { state: s, shared } = save,
      c = E.getCozyComputed(s, shared, world, now),
      ts = E.getCozyTiles(s, shared, world);
    const choices = [];
    const deposits = ts
      .filter((t) => t.kind === "gold" && t.deposit?.remaining > 0 && (t.deposit.surveys<3||t.area?.canAnnex||t.area?.canCollect))
      .sort((a, b) => a.distance - b.distance);
    if (s.resources.gold < 3500 && deposits[0]) {
      const t = deposits[0];
      if(t.deposit.surveys===3&&t.area?.canAnnex) run({type:'area_annex',q:t.q,r:t.r});
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
  save=yield {state:save.state,shared:save.shared,phase:'end'};
  save = E.settleCozyState(save.state, save.shared, world, START+(mode==='express'?30:120)*d);
  return {
    seed,
    mode,
    score: save.state.finalScore,
    cities: save.state.cities.length,
    seal: save.state.portalCrossedAt !== null,
    profile, playerId, coop, focus, balance:save.state.progression.balance, actions, failures, ledger, influence: E.getCozyComputed(save.state,save.shared,world,START+(mode==='express'?30:120)*d).influence,
    visitedDays:history.length,hordesWon: save.state.hordesWon,
    research:save.state.research,heroes:save.state.heroes, history, resources:save.state.resources, council:save.state.progression.council, cityLevels:save.state.cities.map(c=>({id:c.id,sectors:c.sectors})),
  };
}



if(!process.env.COZY_BOT_LIBRARY){
const results=[],worlds=[];
const runLabel=process.env.GROUP_LABEL||'quality';assert(/^[a-z0-9-]+$/.test(runLabel));
let scenarios=[{id:'independent',coop:false,towers:false},{id:'tower',coop:false,towers:true},{id:'alliance',coop:true,towers:false},{id:'alliance_tower',coop:true,towers:true},{id:'mixed_independent',coop:false,towers:true,mixed:true},{id:'mixed_alliance',coop:true,towers:true,mixed:true}];
if(process.env.GROUP_SPECIALISTS)scenarios=[{id:'five_balanced_independent',coop:false,towers:true,size:5},{id:'five_specialist_independent',coop:false,towers:true,size:5,specialists:true},{id:'five_balanced_alliance',coop:true,towers:true,size:5},{id:'five_specialist_alliance',coop:true,towers:true,size:5,specialists:true}];
if(process.env.GROUP_CONTROLLED)scenarios=['independent','alliance'].flatMap(kind=>(process.env.GROUP_CONTROL_FOCUS?[process.env.GROUP_CONTROL_FOCUS]:['balanced','infrastructure','council']).map(focal=>({id:`controlled_${kind}_${focal}`,coop:kind==='alliance',towers:true,size:5,focal})));
for(const seed of (process.env.GROUP_SEEDS?process.env.GROUP_SEEDS.split(',').map(Number):process.env.GROUP_VALIDATION?[88,99]:[11,22,33]))for(const scenario of scenarios)for(const focus of (process.env.GROUP_FOCUS?[process.env.GROUP_FOCUS]:scenario.focal?[scenario.focal]:scenario.specialists?['specialists']:scenario.size||scenario.mixed?['balanced']:['balanced','infrastructure','government','military','council','conquests'])){
 if(process.env.GROUP_FOCUS&&scenario.mixed)continue;
 const world={id:`season-${seed}`,name:'Group economy',mode:'express',influenceVersion:2,economyVersion:2,speedMultiplier:1,status:'running',startsAt:START};
 let shared=E.createCozyShared(world);const handles=[];
 for(let i=0;i<(scenario.size||3);i++){
  const profile=scenario.mixed&&i===2?'diario':'casual',playerId='bot'+i;
  const actorFocus=scenario.focal?(i===seed%5?scenario.focal:'balanced'):scenario.specialists?['infrastructure','government','military','council','conquests'][(i+seed)%5]:focus;
  const gen=play(seed,'express',profile,shared,playerId,scenario.coop,actorFocus,scenario.towers);const message=gen.next();shared=message.value.shared;
  handles.push({gen,message,playerId,state:message.value.state,influence:0});
 }
 for(let day=1;day<=30;day++){
  const now=START+(day-1)*DAY;
  shared=S.settleWorld(handles,shared,world,now);
  for(let offset=0;offset<handles.length;offset++){
   const h=handles[(offset+day+seed)%handles.length];const next=h.gen.next({state:h.state,shared});assert(!next.done);h.message=next;h.state=next.value.state;shared=next.value.shared;
  }
  shared=S.settleWorld(handles,shared,world,now);
 }
 shared=S.settleWorld(handles,shared,world,START+30*DAY);
 for(const h of handles){assert.equal(h.message.value.phase,'end');const last=h.gen.next({state:h.state,shared});assert(last.done);results.push({...last.value,scenario:scenario.id,groupFocus:focus});}
 worlds.push({seed,scenario:scenario.id,focus,shared});
 console.log(seed,scenario.id,focus,handles.map(h=>h.state.finalScore).join('/'));
}
await writeFile(new URL(`../reports/cozy/economic-groups-${runLabel}-${process.env.GROUP_VALIDATION?'holdout':process.env.GROUP_FOCUS||'final'}.json`,import.meta.url),JSON.stringify({policyVersion:'closure-careful-expansion-v1',scope:'Production settlement shared with server; matched player IDs, calendars and action budgets; actual seeds and focuses in rows; no injected resources. Queue capacity 12. Correlated trajectories, not population rates.',seeds:[...new Set(results.map(r=>r.seed))],results,worlds},null,2));

}
