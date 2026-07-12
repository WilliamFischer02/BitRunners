// data_base — three.js plot arena (P7 Stage A). React-free; scene.ts owns the
// mode (enter/exit/tick) exactly like maze-scene.ts, and voxel-core.ts owns
// the data. This module renders a voxel grid and answers pointer picks.
//
// Rendering: ONE InstancedMesh per block type (5 total), each with capacity
// PLOT_VOLUME (9216). Worst case that's ~590 KB of instance matrices per
// type — acceptable, and it means a rebuild never reallocates. Rebuilds are
// requested via markDirty() and executed at most once per frame from
// update() (batched-per-frame per the perf house rules; a drag that edits 10
// voxels in one frame costs one rebuild).
//
// Picking: a 3D DDA (Amanatides–Woo) walk through the grid along the pointer
// ray. The NEAREST air→solid surface crossing wins (devlog 0156 removed the
// depth-selection slider): place lands on the face hit, erase removes the
// hit block. Falls back to the pad plane (y=0) so an empty plot is still
// buildable. Runs on pointer events only — never per frame — so its small
// allocations are fine.
//
// Block-face texturing (devlog 0156): every block material shares a tiny
// procedural canvas map with a dark frame on the face border, so adjacent
// blocks — same type or not — read separated. Chosen over per-block
// EdgesGeometry/LineSegments overlays: InstancedMesh can't batch line
// segments, so edge meshes would have cost one rebuild + draw call per
// block; the border map costs zero extra draw calls. wood_frame gets its
// own map with vertical grain stripes under the same frame.

import {
  BoxGeometry,
  CanvasTexture,
  DynamicDrawUsage,
  EdgesGeometry,
  GridHelper,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
} from 'three';
import {
  PLOT_D,
  PLOT_H,
  PLOT_VOLUME,
  PLOT_W,
  VOXEL_AIR,
  VOXEL_BLOCKS,
  getVoxel,
  inBounds,
} from './voxel-core.js';

/** World units per voxel. 1.0 makes a 2-block wall taller than the runner
 *  (~1.9 u) and the full pad 24×24 u — a hair smaller than the void room. */
export const VOXEL_SIZE = 1;

/** Plot half-extents in local/world units (pad is centered on the group). */
export const PLOT_HALF_X = (PLOT_W * VOXEL_SIZE) / 2;
export const PLOT_HALF_Z = (PLOT_D * VOXEL_SIZE) / 2;
export const PLOT_HEIGHT = PLOT_H * VOXEL_SIZE;

export interface VoxelCell {
  x: number;
  y: number;
  z: number;
}

export interface VoxelPick {
  /** Solid cell under the selected surface (eraser target); null when the
   *  pick landed on the bare pad. */
  erase: VoxelCell | null;
  /** Empty in-bounds cell in front of the selected surface (place target);
   *  null when the approach cell is out of bounds or occupied. */
  place: VoxelCell | null;
}

/** Local-space center of a voxel cell. */
export function cellCenter(
  x: number,
  y: number,
  z: number,
  out: { x: number; y: number; z: number },
): void {
  out.x = (x + 0.5) * VOXEL_SIZE - PLOT_HALF_X;
  out.y = (y + 0.5) * VOXEL_SIZE;
  out.z = (z + 0.5) * VOXEL_SIZE - PLOT_HALF_Z;
}

// ── Block-face textures (devlog 0156) ──────────────────────────────────────
// Module-lifetime singletons (a few KB of canvas each, shared by every
// PlotArena — same convention as the glyph atlases; never disposed). Both
// are near-white so the material `color` supplies the hue: as a `map` the
// texture multiplies base color, and as an `emissiveMap` it multiplies the
// glow, so the dark frame reads on emissive blocks (neon_panel) too.

const FACE_TEX_SIZE = 64;
const FACE_FRAME_PX = 3; // ≈ semi-bold border at typical RegEdit zoom

function makeFaceTexture(draw: (ctx: CanvasRenderingContext2D) => void): CanvasTexture | null {
  if (typeof document === 'undefined') return null; // node/vitest — untextured
  const canvas = document.createElement('canvas');
  canvas.width = FACE_TEX_SIZE;
  canvas.height = FACE_TEX_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null; // jsdom without canvas — untextured
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, FACE_TEX_SIZE, FACE_TEX_SIZE);
  draw(ctx);
  // Dark frame on the face border — per-block edge separation.
  ctx.strokeStyle = 'rgba(16, 20, 24, 0.88)';
  ctx.lineWidth = FACE_FRAME_PX * 2; // stroke straddles the edge: half lands inside
  ctx.strokeRect(0, 0, FACE_TEX_SIZE, FACE_TEX_SIZE);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

let faceTextures: { border: CanvasTexture | null; wood: CanvasTexture | null } | null = null;

function getFaceTextures(): NonNullable<typeof faceTextures> {
  if (!faceTextures) {
    faceTextures = {
      border: makeFaceTexture(() => {
        // frame only
      }),
      wood: makeFaceTexture((ctx) => {
        // Vertical grain: deterministic pseudo-random columns of varying
        // width/brightness (grayscale so the light-brown base hue holds).
        let x = 0;
        let seed = 0x9e37;
        const rand = (): number => {
          seed = (seed * 1103515245 + 12345) & 0x7fffffff;
          return seed / 0x7fffffff;
        };
        while (x < FACE_TEX_SIZE) {
          const w = 2 + Math.floor(rand() * 5);
          const shade = 176 + Math.floor(rand() * 70);
          ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
          ctx.fillRect(x, 0, w, FACE_TEX_SIZE);
          x += w;
        }
      }),
    };
  }
  return faceTextures;
}

export class PlotArena {
  readonly group = new Group();
  blocks: Uint8Array;

  private readonly typeMeshes: InstancedMesh[] = [];
  private readonly disposables: Array<{ dispose(): void }> = [];
  private dirty = true;
  private readonly scratchMat = new Matrix4();

  constructor(blocks: Uint8Array) {
    this.blocks = blocks;

    // Pad: a thin slab whose TOP face is local y=0 — the Corporeal floor.
    const padGeo = new BoxGeometry(PLOT_W * VOXEL_SIZE + 0.6, 0.3, PLOT_D * VOXEL_SIZE + 0.6);
    const padMat = new MeshStandardMaterial({ color: 0x22262b, roughness: 0.9, metalness: 0.1 });
    const pad = new Mesh(padGeo, padMat);
    pad.position.y = -0.15;
    this.group.add(pad);
    this.disposables.push(padGeo, padMat);

    // Cell grid on the pad surface so RegEdit placement reads at a glance.
    const grid = new GridHelper(PLOT_W * VOXEL_SIZE, PLOT_W, 0x3a4a44, 0x232d29);
    grid.position.y = 0.01;
    this.group.add(grid);
    this.disposables.push(grid.geometry, grid.material as LineBasicMaterial);

    // Faint wireframe of the buildable volume.
    const boundsGeo = new EdgesGeometry(
      new BoxGeometry(PLOT_W * VOXEL_SIZE, PLOT_HEIGHT, PLOT_D * VOXEL_SIZE),
    );
    const boundsMat = new LineBasicMaterial({ color: 0x2a3340, transparent: true, opacity: 0.5 });
    const bounds = new LineSegments(boundsGeo, boundsMat);
    bounds.position.y = PLOT_HEIGHT / 2;
    this.group.add(bounds);
    this.disposables.push(boundsGeo, boundsMat);

    // One InstancedMesh per launch block type, shared unit-cube geometry.
    // Every material carries the shared border map (+ grain for wood) so
    // block faces read separated — see the texture note at the top.
    const cubeGeo = new BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE);
    this.disposables.push(cubeGeo);
    const { border, wood } = getFaceTextures();
    for (const def of VOXEL_BLOCKS) {
      const mat = new MeshStandardMaterial({
        color: def.color,
        roughness: def.roughness,
        metalness: def.metalness,
      });
      const tex = def.key === 'wood_frame' ? (wood ?? border) : border;
      if (tex) mat.map = tex;
      if (def.emissive !== 0) {
        mat.emissive.setHex(def.emissive);
        mat.emissiveIntensity = def.emissiveIntensity;
        // Frame darkens the glow too, else the border drowns in emissive.
        if (tex) mat.emissiveMap = tex;
      }
      const mesh = new InstancedMesh(cubeGeo, mat, PLOT_VOLUME);
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.count = 0;
      // Instance bounds churn on every edit; the plot is small — skip culling.
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.typeMeshes.push(mesh);
      this.disposables.push(mat, mesh);
    }
  }

  /** Swap the backing grid (store reload) and force a remesh. */
  setBlocks(blocks: Uint8Array): void {
    this.blocks = blocks;
    this.dirty = true;
  }

  markDirty(): void {
    this.dirty = true;
  }

  /** Per-frame hook — rebuilds instance matrices only when edits happened. */
  update(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.rebuild();
  }

  private rebuild(): void {
    const counts = new Array<number>(this.typeMeshes.length).fill(0);
    const m = this.scratchMat;
    let i = 0;
    for (let y = 0; y < PLOT_H; y++) {
      for (let z = 0; z < PLOT_D; z++) {
        for (let x = 0; x < PLOT_W; x++, i++) {
          const id = this.blocks[i] ?? VOXEL_AIR;
          if (id === VOXEL_AIR) continue;
          const mesh = this.typeMeshes[id - 1];
          const slot = counts[id - 1];
          if (!mesh || slot === undefined) continue;
          m.makeTranslation(
            (x + 0.5) * VOXEL_SIZE - PLOT_HALF_X,
            (y + 0.5) * VOXEL_SIZE,
            (z + 0.5) * VOXEL_SIZE - PLOT_HALF_Z,
          );
          mesh.setMatrixAt(slot, m);
          counts[id - 1] = slot + 1;
        }
      }
    }
    for (let t = 0; t < this.typeMeshes.length; t++) {
      const mesh = this.typeMeshes[t];
      if (!mesh) continue;
      mesh.count = counts[t] ?? 0;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
  }
}

// ── Picking ────────────────────────────────────────────────────────────────

/**
 * Walk the pointer ray through the grid and resolve the NEAREST air→solid
 * surface (devlog 0156 dropped the depth slider — placement targets purely
 * what the ray hits: place lands on the face hit, erase removes the hit
 * block). Inputs are LOCAL to the arena group (caller subtracts the group's
 * world position — the group never rotates/scales). With no solid crossing
 * at all, the pad plane (y=0) provides a placement cell.
 */
export function pickVoxel(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  blocks: Uint8Array,
): VoxelPick | null {
  // Grid space: cell (x,y,z) spans [x,x+1)×[y,y+1)×[z,z+1).
  let gx = (ox + PLOT_HALF_X) / VOXEL_SIZE;
  let gy = oy / VOXEL_SIZE;
  let gz = (oz + PLOT_HALF_Z) / VOXEL_SIZE;

  // Clip the ray to the grid AABB (slab method) so DDA starts inside.
  let tMin = 0;
  let tMax = Number.POSITIVE_INFINITY;
  const axes: Array<[number, number, number]> = [
    [gx, dx, PLOT_W],
    [gy, dy, PLOT_H],
    [gz, dz, PLOT_D],
  ];
  for (const [o, d, size] of axes) {
    if (Math.abs(d) < 1e-9) {
      if (o < 0 || o > size) return null;
    } else {
      let t0 = (0 - o) / d;
      let t1 = (size - o) / d;
      if (t0 > t1) {
        const tmp = t0;
        t0 = t1;
        t1 = tmp;
      }
      tMin = Math.max(tMin, t0);
      tMax = Math.min(tMax, t1);
    }
  }
  if (tMax < tMin) return null;

  // Pad-plane fallback t (top of the pad = grid y 0), only when descending.
  let padT = -1;
  if (dy < -1e-9) {
    const t = (0 - gy) / dy;
    if (t >= 0) {
      const px = gx + dx * t;
      const pz = gz + dz * t;
      if (px >= 0 && px < PLOT_W && pz >= 0 && pz < PLOT_D) padT = t;
    }
  }

  // Enter the grid slightly inside the boundary to dodge face-exact seams.
  const tStart = tMin + 1e-6;
  gx += dx * tStart;
  gy += dy * tStart;
  gz += dz * tStart;

  let cx = Math.floor(gx);
  let cy = Math.floor(gy);
  let cz = Math.floor(gz);
  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  const stepZ = dz > 0 ? 1 : -1;
  const tDeltaX = Math.abs(dx) < 1e-9 ? Number.POSITIVE_INFINITY : Math.abs(1 / dx);
  const tDeltaY = Math.abs(dy) < 1e-9 ? Number.POSITIVE_INFINITY : Math.abs(1 / dy);
  const tDeltaZ = Math.abs(dz) < 1e-9 ? Number.POSITIVE_INFINITY : Math.abs(1 / dz);
  const frac = (v: number, step: number): number =>
    step > 0 ? Math.ceil(v) - v || 1 : v - Math.floor(v) || 1;
  let tNextX = tDeltaX === Number.POSITIVE_INFINITY ? tDeltaX : frac(gx, stepX) * tDeltaX;
  let tNextY = tDeltaY === Number.POSITIVE_INFINITY ? tDeltaY : frac(gy, stepY) * tDeltaY;
  let tNextZ = tDeltaZ === Number.POSITIVE_INFINITY ? tDeltaZ : frac(gz, stepZ) * tDeltaZ;

  let prevX = -1;
  let prevY = -1;
  let prevZ = -1;
  let hasPrev = false;
  const spanLimit = tMax - tStart;
  let traveled = 0;

  for (let steps = 0; steps < PLOT_W + PLOT_H + PLOT_D + 3; steps++) {
    if (!inBounds(cx, cy, cz)) break;
    if (getVoxel(blocks, cx, cy, cz) !== VOXEL_AIR) {
      // A crossing is air→solid only — a column of stacked solid cells along
      // the ray is ONE surface. Entry from outside the grid counts (no prev).
      const prevAir =
        !hasPrev || !inBounds(prevX, prevY, prevZ)
          ? true
          : getVoxel(blocks, prevX, prevY, prevZ) === VOXEL_AIR;
      if (prevAir) {
        const place =
          hasPrev &&
          inBounds(prevX, prevY, prevZ) &&
          getVoxel(blocks, prevX, prevY, prevZ) === VOXEL_AIR
            ? { x: prevX, y: prevY, z: prevZ }
            : null;
        return { erase: { x: cx, y: cy, z: cz }, place };
      }
    }
    prevX = cx;
    prevY = cy;
    prevZ = cz;
    hasPrev = true;
    if (tNextX <= tNextY && tNextX <= tNextZ) {
      traveled = tNextX;
      cx += stepX;
      tNextX += tDeltaX;
    } else if (tNextY <= tNextZ) {
      traveled = tNextY;
      cy += stepY;
      tNextY += tDeltaY;
    } else {
      traveled = tNextZ;
      cz += stepZ;
      tNextZ += tDeltaZ;
    }
    if (traveled > spanLimit) break;
  }

  if (padT >= 0) {
    const px = Math.floor(gx + dx * (padT - tStart));
    const pz = Math.floor(gz + dz * (padT - tStart));
    if (inBounds(px, 0, pz) && getVoxel(blocks, px, 0, pz) === VOXEL_AIR) {
      return { erase: null, place: { x: px, y: 0, z: pz } };
    }
  }
  return null;
}

// ── Corporeal-mode collision ───────────────────────────────────────────────

/** Body layers a standing runner occupies (feet + torso). A 1-block ledge
 *  still blocks — no step-up in v1. */
const BODY_LAYERS = 2;

function circleBlockedAt(blocks: Uint8Array, wx: number, wz: number, r: number): boolean {
  // wx/wz are already plot-local here (origin subtracted by the caller).
  const minX = Math.floor((wx - r + PLOT_HALF_X) / VOXEL_SIZE);
  const maxX = Math.floor((wx + r + PLOT_HALF_X) / VOXEL_SIZE);
  const minZ = Math.floor((wz - r + PLOT_HALF_Z) / VOXEL_SIZE);
  const maxZ = Math.floor((wz + r + PLOT_HALF_Z) / VOXEL_SIZE);
  for (let z = minZ; z <= maxZ; z++) {
    for (let x = minX; x <= maxX; x++) {
      for (let y = 0; y < BODY_LAYERS; y++) {
        if (getVoxel(blocks, x, y, z) !== VOXEL_AIR) {
          // Circle vs cell AABB in the XZ plane.
          const cxMin = x * VOXEL_SIZE - PLOT_HALF_X;
          const czMin = z * VOXEL_SIZE - PLOT_HALF_Z;
          const nx = Math.max(cxMin, Math.min(wx, cxMin + VOXEL_SIZE));
          const nz = Math.max(czMin, Math.min(wz, czMin + VOXEL_SIZE));
          const ddx = wx - nx;
          const ddz = wz - nz;
          if (ddx * ddx + ddz * ddz < r * r) return true;
        }
      }
    }
  }
  return false;
}

/** Axis-separated slide against solid voxels + the plot AABB, mirroring
 *  colliders.ts slideMoveInto. Mutates pos in place; allocation-free.
 *  originX/originZ = the arena group's world position (sky-grid slot, P7C)
 *  — pos/next are world coords, the grid math runs plot-local. */
export function slideMoveVoxel(
  pos: { x: number; z: number },
  nextX: number,
  nextZ: number,
  r: number,
  blocks: Uint8Array,
  originX = 0,
  originZ = 0,
): void {
  const loX = originX - PLOT_HALF_X + r;
  const hiX = originX + PLOT_HALF_X - r;
  const loZ = originZ - PLOT_HALF_Z + r;
  const hiZ = originZ + PLOT_HALF_Z - r;
  const cx = Math.max(loX, Math.min(hiX, nextX));
  const cz = Math.max(loZ, Math.min(hiZ, nextZ));
  if (!circleBlockedAt(blocks, cx - originX, pos.z - originZ, r)) pos.x = cx;
  if (!circleBlockedAt(blocks, pos.x - originX, cz - originZ, r)) pos.z = cz;
}
