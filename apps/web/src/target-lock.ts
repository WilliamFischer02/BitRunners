// Tap-to-lock target selection + glow. Mobile-safe by design: no OutlinePass
// or other post-process pass (iOS-fragile per devlog 0008). The glow is
// applied directly on the target's `MeshStandardMaterial` emissiveIntensity
// (pulsed each frame) and a halo torus added as a child of the target group.
// Release restores every original emissiveIntensity exactly.

import {
  type Camera,
  type Group,
  Mesh,
  MeshStandardMaterial,
  Raycaster,
  TorusGeometry,
  Vector2,
} from 'three';

export interface LockedTarget {
  id: string;
  group: Group;
  /** Original emissiveIntensity captured per unique material so release restores exactly. */
  pulseMats: Map<MeshStandardMaterial, number>;
  halo: Mesh;
}

/** Lockable avatar — matches `RemoteAvatar.group` in scene.ts. */
export interface Lockable {
  group: Group;
}

const ndc = new Vector2();

export function createTargetRaycaster(): Raycaster {
  return new Raycaster();
}

/**
 * Pick the closest avatar group hit by a tap (NDC coords). Returns null if
 * the tap missed every candidate. Iterates the candidates and runs a recursive
 * intersect against each group — cheap at the dozens-of-entities scale a
 * sphere holds.
 */
export function pickAvatar(
  raycaster: Raycaster,
  camera: Camera,
  ndcX: number,
  ndcY: number,
  candidates: ReadonlyMap<string, Lockable>,
): { id: string; group: Group } | null {
  ndc.set(ndcX, ndcY);
  raycaster.setFromCamera(ndc, camera);
  let bestDist = Number.POSITIVE_INFINITY;
  let bestId: string | null = null;
  let bestGroup: Group | null = null;
  for (const [id, ra] of candidates) {
    const hits = raycaster.intersectObject(ra.group, true);
    const first = hits[0];
    if (!first) continue;
    if (first.distance < bestDist) {
      bestDist = first.distance;
      bestId = id;
      bestGroup = ra.group;
    }
  }
  return bestId && bestGroup ? { id: bestId, group: bestGroup } : null;
}

/**
 * Lock onto a target: snapshot every unique MeshStandardMaterial's
 * emissiveIntensity (so release can restore exactly), then add a halo torus
 * above the head. Returns the lock state for the tick + release to use.
 */
export function applyLock(id: string, group: Group): LockedTarget {
  const pulseMats = new Map<MeshStandardMaterial, number>();
  group.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    const m = obj.material;
    if (m instanceof MeshStandardMaterial && !pulseMats.has(m)) {
      pulseMats.set(m, m.emissiveIntensity);
    }
  });
  const haloMat = new MeshStandardMaterial({
    color: 0xd4b86a,
    emissive: 0xffd97a,
    emissiveIntensity: 1.9,
    transparent: true,
    opacity: 0.85,
  });
  const halo = new Mesh(new TorusGeometry(0.42, 0.04, 8, 24), haloMat);
  halo.position.y = 2.1;
  halo.rotation.x = Math.PI / 2;
  group.add(halo);
  return { id, group, pulseMats, halo };
}

/** Restore every captured material; remove + dispose the halo. */
export function releaseLock(lock: LockedTarget): void {
  for (const [m, orig] of lock.pulseMats) m.emissiveIntensity = orig;
  lock.group.remove(lock.halo);
  lock.halo.geometry.dispose();
  (lock.halo.material as MeshStandardMaterial).dispose();
}

/** Per-frame glow: pulse the captured materials + slowly spin the halo. */
export function tickLock(lock: LockedTarget, elapsed: number): void {
  // 0..1 pulse; emissive scales 1.0..~1.7 of original.
  const pulse = 1 + 0.7 * ((Math.sin(elapsed * 5) + 1) * 0.5);
  for (const [m, orig] of lock.pulseMats) m.emissiveIntensity = orig * pulse;
  lock.halo.rotation.y = elapsed * 2;
}
