// data_base — pure voxel-plot data model + palette-indexed RLE codec (P7).
//
// A plot is a fixed 24×16×24 grid of block ids stored in a flat Uint8Array:
// index = x + z*W + y*W*D (x fastest, then z, then y — matches the launch
// brief and keeps whole horizontal layers contiguous, which RLE loves: an
// empty sky is one run). Block id 0 is air; 1–5 are the launch palette.
//
// The codec is the persistence wire for BOTH localStorage (guests) and the
// save_voxel_plot RPC (accounts, migration 0019): runs of [count, blockId]
// flattened into a plain number[] inside a small versioned envelope. A
// typical build is well under 2 KB; the theoretical worst case (alternating
// blocks) is 2×9216 numbers, still far under the RPC's 64 KB cap.
//
// React-free and three.js-free; the InstancedMesh renderer lives in
// voxel-scene.ts. Decoders NEVER throw on bad input — they return null so a
// corrupt blob degrades to a fresh pad, not a crash (never trust the wire).

export const PLOT_W = 24;
export const PLOT_H = 16;
export const PLOT_D = 24;
export const PLOT_VOLUME = PLOT_W * PLOT_H * PLOT_D; // 9216

/** Envelope version for persisted plots (localStorage + voxel_plots.blob). */
export const PLOT_FORMAT_VERSION = 1;

// Launch block palette. Id 0 = air (never rendered, never in the palette UI).
// Visual params are data-only descriptors — voxel-scene.ts turns them into
// shared MeshStandardMaterials (one per block type, module-level, per the
// material-sharing convention).
export const VOXEL_AIR = 0;

export interface VoxelBlockDef {
  id: number;
  key: string;
  /** Palette button label. */
  label: string;
  /** Base color (hex). Grayscale-leaning per the visual identity; neon_panel
   *  is the deliberate emissive exception (reads as glow through the ASCII
   *  pass via brightness). */
  color: number;
  roughness: number;
  metalness: number;
  /** Emissive color; 0 = none. */
  emissive: number;
  emissiveIntensity: number;
}

export const VOXEL_BLOCKS: readonly VoxelBlockDef[] = [
  {
    id: 1,
    key: 'concrete',
    label: 'concrete',
    color: 0x8a8a8a,
    roughness: 0.95,
    metalness: 0.0,
    emissive: 0,
    emissiveIntensity: 0,
  },
  {
    id: 2,
    key: 'neon_panel',
    label: 'neon_panel',
    color: 0x0e2a2c,
    roughness: 0.4,
    metalness: 0.1,
    emissive: 0x2ff5e0,
    emissiveIntensity: 1.6,
  },
  {
    id: 3,
    key: 'wood_frame',
    label: 'wood_frame',
    color: 0x9a7b52,
    roughness: 0.85,
    metalness: 0.0,
    emissive: 0,
    emissiveIntensity: 0,
  },
  {
    id: 4,
    key: 'metal_frame',
    label: 'metal_frame',
    color: 0xb8bec4,
    roughness: 0.35,
    metalness: 0.85,
    emissive: 0,
    emissiveIntensity: 0,
  },
  {
    id: 5,
    key: 'asphalt',
    label: 'asphalt',
    color: 0x3a3d40,
    roughness: 0.7,
    metalness: 0.15,
    emissive: 0,
    emissiveIntensity: 0,
  },
] as const;

export const MAX_BLOCK_ID = VOXEL_BLOCKS.length; // ids are 1..MAX_BLOCK_ID contiguous

export function isValidBlockId(id: number): boolean {
  return Number.isInteger(id) && id >= VOXEL_AIR && id <= MAX_BLOCK_ID;
}

/** Flat index for (x, y, z). Callers must bounds-check first (inBounds). */
export function voxelIndex(x: number, y: number, z: number): number {
  return x + z * PLOT_W + y * PLOT_W * PLOT_D;
}

export function inBounds(x: number, y: number, z: number): boolean {
  return x >= 0 && x < PLOT_W && y >= 0 && y < PLOT_H && z >= 0 && z < PLOT_D;
}

/** Safe read — out-of-bounds reads as air, so neighbour checks at the plot
 *  faces need no special-casing. */
export function getVoxel(blocks: Uint8Array, x: number, y: number, z: number): number {
  if (!inBounds(x, y, z)) return VOXEL_AIR;
  return blocks[voxelIndex(x, y, z)] ?? VOXEL_AIR;
}

/** Safe write. Returns true when the write changed the grid (drives the
 *  dirty flag for the debounced save + batched remesh). */
export function setVoxel(blocks: Uint8Array, x: number, y: number, z: number, id: number): boolean {
  if (!inBounds(x, y, z) || !isValidBlockId(id)) return false;
  const i = voxelIndex(x, y, z);
  if (blocks[i] === id) return false;
  blocks[i] = id;
  return true;
}

/** Fresh plot: all air. The plot pad (voxel-scene.ts) is the walkable floor;
 *  blocks build UP from it, so an empty grid is the correct blank canvas —
 *  a prefilled ground layer would read as a slab the Corporeal-mode player
 *  collides with. */
export function createEmptyPlot(): Uint8Array {
  return new Uint8Array(PLOT_VOLUME);
}

export function countBlocks(blocks: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < blocks.length; i++) if (blocks[i] !== VOXEL_AIR) n++;
  return n;
}

// ── RLE codec ──────────────────────────────────────────────────────────────

/** Encode to flat runs [count, id, count, id, …]. Total counts always sum to
 *  PLOT_VOLUME, which the decoder verifies. */
export function encodePlotRuns(blocks: Uint8Array): number[] {
  const runs: number[] = [];
  if (blocks.length !== PLOT_VOLUME) return runs;
  let runId = blocks[0] ?? VOXEL_AIR;
  let runLen = 1;
  for (let i = 1; i < PLOT_VOLUME; i++) {
    const id = blocks[i] ?? VOXEL_AIR;
    if (id === runId) {
      runLen++;
    } else {
      runs.push(runLen, runId);
      runId = id;
      runLen = 1;
    }
  }
  runs.push(runLen, runId);
  return runs;
}

/** Decode flat runs back to a grid. Returns null on ANY malformation:
 *  non-array, odd length, non-integer / non-positive counts, unknown block
 *  ids, or a total that isn't exactly PLOT_VOLUME. */
export function decodePlotRuns(runs: unknown): Uint8Array | null {
  if (!Array.isArray(runs)) return null;
  if (runs.length === 0 || runs.length % 2 !== 0) return null;
  // Worst case is one run per voxel — anything longer is malformed by pigeonhole.
  if (runs.length > PLOT_VOLUME * 2) return null;
  const blocks = createEmptyPlot();
  let cursor = 0;
  for (let i = 0; i < runs.length; i += 2) {
    const count = runs[i];
    const id = runs[i + 1];
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 1) return null;
    if (typeof id !== 'number' || !isValidBlockId(id)) return null;
    if (cursor + count > PLOT_VOLUME) return null;
    if (id !== VOXEL_AIR) blocks.fill(id, cursor, cursor + count);
    cursor += count;
  }
  if (cursor !== PLOT_VOLUME) return null;
  return blocks;
}

// ── Versioned envelope (localStorage value / RPC blob) ─────────────────────

export interface PlotBlobV1 {
  v: number;
  w: number;
  h: number;
  d: number;
  runs: number[];
}

export function encodePlotBlob(blocks: Uint8Array): PlotBlobV1 {
  return {
    v: PLOT_FORMAT_VERSION,
    w: PLOT_W,
    h: PLOT_H,
    d: PLOT_D,
    runs: encodePlotRuns(blocks),
  };
}

/** Decode a persisted envelope (already-parsed JSON). Strict v1: rejects
 *  unknown versions and mismatched dimensions — a future resize migration
 *  owns relaxing this. Returns null on anything malformed. */
export function decodePlotBlob(blob: unknown): Uint8Array | null {
  if (typeof blob !== 'object' || blob === null) return null;
  const b = blob as Partial<PlotBlobV1>;
  if (b.v !== PLOT_FORMAT_VERSION) return null;
  if (b.w !== PLOT_W || b.h !== PLOT_H || b.d !== PLOT_D) return null;
  return decodePlotRuns(b.runs);
}
