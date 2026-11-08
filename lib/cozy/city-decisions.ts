import type {CozyCity,CozyResources} from './types';
import type {CityChoice,CityLifeView} from './city-life';
export type CityDecisionContext={resources:CozyResources;now:number;hordeSoon:boolean};

/** City-scale situations. No random draw while displaying a card, no direct influence grants. */
export function modernCityDecision(city:CozyCity,day:number,context:CityDecisionContext):CityLifeView['decision']{
 const trust=city.life?.contentment??70,integrity=city.integrity??100;
 const choice=(id:string,label:string,cost:Partial<CozyResources>,effects:Partial<CityChoice>={}):CityChoice=>({id,label,cost,contentment:0,productionBonus:0,...effects});
 const card=(key:string,title:string,sector:'society'|'economy',options:CityChoice[])=>({id:`${city.id}:${day}:${key}`,title,sector,options});
 if(trust<35)return card('crisis','A praça pede ajuda','society',[
  choice('relief','Abrir a despensa',{supplies:100},{contentment:12}),
  choice('listen','Negociar com os moradores',{},{contentment:4}),
 ]);
 if(integrity<100){
  const missing=100-integrity;
  return card('repairs','Depois dos estragos','economy',[
   ...(missing>8?[choice('repair','Contratar pedreiros',{materials:Math.ceil(90*Math.min(35,missing)/35)},{integrityRestore:Math.min(35,missing)})]:[]),
   choice('volunteers','Organizar um mutirão',{supplies:Math.ceil(35*Math.min(20,missing)/20)},{integrityRestore:Math.min(20,missing),contentment:2}),
   choice('salvage','Recuperar o que restou',{},{integrityRestore:Math.min(8,missing)}),
  ]);
 }
 if(trust<60)return card('families','A cidade está inquieta','society',[
  choice('support','Distribuir provisões',{supplies:60},{contentment:8}),
  choice('work','Pagar pequenos serviços',{gold:15},{contentment:6}),
  choice('listen','Receber os representantes',{},{contentment:2}),
 ]);
 if(context.hordeSoon)return card('watch','Os vigias precisam de apoio','economy',[
  choice('supplies','Trocar excedentes por mantimentos',{materials:80},{rewards:{supplies:60}}),
  choice('tools','Reunir materiais para a defesa',{supplies:90},{rewards:{materials:50}}),
 ]);
 // Rotation includes city identity so all cities do not offer the same card on a given day.
 const offset=[...city.id].reduce((sum,c)=>sum+c.charCodeAt(0),0);
 const cycle=(day+offset)%5;
 if(cycle===0||context.resources.gold<20)return card('market','A feira chegou','economy',[
  choice('sell-stone','Vender parte dos materiais',{materials:100},{rewards:{gold:16}}),
  choice('sell-grain','Vender provisões excedentes',{supplies:100},{rewards:{gold:10}}),
 ]);
 if(cycle===1)return card('barter','Uma carroça de mercadores','economy',[
  choice('buy-tools','Comprar materiais',{gold:20},{rewards:{materials:80}}),
  choice('buy-food','Comprar mantimentos',{gold:15},{rewards:{supplies:90}}),
  choice('trade','Trocar mantimentos por materiais',{supplies:90},{rewards:{materials:50}}),
 ]);
 if(cycle===2&&!(city.life?.productionEffect&&city.life.productionEffect.endsAt>context.now)){
  const investment=Math.max(20,Math.round((120+city.sectors.economy*85+city.sectors.administration*15)*.12));
  return card('workshops','Um pedido das oficinas','economy',[
   choice('maintenance','Renovar ferramentas',{materials:investment},{productionBonus:8}),
   choice('team','Abastecer os artesãos',{supplies:60},{productionBonus:5}),
  ]);
 }
 if(cycle===3)return card('caravan','Uma rota pouco conhecida','economy',[
  choice('escort','Fazer uma entrega curta',{supplies:60},{rewards:{gold:6}}),
  choice('venture','Arriscar a rota longa',{supplies:60},{rewards:{gold:20},chance:{successPercent:65,failure:{contentment:-3,productionBonus:0}}}),
 ]);
 return card('square','O destino da colheita','society',[
  choice('meal','Preparar uma refeição comunitária',{supplies:50},{contentment:5}),
  choice('sale','Vender a colheita',{supplies:80},{rewards:{gold:8}}),
  choice('levy','Cobrar uma contribuição',{},{contentment:-6,materialsReward:70}),
 ]);
}
