import assert from "node:assert/strict";
import { loadCozyEngine } from "./lib/load-cozy-engine.mjs";

const E = loadCozyEngine();
const R = loadCozyEngine("exploration-route");
const {researchQueueQuote} = loadCozyEngine("order-presentation");
const {cityWorksPreview} = loadCozyEngine("city-works");
const {courtGrowthOffer} = loadCozyEngine("kingdom-journey");
const { settleWorld } = loadCozyEngine("settlement");
const { ASCENSION_MINIMUM } = loadCozyEngine("ascension-preview");
const DAY = 86_400_000;
const START = 1_800_000_000_000;
const HORIZON = Number(process.env.KW_AUDIT_DAYS ?? 120);
const SEEDS = Number(process.env.KW_AUDIT_SEEDS ?? 2);
const MODES = process.env.KW_AUDIT_MODE ? [process.env.KW_AUDIT_MODE] : ["classic","express"];
const compareQueues = process.env.KW_AUDIT_QUEUE_COMPARE==="1";
const planWorks = process.env.KW_AUDIT_CITY_WORKS==="1";
const followCourtGuide = process.env.KW_AUDIT_COURT_GUIDE==="1";
const visitsPerDay = process.env.KW_AUDIT_VISITS ? [Number(process.env.KW_AUDIT_VISITS)] : [1,3];
const TRADE_PLANS = compareQueues || planWorks ? [true] : process.env.KW_AUDIT_TRADE_COMPARE==="1" ? [false,true] : [false];
assert(Number.isSafeInteger(HORIZON) && HORIZON>0 && Number.isSafeInteger(SEEDS) && SEEDS>0);
assert(MODES.every(mode=>["classic","express"].includes(mode)));
assert(visitsPerDay.every(count=>[1,3].includes(count)));

function play(seed, mode, visits, style, planTrade, planQueues) {
  const world = {id:`persistent-journey-${seed}`,name:"Vale",mode,status:"running",startsAt:START,
    influenceVersion:2,economyVersion:3,persistent:true,foundingOnboarding:true};
  const player = {playerId:"tester",influence:0,state:E.createCozyState(world,"tester","Teste",START)};
  let shared = E.createCozyShared(world);
  let now = START;
  let commands = 0;
  let buildingCommands = 0;
  let orderedWorks = 0;
  let courtHires = 0;
  let tradeCommands = 0;
  let bookedTrips = 0;
  let explorations = 0;
  let firstDecision = null;
  let secondCity = null;
  let firstLevelSix = null;
  let firstThreshold = null;
  let idleCityChecks = 0;
  let unfundedCityChecks = 0;
  let heldMaterials = 0;
  const blockedExploration = new Set();
  const checkpoints = {};
  const cityGoal = style==="capital" ? 2 : 8;
  const view = () => E.getCozyComputed(player.state,shared,world,now);
  const tiles = () => E.getCozyTiles(player.state,shared,world);
  const coord = ({q,r}) => ({q,r});
  const elapsed = () => Math.round((now-START)/DAY*10)/10;
  const dispatch = (action) => {
    const result = E.applyCozyAction(player.state,shared,world,action,now);
    player.state = result.state;
    shared = result.shared;
    commands++;
    if (["upgrade","plan_upgrade","plan_city_works"].includes(action.type)) {
      buildingCommands++;
      orderedWorks+=action.works?.length??1;
    }
    if (action.type==="trade_route") {
      tradeCommands++;
      bookedTrips+=action.trips??1;
    }
    if (action.type==="decree") firstDecision ??= elapsed();
    if (action.type==="explore") explorations++;
  };
  const afford = (state,cost) => Object.entries(cost).every(([key,value])=>state.resources[key]>=value);
  const localChoice = (option) => option.contentment*12+(option.integrityRestore??0)*4+option.productionBonus*5+
    (option.rewards?.gold??0)*2-Object.values(option.cost).reduce((a,b)=>a+b,0)/10;

  dispatch({type:"king_choose",profileId:"builder",nickname:"Teste"});
  dispatch({type:"counselor",slot:0,counselorId:"helena"});
  dispatch({type:"counselor",slot:1,counselorId:"ines"});
  dispatch({type:"hire",role:"engineer"});
  dispatch({type:"found_capital",...coord(tiles()[0]),name:"Vale",heroId:player.state.heroes[0].id});

  function manageRealm() {
    let s = player.state, c = view();
    const decree = c.decree;
    const option = decree?.options.filter(choice=>choice.resolution==="certain"&&afford(s,choice.cost??{}))
      .sort((a,b)=>b.effects.satisfaction-a.effects.satisfaction || (b.effects.gold??0)-(a.effects.gold??0))[0];
    if (option) dispatch({type:"decree",decreeId:decree.id,optionId:option.id});
    s = player.state; c = view();
    const care = s.cities.flatMap(city=>{
      const letter = c.cityLife[city.id]?.decision;
      return letter?.options.filter(choice=>!choice.chance&&localChoice(choice)>0&&afford(s,choice.cost))
        .map(choice=>({city,letter,choice})) ?? [];
    }).sort((a,b)=>localChoice(b.choice)-localChoice(a.choice))[0];
    if(care) dispatch({type:"city_decision",cityId:care.city.id,decisionId:care.letter.id,optionId:care.choice.id});
    s = player.state; c = view();
    const quest = c.questProgress.find(item=>item.complete&&!item.claimed);
    if(quest) dispatch({type:"quest",questId:quest.id});
    s = player.state; c = view();
    const reserveHero = !s.heroes.some(hero=>!hero.cityId) && s.cities.length<cityGoal;
    const research = Object.keys(s.research).sort((a,b)=>s.research[a]-s.research[b])[0];
    if (followCourtGuide && courtGrowthOffer(s,c)) {
      dispatch({type:"hire",role:"general"});
      courtHires++;
    } else if (reserveHero && s.resources.gold>=c.heroCost)
      dispatch({type:"hire",role:s.cities.length%3===0 ? "engineer" : "general"});
    else if (s.research[research]<5 && !s.orders.some(order=>order.kind==="research") &&
      s.resources.gold>=c.researchCosts[research] && (!reserveHero || s.research.military===0))
      dispatch({type:"research",research:s.research.military===0 ? "military" : research});
    else if (s.heroes.length<10 && s.heroes.length<=s.cities.length+1 && s.resources.gold>=c.heroCost)
      dispatch({type:"hire",role:"general"});
    if(planQueues && !reserveHero && player.state.orders.some(order=>order.kind==="research")) {
      for(let i=0;i<2;i++){
        const current=player.state;
        if(current.orders.filter(order=>order.kind==="research").length>=3) break;
        const options=Object.keys(current.research).map(id=>({id,...researchQueueQuote(current,id,c.dayMs,now)}));
        const next=options.filter(item=>item.level<5&&!item.full&&item.cost<=current.resources.gold)
          .sort((a,b)=>a.level-b.level)[0];
        if(!next) break;
        dispatch({type:"plan_research",research:next.id});
      }
    }
    s = player.state; c = view();
    const wonder = s.cities.find(city=>!city.wonder && Object.values(city.sectors).every(level=>level===10));
    if (wonder && c.influenceDetails.conquests.wonders<2 && s.resources.materials>=c.wonderCost)
      dispatch({type:"wonder",cityId:wonder.id});
  }

  function work() {
    if (planWorks) {
      const dayMs=view().dayMs;
      const cities=[...player.state.cities].sort((a,b)=>E.getCityDevelopment(a)-E.getCityDevelopment(b));
      let plans=0;
      for (const city of cities) {
        if (plans>=2) break;
        const {works}=cityWorksPreview(player.state,city,dayMs,now);
        if (!works.length) continue;
        dispatch({type:"plan_city_works",cityId:city.id,works});
        plans++;
      }
      return;
    }
    for (let n=0;n<4;n++) {
      const s = player.state;
      const candidates = s.cities.flatMap((city,index)=>{
        const orders = s.orders.filter(order=>order.kind==="upgrade"&&order.cityId===city.id);
        return E.SECTORS.flatMap(({id:sector})=>{
          const level = city.sectors[sector]+orders.filter(order=>order.sector===sector).length;
          if(level>=10 || orders.length>=3) return [];
          const cost = E.upgradeCost(s,level);
          if(cost>s.resources.materials) return [];
          const economy = sector==="economy" && level<4 ? -4 : 0;
          const supply = sector==="administration" && level<3 ? -1 : 0;
          const capital = style==="capital" && index===0 ? -3 : 0;
          return [{city,sector,level,orders,weight:level+economy+supply+capital+orders.length*2}];
        });
      }).sort((a,b)=>a.weight-b.weight);
      const choice = candidates[0];
      if(!choice) break;
      dispatch({type:choice.orders.length ? "plan_upgrade" : "upgrade",cityId:choice.city.id,sector:choice.sector});
    }
  }

  function frontier() {
    const s = player.state, c = view();
    const map = tiles();
    const nearby = [...map].sort((a,b)=>a.distance-b.distance);
    const armyBusy = s.orders.some(order=>order.kind==="attack");
    const hero = s.heroes.find(hero=>!hero.cityId&&!s.orders.some(order=>order.heroId===hero.id));
    const expand = s.cities.length<cityGoal;
    const affordable = tile=>tile.exploreCost<=s.resources.supplies;
    const expansion = hero && expand && !armyBusy && nearby.find(tile=>{
      if (!affordable(tile)) return false;
      if (style==="conquest") return tile.occupation?.canAnnex && s.explored.includes(tile.id) &&
        (!tile.territoryOwnerId || tile.territoryOwnerId===s.playerId);
      return tile.foundation?.canFound && afford(s,{materials:tile.foundation.materials,supplies:tile.foundation.supplies});
    });
    if (expansion) dispatch({type:style==="conquest" ? "annex" : "found_city",...coord(expansion),heroId:hero.id});
    else if (!armyBusy) {
      const hostiles = nearby.filter(tile=>tile.attackable&&tile.revealed&&s.explored.includes(tile.id)&&
        !tile.occupation?.canAnnex&&affordable(tile));
      const known = s.progression.feats.frontier.victories;
      const target = hostiles.find(tile=>!known.includes(tile.id)&&tile.combat?.attackWins) ??
        (s.resources.gold<1000 ? hostiles.find(tile=>tile.combat?.attackWins) : undefined);
      if(target) dispatch({type:"attack",...coord(target)});
      else if(c.armyPower<3200 && s.resources.materials>1100) {
        const army = Object.values(s.army).reduce((a,b)=>a+b,0);
        const unit = E.TROOPS.filter(troop=>E.canRecruitTroop(s,troop.id)).sort((a,b)=>b.power-a.power)[0];
        const amount = Math.min(c.armyCapacity-army,Math.floor((s.resources.materials-600)/c.troopCosts[unit.id]));
        if (amount>=5) dispatch({type:"recruit",troop:unit.id,amount});
      }
    }
    const reservation = nearby.find(tile=>tile.area?.canAnnex &&
      (!s.progression.feats.frontier.resourceAreaClaimed || tile.deposit?.resource==="gold"));
    if (reservation) dispatch({type:"area_annex",...coord(reservation)});
    const gold = nearby.find(tile=>tile.area?.canCollect && tile.deposit?.resource==="gold" && tile.deposit.remaining>0);
    if (gold && s.resources.gold<9000 && !s.orders.some(order=>order.kind==="collect"&&!order.tradeRoute))
      dispatch({type:"collect",...coord(gold)});
    if (c.tradeRoute && c.tradeRoute.arrivesAt===null && now>=c.tradeRoute.nextAt &&
        player.state.resources.supplies>=c.tradeRoute.supplies+30 && player.state.resources.gold<3500) {
      const trips=planTrade ? Math.min(3,Math.floor((player.state.resources.supplies-30)/c.tradeRoute.supplies)) : 1;
      dispatch({type:"trade_route",trips});
    }
    const explorationLimit = planQueues ? R.EXPLORATION_QUEUE_LIMIT : 1;
    for (let attempt=0;attempt<explorationLimit;attempt++) {
      const lane=R.explorationQueue(player.state,now).orders;
      if(lane.length>=explorationLimit) break;
      const known = new Set(map.filter(tile=>tile.revealed).map(tile=>tile.id));
      const pending = new Set(lane.map(order=>`${order.q},${order.r}`));
      const reservedTerrain = new Set(lane.flatMap(order=>R.explorationCorridor(order.explorationPath??[])));
      const target = nearby.filter(tile=>!pending.has(tile.id) && !blockedExploration.has(tile.id) && !s.explored.includes(tile.id) && !tile.ownerId && !tile.landmarkId &&
        (tile.q!==0 || tile.r!==0) && affordable(tile) && tile.exploreCost<=player.state.resources.supplies)
        .filter(tile=>!tile.revealed || tile.attackable)
        .map(tile=>({tile,weight:tile.distance+knownAreaPenalty(tile,known)+
          (reservedTerrain.has(tile.id)?6:knownAreaPenalty(tile,reservedTerrain))-Number(tile.attackable&&tile.revealed)*20}))
        .sort((a,b)=>a.weight-b.weight)[0]?.tile;
      if(!target) break;
      try {
        dispatch({type:"explore",...coord(target),...(lane.length?{queue:true}:{})});
      } catch (error) {
        if (error.name!=="CozyRuleError" || !error.message.includes("distrito de um santuário")) throw error;
        blockedExploration.add(target.id);
      }
    }
    function knownAreaPenalty({q,r},known) {
      return [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]]
        .filter(([dq,dr])=>known.has(`${q+dq},${r+dr}`)).length;
    }
  }

  for(let real=0;real<=HORIZON;real++){
    for (let visit=0;visit<(real===HORIZON ? 1:visits);visit++) {
      now=START+(real+visit/visits)*DAY;
      shared=settleWorld([player],shared,world,now);
      const s=player.state,c=view();
      assert(c.influence.total<=2500);
      if(s.cities.length>=2) secondCity ??= elapsed();
      if(s.cities.some(city=>Object.values(city.sectors).some(level=>level>=6))) firstLevelSix ??= elapsed();
      if(c.influence.total>=ASCENSION_MINIMUM) firstThreshold ??= elapsed();
      if(visit===0 && [15,30,60,90,120,HORIZON].includes(real)) checkpoints[real]={...c.influence,cities:s.cities.length};
      if (real===HORIZON || real>=7 && real<=9) continue;
      for (const city of s.cities) {
        if(s.orders.some(order=>order.kind==="upgrade"&&order.cityId===city.id)||Object.values(city.sectors).every(level=>level===10)) continue;
        idleCityChecks++;
        if(!E.SECTORS.some(({id})=>city.sectors[id]<10&&c.upgradeCosts[city.id][id]<=s.resources.materials)) unfundedCityChecks++;
      }
      heldMaterials=Math.max(heldMaterials,s.orders.reduce((sum,order)=>sum+(order.planned&&!order.planned.started ? order.planned.cost.materials??0 : 0),0));
      manageRealm();
      frontier();
      work();
      assert(Object.values(player.state.resources).every(value=>Number.isFinite(value)&&value>=0));
    }
  }
  const final = view();
  assert.equal(final.readOnly,false);
  assert.equal(player.state.portalCrossedAt,null);
  return {seed,mode,visits,style,planTrade,planQueues,planWorks,followCourtGuide,courtHires,firstDecision,secondCity,firstLevelSix,firstThreshold,commands,buildingCommands,orderedWorks,tradeCommands,bookedTrips,explorations,
    idleCityChecks,unfundedCityChecks,heldMaterials,blockedExploration:blockedExploration.size,peak:player.state.peakInfluence,
    military:final.influenceDetails.military,council:player.state.progression.council.sources,
    research:player.state.research,heroes:player.state.heroes.length,resources:player.state.resources,checkpoints};
}

const rows=[];
for(const mode of MODES)
  for(const visits of visitsPerDay)
    for(const style of ["capital","expansion","conquest"])
      for(let seed=1;seed<=SEEDS;seed++)
        for(const planTrade of TRADE_PLANS)
          for(const planQueues of planWorks?[true]:compareQueues?[false,true]:[false]) rows.push(play(seed,mode,visits,style,planTrade,planQueues));
if(process.env.KW_AUDIT_JSON==="1") console.log(JSON.stringify(rows,null,2));
else console.table(rows.map(row=>({map:row.seed,mode:row.mode,visits:row.visits,style:row.style,plannedTrades:row.planTrade,plannedQueues:row.planQueues,day1500:row.firstThreshold,
  cities:row.checkpoints[HORIZON].cities,score:row.checkpoints[HORIZON].total,
  infra:row.checkpoints[HORIZON].infrastructure,military:row.checkpoints[HORIZON].military,government:row.checkpoints[HORIZON].government,
  council:row.checkpoints[HORIZON].society,feats:row.checkpoints[HORIZON].legacy,builds:row.buildingCommands})));
