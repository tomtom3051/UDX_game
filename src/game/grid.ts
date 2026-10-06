import { CELL, type MapDef, type Obstacle } from '../config';

export const GRASS = 0;
export const MOWED = 1;
export const BLOCKED = 2;

export interface Grid {
  cols: number;
  rows: number;
  cells: Uint8Array;
  /** Number of cells that can be mowed (not under an obstacle). */
  mowable: number;
  mowed: number;
}

export function pointInObstacle(o: Obstacle, x: number, y: number): boolean {
  if (o.type === 'tree') {
    const dx = x - o.x;
    const dy = y - o.y;
    return dx * dx + dy * dy <= o.r * o.r;
  }
  return x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h;
}

export function circleHitsObstacle(o: Obstacle, x: number, y: number, r: number): boolean {
  if (o.type === 'tree') {
    const dx = x - o.x;
    const dy = y - o.y;
    const rr = o.r + r;
    return dx * dx + dy * dy < rr * rr;
  }
  const nx = Math.max(o.x, Math.min(x, o.x + o.w));
  const ny = Math.max(o.y, Math.min(y, o.y + o.h));
  const dx = x - nx;
  const dy = y - ny;
  return dx * dx + dy * dy < r * r;
}

/** Builds the mowing grid. Cells whose centre lies under any obstacle do not count. */
export function buildGrid(map: MapDef): Grid {
  const cols = Math.floor(map.width / CELL);
  const rows = Math.floor(map.height / CELL);
  const cells = new Uint8Array(cols * rows);
  let mowable = 0;
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const px = cx * CELL + CELL / 2;
      const py = cy * CELL + CELL / 2;
      const blocked = map.obstacles.some((o) => pointInObstacle(o, px, py));
      cells[cy * cols + cx] = blocked ? BLOCKED : GRASS;
      if (!blocked) mowable++;
    }
  }
  return { cols, rows, cells, mowable, mowed: 0 };
}

export function coveragePercent(grid: Grid): number {
  return grid.mowable === 0 ? 0 : (grid.mowed / grid.mowable) * 100;
}
