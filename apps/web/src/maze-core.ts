// core_run — pure maze generation + difficulty normalisation (mega-batch 2 · 4.5).
//
// Recursive-backtracker perfect maze on an N×N grid of rooms, lightly braided
// (a few dead ends removed to add loops), with the goal at the exact center and
// the entrance on the perimeter. Difficulty is normalised: after generating, we
// BFS the shortest entrance→center path and only accept mazes whose length
// falls in a fixed band, so no run is a trivial straight shot or an unfair
// marathon. Deterministic given a seed (seeded PRNG) so it's unit-testable.
//
// React-free; the three.js arena is built from a MazeGrid by maze-scene.ts.

export type Dir = 0 | 1 | 2 | 3; // N, E, S, W

export interface Cell {
  /** Wall present on each edge: [N, E, S, W]. */
  walls: [boolean, boolean, boolean, boolean];
}

export interface MazeGrid {
  size: number; // odd N; center is a valid room
  cells: Cell[][]; // [y][x]
  entrance: { x: number; y: number };
  center: { x: number; y: number };
  /** BFS shortest-path length (edges traversed) entrance → center. */
  pathLength: number;
  /** Whether pathLength landed inside the difficulty band. */
  inBand: boolean;
}

export const MAZE_SIZE = 21;
// Difficulty band for the entrance→center shortest path (edges between rooms),
// for a 21×21 room grid. STOP-AND-ASK default — tunable. Chosen from the
// measured distribution so a comfortable majority of raw recursive-backtracker
// mazes land in band (the bounded retry then accepts ~100 % of seeds) while the
// trivial-short and marathon tails are rejected. NOTE: the launch brief's
// suggested [55,85] assumed a wall-inclusive-cell metric; this metric counts
// room-to-room edges, so the equivalent band is lower. See devlog 0118 +
// decisions log.
export const BAND_MIN = 30;
export const BAND_MAX = 70;
export const MAX_ATTEMPTS = 24;
// Fraction of dead ends to reconnect (braiding) so there are occasional loops.
export const BRAID_FRACTION = 0.1;

// Direction tables as fixed tuples: indexing with a `Dir` union yields the
// element union (never `undefined`), which keeps them clean under
// noUncheckedIndexedAccess.
const DX = [0, 1, 0, -1] as const;
const DY = [-1, 0, 1, 0] as const;
const OPP = [2, 3, 0, 1] as const;

/** Cell accessor — indices are always in range by construction; the cast keeps
 *  the 2D grid ergonomic under noUncheckedIndexedAccess. */
function at(cells: Cell[][], x: number, y: number): Cell {
  return (cells[y] as Cell[])[x] as Cell;
}

/** mulberry32 — small, fast, deterministic PRNG. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function solidGrid(size: number): Cell[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => ({ walls: [true, true, true, true] as Cell['walls'] })),
  );
}

function carve(cells: Cell[][], size: number, rng: () => number, sx: number, sy: number): void {
  const visited = new Uint8Array(size * size);
  const seen = (x: number, y: number): boolean => visited[y * size + x] === 1;
  const mark = (x: number, y: number): void => {
    visited[y * size + x] = 1;
  };
  const stack: Array<[number, number]> = [[sx, sy]];
  mark(sx, sy);
  while (stack.length > 0) {
    const top = stack[stack.length - 1];
    if (!top) break;
    const [x, y] = top;
    // Shuffle the four directions, then take the first unvisited neighbour.
    const dirs: Dir[] = [0, 1, 2, 3];
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = dirs[i] as Dir;
      dirs[i] = dirs[j] as Dir;
      dirs[j] = tmp;
    }
    let advanced = false;
    for (const d of dirs) {
      const nx = x + DX[d];
      const ny = y + DY[d];
      if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
      if (seen(nx, ny)) continue;
      // Knock down the wall between (x,y) and (nx,ny).
      at(cells, x, y).walls[d] = false;
      at(cells, nx, ny).walls[OPP[d]] = false;
      mark(nx, ny);
      stack.push([nx, ny]);
      advanced = true;
      break;
    }
    if (!advanced) stack.pop();
  }
}

/** Reconnect a fraction of dead ends (cells with 3 walls) to add loops. */
function braid(cells: Cell[][], size: number, rng: () => number): void {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cell = at(cells, x, y);
      if (cell.walls.filter(Boolean).length !== 3) continue;
      if (rng() > BRAID_FRACTION) continue;
      // Collect walled edges with an in-bounds neighbour, open a random one.
      const closed: Dir[] = [];
      for (const d of [0, 1, 2, 3] as Dir[]) {
        if (!cell.walls[d]) continue;
        const nx = x + DX[d];
        const ny = y + DY[d];
        if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
        closed.push(d);
      }
      if (closed.length === 0) continue;
      const d = closed[Math.floor(rng() * closed.length)] as Dir;
      cell.walls[d] = false;
      at(cells, x + DX[d], y + DY[d]).walls[OPP[d]] = false;
    }
  }
}

/** BFS shortest path (edges) between two rooms over open edges. -1 if none. */
export function shortestPath(
  cells: Cell[][],
  size: number,
  from: { x: number; y: number },
  to: { x: number; y: number },
): number {
  const dist = new Int32Array(size * size).fill(-1);
  dist[from.y * size + from.x] = 0;
  const queue: Array<[number, number]> = [[from.x, from.y]];
  let head = 0;
  while (head < queue.length) {
    const [x, y] = queue[head++] as [number, number];
    if (x === to.x && y === to.y) return dist[y * size + x] as number;
    const cell = at(cells, x, y);
    for (const d of [0, 1, 2, 3] as Dir[]) {
      if (cell.walls[d]) continue;
      const nx = x + DX[d];
      const ny = y + DY[d];
      if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
      const ni = ny * size + nx;
      if ((dist[ni] as number) >= 0) continue;
      dist[ni] = (dist[y * size + x] as number) + 1;
      queue.push([nx, ny]);
    }
  }
  return dist[to.y * size + to.x] as number;
}

function buildOne(size: number, seed: number): MazeGrid {
  const cells = solidGrid(size);
  const rng = makeRng(seed);
  const center = { x: (size - 1) / 2, y: (size - 1) / 2 };
  // Carve from the center so the goal is always reachable; braid for loops.
  carve(cells, size, rng, center.x, center.y);
  braid(cells, size, rng);
  // Entrance: a perimeter room, side + offset chosen by the seed.
  const side = Math.floor(rng() * 4);
  const off = 1 + Math.floor(rng() * (size - 2));
  const entrance =
    side === 0
      ? { x: off, y: 0 }
      : side === 1
        ? { x: size - 1, y: off }
        : side === 2
          ? { x: off, y: size - 1 }
          : { x: 0, y: off };
  const pathLength = shortestPath(cells, size, entrance, center);
  const inBand = pathLength >= BAND_MIN && pathLength <= BAND_MAX;
  return { size, cells, entrance, center, pathLength, inBand };
}

/**
 * Generate a difficulty-normalised maze. Tries up to MAX_ATTEMPTS seeds derived
 * from `seed`; returns the first in-band maze, else the candidate whose path
 * length is closest to the band (never a maze with an unreachable center — a
 * perfect maze carved from the center is always fully connected).
 */
export function generateMaze(seed: number, size = MAZE_SIZE): MazeGrid {
  let best: MazeGrid | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const candidate = buildOne(size, (seed + i * 0x9e3779b1) | 0);
    if (candidate.inBand) return candidate;
    const d =
      candidate.pathLength < BAND_MIN
        ? BAND_MIN - candidate.pathLength
        : candidate.pathLength - BAND_MAX;
    if (d < bestDist) {
      bestDist = d;
      best = candidate;
    }
  }
  return best as MazeGrid;
}
