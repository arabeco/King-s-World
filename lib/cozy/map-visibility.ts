import type {CozyCoord, CozyShared, CozyState} from './types';
import {ALL_SANCTUARIES} from './landmarks';

const key = (c: CozyCoord) => `${c.q},${c.r}`;
const distance = (a: CozyCoord, b: CozyCoord) =>
  Math.max(Math.abs(a.q-b.q), Math.abs(a.r-b.r), Math.abs(a.q+a.r-b.q-b.r));

/** Landscape sight is not a survey, a claim, or permission to collect resources. */
export function visibleTerrainCells(state: CozyState): Set<string> {
  const visible = new Set<string>();
  const around = (center: CozyCoord, radius: number) => {
    for (let q=-radius;q<=radius;q++) for(let r=-radius;r<=radius;r++) {
      const cell={q:center.q+q,r:center.r+r};
      if (Math.abs(cell.q)<=40 && Math.abs(cell.r)<=40 && distance(center,cell)<=radius) visible.add(key(cell));
    }
  };
  for (const city of state.cities) around(city,4);
  for (const id of state.explored) {
    const [q,r]=id.split(',').map(Number);
    around({q,r},2);
  }
  for(const id of [...(state.knownTerritories??[]),...(state.scoutedCells??[])])visible.add(id);
  return visible;
}

/** Discovery belongs to the player, not to the camera or the world's public claims. */
export function knownMapCells(state: CozyState, shared: CozyShared): Set<string> {
  const known = new Set([...state.explored,...(state.knownTerritories??[]),...(state.scoutedCells??[])]);
  for (const city of state.cities) known.add(key(city));
  for (const [id, owner] of Object.entries(shared.territories ?? {})) {
    if (owner === state.playerId) known.add(id);
  }
  for (const [id, city] of Object.entries(shared.independentCities ?? {})) {
    if (city.formerOwnerId === state.playerId) known.add(id);
  }
  for (const tower of ALL_SANCTUARIES) {
    const discovered = tower.cells.some(cell => known.has(key(cell)));
    const nearby = state.cities.some(city => tower.cells.some(cell => distance(city, cell) <= 4));
    if (discovered || nearby) for (const cell of tower.cells) known.add(key(cell));
  }
  return known;
}
