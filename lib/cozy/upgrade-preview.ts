import type {CozyPayload,CozySector} from './types';
import {getCityInfrastructure} from './catalog';
import {PROGRESSION,zeroInfluence} from './progression';

/** A present-state preview, without advancing time, spending or completing an order. */
export function cityUpgradePreview(data:CozyPayload,cityId:string,sector:CozySector,projectedLevel?:number){
 const {state,computed}=data,original=state.cities.find(c=>c.id===cityId),life=computed.cityLife[cityId];
 if(!original||!life||state.defeat)return null;
 const level=projectedLevel??original.sectors[sector];
 if(level>=10)return null;
 const city={...original,sectors:{...original.sectors,[sector]:level}};
 const nextCity={...city,sectors:{...city.sectors,[sector]:city.sectors[sector]+1}};
 const nextState={...state,cities:state.cities.map(c=>c.id===cityId?nextCity:c)};
 const wallLevels=(c:typeof city)=>c.sectors.defense*(c.integrity??100)/100*(!c.capital&&c.cityClass==='bastiao'?1.05:1);
 const wallFactor=18*(1+state.research.fortification*.15);
 const walls=Math.floor(nextState.cities.reduce((sum,c)=>sum+wallLevels(c),0)*wallFactor);
 const priorWalls=Math.floor(nextState.cities.reduce((sum,c)=>sum+wallLevels(c.id===cityId?city:c),0)*wallFactor);
 const army=computed.influenceDetails.military.capacity-computed.fortificationPower;
 const influenceAt = (projected: typeof state, defenses: number) => state.progression
  ? zeroInfluence(projected, army, defenses).total
  : computed.influence.government + computed.influence.legacy
    + Math.min(500, projected.cities.reduce((sum, entry) => sum + getCityInfrastructure(entry), 0))
    + Math.min(500, Math.floor((army + defenses) / 6) + state.research.military * 15)
    + Math.min(500, Math.round(state.satisfaction * 2 +
      projected.cities.reduce((sum, entry) => sum + entry.sectors.society, 0) / projected.cities.length * 30));
 const nextScore = influenceAt(nextState, walls);
 const materialsBase=120+city.sectors.economy*85+city.sectors.administration*15;
 const materialsRate=life.production.materials/(120+original.sectors.economy*85+original.sectors.administration*15);
 const suppliesRate=life.production.supplies/(70+original.sectors.economy*50);
 const suppliesBase=70+city.sectors.economy*50;
 const capacity=computed.armyCapacity+(city.sectors.recruitment-original.sectors.recruitment)*30;
 const priorState={...state,cities:state.cities.map(c=>c.id===cityId?city:c)};
 const previousScore = level === original.sectors[sector] ? computed.influence.total : influenceAt(priorState, priorWalls);
 const metrics=sector==='administration'?[{key:'materials',label:'Materiais/dia',icon:'/icons/resource-materials.png',before:materialsRate*materialsBase,after:materialsRate*(materialsBase+15)}]:
 sector==='economy'?[
  {key:'materials',label:'Materiais/dia',icon:'/icons/resource-materials.png',before:materialsRate*materialsBase,after:materialsRate*(materialsBase+85)},
  {key:'supplies',label:'Suprimentos/dia',icon:'/icons/resource-supplies.png',before:suppliesRate*suppliesBase,after:suppliesRate*(suppliesBase+50)},
 ]:sector==='recruitment'?[{key:'capacity',label:'Vagas no exército',icon:'/icons/building-barracks.png',before:capacity,after:capacity+30}]:
 sector==='defense'?[{key:'walls',label:'Fortificações do reino',icon:'/icons/building-wall.png',before:priorWalls,after:walls}]:
 [{key:'trust',label:'Proteção contra perda de confiança',icon:'/icons/influence-society.png',before:Math.min(30,city.sectors.society*PROGRESSION.societyResistancePerLevel*100),after:Math.min(30,nextCity.sectors.society*PROGRESSION.societyResistancePerLevel*100),percent:true}];
 return {level:city.sectors[sector],nextLevel:nextCity.sectors[sector],influenceBefore:previousScore,influenceAfter:nextScore,metrics};
}
