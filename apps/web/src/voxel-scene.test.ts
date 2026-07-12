import { describe, expect, it } from 'vitest';
import { createEmptyPlot, setVoxel } from './voxel-core.js';
import { PLOT_HALF_X, PLOT_HALF_Z, pickVoxel, slideMoveVoxel } from './voxel-scene.js';

/** Local-space x/z of a cell center (VOXEL_SIZE = 1). */
const lx = (x: number): number => x + 0.5 - PLOT_HALF_X;
const lz = (z: number): number => z + 0.5 - PLOT_HALF_Z;

describe('pickVoxel — DDA surface selection', () => {
  it('empty plot: straight-down ray lands a pad placement cell', () => {
    const g = createEmptyPlot();
    const pick = pickVoxel(lx(5), 30, lz(7), 0, -1, 0, g, 0);
    expect(pick).toEqual({ erase: null, place: { x: 5, y: 0, z: 7 } });
  });

  it('single block: erase = the block, place = the cell above', () => {
    const g = createEmptyPlot();
    setVoxel(g, 5, 0, 7, 1);
    const pick = pickVoxel(lx(5), 30, lz(7), 0, -1, 0, g, 0);
    expect(pick?.erase).toEqual({ x: 5, y: 0, z: 7 });
    expect(pick?.place).toEqual({ x: 5, y: 1, z: 7 });
  });

  it('a contiguous solid column is ONE surface', () => {
    const g = createEmptyPlot();
    setVoxel(g, 5, 0, 7, 1);
    setVoxel(g, 5, 1, 7, 1);
    setVoxel(g, 5, 2, 7, 1);
    const d0 = pickVoxel(lx(5), 30, lz(7), 0, -1, 0, g, 0);
    expect(d0?.erase).toEqual({ x: 5, y: 2, z: 7 });
    // Depth 1 over-reaches (only one surface) → clamps to the deepest found.
    const d1 = pickVoxel(lx(5), 30, lz(7), 0, -1, 0, g, 1);
    expect(d1?.erase).toEqual({ x: 5, y: 2, z: 7 });
  });

  it('depth slider reaches the second surface behind an air gap', () => {
    const g = createEmptyPlot();
    setVoxel(g, 5, 4, 7, 2); // upper slab
    setVoxel(g, 5, 0, 7, 1); // lower slab, 3-cell air gap between
    const d0 = pickVoxel(lx(5), 30, lz(7), 0, -1, 0, g, 0);
    expect(d0?.erase).toEqual({ x: 5, y: 4, z: 7 });
    expect(d0?.place).toEqual({ x: 5, y: 5, z: 7 });
    const d1 = pickVoxel(lx(5), 30, lz(7), 0, -1, 0, g, 1);
    expect(d1?.erase).toEqual({ x: 5, y: 0, z: 7 });
    expect(d1?.place).toEqual({ x: 5, y: 1, z: 7 });
  });

  it('horizontal ray hits the side face and places in front of it', () => {
    const g = createEmptyPlot();
    setVoxel(g, 10, 0, 12, 4);
    // Ray flying at block-half height along +x toward the block.
    const pick = pickVoxel(lx(2), 0.5, lz(12), 1, 0, 0, g, 0);
    expect(pick?.erase).toEqual({ x: 10, y: 0, z: 12 });
    expect(pick?.place).toEqual({ x: 9, y: 0, z: 12 });
  });

  it('ray that misses the grid entirely returns null', () => {
    const g = createEmptyPlot();
    expect(pickVoxel(0, 40, 0, 0, 1, 0, g, 0)).toBeNull(); // straight up
    expect(pickVoxel(PLOT_HALF_X + 50, 5, 0, 1, 0, 0, g, 0)).toBeNull(); // parallel, outside
  });
});

describe('slideMoveVoxel — Corporeal collision', () => {
  it('clamps to the plot AABB', () => {
    const g = createEmptyPlot();
    const pos = { x: 0, z: 0 };
    slideMoveVoxel(pos, 999, -999, 0.35, g);
    expect(pos.x).toBeCloseTo(PLOT_HALF_X - 0.35);
    expect(pos.z).toBeCloseTo(-(PLOT_HALF_Z - 0.35));
  });

  it('solid voxel blocks the axis but allows sliding along it', () => {
    const g = createEmptyPlot();
    setVoxel(g, 12, 0, 12, 1); // local cell spans x [0,1), z [0,1)
    const pos = { x: -0.6, z: 0.5 }; // just west of the block, aligned in z
    slideMoveVoxel(pos, 0.5, 0.5, 0.35, g); // try to move into the block
    expect(pos.x).toBeCloseTo(-0.6); // x blocked
    // Sliding north-south still works from the blocked spot.
    slideMoveVoxel(pos, pos.x, 2.5, 0.35, g);
    expect(pos.z).toBeCloseTo(2.5);
  });

  it('body-height blocks stop movement even above the feet layer', () => {
    const g = createEmptyPlot();
    setVoxel(g, 12, 1, 12, 1); // floating at torso height
    const pos = { x: -0.6, z: 0.5 };
    slideMoveVoxel(pos, 0.5, 0.5, 0.35, g);
    expect(pos.x).toBeCloseTo(-0.6);
  });

  it('blocks above head height do not collide', () => {
    const g = createEmptyPlot();
    setVoxel(g, 12, 3, 12, 1); // above the 2-layer body
    const pos = { x: -0.6, z: 0.5 };
    slideMoveVoxel(pos, 0.5, 0.5, 0.35, g);
    expect(pos.x).toBeCloseTo(0.5);
  });
});
