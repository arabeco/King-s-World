import {applyAllianceAction,syncAllianceProjects} from './alliances';
import {cancelOrphanedPacts,syncSanctuaryPacts} from './sanctuary-pacts';
import {combatAssessment} from './combat';
import {retargetArmyReturns} from './expedition-army';
import {seasonDays,clockSpeed} from './rhythm';
import type {CozyShared,CozyState,CozyWorld} from './types';
import {releaseCityTerritory,restoreCityTerritory} from './city-territory';
/** Atomic domain transfer primitive. Live dispatch remains unavailable until competitive worlds are enabled. */
export function conquerPlayerCity(input:{attacker:CozyState;defender:CozyState;shared:CozyShared;world:CozyWorld;cityId:string;heroId:string;at:number;attackPower:number;defensePower:number}){
 const {world,cityId,heroId,at}=input;
 if(world.combatMode!=='competitive'||world.status!=='running'||!Number.isFinite(at)||world.startsAt===null||at<world.startsAt)throw Error('CONQUEST_MODE_CLOSED');
 const duration=86400000/clockSpeed(world);
 if(at>=world.startsAt+seasonDays(world)*duration)throw Error('CONQUEST_SEASON_CLOSED');
 if(!Number.isFinite(input.attackPower)||!Number.isFinite(input.defensePower)||input.attackPower<=0||input.defensePower<0||!combatAssessment(input.attackPower,input.defensePower).occupationMargin)throw Error('CONQUEST_MARGIN_REQUIRED');
 if(at<input.attacker.settledAt||at<input.defender.settledAt)throw Error('CONQUEST_TIME_REWIND');
 if(input.attacker.cities.some(c=>c.id===cityId))throw Error('CONQUEST_TARGET_CHANGED');
 if(input.attacker.playerId===input.defender.playerId||input.attacker.defeat||input.defender.defeat||input.attacker.finalizedAt!==null||input.defender.finalizedAt!==null)throw Error('CONQUEST_ACTOR_INVALID');
 if(input.shared.alliances.some(a=>a.members.includes(input.attacker.playerId)&&a.members.includes(input.defender.playerId)))throw Error('CONQUEST_ALLIED');
 const attacker=structuredClone(input.attacker),defender=structuredClone(input.defender),shared=structuredClone(input.shared);
 const city=defender.cities.find(c=>c.id===cityId),hero=attacker.heroes.find(h=>h.id===heroId&&h.cityId===null);
 if(!city||shared.claims[`${city.q},${city.r}`]?.playerId!==defender.playerId||shared.claims[`${city.q},${city.r}`]?.cityId!==city.id)throw Error('CONQUEST_TARGET_CHANGED');
 if(!hero||attacker.orders.some(o=>o.heroId===heroId)||attacker.cities.length>=10)throw Error('CONQUEST_OCCUPATION_UNAVAILABLE');
 const domain=releaseCityTerritory(defender,shared,city),wasCapital=city.capital;
 defender.cities=defender.cities.filter(c=>c.id!==city.id);
 for(const h of defender.heroes)if(h.cityId===city.id)h.cityId=null;
 const canceled=defender.orders.filter(o=>o.cityId===city.id);
 for(const order of canceled)if(order.planned&&!order.planned.started)for(const resource of ['gold','materials','supplies'] as const)defender.resources[resource]+=order.planned.cost[resource]??0;
 defender.orders=defender.orders.filter(o=>o.cityId!==city.id);
 if(defender.progression)delete defender.progression.council.careSince[`${city.q},${city.r}`];
 const captured={...city,capital:false,heroId:hero.id,life:{contentment:35,lastDecisionDay:null,lastSocialDay:city.life?.lastSocialDay??1,unrestDays:0}};
 attacker.cities.push(captured);hero.cityId=captured.id;
 shared.claims[`${city.q},${city.r}`]={playerId:attacker.playerId,cityId:captured.id,name:captured.name};
 restoreCityTerritory(attacker,shared,captured,domain);
 // Transfer only this defender's reserve rights, retaining allied shares and stock.
 for(const id of domain.resourceAreas){const area=shared.areas?.[id];if(!area)continue;
  const hostile=area.owners.some(owner=>owner!==attacker.playerId&&!shared.alliances.some(a=>a.members.includes(owner)&&a.members.includes(attacker.playerId)));
  if(!hostile){if(!area.owners.includes(attacker.playerId))area.owners.push(attacker.playerId);(area.ownerCities??={})[attacker.playerId]=captured.id;}
 }
 let replacement:string|null=null;
 if(!defender.cities.length){
  defender.defeat={at,byPlayerId:attacker.playerId,lastCityId:cityId};defender.capitalSelectionPending=false;
  // No traveling order may later recreate an eliminated empire or award a fresh discovery.
  for(const order of defender.orders)if(order.planned&&!order.planned.started)for(const resource of ['gold','materials','supplies'] as const)defender.resources[resource]+=order.planned.cost[resource]??0;
  defender.orders=[];for(const h of defender.heroes)h.cityId=null;
  for(const troop of ['militia','shooters','scouts','machinery'] as const)defender.army[troop]=0;
  if(defender.allianceId){applyAllianceAction(defender,shared,{type:'alliance_leave'},at,duration,prefix=>`${defender.playerId}:${prefix}:${++defender.sequence}`);cancelOrphanedPacts(shared,at);}
  const log=(title:string,body:string)=>{defender.reports.unshift({id:`${defender.playerId}:report:${++defender.sequence}`,at,kind:'alliance',title,body,positive:true});defender.reports=defender.reports.slice(0,80);};
  syncAllianceProjects(defender,shared,at,log);syncSanctuaryPacts(defender,shared,at,log);
  defender.allianceBenefits=[];defender.sanctuaryBenefits=[];

 }else if(wasCapital){
  const next=[...defender.cities].sort((a,b)=>(b.integrity??100)-(a.integrity??100)||Object.values(b.sectors).reduce((n,v)=>n+v,0)-Object.values(a.sectors).reduce((n,v)=>n+v,0)||a.id.localeCompare(b.id))[0];
  for(const c of defender.cities)c.capital=c.id===next.id;
  defender.capitalSelectionPending=true;replacement=next.id;
 }
 retargetArmyReturns(defender);
 return {attacker,defender,shared,capturedCityId:cityId,replacementCapitalId:replacement,eliminated:Boolean(defender.defeat),territory:domain.territory};
}
