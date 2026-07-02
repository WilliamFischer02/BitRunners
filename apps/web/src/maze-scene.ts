// core_run — three.js arena builder (mega-batch 2 · 4.5).
//
// Turns a pure MazeGrid (maze-core.ts) into a group of meshes + wall colliders
// for the scene's maze mode. Walls are one InstancedMesh (cheap). The shrinking
// "dissolve into raw data" is four dark void slabs that grow inward as rings
// dissolve; the collision bound shrinks with them. No second WebGL context —
// scene.ts adds this group to its existing scene and renders it in the main
// pass (default layer 0, so the rig's character pass ignores it).

import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
} from 'three';
import type { BoxCollider } from './colliders.js';
import type { Dir, MazeGrid } from './maze-core.js';

export const MAZE_CELL = 1.8; // world units per maze cell (wide, easy-to-walk alleys)
const WALL_T = 0.18; // wall thickness (thin walls → wide walkable corridors)
const WALL_H = 1.35; // wall height

interface WallSpec {
  x: number;
  z: number;
  hx: number;
  hz: number;
}

export class MazeArena {
  readonly group = new Group();
  readonly colliders: BoxCollider[] = [];
  readonly entranceWorld: { x: number; z: number };
  readonly centerWorld: { x: number; z: number };

  private readonly size: number;
  private readonly off: number;
  private readonly voidSlabs: Mesh[] = [];
  private readonly disposables: Array<{ dispose(): void }> = [];

  constructor(private readonly grid: MazeGrid) {
    this.size = grid.size;
    this.off = ((grid.size - 1) / 2) * MAZE_CELL;
    this.entranceWorld = this.cellToWorld(grid.entrance.x, grid.entrance.y);
    this.centerWorld = this.cellToWorld(grid.center.x, grid.center.y);
    this.buildFloor();
    this.buildWalls();
    this.buildGoal();
    this.buildVoidSlabs();
  }

  cellToWorld(cx: number, cy: number): { x: number; z: number } {
    return { x: cx * MAZE_CELL - this.off, z: cy * MAZE_CELL - this.off };
  }

  worldToCell(x: number, z: number): { cx: number; cy: number } {
    const clamp = (v: number): number => Math.max(0, Math.min(this.size - 1, v));
    return {
      cx: clamp(Math.round((x + this.off) / MAZE_CELL)),
      cy: clamp(Math.round((z + this.off) / MAZE_CELL)),
    };
  }

  /** World-space [min, max] the player may occupy after `rings` have dissolved
   *  (square, both axes). Caller insets by the player radius. */
  playableBound(rings: number): { min: number; max: number } {
    const lo = Math.min(rings, (this.size - 1) / 2);
    const hi = this.size - 1 - lo;
    return {
      min: this.cellToWorld(lo, lo).x - MAZE_CELL / 2,
      max: this.cellToWorld(hi, hi).x + MAZE_CELL / 2,
    };
  }

  /** True if a world position sits in a ring that has already dissolved. */
  isInVoid(x: number, z: number, rings: number): boolean {
    const { cx, cy } = this.worldToCell(x, z);
    const border = Math.min(cx, cy, this.size - 1 - cx, this.size - 1 - cy);
    return border < rings;
  }

  private buildFloor(): void {
    const span = this.size * MAZE_CELL;
    const geo = new PlaneGeometry(span, span);
    const mat = new MeshStandardMaterial({ color: 0x0c1416, roughness: 0.95, metalness: 0.05 });
    const floor = new Mesh(geo, mat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    this.group.add(floor);
    this.disposables.push(geo, mat);
  }

  private buildWalls(): void {
    const specs: WallSpec[] = [];
    const cells = this.grid.cells;
    const size = this.size;
    for (let y = 0; y < size; y++) {
      const row = cells[y] as MazeGrid['cells'][number];
      for (let x = 0; x < size; x++) {
        const walls = (row[x] as { walls: [boolean, boolean, boolean, boolean] }).walls;
        const c = this.cellToWorld(x, y);
        const nWall = (d: Dir): boolean => walls[d];
        if (nWall(0))
          specs.push({ x: c.x, z: c.z - MAZE_CELL / 2, hx: MAZE_CELL / 2, hz: WALL_T / 2 });
        if (nWall(3))
          specs.push({ x: c.x - MAZE_CELL / 2, z: c.z, hx: WALL_T / 2, hz: MAZE_CELL / 2 });
        if (x === size - 1 && nWall(1))
          specs.push({ x: c.x + MAZE_CELL / 2, z: c.z, hx: WALL_T / 2, hz: MAZE_CELL / 2 });
        if (y === size - 1 && nWall(2))
          specs.push({ x: c.x, z: c.z + MAZE_CELL / 2, hx: MAZE_CELL / 2, hz: WALL_T / 2 });
      }
    }
    const geo = new BoxGeometry(1, 1, 1);
    const mat = new MeshStandardMaterial({
      color: 0x39506a,
      roughness: 0.7,
      metalness: 0.1,
      emissive: 0x0a1420,
      emissiveIntensity: 0.6,
    });
    const inst = new InstancedMesh(geo, mat, specs.length);
    const m = new Matrix4();
    for (let i = 0; i < specs.length; i++) {
      const s = specs[i] as WallSpec;
      m.makeScale(s.hx * 2 + WALL_T, WALL_H, s.hz * 2 + WALL_T);
      m.setPosition(s.x, WALL_H / 2, s.z);
      inst.setMatrixAt(i, m);
      this.colliders.push({ x: s.x, z: s.z, hx: s.hx, hz: s.hz });
    }
    inst.instanceMatrix.needsUpdate = true;
    this.group.add(inst);
    this.disposables.push(geo, mat, inst);
  }

  private buildGoal(): void {
    const geo = new CylinderGeometry(MAZE_CELL * 0.28, MAZE_CELL * 0.28, WALL_H * 1.6, 6);
    const mat = new MeshStandardMaterial({
      color: 0x1a0f2a,
      emissive: 0xb07cff,
      emissiveIntensity: 1.4,
      roughness: 0.4,
    });
    const beam = new Mesh(geo, mat);
    beam.position.set(this.centerWorld.x, WALL_H * 0.8, this.centerWorld.z);
    this.group.add(beam);
    this.disposables.push(geo, mat);
  }

  private buildVoidSlabs(): void {
    // Four slabs framing the border; hidden until dissolve. Bright, hot-magenta
    // "raw data storm" walls that TOWER over the maze (height 2.6×) so the
    // player plainly sees the storm closing in from the edges. Repositioned per
    // dissolveTo(). The ASCII post-process renders the bright emissive as dense
    // scrambled glyphs.
    const geo = new BoxGeometry(1, 1, 1);
    const mat = new MeshStandardMaterial({
      color: 0x2a0a1a,
      emissive: 0xff2a6a,
      emissiveIntensity: 1.35,
      roughness: 0.8,
    });
    for (let i = 0; i < 4; i++) {
      const slab = new Mesh(geo, mat);
      slab.visible = false;
      this.voidSlabs.push(slab);
      this.group.add(slab);
    }
    this.disposables.push(geo, mat);
  }

  /** Grow the void frame to swallow the outer `rings` cells. */
  dissolveTo(rings: number): void {
    if (rings <= 0) {
      for (const s of this.voidSlabs) s.visible = false;
      return;
    }
    const fullMin = -this.off - MAZE_CELL / 2;
    const fullMax = this.off + MAZE_CELL / 2;
    const bound = this.playableBound(rings);
    const full = fullMax - fullMin;
    const h = WALL_H * 2.6; // tower well above the maze walls
    const y = h / 2;
    const place = (
      slab: Mesh | undefined,
      cx: number,
      cz: number,
      sx: number,
      sz: number,
    ): void => {
      if (!slab || sx <= 0 || sz <= 0) {
        if (slab) slab.visible = false;
        return;
      }
      slab.visible = true;
      slab.scale.set(sx, h, sz);
      slab.position.set(cx, y, cz);
    };
    const midX = (fullMin + fullMax) / 2;
    // North (−z) band, South (+z) band span the full width; East/West bands
    // fill the remaining height between them.
    place(this.voidSlabs[0], midX, (fullMin + bound.min) / 2, full, bound.min - fullMin);
    place(this.voidSlabs[1], midX, (bound.max + fullMax) / 2, full, fullMax - bound.max);
    const midInner = (bound.min + bound.max) / 2;
    const innerH = bound.max - bound.min;
    place(this.voidSlabs[2], (fullMin + bound.min) / 2, midInner, bound.min - fullMin, innerH);
    place(this.voidSlabs[3], (bound.max + fullMax) / 2, midInner, fullMax - bound.max, innerH);
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.group.clear();
  }
}
