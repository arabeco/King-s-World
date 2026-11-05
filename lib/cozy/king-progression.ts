/** Initial numeric calibration; all kings share this curve and budget. */
export const KING_PROGRESSION={levelXp:25,maxLevel:10,influencePerXp:5,normalWeight:4,expressWeight:1,rankingMaxFraction:.10,rankingMinimumPlayers:5,rankingWarmupFraction:.20} as const;
export function kingLevelFromXp(xp:number){return Math.min(KING_PROGRESSION.maxLevel,1+Math.floor(Math.sqrt(Math.max(0,xp)/KING_PROGRESSION.levelXp)));}
/** Candidate for live ranking only. Season-close rank XP uses seasonRankXp below. */
export function rankXpCandidate(progressXp:number,percentile:number,players:number,day:number,days:number){if(players<KING_PROGRESSION.rankingMinimumPlayers||day<Math.ceil(days*KING_PROGRESSION.rankingWarmupFraction)||!Number.isFinite(percentile))return 0;const weight=percentile<=.25?1:percentile<=.5?.5:0;return Math.floor(Math.max(0,progressXp)*KING_PROGRESSION.rankingMaxFraction*weight);}

/** Migration 73: final standing supplements XP actually earned by each king in this world. */
export function seasonRankXp(progressXp:number,place:number,participants:number){
 if(!Number.isFinite(progressXp)||progressXp<=0||!Number.isInteger(place)||!Number.isInteger(participants)||participants<5||place<1||place>participants)return 0;
 const fraction=place/participants,percent=fraction<=.25?10:fraction<=.50?5:0;
 return Math.floor(progressXp*percent/100);
}
