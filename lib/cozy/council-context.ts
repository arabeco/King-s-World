import type {CozyState} from './types';

const trust=(state:CozyState,city:CozyState['cities'][number])=>city.life?.contentment??state.satisfaction;

/** Presentation priority only. Does not mutate cities, grant effects or advance a clock. */
export function realmCareCity(state:CozyState){
 const critical=state.cities.filter(city=>trust(state,city)<35).sort((a,b)=>
  (b.life?.unrestDays??0)-(a.life?.unrestDays??0)||trust(state,a)-trust(state,b)||a.id.localeCompare(b.id));
 if(critical.length)return critical[0];
 return state.cities.filter(city=>(city.integrity??100)<100).sort((a,b)=>
  (a.integrity??100)-(b.integrity??100)||a.id.localeCompare(b.id))[0];
}

const regularTopics=[
 {title:'As portas da cidade',body:'Famílias das fronteiras pedem acolhimento. As oficinas também precisam de mãos para preparar o reino.'},
 {title:'O trabalho de amanhã',body:'Os artesãos propõem um mutirão. Há quem queira descanso e quem prefira investir nas reservas do reino.'},
 {title:'Uma promessa à praça',body:'O povo aguarda uma decisão sobre a próxima obra. Seu conselho pede uma assinatura que dê direção à cidade.'},
];
type Topic={title:string;body:string;careLabel?:string;investLabel?:string;careDescription?:string;investDescription?:string};

/** Context changes the subject, never the two canonical effects, IDs or decree cadence. */
export function councilTopic(state:CozyState,decreeDay:number,day:number,nextWaveDay:number|null):Topic{
 const regular=regularTopics[Math.floor((decreeDay-1)/3)%regularTopics.length];
 // Historical seasons keep their original presentation as well as their progression model.
 if(!state.progression)return regular;
 const city=realmCareCity(state);
 if(city&&trust(state,city)<35)return {
  title:'As cidades pedem uma resposta',body:`${city.name} vive uma crise de confiança. O Conselho precisa definir a prioridade do reino.`,
  careLabel:'Priorizar a confiança das cidades',investLabel:'Priorizar os materiais do reino',
  careDescription:'Amparar os moradores com os efeitos de confiança mostrados abaixo.',
  investDescription:'Reunir materiais, considerando o efeito mostrado na confiança.',
 };
 if(city)return {
  title:'Reerguer as estruturas',body:`${city.name} precisa de reparos. A decisão prepara o reino; a recuperação é feita dentro da cidade.`,
  careLabel:'Amparar os moradores',investLabel:'Reunir materiais para reparos',
  careDescription:'Cuidar da confiança enquanto a cidade se recupera.',
  investDescription:'Receber materiais para usar nas decisões de reparo da cidade.',
 };
 // Use the existing three-day decree interval as the narrative preparation window.
 if(nextWaveDay!==null&&nextWaveDay>=day&&nextWaveDay-day<=3)return {
  title:'Os vigias avistaram a horda',body:`A horda do dia ${nextWaveDay} se aproxima. Seu decreto não substitui a preparação no Militar.`,
  careLabel:'Preparar o povo para a ameaça',investLabel:'Reunir materiais para a defesa',
  careDescription:'Sustentar a confiança das cidades antes do confronto.',
  investDescription:'Receber materiais para preparar tropas e fortificações.',
 };
 return regular;
}
