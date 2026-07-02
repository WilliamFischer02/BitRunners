// circuit_patch — pure board model + flood-fill validator (mega-batch 2 · 4.4).
//
// A tile-placement puzzle: route a POWER flow and a DATA flow from their
// border inlets to their opposite outlets at the same time. Power conducts
// only along THICK lines; data only along THIN lines; the two never
// interconnect. `cross_bridge` is how the two paths cross without touching —
// it carries power straight through one axis and data straight through the
// other.
//
// This module is deliberately React-free and allocation-light so the win
// condition can be unit-tested headless (circuit-core.test.ts). The React
// shell (CircuitPatch.tsx) owns rendering, palette state, and rewards.

/** Edge index around a cell: 0 = N(up), 1 = E(right), 2 = S(down), 3 = W(left).
 *  y increases downward, so N is the −y neighbour. */
export type Edge = 0 | 1 | 2 | 3;
export type Channel = 'power' | 'data';
export type PieceType = 'straight' | 'elbow' | 'cross_bridge';

export interface PlacedPiece {
  type: PieceType;
  /** Which flow a straight/elbow carries. Ignored for cross_bridge (it carries
   *  both), but kept present so the value is a plain, serialisable record. */
  variant: Channel;
  /** Clockwise quarter-turns applied to the base geometry. */
  rot: Edge;
}

/** Board is row-major: board[y][x], null = empty cell. */
export type Board = (PlacedPiece | null)[][];

export interface Port {
  x: number;
  y: number;
  edge: Edge;
  channel: Channel;
  role: 'inlet' | 'outlet';
}

export interface FixedPiece {
  x: number;
  y: number;
  piece: PlacedPiece;
}

export interface Level {
  w: number;
  h: number;
  ports: readonly Port[];
  /** Pre-placed immovable tiles (obstacles / hints). Empty for v1. */
  fixed: readonly FixedPiece[];
  /** Palette inventory: how many of each piece kind the player may place. */
  inventory: Readonly<Record<PieceKind, number>>;
}

// A "kind" is the palette-facing identity of a piece (what the button places).
export type PieceKind =
  | 'power_straight'
  | 'power_elbow'
  | 'data_straight'
  | 'data_elbow'
  | 'cross_bridge';

const KIND_TO_PIECE: Record<PieceKind, { type: PieceType; variant: Channel }> = {
  power_straight: { type: 'straight', variant: 'power' },
  power_elbow: { type: 'elbow', variant: 'power' },
  data_straight: { type: 'straight', variant: 'data' },
  data_elbow: { type: 'elbow', variant: 'data' },
  cross_bridge: { type: 'cross_bridge', variant: 'power' },
};

/** Fresh placed piece for a palette kind, at rotation 0. */
export function pieceForKind(kind: PieceKind): PlacedPiece {
  const base = KIND_TO_PIECE[kind];
  return { type: base.type, variant: base.variant, rot: 0 };
}

/** The palette identity of a placed piece (inverse of pieceForKind). */
export function kindOf(piece: PlacedPiece): PieceKind {
  if (piece.type === 'cross_bridge') return 'cross_bridge';
  return `${piece.variant}_${piece.type}` as PieceKind;
}

/**
 * Which channel (if any) each edge of a placed piece exposes.
 *   straight     — two opposite edges of `variant`      (base N,S)
 *   elbow        — two adjacent edges of `variant`      (base N,E)
 *   cross_bridge — power on one axis, data on the other (base power N/S, data E/W)
 * Rotation adds `rot` quarter-turns clockwise (N→E→S→W).
 */
export function connectors(piece: PlacedPiece): Partial<Record<Edge, Channel>> {
  const out: Partial<Record<Edge, Channel>> = {};
  const rot = piece.rot;
  const put = (base: Edge, ch: Channel): void => {
    out[((base + rot) % 4) as Edge] = ch;
  };
  if (piece.type === 'straight') {
    put(0, piece.variant);
    put(2, piece.variant);
  } else if (piece.type === 'elbow') {
    put(0, piece.variant);
    put(1, piece.variant);
  } else {
    // cross_bridge: power straight through N–S, data straight through E–W.
    put(0, 'power');
    put(2, 'power');
    put(1, 'data');
    put(3, 'data');
  }
  return out;
}

// Neighbour cell across an edge + the edge that faces back. null = off-board.
function neighbor(
  x: number,
  y: number,
  edge: Edge,
  w: number,
  h: number,
): { nx: number; ny: number; opp: Edge } | null {
  let nx = x;
  let ny = y;
  let opp: Edge;
  if (edge === 0) {
    ny = y - 1;
    opp = 2;
  } else if (edge === 1) {
    nx = x + 1;
    opp = 3;
  } else if (edge === 2) {
    ny = y + 1;
    opp = 0;
  } else {
    nx = x - 1;
    opp = 1;
  }
  if (nx < 0 || nx >= w || ny < 0 || ny >= h) return null;
  return { nx, ny, opp };
}

/**
 * Is the given `channel` connected from its inlet port to its outlet port on
 * this board? BFS over (cell, edge) connector nodes: within a piece, all
 * same-channel connectors are one wire; between cells, a shared edge conducts
 * only when both pieces expose the same channel on it. Power and data are
 * checked independently, so they can never bridge through each other.
 */
export function pathComplete(level: Level, board: Board, channel: Channel): boolean {
  const inlet = level.ports.find((p) => p.channel === channel && p.role === 'inlet');
  const outlet = level.ports.find((p) => p.channel === channel && p.role === 'outlet');
  if (!inlet || !outlet) return false;

  const startPiece = board[inlet.y]?.[inlet.x];
  if (!startPiece) return false;
  if (connectors(startPiece)[inlet.edge] !== channel) return false;

  const visited = new Set<string>();
  const queue: Array<[number, number, Edge]> = [[inlet.x, inlet.y, inlet.edge]];

  while (queue.length > 0) {
    const [x, y, edge] = queue.shift() as [number, number, Edge];
    const key = `${x},${y},${edge}`;
    if (visited.has(key)) continue;
    visited.add(key);

    if (x === outlet.x && y === outlet.y && edge === outlet.edge) return true;

    const piece = board[y]?.[x];
    if (!piece) continue;
    const conns = connectors(piece);
    if (conns[edge] !== channel) continue;

    // Intra-piece: this connector links to the piece's other same-channel edges.
    for (const e of [0, 1, 2, 3] as Edge[]) {
      if (e !== edge && conns[e] === channel) queue.push([x, y, e]);
    }
    // Inter-cell: cross this edge into the neighbour's facing edge if it, too,
    // exposes the same channel.
    const nb = neighbor(x, y, edge, level.w, level.h);
    if (nb) {
      const nbPiece = board[nb.ny]?.[nb.nx];
      if (nbPiece && connectors(nbPiece)[nb.opp] === channel) {
        queue.push([nb.nx, nb.ny, nb.opp]);
      }
    }
  }
  return false;
}

/** Win condition: BOTH flows reach their outlets simultaneously. */
export function isSolved(level: Level, board: Board): boolean {
  return pathComplete(level, board, 'power') && pathComplete(level, board, 'data');
}

/** Read a cell safely (out-of-range → null). */
export function cellAt(board: Board, x: number, y: number): PlacedPiece | null {
  return board[y]?.[x] ?? null;
}

/** A new board with (x,y) set to `piece` — immutable; no-op if out of range. */
export function setCell(board: Board, x: number, y: number, piece: PlacedPiece | null): Board {
  return board.map((row, ry) => (ry === y ? row.map((c, rx) => (rx === x ? piece : c)) : row));
}

/** Empty board sized to the level, with any fixed pieces seeded in. */
export function makeBoard(level: Level): Board {
  let board: Board = Array.from({ length: level.h }, () =>
    Array.from({ length: level.w }, () => null),
  );
  for (const f of level.fixed) board = setCell(board, f.x, f.y, { ...f.piece });
  return board;
}

// ── Levels ──────────────────────────────────────────────────────────────────
// Ten hand-authored levels of escalating difficulty. Every level is built
// SOLUTION-FIRST via levelFromSolution(): the author lays out a known-good
// board, and the level's inventory is derived from it (plus a few spare /
// distractor pieces), so solvability is guaranteed by construction and
// asserted for all ten by circuit-core.test.ts against CIRCUIT_SOLUTIONS.
//
// Geometry note: a border-to-opposite-border power run always separates the
// data inlet's border from its outlet's, so the data path must cross power an
// ODD number of times — bridge counts per level are 1 or 3, never 2.

/** One authored cell of a level's canonical solution. */
export interface SolutionCell {
  x: number;
  y: number;
  piece: PlacedPiece;
}

/**
 * Build a Level from its intended solution. The inventory is computed as the
 * multiset of kinds used by `solution` plus optional spares, so the level is
 * solvable by construction. `fixed` pieces are pre-seeded immovable obstacles —
 * they are NOT counted into the inventory and must not appear in `solution`.
 */
export function levelFromSolution(
  w: number,
  h: number,
  ports: readonly Port[],
  solution: readonly SolutionCell[],
  extraInventory?: Partial<Record<PieceKind, number>>,
  fixed: readonly FixedPiece[] = [],
): { level: Level; solution: Board } {
  const inventory: Record<PieceKind, number> = {
    power_straight: 0,
    power_elbow: 0,
    data_straight: 0,
    data_elbow: 0,
    cross_bridge: 0,
  };
  for (const cell of solution) inventory[kindOf(cell.piece)] += 1;
  if (extraInventory) {
    for (const kind of Object.keys(extraInventory) as PieceKind[]) {
      inventory[kind] += extraInventory[kind] ?? 0;
    }
  }
  const level: Level = { w, h, ports, fixed, inventory };
  let board = makeBoard(level);
  for (const cell of solution) board = setCell(board, cell.x, cell.y, { ...cell.piece });
  return { level, solution: board };
}

// Piece shorthands for the level tables below.
//   straights — rot 0: vertical (N/S), rot 1: horizontal (E/W)
//   elbows    — rot 0: N+E, rot 1: E+S, rot 2: S+W, rot 3: W+N
//   bridge    — rot 0: power N/S + data E/W, rot 1: power E/W + data N/S
const P = (rot: Edge): PlacedPiece => ({ type: 'straight', variant: 'power', rot });
const PE = (rot: Edge): PlacedPiece => ({ type: 'elbow', variant: 'power', rot });
const D = (rot: Edge): PlacedPiece => ({ type: 'straight', variant: 'data', rot });
const DE = (rot: Edge): PlacedPiece => ({ type: 'elbow', variant: 'data', rot });
const B = (rot: Edge): PlacedPiece => ({ type: 'cross_bridge', variant: 'power', rot });

const port = (
  x: number,
  y: number,
  edge: Edge,
  channel: Channel,
  role: 'inlet' | 'outlet',
): Port => ({ x, y, edge, channel, role });

const at = (x: number, y: number, piece: PlacedPiece): SolutionCell => ({ x, y, piece });

// L1 (4×4) — the original v1 layout. Power W→E across row 1; data N→S down
// column 1; one bridge at the (1,1) junction. Two spare elbows as distractors.
const L1 = levelFromSolution(
  4,
  4,
  [
    port(0, 1, 3, 'power', 'inlet'),
    port(3, 1, 1, 'power', 'outlet'),
    port(1, 0, 0, 'data', 'inlet'),
    port(1, 3, 2, 'data', 'outlet'),
  ],
  [
    at(0, 1, P(1)),
    at(1, 1, B(1)),
    at(2, 1, P(1)),
    at(3, 1, P(1)),
    at(1, 0, D(0)),
    at(1, 2, D(0)),
    at(1, 3, D(0)),
  ],
  { power_elbow: 1, data_elbow: 1 },
);

// L2 (4×4) — axes swapped: power N→S down column 2, data W→E across row 2.
const L2 = levelFromSolution(
  4,
  4,
  [
    port(2, 0, 0, 'power', 'inlet'),
    port(2, 3, 2, 'power', 'outlet'),
    port(0, 2, 3, 'data', 'inlet'),
    port(3, 2, 1, 'data', 'outlet'),
  ],
  [
    at(2, 0, P(0)),
    at(2, 1, P(0)),
    at(2, 2, B(0)),
    at(2, 3, P(0)),
    at(0, 2, D(1)),
    at(1, 2, D(1)),
    at(3, 2, D(1)),
  ],
  { power_elbow: 1 },
);

// L3 (4×4) — first elbows: power doglegs W(0,2)→E(3,1); data drops N(2,0)→S(2,3).
const L3 = levelFromSolution(
  4,
  4,
  [
    port(0, 2, 3, 'power', 'inlet'),
    port(3, 1, 1, 'power', 'outlet'),
    port(2, 0, 0, 'data', 'inlet'),
    port(2, 3, 2, 'data', 'outlet'),
  ],
  [
    at(0, 2, P(1)),
    at(1, 2, PE(3)), // W in → N out
    at(1, 1, PE(1)), // S in → E out
    at(2, 1, B(1)), // power E/W, data N/S
    at(3, 1, P(1)),
    at(2, 0, D(0)),
    at(2, 2, D(0)),
    at(2, 3, D(0)),
  ],
  { data_elbow: 1, power_straight: 1 },
);

// L4 (5×5) — power staircases W(0,0)→E(4,4) with four elbows; data drops
// straight N(3,0)→S(3,4) through one bridge.
const L4 = levelFromSolution(
  5,
  5,
  [
    port(0, 0, 3, 'power', 'inlet'),
    port(4, 4, 1, 'power', 'outlet'),
    port(3, 0, 0, 'data', 'inlet'),
    port(3, 4, 2, 'data', 'outlet'),
  ],
  [
    at(0, 0, P(1)),
    at(1, 0, PE(2)), // W in → S out
    at(1, 1, P(0)),
    at(1, 2, PE(0)), // N in → E out
    at(2, 2, P(1)),
    at(3, 2, B(1)),
    at(4, 2, PE(2)),
    at(4, 3, P(0)),
    at(4, 4, PE(0)),
    at(3, 0, D(0)),
    at(3, 1, D(0)),
    at(3, 3, D(0)),
    at(3, 4, D(0)),
  ],
  { data_elbow: 1 },
);

// L5 (5×5) — both paths dogleg and weave through THREE bridges.
const L5 = levelFromSolution(
  5,
  5,
  [
    port(0, 1, 3, 'power', 'inlet'),
    port(4, 3, 1, 'power', 'outlet'),
    port(1, 0, 0, 'data', 'inlet'),
    port(3, 4, 2, 'data', 'outlet'),
  ],
  [
    at(0, 1, P(1)),
    at(1, 1, B(1)), // power E/W · data N/S
    at(2, 1, PE(2)), // W in → S out
    at(2, 2, B(0)), // power N/S · data E/W
    at(2, 3, PE(0)), // N in → E out
    at(3, 3, B(1)),
    at(4, 3, P(1)),
    at(1, 0, D(0)),
    at(1, 2, DE(0)), // N in → E out
    at(3, 2, DE(2)), // W in → S out
    at(3, 4, D(0)),
  ],
  { power_straight: 1, data_straight: 1 },
);

// L6 (5×5) — mirrored weave: power climbs W(0,3)→E(4,1) while data descends
// N(3,0)→S(0,4) across three bridges, two of them on power's own elbowed run.
const L6 = levelFromSolution(
  5,
  5,
  [
    port(0, 3, 3, 'power', 'inlet'),
    port(4, 1, 1, 'power', 'outlet'),
    port(3, 0, 0, 'data', 'inlet'),
    port(0, 4, 2, 'data', 'outlet'),
  ],
  [
    at(0, 3, B(1)), // power E/W · data N/S
    at(1, 3, PE(3)), // W in → N out
    at(1, 2, B(0)), // power N/S · data E/W
    at(1, 1, PE(1)), // S in → E out
    at(2, 1, P(1)),
    at(3, 1, B(1)),
    at(4, 1, P(1)),
    at(3, 0, D(0)),
    at(3, 2, DE(3)), // N in → W out
    at(2, 2, D(1)),
    at(0, 2, DE(1)), // E in → S out
    at(0, 4, D(0)),
  ],
  { power_elbow: 1, data_elbow: 1 },
);

// L7 (6×6) — first fixed obstacles. Power hooks W(0,4)→E(5,1); data staircases
// N(4,0)→S(0,5); three bridges, two immovable decoy tiles.
const L7 = levelFromSolution(
  6,
  6,
  [
    port(0, 4, 3, 'power', 'inlet'),
    port(5, 1, 1, 'power', 'outlet'),
    port(4, 0, 0, 'data', 'inlet'),
    port(0, 5, 2, 'data', 'outlet'),
  ],
  [
    at(0, 4, B(1)),
    at(1, 4, PE(3)), // W in → N out
    at(1, 3, P(0)),
    at(1, 2, B(0)),
    at(1, 1, PE(1)), // S in → E out
    at(2, 1, P(1)),
    at(3, 1, P(1)),
    at(4, 1, B(1)),
    at(5, 1, P(1)),
    at(4, 0, D(0)),
    at(4, 2, DE(3)), // N in → W out
    at(3, 2, D(1)),
    at(2, 2, D(1)),
    at(0, 2, DE(1)), // E in → S out
    at(0, 3, D(0)),
    at(0, 5, D(0)),
  ],
  { power_elbow: 1, data_straight: 1 },
  [at(3, 3, DE(0)), at(5, 4, P(0))], // inert obstacles off both routes
);

// L8 (6×6) — long snake. Power N(3,0)→S(1,5); data W(0,1)→E(5,5) loops around
// the power hook, crossing it three times.
const L8 = levelFromSolution(
  6,
  6,
  [
    port(3, 0, 0, 'power', 'inlet'),
    port(1, 5, 2, 'power', 'outlet'),
    port(0, 1, 3, 'data', 'inlet'),
    port(5, 5, 1, 'data', 'outlet'),
  ],
  [
    at(3, 0, P(0)),
    at(3, 1, B(0)),
    at(3, 2, P(0)),
    at(3, 3, PE(3)), // N in → W out
    at(2, 3, P(1)),
    at(1, 3, PE(1)), // E in → S out
    at(1, 4, B(0)),
    at(1, 5, B(0)),
    at(0, 1, D(1)),
    at(1, 1, D(1)),
    at(2, 1, D(1)),
    at(4, 1, DE(2)), // W in → S out
    at(4, 2, D(0)),
    at(4, 3, D(0)),
    at(4, 4, DE(3)), // N in → W out
    at(3, 4, D(1)),
    at(2, 4, D(1)),
    at(0, 4, DE(1)), // E in → S out
    at(0, 5, DE(0)), // N in → E out
    at(2, 5, D(1)),
    at(3, 5, D(1)),
    at(4, 5, D(1)),
    at(5, 5, D(1)),
  ],
  { power_straight: 1, data_elbow: 1 },
  [at(2, 2, PE(0)), at(5, 2, D(0))],
);

// L9 (6×6) — power stairs W(0,1)→E(5,4); data mirrors it N(2,0)→S(4,5);
// three bridges + a decoy bridge spare in the palette.
const L9 = levelFromSolution(
  6,
  6,
  [
    port(0, 1, 3, 'power', 'inlet'),
    port(5, 4, 1, 'power', 'outlet'),
    port(2, 0, 0, 'data', 'inlet'),
    port(4, 5, 2, 'data', 'outlet'),
  ],
  [
    at(0, 1, P(1)),
    at(1, 1, P(1)),
    at(2, 1, B(1)),
    at(3, 1, PE(2)), // W in → S out
    at(3, 2, P(0)),
    at(3, 3, B(0)),
    at(3, 4, PE(0)), // N in → E out
    at(4, 4, B(1)),
    at(5, 4, P(1)),
    at(2, 0, D(0)),
    at(2, 2, D(0)),
    at(2, 3, DE(0)), // N in → E out
    at(4, 3, DE(2)), // W in → S out
    at(4, 5, D(0)),
  ],
  { cross_bridge: 1, power_straight: 1 },
  [at(1, 3, P(0)), at(5, 1, DE(2))],
);

// L10 (6×6) — corner-to-corner finale. Power spirals W(0,5)→E(5,0) with six
// elbows; data weaves N(1,0)→S(5,5) through all three bridges; three fixed
// obstacles (including a decoy bridge) crowd the middle.
const L10 = levelFromSolution(
  6,
  6,
  [
    port(0, 5, 3, 'power', 'inlet'),
    port(5, 0, 1, 'power', 'outlet'),
    port(1, 0, 0, 'data', 'inlet'),
    port(5, 5, 2, 'data', 'outlet'),
  ],
  [
    at(0, 5, PE(3)), // W in → N out
    at(0, 4, PE(1)), // S in → E out
    at(1, 4, B(1)),
    at(2, 4, P(1)),
    at(3, 4, B(1)),
    at(4, 4, PE(3)), // W in → N out
    at(4, 3, P(0)),
    at(4, 2, B(0)),
    at(4, 1, PE(1)), // S in → E out
    at(5, 1, PE(3)), // W in → N out
    at(5, 0, PE(1)), // S in → E out (the outlet corner)
    at(1, 0, D(0)),
    at(1, 1, D(0)),
    at(1, 2, D(0)),
    at(1, 3, D(0)),
    at(1, 5, DE(0)), // N in → E out
    at(2, 5, D(1)),
    at(3, 5, DE(3)), // W in → N out
    at(3, 3, D(0)),
    at(3, 2, DE(1)), // S in → E out
    at(5, 2, DE(2)), // W in → S out
    at(5, 3, D(0)),
    at(5, 4, D(0)),
    at(5, 5, D(0)),
  ],
  { power_elbow: 1, data_elbow: 1, cross_bridge: 1 },
  [at(2, 2, B(0)), at(3, 0, PE(1)), at(4, 5, D(1))],
);

const LEVELS = [L1, L2, L3, L4, L5, L6, L7, L8, L9, L10] as const;

/** All 10 levels, in play order (escalating difficulty). */
export const CIRCUIT_LEVELS: readonly Level[] = LEVELS.map((l) => l.level);

/** Canonical solved board for each level, parallel to CIRCUIT_LEVELS. The
 *  test suite asserts isSolved() for every pair — the solvability proof. */
export const CIRCUIT_SOLUTIONS: readonly Board[] = LEVELS.map((l) => l.solution);

/** Back-compat alias: v1 shipped a single level; it is now level 1 of 10. */
export const CIRCUIT_LEVEL: Level = L1.level;

/** The intended solution for CIRCUIT_LEVEL (also used by the test). Returns a
 *  fresh copy so callers can never mutate the canonical board. */
export function circuitSolution(): Board {
  return L1.solution.map((row) => row.map((c) => (c ? { ...c } : null)));
}
