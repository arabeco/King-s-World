import type {CozyCity,CozyInfluence,CozyShared,CozyState} from './types';
import {getCityInfrastructure,QUESTS} from './catalog';

/** Provisional weights, centralized for later balancing. No economy/timer constants here. */
export const PROGRESSION = {
  cityMax:50,hero:30,researchLevel:10,militaryDivisor:6,
  councilMax:500,decreeMerit:8,localMerit:6,stableMerit:4,civicPeriod:6,
  trustFloor:35,trustFull:70,societyResistancePerLevel:.03,
  wonder:60,wonderLimit:2,cooperationMax:80,survey:4,collectionStep:500,collectionCredit:4,support:12,project:12,
} as const;
const clamp=(n:number,max=500)=>Math.max(0,Math.min(max,n));
export const hasZeroProgression=(state:CozyState)=>state.progression?.version===2;
export const newProgressionBalance=(expressEconomy=false)=>({militaryDivisor:90,militaryVictoryMax:200,councilExpansionDamping:true,...(expressEconomy?{expressEconomy:true,constructionGrowth:1.36,councilMeaningfulDecrees:true,councilContinuity:true,plannedCapacity:12,infrastructureRanked:true,infrastructureWeights:[...INFRASTRUCTURE_WEIGHTS],councilSourceCaps:{decree:160,local:140,stable:200},councilMerit:{decree:4,local:6,stable:8}}:{})});
export function bindWorldBalance(shared:CozyShared,existing:CozyState[],expressEconomy=false){
 if(shared.progressionBalance===undefined){const first=existing.filter(s=>s.progression).sort((a,b)=>a.createdAt-b.createdAt||a.playerId.localeCompare(b.playerId))[0];shared.progressionBalance=first?structuredClone(first.progression!.balance??null):newProgressionBalance(expressEconomy);}
 return shared.progressionBalance;
}
export function createProgression(state:CozyState,militaryBaseline:number,expressEconomy=false){
 const capital=state.cities.find(c=>c.capital)!;
 state.progression={version:2,balance:newProgressionBalance(expressEconomy),capitalId:capital.id,capitalLevels:{...capital.sectors},militaryBaseline,
  council:{merit:0,episodes:[],careSince:{},selfHarm:{}},feats:{wonders:[],surveys:[],collected:{},supports:[]}};
}
function infrastructureLevels(state:CozyState,city:CozyCity){
 // Legacy seasons use the original five-sector rule. Current infrastructure
 // belongs to the city and counts its actual levels, including retained ones.
 if(!state.progression)return getCityInfrastructure(city);
 return Object.values(city.sectors).reduce((sum,level)=>sum+level,0);
}
const INFRASTRUCTURE_WEIGHTS=[150,100,70,50,35,25,20,20,15,15];
const HISTORICAL_INFRASTRUCTURE_WEIGHTS=[100,80,65,55,45,40,35,30,25,25];
export function infrastructureContribution(state:CozyState,city:CozyCity){
 if(!state.progression?.balance?.infrastructureRanked)return infrastructureLevels(state,city);
 const ranked=state.cities.map(c=>({id:c.id,levels:clamp(infrastructureLevels(state,c),50)})).sort((a,b)=>b.levels-a.levels||a.id.localeCompare(b.id));
 const position=ranked.findIndex(c=>c.id===city.id);
 const weights=state.progression.balance.infrastructureWeights??HISTORICAL_INFRASTRUCTURE_WEIGHTS;
 return position<0?0:Math.floor(ranked[position].levels/50*(weights[position]??0));
}
export function localTrustDelta(state:CozyState,city:CozyCity,delta:number){
 if(!hasZeroProgression(state)||delta>=0)return delta;
 return -Math.ceil(-delta*(1-Math.min(.3,city.sectors.society*PROGRESSION.societyResistancePerLevel)));
}
export function councilStability(state:CozyState){
 if(!state.cities.length)return 0;
 const values=state.cities.map(c=>clamp(((c.life?.contentment??state.satisfaction)-PROGRESSION.trustFloor)/(PROGRESSION.trustFull-PROGRESSION.trustFloor),1));
 return values.reduce((a,b)=>a+b,0)/values.length;
}
/** A healthy kingdom can earn legitimacy without manufacturing a crisis. */
export function decreeCareRecognized(state:CozyState,day:number,deltas:Record<string,number>,fallback:number){
 if(!state.progression?.balance?.councilMeaningfulDecrees)return true;
 const council=state.progression.council;
 const genuine=state.cities.some(city=>(deltas[city.id]??fallback)>(council.selfHarm[`${city.q},${city.r}`]??0));
 const maintained=state.cities.length>0&&state.cities.every(city=>(city.life?.contentment??state.satisfaction)>=70&&(council.selfHarm[`${city.q},${city.r}`]??0)===0)&&state.cities.some(city=>{const since=council.careSince[`${city.q},${city.r}`];return since!==undefined&&day-since>=PROGRESSION.civicPeriod;});
 return genuine||maintained;
}
export function councilCredit(state:CozyState,id:string,points:number){
 const council=state.progression?.council;
 if(!council||council.episodes.includes(id)||council.merit>=PROGRESSION.councilMax)return;
 const source=id.startsWith('decree:')?'decree':id.startsWith('local:')?'local':id.startsWith('stable:')?'stable':null;
 points=(source&&state.progression?.balance?.councilMerit?.[source])??points;
 const localEpisode=id.startsWith('local:')||id.startsWith('stable:');
 const credit=localEpisode&&state.progression?.balance?.councilExpansionDamping?Math.max(1,Math.floor(points/Math.sqrt(Math.max(1,state.cities.length)))):points;
 const amount=credit*(state.progression?.balance?.expressEconomy?4:1);
 const caps=state.progression?.balance?.councilSourceCaps;
 if(caps){
  if(!source)return;
  council.sources??={decree:0,local:0,stable:0};
  const earned=Math.max(0,Math.min(amount,caps[source]-council.sources[source]));
  council.episodes.push(id);council.sources[source]+=earned;council.merit=clamp(council.merit+earned);
 }else{council.episodes.push(id);council.merit=clamp(council.merit+amount);}
}
export function recordCityCare(state:CozyState,city:CozyCity,day:number,trustDelta:number,operationalGain:boolean,credit=true){
 const council=state.progression?.council;if(!council)return;
 const site=`${city.q},${city.r}`,debt=council.selfHarm[site]??0;
 if(trustDelta<0){council.selfHarm[site]=debt-trustDelta;if(state.progression?.balance?.councilContinuity)delete council.careSince[site];return;}
 const genuineRecovery=Math.max(0,trustDelta-debt);
 council.selfHarm[site]=Math.max(0,debt-trustDelta);
 if(!genuineRecovery&&!operationalGain)return;
 council.careSince[site]??=day;
 if(credit&&(city.life?.contentment??0)>=35&&!(council.selfHarm[site]>0))
  councilCredit(state,`local:${site}:${Math.floor((day-1)/PROGRESSION.civicPeriod)}`,PROGRESSION.localMerit);
}
export function recordStableAdministration(state:CozyState,city:CozyCity,day:number){
 const council=state.progression?.council;if(!council)return;
 const site=`${city.q},${city.r}`,since=council.careSince[site];
 if(state.progression?.balance?.councilContinuity&&((city.life?.contentment??0)<60||(council.selfHarm[site]??0)>0)){delete council.careSince[site];return;}
 if(since===undefined||day-since<PROGRESSION.civicPeriod||(city.life?.contentment??0)<60||(council.selfHarm[site]??0)>0)return;
 councilCredit(state,`stable:${site}:${Math.floor((day-since)/PROGRESSION.civicPeriod)}`,PROGRESSION.stableMerit);
}
export function recognizeSupport(state:CozyState,shared:CozyShared,at:number){
 const feats=state.progression?.feats;if(!feats)return;
 for(const support of shared.support)if(support.supporterId===state.playerId&&support.resolvedAt!==undefined&&support.resolvedAt<=at&&support.acceptedAt!==null&&!feats.supports.includes(support.id))feats.supports.push(support.id);
}
export function progressionBreakdown(state:CozyState,army:number,walls:number){
 const p=state.progression;
 const cities=Object.fromEntries(state.cities.map(c=>[c.id,infrastructureContribution(state,c)]));
 const assigned=state.heroes.filter(h=>h.cityId!==null&&state.cities.some(c=>c.id===h.cityId&&c.heroId===h.id)).length;
 const research=Object.values(state.research).reduce((a,b)=>a+b,0);
 const missions=state.quests.reduce((sum,id)=>sum+(QUESTS.find(q=>q.id===id)?.points??0),0);
 const wonders=p?Math.min(PROGRESSION.wonderLimit,p.feats.wonders.length):Math.min(2,state.cities.filter(c=>c.wonder).length);
 const collected=p?Object.values(p.feats.collected).reduce((a,b)=>a+b,0):0;
 const cooperation=p?Math.min(PROGRESSION.cooperationMax,p.feats.surveys.length*PROGRESSION.survey+Math.floor(collected/PROGRESSION.collectionStep)*PROGRESSION.collectionCredit+p.feats.supports.length*PROGRESSION.support+(p.feats.projects?.length??0)*PROGRESSION.project):Math.min(80,state.cooperation*4);
 const military=Math.max(0,army+walls-(p?.militaryBaseline??0));
 return {model:p?'zero-v1' as const:'legacy' as const,cities,government:{heroes:assigned*(p?PROGRESSION.hero:50),research:p?research*PROGRESSION.researchLevel:0},
  council:{merit:p?.council.merit??0,stability:councilStability(state),episodes:p?.council.episodes.length??0},
  conquests:{missions,wonders,wonderPoints:wonders*PROGRESSION.wonder,cooperation,surveySteps:p?.feats.surveys.length??0,collectedUnits:collected,supports:p?.feats.supports.length??0,projects:p?.feats.projects?.length??0},
  military:{baseline:p?.militaryBaseline??0,capacity:army+walls,earned:military}};
}
export function zeroInfluence(state:CozyState,army:number,walls:number):CozyInfluence{
 const d=progressionBreakdown(state,army,walls);
 const infrastructure=clamp(Object.values(d.cities).reduce((a,b)=>a+b,0));
 const government=clamp(d.government.heroes+d.government.research);
 const victoryMax=state.progression?.balance?.militaryVictoryMax??0;
 const readiness=clamp(Math.floor(d.military.earned/(state.progression?.balance?.militaryDivisor??PROGRESSION.militaryDivisor)),500-victoryMax);
 const military=clamp(readiness+Math.floor(Math.min(6,state.hordesWon)/6*victoryMax));
 const society=clamp(Math.round(d.council.merit*d.council.stability));
 const legacy=clamp(d.conquests.missions+d.conquests.wonderPoints+d.conquests.cooperation);
 return {infrastructure,government,military,society,legacy,total:infrastructure+government+military+society+legacy};
}
