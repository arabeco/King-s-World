import type {CozyPayload,CozySector} from './types';
import {getCityInfrastructure} from './catalog';
import {PROGRESSION,zeroInfluence} from './progression';

/** A present-state preview, without advancing time, spending or completing an order. */
export function cityUpgradePreview(data:CozyPayload,cityId:string,sector:CozySector){
 const {state,computed}=data,city=state.cities.find(c=>c.id===cityId),life=computed.cityLife[cityId];
 if(!city||!life||city.sectors[sector]>=10||state.defeat)return null;
 const nextCity={...city,sectors:{...city.sectors,[sector]:city.sectors[sector]+1}};
 const nextState={...state,cities:state.cities.map(c=>c.id===cityId?nextCity:c)};
 const wallLevels=(c:typeof city)=>c.sectors.defense*(c.integrity??100)/100*(!c.capital&&c.cityClass==='bastiao'?1.05:1);
 const walls=Math.floor(nextState.cities.reduce((sum,c)=>sum+wallLevels(c),0)*18*(1+state.research.fortification*.15));
 const army=computed.influenceDetails.military.capacity-computed.fortificationPower;
 const nextScore=state.progression?zeroInfluence(nextState,army,walls).total:
  computed.influence.total+
  Math.min(500,nextState.cities.reduce((n,c)=>n+getCityInfrastructure(c),0))-computed.influence.infrastructure+
  Math.min(500,Math.floor((army+walls)/6)+state.research.military*15)-computed.influence.military+
  Math.min(500,Math.round(state.satisfaction*2+nextState.cities.reduce((n,c)=>n+c.sectors.society,0)/nextState.cities.length*30))-computed.influence.society;
 const materialsBase=120+city.sectors.economy*85+city.sectors.administration*15;
 const metrics=sector==='administration'?[{key:'materials',label:'Materiais/dia',icon:'/icons/resource-materials.png',before:life.production.materials,after:life.production.materials*(materialsBase+15)/materialsBase}]:
 sector==='economy'?[
  {key:'materials',label:'Materiais/dia',icon:'/icons/resource-materials.png',before:life.production.materials,after:life.production.materials*(materialsBase+85)/materialsBase},
  {key:'supplies',label:'Suprimentos/dia',icon:'/icons/resource-supplies.png',before:life.production.supplies,after:life.production.supplies*(70+(city.sectors.economy+1)*50)/(70+city.sectors.economy*50)},
 ]:sector==='recruitment'?[{key:'capacity',label:'Vagas no exército',icon:'/icons/building-barracks.png',before:computed.armyCapacity,after:computed.armyCapacity+30}]:
 sector==='defense'?[{key:'walls',label:'Fortificações do reino',icon:'/icons/building-wall.png',before:computed.fortificationPower,after:walls}]:
 [{key:'trust',label:'Proteção contra perda de confiança',icon:'/icons/influence-society.png',before:Math.min(30,city.sectors.society*PROGRESSION.societyResistancePerLevel*100),after:Math.min(30,nextCity.sectors.society*PROGRESSION.societyResistancePerLevel*100),percent:true}];
 return {level:city.sectors[sector],nextLevel:nextCity.sectors[sector],influenceBefore:computed.influence.total,influenceAfter:nextScore,metrics};
}
