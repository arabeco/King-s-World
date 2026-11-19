import type {CozyState, CozyWorld} from './types';

// Real-time windows prevent the accelerated clock from flooding a casual player.
export const MISSION_WINDOW_MS = 24 * 60 * 60 * 1000;
const stories = [
  {title:'A estrada da caravana',enemy:'Salteadores',description:'Uma caravana pede companhia para atravessar a estrada.',reward:{gold:25,materials:80,supplies:0}},
  {title:'Guardas da fronteira',enemy:'Mercenários',description:'Viajantes avistaram mercenários junto à passagem.',reward:{gold:20,materials:50,supplies:40}},
  {title:'A aldeia na colina',enemy:'Saqueadores',description:'Uma aldeia vizinha pede ajuda para proteger suas oficinas.',reward:{gold:15,materials:100,supplies:0}},
  {title:'A ponte do moinho',enemy:'Bandidos',description:'Comerciantes pedem uma escolta para reabrir a travessia.',reward:{gold:30,materials:60,supplies:0}},
  {title:'O pomar do vale',enemy:'Saqueadores',description:'Os moradores querem recuperar a colheita levada na estrada.',reward:{gold:10,materials:55,supplies:50}},
  {title:'O caminho das pedras',enemy:'Mercenários',description:'Pedreiros procuram proteção para levar materiais ao reino.',reward:{gold:10,materials:110,supplies:0}},
  {title:'A feira distante',enemy:'Salteadores',description:'Artesãos querem viajar em segurança até a próxima feira.',reward:{gold:30,materials:45,supplies:15}},
  {title:'O celeiro do bosque',enemy:'Bandidos',description:'Uma pequena comunidade pede ajuda para proteger as provisões.',reward:{gold:15,materials:50,supplies:45}},
  {title:'A patrulha da serra',enemy:'Mercenários',description:'Uma patrulha pede reforços para tornar a passagem mais segura.',reward:{gold:20,materials:75,supplies:15}},
] as const;

function playerOffset(id:string){let value=0;for(const char of id)value=(Math.imul(value,31)+char.charCodeAt(0))>>>0;return value%stories.length;}

export function miniMissionOffer(state:CozyState, world:CozyWorld, now:number) {
  if (!world.persistent || world.status !== 'running' || world.startsAt === null ||
      state.founding || state.defeat || state.ascension || !state.cities.length) return null;
  const origin = Math.max(state.createdAt,world.startsAt);
  if(now < origin) return null;
  const cycle = Math.floor((now-origin)/MISSION_WINDOW_MS);
  if (state.lastMiniMissionCycle === cycle) return null;
  const story = stories[(cycle+playerOffset(`${world.id}:${state.playerId}`)) % stories.length];
  const development = state.cities.reduce((sum,city)=>sum+Object.values(city.sectors).reduce((a,b)=>a+b,0),0);
  return {id:`mission:${cycle}`,cycle,...story,enemyPower:60+Math.min(900,Math.floor(development*3)),
    suppliesCost:30,expiresAt:origin+(cycle+1)*MISSION_WINDOW_MS};
}
