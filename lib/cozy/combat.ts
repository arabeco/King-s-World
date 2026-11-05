/** Shared deterministic confrontation rules. Influence wagers are not enabled here. */
export function combatAssessment(attackPower:number,defensePower:number){
  return {
    attackRequired:defensePower,
    occupationRequired:Math.ceil(defensePower*1.25),
    attackWins:attackPower>=defensePower,
    occupationMargin:attackPower>=Math.ceil(defensePower*1.25),
  };
}
