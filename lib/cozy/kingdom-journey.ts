import type {CozyPayload,CozySector,CozyResearch} from './types';
import {getCozyUpgradeDurationMs,getCozyResearchDurationMs} from './catalog';
import {hordeForecast} from './horde-forecast';
import {orderQueued,orderMapLabel} from './order-presentation';
export type JourneyTarget={kind:'city';cityId:string;entry:'decisions'|CozySector}|{kind:'military'|'defense'|'map'|'council'|'orders'|'reports'}|{kind:'achievements';tab?:'Conquistas'|'Vitória'|'Ranking'}|{kind:'research';research:CozyResearch};
export type JourneyStep={id:string;title:string;detail:string;action:string;icon:string;target:JourneyTarget;readyAt?:number;tone?:'urgent'|'calm'};
/** Navigation only. Never settles time, spends resources or predicts a completed command. */
export function kingdomJourney(data:CozyPayload,now:number):JourneyStep[]{
 const {state,computed}=data,steps:JourneyStep[]=[];
 const add=(step:JourneyStep)=>{if(!steps.some(s=>s.id===step.id))steps.push(step);};
 const results:JourneyStep={id:'results',title:state.finalizedAt!==null?'Seu resultado está pronto':'A temporada terminou',detail:state.finalizedAt!==null?'Veja o ranking e os prêmios registrados para este reinado.':'Consulte as conquistas e o fechamento da temporada.',action:'Ver conquistas',icon:'/icons/influence-legacy.png',target:{kind:'achievements',tab:'Vitória'}};
 if(computed.readOnly||state.finalizedAt!==null)return [results];
 if(!computed.started)return [];
 if(state.defeat)return [{id:'defeat',title:'A história deste império terminou',detail:'Os relatos mostram o que aconteceu. O ranking e os prêmios são fechados no fim da temporada.',action:'Ver relatos',icon:'/icons/nav-intel.png',target:{kind:'reports'}},{...results,title:'Acompanhar a temporada',target:{kind:'achievements',tab:'Ranking'}}];
 if(state.capitalSelectionPending&&state.cities[0])add({id:'capital',title:'Escolha sua nova capital',detail:'Confira as cidades que restaram e confirme qual será a nova sede do reino.',action:'Escolher capital',icon:'/icons/nav-cities.png',target:{kind:'city',cityId:state.cities[0].id,entry:'decisions'},tone:'urgent'});
 const forecast=hordeForecast(computed,now),attack=computed.playerThreats?.[0];
 if(attack||forecast.urgent)add({id:'defense',title:attack?`Ataque a ${attack.cityName}`:'Prepare-se para a horda',detail:attack?'Confira a chegada do ataque, sua defesa e as opções de apoio.':`Na comparação atual faltam ${Math.ceil(forecast.gap)} de defesa. Confira tropas, muralhas e apoio.`,action:'Ver defesa',icon:'/icons/action-defend.png',target:{kind:'defense'},readyAt:attack?.arrivesAt??forecast.horde?.arrivesAt,tone:'urgent'});
 const crisis=state.cities.find(city=>(computed.cityLife[city.id]?.contentment??70)<35);
 if(crisis)add({id:'crisis',title:`Cuide de ${crisis.name}`,detail:computed.cityLife[crisis.id]?.decision?'A confiança está baixa. Veja as escolhas locais para ajudar a cidade antes de a crise piorar.':'A confiança está baixa. Confira a situação da cidade; as decisões locais se renovam a cada dia de jogo.',action:'Ver decisões da cidade',icon:'/icons/influence-society.png',target:{kind:'city',cityId:crisis.id,entry:'decisions'},tone:'urgent'});
 if(state.portalCrossedAt!==null&&state.portalCrossedAt>state.readAt)add({id:'victory',title:'Selo de Vitória conquistado',detail:'Seu selo está registrado. A temporada continua até o ranking final; os prêmios chegam no fechamento.',action:'Ver vitória',icon:'/icons/influence-legacy.png',target:{kind:'achievements',tab:'Vitória'}});
 const busyCities=new Set(state.orders.filter(order=>order.kind==='upgrade').map(order=>order.cityId));
 const sectors:CozySector[]=['economy','administration','society','recruitment','defense'];
 const canUpgrade=(city:typeof state.cities[number],sector:CozySector)=>city.sectors[sector]<10&&computed.upgradeCosts[city.id]?.[sector]<=state.resources.materials&&(computed.endsAt===null||now+getCozyUpgradeDurationMs(state,city,sector,computed.dayMs)<=computed.endsAt);
 const upgradeCity=state.cities.find(city=>!busyCities.has(city.id)&&sectors.some(sector=>canUpgrade(city,sector)));
 const upgradeSector=upgradeCity&&[...sectors].sort((a,b)=>upgradeCity.sectors[a]-upgradeCity.sectors[b]).find(sector=>canUpgrade(upgradeCity,sector));
 const firstUpgrade=state.cities.some(city=>Object.values(city.sectors).some(level=>level>(state.progression?0:1)))||busyCities.size>0;
 const army=Object.values(state.army).reduce((sum,n)=>sum+n,0),hasExplored=state.explored.length>0;
 const explore=state.orders.find(order=>order.kind==='explore');
 const canRecruit=army<computed.armyCapacity&&state.resources.materials>=computed.troopCosts.militia&&!state.orders.some(order=>order.kind==='attack');
 const grow:JourneyStep|undefined=upgradeCity&&upgradeSector?{id:'upgrade',title:`Evoluir ${upgradeCity.name}`,detail:'Compare o ganho do próximo nível com o custo e o tempo da obra antes de confirmar.',action:'Ver melhoria',icon:upgradeSector==='economy'?'/buildings/fazenda.png':upgradeSector==='society'?'/buildings/habitacao.png':upgradeSector==='recruitment'?'/buildings/quartel.png':upgradeSector==='defense'?'/icons/building-wall.png':'/buildings/palacio.png',target:{kind:'city',cityId:upgradeCity.id,entry:upgradeSector}}:undefined;
 if(!firstUpgrade&&grow)add(grow);
 if(firstUpgrade&&army<=25&&canRecruit&&!hasExplored&&!explore)add({id:'recruit',title:'Reforce seu exército',detail:'Veja poder, vagas e custo total. Escolha a quantidade antes de recrutar.',action:'Ver recrutamento',icon:'/icons/influence-military.png',target:{kind:'military'}});
 if(firstUpgrade&&army>25&&!hasExplored&&!explore)add({id:'first-explore',title:'Explore seu primeiro território',detail:'Escolha um destino para ver o caminho, os suprimentos e a chegada. Explorar revela a região; anexar é uma ação diferente.',action:'Ver mundo',icon:'/icons/action-explore.png',target:{kind:'map'}});
 const completed=state.reports.filter(r=>r.at>state.readAt&&(['Setor concluído','Pesquisa concluída','Expedição retornou','Saque concluído'].includes(r.title)||r.kind==='exploration')).sort((a,b)=>b.at-a.at);
 if(completed.length)add({id:'returned',title:completed.length===1?completed[0].title:`${completed.length} novidades no reino`,detail:'Veja o que terminou e o resultado de cada ordem nos relatos.',action:'Ver resultados das ordens',icon:'/icons/nav-intel.png',target:{kind:'reports'}});
 if(explore)add({id:'waiting',title:'Exploração em curso',detail:'A expedição já está a caminho. Ao chegar, o resultado aparece nos relatos. Você pode voltar depois.',action:'Acompanhar ordens',icon:'/icons/status-time-v1.png',target:{kind:'orders'},readyAt:explore.arrivesAt,tone:'calm'});
 if(computed.decree&&computed.decree.options.some(option=>Object.entries(option.cost??{}).every(([key,n])=>state.resources[key as keyof typeof state.resources]>=n)))add({id:'council',title:'Uma decisão espera por você',detail:computed.decree.title,action:'Ouvir o Conselho',icon:'/icons/influence-society.png',target:{kind:'council'}});
 const damaged=state.cities.find(city=>(city.integrity??100)<100&&computed.cityLife[city.id]?.decision?.options.some(option=>option.integrityRestore&&Object.entries(option.cost).every(([key,n])=>state.resources[key as keyof typeof state.resources]>=n)));
 if(damaged)add({id:'repair',title:`Recuperar ${damaged.name}`,detail:`Integridade em ${Math.round(damaged.integrity??100)}%. Veja as opções de recuperação e seus custos.`,action:'Ver reparos',icon:'/icons/building-wall.png',target:{kind:'city',cityId:damaged.id,entry:'decisions'}});
 if(computed.questProgress.some(q=>q.complete&&!q.claimed))add({id:'milestone',title:'Uma conquista está pronta',detail:'Confira o marco concluído e a recompensa antes de receber.',action:'Ver conquistas',icon:'/icons/influence-legacy.png',target:{kind:'achievements'}});
 if(firstUpgrade&&grow)add(grow);
 if(!state.orders.some(o=>o.kind==='research')){
  const research=(Object.keys(computed.researchCosts) as CozyResearch[]).find(key=>state.research[key]<5&&computed.researchCosts[key]<=state.resources.gold&&(computed.endsAt===null||now+getCozyResearchDurationMs(state,key,computed.dayMs)<=computed.endsAt));
  if(research)add({id:'research',title:'Escolha sua próxima pesquisa',detail:'Veja o bônus, o custo em ouro e a duração. A pesquisa ajuda o reino inteiro.',action:'Ver pesquisas',icon:'/icons/influence-government.png',target:{kind:'research',research}});
 }
 const local=state.cities.find(city=>computed.cityLife[city.id]?.decision?.options.some(option=>Object.entries(option.cost).every(([key,n])=>state.resources[key as keyof typeof state.resources]>=n)));
 if(local)add({id:'local',title:`Um encontro em ${local.name}`,detail:computed.cityLife[local.id].decision!.title,action:'Ver decisões da cidade',icon:'/buildings/habitacao.png',target:{kind:'city',cityId:local.id,entry:'decisions'}});
 if(!steps.length||explore){
  const next=[...state.orders].filter(order=>!orderQueued(order)).sort((a,b)=>a.arrivesAt-b.arrivesAt)[0];
  if(next)add({id:'waiting',title:explore?'Exploração em curso':'Seu reino está trabalhando',detail:explore?'A expedição já está a caminho. Ao chegar, o resultado aparece nos relatos. Você pode voltar depois.':`${orderMapLabel(next)} em andamento. Confira as ordens e seus horários de chegada.`,action:'Acompanhar ordens',icon:'/icons/status-time-v1.png',target:{kind:'orders'},readyAt:explore?.arrivesAt??next.arrivesAt,tone:'calm'});
 }
 if(!steps.length)add({id:'rest',title:'Seu reino está em dia',detail:'Não há uma ação prioritária agora. As reservas continuam sendo produzidas; você pode voltar depois.',action:'Ver ordens',icon:'/icons/status-time-v1.png',target:{kind:'orders'},tone:'calm'});
 return steps.slice(0,3);
}
