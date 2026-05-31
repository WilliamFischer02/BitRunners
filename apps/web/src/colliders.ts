// Obstacle collision for the local player. The world is a torus, so collider
// distance is measured via wrapDelta — an obstacle near the seam still blocks
// across the wrap. Movement uses axis-separated slide: try the X step first,
// then the Z step against the resolved X; reject whichever axis overlaps any
// collider. This is the classic, cheap "slide along walls" that doesn't need
// a physics engine.
//
// Mutates a Vector3 in place; allocation-free per call.

import { PLATFORM_HALF, PLATFORM_SIZE } from '@bitrunners/shared';
import type { Vector3 } from 'three';

export interface BoxCollider {
  /** Centre x (world coords). */
  x: number;
  /** Centre z (world coords). */
  z: number;
  /** Half-extent on x. */
  hx: number;
  /** Half-extent on z. */
  hz: number;
}

function wrapDelta(d: number): number {
  return ((((d + PLATFORM_HALF) % PLATFORM_SIZE) + PLATFORM_SIZE) % PLATFORM_SIZE) - PLATFORM_HALF;
}

function blocked(cx: number, cz: number, r: number, cs: readonly BoxCollider[]): boolean {
  const r2 = r * r;
  for (const c of cs) {
    const dx = Math.max(Math.abs(wrapDelta(cx - c.x)) - c.hx, 0);
    const dz = Math.max(Math.abs(wrapDelta(cz - c.z)) - c.hz, 0);
    if (dx * dx + dz * dz < r2) return true;
  }
  return false;
}

/**
 * Try to move the position toward (nextX, nextZ); reject the X step if it
 * would overlap any collider, then the Z step against the resolved X. Pos is
 * mutated in place; no allocations.
 */
export function slideMoveInto(
  pos: Vector3,
  nextX: number,
  nextZ: number,
  r: number,
  cs: readonly BoxCollider[],
): void {
  const resolvedX = blocked(nextX, pos.z, r, cs) ? pos.x : nextX;
  const resolvedZ = blocked(resolvedX, nextZ, r, cs) ? pos.z : nextZ;
  pos.x = resolvedX;
  pos.z = resolvedZ;
}
