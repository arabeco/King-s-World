import {citySocialStatus,SOCIAL_RUPTURE_DAYS} from "./city-crisis";
import type {CozyCity,CozyResources} from './types';
export type CityChoice={id:string;label:string;cost:Partial<CozyResources>;contentment:number;productionBonus:number;integrityRestore?:number;materialsReward?:number};
export type CityLifeView={contentment:number;status:string;unrestDays:number;daysToRupture:number|null;integrity:number;efficiency:number;production:{materials:number;supplies:number};effectEndsAt:number|null;decision:{id:string;title:string;sector:'society'|'economy';options:CityChoice[]}|null};
export function cityEfficiency(city:CozyCity,at:number){return (100+(city.life?.productionEffect&&city.life.productionEffect.endsAt>at?city.life.productionEffect.bonus:0))*(city.integrity??100)/100;}
export function cityDecision(city:CozyCity,day:number):CityLifeView['decision']{
 if(day<1||city.life?.lastDecisionDay===day)return null;
 if((city.life?.contentment??70)<35)return {id:`${city.id}:${day}:crisis`,title:'A cidade exige uma resposta',sector:'society',options:[
 {id:'relief',label:'Enviar provisões e acolher as reivindicações',cost:{supplies:120},contentment:12,productionBonus:0},
 {id:'listen',label:'Ouvir os moradores e negociar uma resposta',cost:{},contentment:5,productionBonus:0},
 ]};
 if((city.integrity??100)<100)return {id:`${city.id}:${day}:repairs`,title:'Recuperar as estruturas',sector:'economy',options:[
 {id:'repair',label:'Contratar reparos com materiais',cost:{materials:120},contentment:0,productionBonus:0,integrityRestore:40},
 {id:'volunteers',label:'Organizar reparos com a equipe local',cost:{},contentment:0,productionBonus:0,integrityRestore:20},
 ]};
 if(day%3===0)return {id:`${city.id}:${day}:levy`,title:'Recursos ou confiança?',sector:'society',options:[
 {id:'support',label:'Ajudar as famílias com provisões',cost:{supplies:60},contentment:6,productionBonus:0},
 {id:'levy',label:'Cobrar uma contribuição extraordinária',cost:{},contentment:-8,productionBonus:0,materialsReward:120},
 ]};
 return day%2?{id:`${city.id}:${day}:society`,title:'Um encontro na praça',sector:'society',options:[
  {id:'meal',label:'Preparar uma refeição comunitária',cost:{supplies:60},contentment:6,productionBonus:0},
  {id:'square',label:'Melhorar o espaço de convivência',cost:{materials:80},contentment:4,productionBonus:0},
 ]}:{id:`${city.id}:${day}:economy`,title:'Cuidar das oficinas',sector:'economy',options:[
  {id:'maintenance',label:'Revisar ferramentas e equipamentos',cost:{materials:80},contentment:0,productionBonus:5},
  {id:'team',label:'Organizar e abastecer a equipe',cost:{supplies:60},contentment:0,productionBonus:3},
 ]};
}
