/** Display the real season duration while retaining the engine's independent game-day clock. */
export function seasonDisplay(day:number,durationDays:number,realDurationDays:number){
 const duration=Math.max(1,Math.round(realDurationDays));
 const scale=Math.max(1,durationDays/duration);
 return {day:day<=0?0:Math.min(duration,Math.max(1,Math.ceil(day/scale))),duration};
}
