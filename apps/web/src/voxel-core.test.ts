import { describe, expect, it } from 'vitest';
import {
  MAX_BLOCK_ID,
  PLOT_D,
  PLOT_FORMAT_VERSION,
  PLOT_H,
  PLOT_VOLUME,
  PLOT_W,
  VOXEL_AIR,
  VOXEL_BLOCKS,
  countBlocks,
  createEmptyPlot,
  decodePlotBlob,
  decodePlotRuns,
  encodePlotBlob,
  encodePlotRuns,
  getVoxel,
  inBounds,
  isValidBlockId,
  setVoxel,
  voxelIndex,
} from './voxel-core.js';

/** mulberry32 — deterministic fill for round-trip fuzzing. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Slab fixture: empty plot with a filled y=0 concrete layer. */
function slabPlot(): Uint8Array {
  const g = createEmptyPlot();
  g.fill(1, 0, PLOT_W * PLOT_D);
  return g;
}

describe('voxel grid basics', () => {
  it('palette ids are contiguous 1..MAX_BLOCK_ID', () => {
    expect(VOXEL_BLOCKS.map((b) => b.id)).toEqual(
      Array.from({ length: MAX_BLOCK_ID }, (_, i) => i + 1),
    );
  });

  it('voxelIndex covers the volume without collision at the corners', () => {
    expect(voxelIndex(0, 0, 0)).toBe(0);
    expect(voxelIndex(PLOT_W - 1, PLOT_H - 1, PLOT_D - 1)).toBe(PLOT_VOLUME - 1);
    // x fastest, then z, then y
    expect(voxelIndex(1, 0, 0)).toBe(1);
    expect(voxelIndex(0, 0, 1)).toBe(PLOT_W);
    expect(voxelIndex(0, 1, 0)).toBe(PLOT_W * PLOT_D);
  });

  it('set/get round-trip and out-of-bounds reads as air', () => {
    const g = createEmptyPlot();
    expect(setVoxel(g, 3, 2, 5, 4)).toBe(true);
    expect(getVoxel(g, 3, 2, 5)).toBe(4);
    // idempotent write reports no change
    expect(setVoxel(g, 3, 2, 5, 4)).toBe(false);
    // out-of-bounds is rejected / reads air
    expect(setVoxel(g, -1, 0, 0, 1)).toBe(false);
    expect(setVoxel(g, 0, PLOT_H, 0, 1)).toBe(false);
    expect(getVoxel(g, PLOT_W, 0, 0)).toBe(VOXEL_AIR);
    // invalid block ids are rejected
    expect(setVoxel(g, 0, 0, 0, MAX_BLOCK_ID + 1)).toBe(false);
    expect(setVoxel(g, 0, 0, 0, 1.5)).toBe(false);
    expect(setVoxel(g, 0, 0, 0, -1)).toBe(false);
  });

  it('inBounds / isValidBlockId edges', () => {
    expect(inBounds(0, 0, 0)).toBe(true);
    expect(inBounds(PLOT_W - 1, PLOT_H - 1, PLOT_D - 1)).toBe(true);
    expect(inBounds(PLOT_W, 0, 0)).toBe(false);
    expect(isValidBlockId(VOXEL_AIR)).toBe(true);
    expect(isValidBlockId(MAX_BLOCK_ID)).toBe(true);
    expect(isValidBlockId(MAX_BLOCK_ID + 1)).toBe(false);
  });

  it('slab helper: filling y=0 gives a W*D ground layer', () => {
    const g = createEmptyPlot();
    g.fill(1, 0, PLOT_W * PLOT_D); // y=0 stripe is contiguous by index layout
    expect(countBlocks(g)).toBe(PLOT_W * PLOT_D);
    expect(getVoxel(g, 0, 0, 0)).toBe(1);
    expect(getVoxel(g, PLOT_W - 1, 0, PLOT_D - 1)).toBe(1);
    expect(getVoxel(g, 0, 1, 0)).toBe(VOXEL_AIR);
  });
});

describe('RLE codec round-trips', () => {
  it('empty plot → single run → identical grid', () => {
    const g = createEmptyPlot();
    const runs = encodePlotRuns(g);
    expect(runs).toEqual([PLOT_VOLUME, VOXEL_AIR]);
    expect(decodePlotRuns(runs)).toEqual(g);
  });

  it('default plot round-trips and stays tiny', () => {
    const g = slabPlot();
    const runs = encodePlotRuns(g);
    expect(runs.length).toBe(4); // ground run + sky run
    expect(decodePlotRuns(runs)).toEqual(g);
  });

  it('seeded random builds round-trip exactly', () => {
    const rng = makeRng(0xb17);
    for (let trial = 0; trial < 5; trial++) {
      const g = createEmptyPlot();
      // Scatter ~600 random blocks (a plausible dense build).
      for (let n = 0; n < 600; n++) {
        const x = Math.floor(rng() * PLOT_W);
        const y = Math.floor(rng() * PLOT_H);
        const z = Math.floor(rng() * PLOT_D);
        setVoxel(g, x, y, z, 1 + Math.floor(rng() * MAX_BLOCK_ID));
      }
      const decoded = decodePlotRuns(encodePlotRuns(g));
      expect(decoded).toEqual(g);
    }
  });

  it('worst-case alternating grid round-trips and respects the run cap', () => {
    const g = createEmptyPlot();
    for (let i = 0; i < PLOT_VOLUME; i++) g[i] = i % 2 === 0 ? 1 : VOXEL_AIR;
    const runs = encodePlotRuns(g);
    expect(runs.length).toBe(PLOT_VOLUME * 2);
    expect(decodePlotRuns(runs)).toEqual(g);
  });
});

describe('decoder rejects malformed input', () => {
  const cases: [string, unknown][] = [
    ['non-array', { runs: true }],
    ['null', null],
    ['empty array', []],
    ['odd length', [PLOT_VOLUME, VOXEL_AIR, 3]],
    ['short total', [PLOT_VOLUME - 1, VOXEL_AIR]],
    ['long total', [PLOT_VOLUME + 1, VOXEL_AIR]],
    ['overflow mid-stream', [PLOT_VOLUME, 1, 5, 2]],
    ['zero count', [0, 1, PLOT_VOLUME, VOXEL_AIR]],
    ['negative count', [-5, 1, PLOT_VOLUME + 5, VOXEL_AIR]],
    ['fractional count', [PLOT_VOLUME - 0.5, VOXEL_AIR, 0.5, 1]],
    ['unknown block id', [PLOT_VOLUME, MAX_BLOCK_ID + 1]],
    ['negative block id', [PLOT_VOLUME, -1]],
    ['string entries', [String(PLOT_VOLUME), String(VOXEL_AIR)]],
    ['NaN count', [Number.NaN, VOXEL_AIR]],
    ['oversized run list', Array.from({ length: PLOT_VOLUME * 2 + 2 }, () => 1)],
  ];
  for (const [name, input] of cases) {
    it(name, () => {
      expect(decodePlotRuns(input)).toBeNull();
    });
  }
});

describe('versioned envelope', () => {
  it('encode → decode round-trips', () => {
    const g = slabPlot();
    setVoxel(g, 5, 3, 7, 2);
    const blob = encodePlotBlob(g);
    expect(blob.v).toBe(PLOT_FORMAT_VERSION);
    expect(blob.w).toBe(PLOT_W);
    expect(blob.h).toBe(PLOT_H);
    expect(blob.d).toBe(PLOT_D);
    expect(decodePlotBlob(blob)).toEqual(g);
  });

  it('survives a JSON round-trip (the actual persistence path)', () => {
    const g = slabPlot();
    setVoxel(g, 1, 1, 1, 5);
    const revived = decodePlotBlob(JSON.parse(JSON.stringify(encodePlotBlob(g))));
    expect(revived).toEqual(g);
  });

  it('rejects wrong version / dimensions / shapes', () => {
    const good = encodePlotBlob(createEmptyPlot());
    expect(decodePlotBlob({ ...good, v: 2 })).toBeNull();
    expect(decodePlotBlob({ ...good, w: 32 })).toBeNull();
    expect(decodePlotBlob({ ...good, h: PLOT_H + 1 })).toBeNull();
    expect(decodePlotBlob({ ...good, runs: 'nope' })).toBeNull();
    expect(decodePlotBlob('a string')).toBeNull();
    expect(decodePlotBlob(undefined)).toBeNull();
    expect(decodePlotBlob(42)).toBeNull();
  });
});
