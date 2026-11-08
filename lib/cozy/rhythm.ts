import type {CozyWorld} from './types';
export const economicExpress=(world:CozyWorld)=>world.mode==='express'&&world.economyVersion===2;
export const clockSpeed=(world:CozyWorld)=>world.mode!=='express'||economicExpress(world)?1:world.economyVersion===3?4:world.speedMultiplier===2?2:4;
export const seasonDays=(world:CozyWorld)=>economicExpress(world)?30:120;
export const waveDays=(world:CozyWorld)=>economicExpress(world)?[5,10,15,20,25,28]:[20,40,60,80,98,110];
