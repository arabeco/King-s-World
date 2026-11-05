import {resolvePlayerAttacks} from './player-combat';
import {nextSanctuaryRaidAt,resolveSanctuaryRaids} from './sanctuary-raids';
import {nextCityDayAt,getCozyComputed,settleCozyState} from './engine';
import type {CozyState,CozyShared,CozyWorld} from './types';
/** Settle shared events in arrival order across every player, not request order. */
export function settleWorld(
  players: {playerId:string;state:CozyState;influence:number}[],
  initialShared: CozyShared,
  world: CozyWorld,
  now: number,
): CozyShared {
  let shared = initialShared;
  const sorted = [...players].sort((a, b) =>
    a.playerId.localeCompare(b.playerId),
  );
  if (world.status === "running") {
    // Orders are bounded by the engine; six horde waves add six boundaries.
    // A single boundary settles all participants at precisely the same instant.
    const limit=Math.max(2048,sorted.reduce((sum,p)=>sum+2*p.state.orders.length,0)+512+(shared.sanctuaryPacts??[]).reduce((sum,p)=>sum+(p.raids?.waves.length??0),0));
    let exhausted=true;
    for (let iteration = 0; iteration < limit; iteration += 1) {
      let boundary = nextSanctuaryRaidAt(shared,now);
      for (const player of sorted) {
        for (const order of player.state.orders) {
          if (
            order.arrivesAt > player.state.settledAt &&
            order.arrivesAt <= now
          )
            boundary = Math.min(boundary, order.arrivesAt);
        }
        const social=nextCityDayAt(player.state,world);
        if(social!==null&&social>player.state.settledAt&&social<=now)boundary=Math.min(boundary,social);
        const next = getCozyComputed(
          player.state,
          shared,
          world,
          player.state.settledAt,
        ).nextHorde;
        if (
          next &&
          next.arrivesAt > player.state.settledAt &&
          next.arrivesAt <= now
        )
          boundary = Math.min(boundary, next.arrivesAt);
      }
      if (!Number.isFinite(boundary)){exhausted=false;break;}
      // Tower pledges are fixed: resolve them globally before any realm uses its bonuses.
      resolveSanctuaryRaids(shared,boundary);
      // Complete shared guardian encounters before any realm resolves a horde at the same instant.
      if(sorted.some(p=>p.state.orders.some(o=>o.sanctuaryPactId&&o.arrivesAt===boundary))){
        for(const player of sorted){
          if(player.state.settledAt>boundary)continue;
          const next=settleCozyState(player.state,shared,world,boundary,{deferWorldEventsAt:boundary});
          player.state=next.state;shared=next.shared;
        }
      }
      for (const player of sorted) {
        if (player.state.settledAt > boundary) continue;
        const next = settleCozyState(player.state, shared, world, boundary);
        player.state = next.state;
        shared = next.shared;
      }
      shared=resolvePlayerAttacks(sorted,shared,world,boundary);
      // Support evidence becomes shared after the recipient resolves the horde.
      // Flush it at this same boundary, independently of player iteration order.
      for(const player of sorted){
        if(!player.state.progression||player.state.settledAt>boundary)continue;
        const next=settleCozyState(player.state,shared,world,boundary);player.state=next.state;shared=next.shared;
      }
    }
    if(exhausted)throw new Error('COZY_SETTLEMENT_BOUNDARY_LIMIT');
  }
  for (const player of sorted) {
    const next = settleCozyState(player.state, shared, world, now);
    player.state = next.state;
    shared = next.shared;
    player.influence = getCozyComputed(
      player.state,
      shared,
      world,
      now,
    ).influence.total;
  }
  return shared;
}

