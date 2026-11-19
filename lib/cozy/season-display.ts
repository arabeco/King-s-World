/** Display the real season duration while retaining the engine's independent game-day clock. */
export function seasonDisplay(day:number,durationDays:number,realDurationDays:number,persistent=false){
 const duration=Math.max(1,Math.round(realDurationDays));
 const scale=Math.max(1,durationDays/duration);
 const realDay = day <= 0 ? 0 : Math.max(1, Math.ceil(day / scale));
 return {day:persistent ? realDay : Math.min(duration, realDay),duration};
}
