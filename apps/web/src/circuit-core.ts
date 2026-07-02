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

// ── v1 level ───────────────────────────────────────────────────────────────
// A 4×4 board. Power runs left→right across row 1; data runs top→bottom down
// column 1; they cross at (1,1) via the single cross_bridge. Two spare elbows
// are in the palette so it isn't a paint-by-numbers exact fit. The canonical
// solution below is asserted by circuit-core.test.ts.
export const CIRCUIT_LEVEL: Level = {
  w: 4,
  h: 4,
  ports: [
    { x: 0, y: 1, edge: 3, channel: 'power', role: 'inlet' }, // power in  — W of (0,1)
    { x: 3, y: 1, edge: 1, channel: 'power', role: 'outlet' }, // power out — E of (3,1)
    { x: 1, y: 0, edge: 0, channel: 'data', role: 'inlet' }, // data in   — N of (1,0)
    { x: 1, y: 3, edge: 2, channel: 'data', role: 'outlet' }, // data out  — S of (1,3)
  ],
  fixed: [],
  inventory: {
    power_straight: 3,
    data_straight: 3,
    cross_bridge: 1,
    power_elbow: 1,
    data_elbow: 1,
  },
};

/** The intended solution for CIRCUIT_LEVEL (also used by the test). */
export function circuitSolution(): Board {
  let board = makeBoard(CIRCUIT_LEVEL);
  const pwr: PlacedPiece = { type: 'straight', variant: 'power', rot: 1 };
  const dat: PlacedPiece = { type: 'straight', variant: 'data', rot: 0 };
  // Power row (E–W straights, rot 1) + the bridge (rot 1 → power E–W, data N–S).
  board = setCell(board, 0, 1, { ...pwr });
  board = setCell(board, 1, 1, { type: 'cross_bridge', variant: 'power', rot: 1 });
  board = setCell(board, 2, 1, { ...pwr });
  board = setCell(board, 3, 1, { ...pwr });
  // Data column (N–S straights, rot 0).
  board = setCell(board, 1, 0, { ...dat });
  board = setCell(board, 1, 2, { ...dat });
  board = setCell(board, 1, 3, { ...dat });
  return board;
}
