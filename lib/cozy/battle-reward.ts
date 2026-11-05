import type {CozyResources,CozyState} from './types';
/** A bounded transfer of existing resources, never generated currency or influence. */
export function takeBattleLoot(loser:CozyState):Partial<CozyResources>{
 const loot={gold:Math.min(30,Math.floor(Math.max(0,loser.resources.gold)*.04)),materials:Math.min(120,Math.floor(Math.max(0,loser.resources.materials)*.04))};
 loser.resources.gold-=loot.gold;loser.resources.materials-=loot.materials;return loot;
}
