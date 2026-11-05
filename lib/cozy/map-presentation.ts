import type { CozyCoord, CozyTile } from './types';

export const MAP_STEP = 48;
// Foreshorten only the ground. Buildings, labels and tap targets stay upright.
export const MAP_GROUND_Y = 0.72;
const rowHeight = MAP_STEP * Math.sqrt(3) / 2 * MAP_GROUND_Y;

export function mapPoint({q, r}: CozyCoord) {
  return {x: MAP_STEP * (q + r / 2), y: rowHeight * r};
}

export function mapCoord({x, y}: {x:number; y:number}) {
  const r = y / rowHeight;
  return {q: x / MAP_STEP - r / 2, r};
}

const directions = [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];
const corners = directions.map((_, index) => {
  const angle = (index * 60 - 30) * Math.PI / 180;
  const radius = MAP_STEP / Math.sqrt(3);
  return {x: radius * Math.cos(angle), y: radius * Math.sin(angle) * MAP_GROUND_Y};
});

function vertices(cell: CozyCoord) {
  const center = mapPoint(cell);
  return corners.map(corner => `${center.x + corner.x},${center.y + corner.y}`);
}

export function cellPath(cell: CozyCoord) {
  return 'M' + vertices(cell).join(' L') + ' Z';
}

/** Only exposed cell ownership is outlined: no invented claims around capitals. */
export function borderPath(tiles: CozyCoord[]) {
  const ids = new Set(tiles.map(cell => `${cell.q},${cell.r}`));
  return tiles.flatMap(cell => {
    const points = vertices(cell);
    return directions.flatMap(([dq,dr], i) => ids.has(`${cell.q+dq},${cell.r+dr}`)
      ? [] : [`M${points[i]} L${points[(i+1)%6]}`]);
  }).join(' ');
}
export type ResourceRegion={id:string;kind:string;cells:CozyTile[];footprint?:CozyCoord[]};
/** Prefer authoritative area identity; keep a visual fallback for undiscovered legacy points. */
export function resourceRegions(tiles:CozyTile[]) {
 const resources=tiles.filter(t=>t.revealed&&!t.ownerId&&(['gold','materials'].includes(t.kind))&&(!t.deposit||t.deposit.remaining>0));
 const canonical=resources.filter(t=>t.area),legacy=resources.filter(t=>!t.area);
 const registered=new Map<string,ResourceRegion>();
 for(const t of canonical){const id=t.area!.id;const area=registered.get(id)??{id,kind:t.kind,cells:[],footprint:t.area!.cells.map(id=>{const [q,r]=id.split(',').map(Number);return {q:q||0,r:r||0};})};area.cells.push(t);registered.set(id,area);}
 const remaining=new Set(legacy),regions:ResourceRegion[]=[...registered.values()];
 while(remaining.size){const first=remaining.values().next().value!;remaining.delete(first);const cells=[first];
  for(let i=0;i<cells.length;i++)for(const other of remaining){const c=cells[i];if(other.kind===first.kind&&Math.max(Math.abs(c.q-other.q),Math.abs(c.r-other.r),Math.abs(c.q+c.r-other.q-other.r))<=3){remaining.delete(other);cells.push(other);}}
  regions.push({id:first.id,kind:first.kind,cells});
 }
 return regions;
}

/** Cube rounding keeps taps inside the same hexagon along diagonal edges. */
export function roundMapCoord(c: CozyCoord): CozyCoord {
 let q=Math.round(c.q),r=Math.round(c.r),s=Math.round(-c.q-c.r);
 const dq=Math.abs(q-c.q),dr=Math.abs(r-c.r),ds=Math.abs(s+c.q+c.r);
 if(dq>dr&&dq>ds)q=-r-s;
 else if(dr>ds)r=-q-s;
 return {q:q||0,r:r||0};
}
