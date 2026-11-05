import {takeBattleLoot} from './battle-reward';
import {retargetArmyReturns} from './expedition-army';
import {getCozyComputed,getCozyDay} from './engine';
import {combatAssessment} from './combat';
import {damageCityBuildings} from './city-damage';
import {conquerPlayerCity} from './city-conquest';
import {areaAllied} from './areas';
import {TROOPS} from './catalog';
import type {CozyState,CozyShared,CozyWorld,CozyResources,CozyReport} from './types';
type Player={playerId:string;state:CozyState;influence:number};
function report(state:CozyState,at:number,title:string,body:string,positive=false,battle?:CozyReport['battle']){
 state.sequence++;state.reports.unshift({id:`${state.playerId}:report:${state.sequence}`,at,kind:'combat',title,body,positive,...(battle?{battle}:{})});state.reports=state.reports.slice(0,80);
}
function losses(state:CozyState,fraction:number){let total=0;for(const troop of TROOPS){const n=Math.ceil(state.army[troop.id]*fraction);state.army[troop.id]-=n;total+=n;}return total;}
/** Global arrivals are ordered by sent time and receipt ID, never player-array iteration. */
export function resolvePlayerAttacks(players:Player[],inputShared:CozyShared,world:CozyWorld,at:number){
 let shared=inputShared;
 const arrivals=players.flatMap(p=>p.state.orders.filter(o=>o.targetPlayerId&&o.arrivesAt===at).map(order=>({playerId:p.playerId,order}))).sort((a,b)=>a.order.createdAt-b.order.createdAt||a.order.id.localeCompare(b.order.id));
 for(const {playerId,order} of arrivals){
  const actor=players.find(p=>p.playerId===playerId);if(!actor||!actor.state.orders.some(o=>o.id===order.id))continue;
  actor.state.orders=actor.state.orders.filter(o=>o.id!==order.id);
  const roundtrip=order.abstractAttack||Boolean(order.returnTravelMs)||Boolean(order.expeditionArmy);
  const returning=(cargo:Partial<CozyResources>={})=>{
   if(!roundtrip||actor.state.defeat)return;
   const hero=actor.state.heroes.find(h=>h.id===order.heroId);
   actor.state.orders.push({id:order.id+':return',kind:'attack',createdAt:at,arrivesAt:at+(order.returnTravelMs??Math.max(60000,order.arrivesAt-order.createdAt)),q:order.expeditionOrigin?.q??order.q,r:order.expeditionOrigin?.r??order.r,returning:true,abstractAttack:true,expeditionOrigin:{q:order.q!,r:order.r!},cargo,...(hero?.cityId===null?{heroId:hero.id}:{})});
   retargetArmyReturns(actor.state);
  };
  const target=players.find(p=>p.playerId===order.targetPlayerId),id=`${order.q},${order.r}`;
  const city=target?.state.cities.find(c=>c.id===order.targetCityId&&c.q===order.q&&c.r===order.r);
  if(world.combatMode!=='competitive'||actor.state.defeat||!target||target.state.defeat||!city||shared.claims[id]?.playerId!==target.playerId||shared.claims[id]?.cityId!==city.id||areaAllied(shared,actor.playerId,target.playerId)){
   report(actor.state,at,'Investida encerrada sem combate','O alvo mudou, ficou aliado ou não pode mais combater. Não houve novas perdas; as tropas estão retornando e os suprimentos do envio já foram utilizados.');returning();continue;
  }
  const a=getCozyComputed(actor.state,shared,world,at),d=getCozyComputed(target.state,shared,world,at);
  if(a.readOnly||d.readOnly){report(actor.state,at,'Investida encerrada sem combate','A temporada ou o império não permite mais o confronto.');returning();continue;}
  const power=a.playerAttackPower,defense=d.defensePower;
  if(power<=0){report(actor.state,at,'Investida encerrada sem combate','O exército não tem mais força disponível para atacar. O destino não sofreu dano.');returning();continue;}
  const result=combatAssessment(power,defense);
  const attackerLosses=losses(actor.state,result.attackWins?.06:.20),defenderLosses=losses(target.state,result.attackWins?.12:.025);
  const loot=takeBattleLoot(result.attackWins?target.state:actor.state);
  if(!result.attackWins)for(const resource of ['gold','materials'] as const)target.state.resources[resource]+=loot[resource]??0;
  const before=city.integrity??100,infraBefore=d.influence.infrastructure;
  const buildings=result.attackWins?damageCityBuildings(target.state,city,defense,power):[];
  if(result.attackWins)city.integrity=Math.max(0,before-25);
  let conquered=false,replacement:string|null=null,eliminated=false;
  const hero=actor.state.heroes.find(h=>h.id===order.heroId&&h.cityId===null);
  if(result.attackWins&&city.integrity===0&&order.conquest&&result.occupationMargin&&hero&&actor.state.cities.length<10&&!actor.state.orders.some(o=>o.heroId===hero.id)){
   const moved=conquerPlayerCity({attacker:actor.state,defender:target.state,shared,world,cityId:city.id,heroId:hero.id,at,attackPower:power,defensePower:defense});
   actor.state=moved.attacker;target.state=moved.defender;shared=moved.shared;conquered=true;replacement=moved.replacementCapitalId;eliminated=moved.eliminated;
   const occupied=actor.state.cities.find(c=>c.id===city.id)!;if(occupied.life)occupied.life.lastSocialDay=getCozyDay(world,at);
  }
  const infraAfter=getCozyComputed(target.state,shared,world,at).influence.infrastructure;
  const infrastructureLost=Math.max(0,infraBefore-infraAfter);
  const changed=buildings.map(hit=>`${hit.sector} ${hit.from}→${hit.to}`).join(', ');
  const summary=`${power} de poder contra ${defense} de defesa. Integridade de ${city.name}: ${before}% → ${Math.max(0,before-(result.attackWins?25:0))}%.${changed?` Edifícios: ${changed}.`:''}${infrastructureLost?` Infraestrutura: −${infrastructureLost} de influência.`:''}`;
  if(result.attackWins&&!roundtrip)for(const resource of ['gold','materials'] as const)actor.state.resources[resource]+=loot[resource]??0;
  returning(result.attackWins?loot:{});
  const battle={city:{name:city.name,q:city.q,r:city.r},attackPower:power,defensePower:defense,integrityBefore:before,integrityAfter:Math.max(0,before-(result.attackWins?25:0)),infrastructureBefore:infraBefore,infrastructureAfter:infraAfter,buildings,conquered};
  const signedLoot=(positive:boolean)=>({gold:(loot.gold??0)*(positive?1:-1),materials:(loot.materials??0)*(positive?1:-1)});
  report(actor.state,at,conquered?'Cidade conquistada':result.attackWins?'Ataque causou danos':'Ataque repelido',`${summary} ${attackerLosses} tropas suas perdidas. ${result.attackWins?`Saque em transporte: ${loot.gold??0} ouro e ${loot.materials??0} materiais.`:`Recursos perdidos: ${loot.gold??0} ouro e ${loot.materials??0} materiais.`}${order.conquest&&!conquered?' A ocupação não foi concluída; outra investida pode ser necessária.':''}`,result.attackWins,{...battle,perspective:'attacker',troopsLost:attackerLosses,resourceDelta:signedLoot(result.attackWins),delivery:result.attackWins?(roundtrip?'return':'credited'):'lost',returnsAt:actor.state.orders.find(o=>o.id===order.id+':return')?.arrivesAt});
  report(target.state,at,eliminated?'Última cidade conquistada':conquered?'Cidade perdida':result.attackWins?'Cidade sob ataque':'Ataque defendido',`${summary} ${defenderLosses} tropas suas perdidas. ${result.attackWins?`Saque perdido: ${loot.gold??0} ouro e ${loot.materials??0} materiais.`:`Defesa vitoriosa: +${loot.gold??0} ouro e +${loot.materials??0} materiais.`}${replacement?' Outra cidade assumiu provisoriamente; escolha a nova capital.':''}${eliminated?' O império foi derrotado; relatos e resultado da temporada permanecem disponíveis.':''}`,!result.attackWins,{...battle,perspective:'defender',troopsLost:defenderLosses,resourceDelta:signedLoot(!result.attackWins),delivery:result.attackWins?'lost':'credited'});
 }
 return shared;
}

/** Recipient-only projection. Do not expose unrelated armies or other kingdoms' routes. */
export function incomingPlayerAttacks(players:Player[],target:CozyState,now:number){
 if(target.defeat)return [];
 return players.filter(p=>p.playerId!==target.playerId&&!p.state.defeat).flatMap(p=>p.state.orders.filter(o=>o.targetPlayerId===target.playerId&&o.arrivesAt>now).map(o=>({orderId:o.id,attackerId:p.playerId,attackerName:p.state.playerName,cityId:o.targetCityId!,cityName:target.cities.find(c=>c.id===o.targetCityId)?.name??'Cidade',arrivesAt:o.arrivesAt,conquest:o.conquest===true}))).sort((a,b)=>a.arrivesAt-b.arrivesAt||a.orderId.localeCompare(b.orderId));
}
