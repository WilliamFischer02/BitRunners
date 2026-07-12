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
// ray. Surface crossings (air→solid) are collected in ray order; the
// selection-depth slider indexes into them (depth 0 = nearest surface).
// Falls back to the pad plane (y=0) so an empty plot is still buildable.
// Runs on pointer events only — never per frame — so its small allocations
// are fine.

import {
  BoxGeometry,
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

export class PlotArena {
  readonly group = new Group();
  blocks: Uint8Array;

  private readonly typeMeshes: InstancedMesh[] = [];
  private readonly cursorMesh: Mesh;
  private readonly cursorEdges: LineSegments;
  private readonly cursorFillMat: MeshStandardMaterial;
  private readonly cursorEdgeMat: LineBasicMaterial;
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
    const cubeGeo = new BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE);
    this.disposables.push(cubeGeo);
    for (const def of VOXEL_BLOCKS) {
      const mat = new MeshStandardMaterial({
        color: def.color,
        roughness: def.roughness,
        metalness: def.metalness,
      });
      if (def.emissive !== 0) {
        mat.emissive.setHex(def.emissive);
        mat.emissiveIntensity = def.emissiveIntensity;
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

    // Voxel cursor: translucent cell + bright edges, recolored per tool.
    const curGeo = new BoxGeometry(VOXEL_SIZE * 1.02, VOXEL_SIZE * 1.02, VOXEL_SIZE * 1.02);
    this.cursorFillMat = new MeshStandardMaterial({
      color: 0x0a1a12,
      emissive: 0x7effc0,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });
    this.cursorMesh = new Mesh(curGeo, this.cursorFillMat);
    const curEdgeGeo = new EdgesGeometry(curGeo);
    this.cursorEdgeMat = new LineBasicMaterial({ color: 0x7effc0 });
    this.cursorEdges = new LineSegments(curEdgeGeo, this.cursorEdgeMat);
    this.cursorMesh.visible = false;
    this.cursorEdges.visible = false;
    this.group.add(this.cursorMesh, this.cursorEdges);
    this.disposables.push(curGeo, curEdgeGeo, this.cursorFillMat, this.cursorEdgeMat);
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

  /** Show the voxel cursor on a cell. Mint = place, ember = erase. */
  showCursor(cell: VoxelCell, erasing: boolean): void {
    const color = erasing ? 0xff9c6b : 0x7effc0;
    this.cursorFillMat.emissive.setHex(color);
    this.cursorEdgeMat.color.setHex(color);
    const cx = (cell.x + 0.5) * VOXEL_SIZE - PLOT_HALF_X;
    const cy = (cell.y + 0.5) * VOXEL_SIZE;
    const cz = (cell.z + 0.5) * VOXEL_SIZE - PLOT_HALF_Z;
    this.cursorMesh.position.set(cx, cy, cz);
    this.cursorEdges.position.set(cx, cy, cz);
    this.cursorMesh.visible = true;
    this.cursorEdges.visible = true;
  }

  hideCursor(): void {
    this.cursorMesh.visible = false;
    this.cursorEdges.visible = false;
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
  }
}

// ── Picking ────────────────────────────────────────────────────────────────

/**
 * Walk the pointer ray through the grid and resolve the depth-selected
 * surface. Inputs are LOCAL to the arena group (caller subtracts the group's
 * world position — the group never rotates/scales).
 *
 * depth counts air→solid surface crossings along the ray (0 = nearest). When
 * the ray crosses fewer surfaces than requested, the deepest one wins
 * (friendlier than a dead slider). With no solid crossing at all, the pad
 * plane (y=0) provides a placement cell.
 */
export function pickVoxel(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  blocks: Uint8Array,
  depth: number,
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
  let hitCount = 0;
  let best: VoxelPick | null = null;
  const spanLimit = tMax - tStart;
  let traveled = 0;
  const wantDepth = Math.max(0, Math.floor(depth));

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
        best = { erase: { x: cx, y: cy, z: cz }, place };
        if (hitCount === wantDepth) return best;
        hitCount++;
        // Deeper requested: keep walking; `best` stays the deepest so far.
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

  if (best) return best; // deepest surface when the slider over-reaches
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
