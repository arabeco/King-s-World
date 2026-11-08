import type {CozyDecree,CozyDecreeEffects,CozyResources,CozyState} from './types';
import {realmCareCity} from './council-context';

type Option=CozyDecree['options'][number];
/** Realm choices use finite exchanges. Cost is paid for both successful and failed ventures. */
export function modernCouncilDecision(state:CozyState,decreeDay:number,day:number,nextWaveDay:number|null,counselorId:string,normalize:(materials:number,trust:number)=>CozyDecreeEffects,now:number):CozyDecree{
 const count=state.cities.length,care=realmCareCity(state);
 const caring=counselorId==='helena'||counselorId==='ines';
 const effects=(trust=0,extra:Partial<CozyDecreeEffects>={}):CozyDecreeEffects=>{
  const adjusted={...extra,...(extra.materials&&!caring?{materials:Math.round(extra.materials*1.05)}:{})};
  return {...normalize(adjusted.materials??0,trust>0&&caring?trust+1:trust),...adjusted};
 };
 const certain=(id:string,label:string,description:string,cost:Partial<CozyResources>,outcome:CozyDecreeEffects):Option=>({id,label,description,cost,effects:outcome,resolution:'certain'});
 const venture=(cost:Partial<CozyResources>,outcome:CozyDecreeEffects,failure:CozyDecreeEffects):Option=>({id:'risk',label:'Enviar uma caravana distante',description:'A expedição consome a reserva mesmo se não retornar.',cost,effects:outcome,failure,resolution:'chance',successPercent:70});
 let key:string,title:string,body:string,options:Option[];
 if(care&&(care.life?.contentment??state.satisfaction)<35){
  key='unrest';title='A confiança está por um fio';body=`${care.name} espera uma resposta da Coroa.`;
  options=[
   certain('care','Receber os representantes','Uma resposta lenta, sem retirar recursos da reserva.',{},effects(3)),
   certain('invest','Abrir as despensas do reino','Uma ajuda maior alcança todas as cidades.',{supplies:100+count*25},effects(9)),
  ];
 }else if(care&&(care.integrity??100)<100){
  const repairCost=Math.max(15,Math.round(state.cities.reduce((sum,city)=>sum+Math.min(20,100-(city.integrity??100)),0)*4.5));
  key='rebuilding';title='Pedreiros a serviço da Coroa';body=`As estruturas de ${care.name} precisam de recuperação.`;
  options=[
   certain('care','Amparar os desabrigados','Recupera a confiança nas cidades; as obras continuam sob sua responsabilidade.',{supplies:100},effects(6)),
   certain('invest','Financiar reparos pelo reino','Repara parte da integridade de todas as cidades. Níveis destruídos precisam ser reconstruídos.',{materials:repairCost},effects(0,{integrityRestore:20})),
  ];
 }else if(nextWaveDay!==null&&nextWaveDay-day<=3){
  key='horde';title='Uma horda se aproxima';body=`O Conselho prepara o reino para a horda do dia ${nextWaveDay}.`;
  options=[
   certain('care','Garantir as provisões do povo','Mantém a confiança enquanto você prepara a defesa no Militar.',{supplies:100+count*20},effects(8)),
   certain('invest','Comprar materiais para a defesa','Troca ouro por materiais. Não recruta tropas automaticamente.',{gold:65},effects(0,{materials:300})),
  ];
 }else{
  const rotation=Math.floor((decreeDay-1)/3)%3;
  if(rotation===0){
   key='harvest';title='O destino dos excedentes';body='Mercadores e moradores apresentam propostas para as reservas do reino.';
   options=[
    certain('care','Abastecer as praças','Troca mantimentos por confiança e trabalho nas oficinas.',{supplies:120},effects(5,{materials:80})),
    certain('invest','Vender materiais do reino','Converte uma parte dos materiais em ouro.',{materials:300},effects(0,{gold:60})),
   ];
  }else if(rotation===1){
   key='trade';title='Uma audiência com os mercadores';body='Há propostas para financiar pesquisa ou reforçar as reservas.';
   options=[
    certain('care','Vender provisões excedentes','Converte mantimentos em ouro, sem retirar materiais das construções.',{supplies:300},effects(0,{gold:35})),
    certain('invest','Encomendar materiais','Troca ouro por materiais para obras e recrutamento.',{gold:80},effects(0,{materials:340})),
    venture({supplies:200,gold:25},effects(0,{gold:95}),effects(-4)),
   ];
  }else{
   key='craft';title='As oficinas pedem uma direção';body='O reino pode investir em produção ou atender às necessidades imediatas.';
   const eligible=state.cities.filter(city=>!city.life?.productionEffect||city.life.productionEffect.endsAt<=now||city.life.productionEffect.bonus<5);
   const investment=Math.max(30,Math.round(eligible.reduce((sum,city)=>sum+120+city.sectors.economy*85+city.sectors.administration*15,0)*.06));
   options=[
    ...(eligible.length?[certain('care','Organizar o trabalho nas cidades','Aumenta a eficiência-base da produção em 5% por dois dias de jogo.',{materials:investment},effects(0,{productionBonus:5}))]:[certain('care','Cuidar dos bairros','Atende às famílias enquanto as oficinas já trabalham com bônus.',{supplies:100},effects(5))]),
    certain('invest','Comprar mantimentos','Reforça o estoque de suprimentos, sem afetar a satisfação.',{gold:35},effects(0,{supplies:200})),
   ];
  }
 }
 return {id:`${decreeDay}:${counselorId}:${key}`,day:decreeDay,counselorId,title,body,options};
}
