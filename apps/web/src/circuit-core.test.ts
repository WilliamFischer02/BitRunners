import { describe, expect, it } from 'vitest';
import {
  type Board,
  CIRCUIT_LEVEL,
  CIRCUIT_LEVELS,
  CIRCUIT_SOLUTIONS,
  type Edge,
  type Level,
  circuitSolution,
  connectors,
  isSolved,
  kindOf,
  makeBoard,
  pathComplete,
  pieceForKind,
  setCell,
} from './circuit-core.js';

describe('connectors', () => {
  it('straight (rot 0) exposes its variant on N + S', () => {
    const c = connectors({ type: 'straight', variant: 'power', rot: 0 });
    expect(c).toEqual({ 0: 'power', 2: 'power' });
  });

  it('straight rotates N–S → E–W at rot 1', () => {
    const c = connectors({ type: 'straight', variant: 'data', rot: 1 });
    expect(c).toEqual({ 1: 'data', 3: 'data' });
  });

  it('elbow (rot 0) exposes N + E', () => {
    const c = connectors({ type: 'elbow', variant: 'power', rot: 0 });
    expect(c).toEqual({ 0: 'power', 1: 'power' });
  });

  it('cross_bridge keeps power + data on separate axes (rot 0)', () => {
    const c = connectors({ type: 'cross_bridge', variant: 'power', rot: 0 });
    expect(c).toEqual({ 0: 'power', 2: 'power', 1: 'data', 3: 'data' });
  });

  it('cross_bridge rot 1 swaps the axes (power E–W, data N–S)', () => {
    const c = connectors({ type: 'cross_bridge', variant: 'power', rot: 1 });
    expect(c).toEqual({ 1: 'power', 3: 'power', 2: 'data', 0: 'data' });
  });
});

describe('kind <-> piece round-trip', () => {
  for (const kind of [
    'power_straight',
    'power_elbow',
    'data_straight',
    'data_elbow',
    'cross_bridge',
  ] as const) {
    it(`${kind}`, () => {
      expect(kindOf(pieceForKind(kind))).toBe(kind);
    });
  }
});

describe('CIRCUIT_LEVELS (solution-first)', () => {
  it('ships 10 levels with a parallel canonical solution each', () => {
    expect(CIRCUIT_LEVELS).toHaveLength(10);
    expect(CIRCUIT_SOLUTIONS).toHaveLength(10);
    // Back-compat alias still points at level 1.
    expect(CIRCUIT_LEVEL).toBe(CIRCUIT_LEVELS[0]);
  });

  for (let i = 0; i < 10; i++) {
    it(`level ${i + 1} — solution solves, dims match, empty board does not`, () => {
      const level = CIRCUIT_LEVELS[i] as Level;
      const solution = CIRCUIT_SOLUTIONS[i] as Board;
      expect(solution).toHaveLength(level.h);
      for (const row of solution) expect(row).toHaveLength(level.w);
      expect(isSolved(level, solution)).toBe(true);
      expect(isSolved(level, makeBoard(level))).toBe(false);
    });
  }

  it('every level routes both channels border-to-border with matched ports', () => {
    for (const level of CIRCUIT_LEVELS) {
      for (const channel of ['power', 'data'] as const) {
        const inlet = level.ports.find((p) => p.channel === channel && p.role === 'inlet');
        const outlet = level.ports.find((p) => p.channel === channel && p.role === 'outlet');
        expect(inlet).toBeDefined();
        expect(outlet).toBeDefined();
      }
    }
  });
});

describe('CIRCUIT_LEVEL validator', () => {
  it('accepts the intended solution — both flows complete', () => {
    const board = circuitSolution();
    expect(pathComplete(CIRCUIT_LEVEL, board, 'power')).toBe(true);
    expect(pathComplete(CIRCUIT_LEVEL, board, 'data')).toBe(true);
    expect(isSolved(CIRCUIT_LEVEL, board)).toBe(true);
  });

  it('rejects an empty board', () => {
    expect(isSolved(CIRCUIT_LEVEL, makeBoard(CIRCUIT_LEVEL))).toBe(false);
  });

  it('rejects a wrong bridge rotation (power can no longer cross the junction)', () => {
    // rot 0 makes the bridge carry power N–S / data E–W, so the horizontal
    // power run no longer conducts through (1,1).
    const board = setCell(circuitSolution(), 1, 1, {
      type: 'cross_bridge',
      variant: 'power',
      rot: 0,
    });
    expect(pathComplete(CIRCUIT_LEVEL, board, 'power')).toBe(false);
    // Data now runs E–W at the junction, breaking the vertical data run too.
    expect(pathComplete(CIRCUIT_LEVEL, board, 'data')).toBe(false);
    expect(isSolved(CIRCUIT_LEVEL, board)).toBe(false);
  });

  it('needs the bridge — a plain power straight at the junction blocks data', () => {
    const board = setCell(circuitSolution(), 1, 1, { type: 'straight', variant: 'power', rot: 1 });
    expect(pathComplete(CIRCUIT_LEVEL, board, 'power')).toBe(true); // power still flows E–W
    expect(pathComplete(CIRCUIT_LEVEL, board, 'data')).toBe(false); // data has no wire through
    expect(isSolved(CIRCUIT_LEVEL, board)).toBe(false);
  });

  it('rejects a single missing tile in the power run', () => {
    const board = setCell(circuitSolution(), 2, 1, null);
    expect(pathComplete(CIRCUIT_LEVEL, board, 'power')).toBe(false);
    expect(pathComplete(CIRCUIT_LEVEL, board, 'data')).toBe(true); // data run intact
    expect(isSolved(CIRCUIT_LEVEL, board)).toBe(false);
  });

  it('power and data never bridge through a same-cell junction', () => {
    // Two crossing straights of different channels sharing a border does not
    // connect them: build a tiny 1x2 where a power straight abuts a data
    // straight — neither flow should reach the other's outlet.
    const level = {
      w: 2,
      h: 1,
      fixed: [],
      inventory: CIRCUIT_LEVEL.inventory,
      ports: [
        { x: 0, y: 0, edge: 3 as Edge, channel: 'power' as const, role: 'inlet' as const },
        { x: 1, y: 0, edge: 1 as Edge, channel: 'data' as const, role: 'outlet' as const },
      ],
    };
    const board: Board = [
      [
        { type: 'straight', variant: 'power', rot: 1 },
        { type: 'straight', variant: 'data', rot: 1 },
      ],
    ];
    // Power reaches the seam but the neighbour is a data wire → power can't
    // cross, and there's no power outlet anyway.
    expect(pathComplete(level, board, 'power')).toBe(false);
    expect(pathComplete(level, board, 'data')).toBe(false);
  });
});
