/** Existing world waves; shared by realm attacks, guardian quotes and tower threats. */
export const WAVE_DAYS = [20, 40, 60, 80, 98, 110];
export const WAVE_POWER = [80, 180, 400, 800, 1400, 2400];
export function hordeSchedule(startsAt:number,dayMs:number){
 return WAVE_DAYS.map((day,index)=>({day,arrivesAt:startsAt+(day-1)*dayMs,power:WAVE_POWER[index]}));
}
