import type {CozyState} from './types';
export const ROYAL_PROFILES=[
 {id:'builder',name:'Construtor',image:'/images/king-aurelian.jpg',bonus:'+5% de produção',description:'Fortalece as oficinas e o abastecimento do reino.'},
 {id:'guardian',name:'Guardião',image:'/images/king-magnor.jpg',bonus:'+5% de defesa contra hordas',description:'Organiza a proteção da capital e das cidades.'},
 {id:'explorer',name:'Explorador',image:'/images/king-corven.jpg',bonus:'Viagens 5% mais rápidas',description:'Aproxima o reino das descobertas do mapa.'},
] as const;
export function activeRoyalProfile(state:CozyState){return state.king?.alive?ROYAL_PROFILES.find(p=>p.id===state.king?.profileId):undefined;}

/** Earlier reigns keep their original profile bonus. New reigns use the saved snapshot. */
export function royalBonus(state:CozyState, stat:'administration'|'command'|'exploration'):number {
 if (!state.king?.alive) return 0;
 const value=state.king.attributes?.[stat];
 if (typeof value==='number' && Number.isFinite(value)) return Math.max(0,Math.min(10,value))/100;
 const profile=activeRoyalProfile(state)?.id;
 return (stat==='administration'&&profile==='builder')||(stat==='command'&&profile==='guardian')||(stat==='exploration'&&profile==='explorer')?.05:0;
}
