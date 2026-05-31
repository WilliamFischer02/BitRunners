// Pet primitive shapes + per-pet movement behaviours. Each pet has a distinct
// silhouette AND a distinct motion character — extracted from scene.ts so the
// tick loop can stay terse and so adding a new pet later only touches one
// file. No per-frame allocations: every behaviour mutates the existing anchor
// and mesh in place.

import {
  BoxGeometry,
  type BufferGeometry,
  ConeGeometry,
  type Group,
  IcosahedronGeometry,
  type Mesh,
  OctahedronGeometry,
  SphereGeometry,
  TetrahedronGeometry,
  TorusGeometry,
} from 'three';

/** Distinct primitive per equipped pet so they don't all look like a box. */
export function petGeometryFor(itemId: string): BufferGeometry {
  switch (itemId) {
    case 'pet.byte_pup':
      return new SphereGeometry(0.1, 12, 8);
    case 'pet.glint_drone':
      return new OctahedronGeometry(0.12);
    case 'pet.null_kit':
      return new TetrahedronGeometry(0.13);
    case 'pet.spark':
      return new ConeGeometry(0.08, 0.22, 6);
    case 'pet.mote_ultra':
      return new IcosahedronGeometry(0.12);
    case 'pet.token_seraph':
      return new TorusGeometry(0.09, 0.035, 8, 16);
    default:
      return new BoxGeometry(0.14, 0.14, 0.14);
  }
}

/**
 * Per-pet movement behaviour. Each branch mutates `anchor.rotation` (the orbit)
 * and `mesh.{position,rotation,scale}` (the pet's local motion) in place; no
 * allocations.
 *
 * Behaviour vocabulary:
 *   byte_pup     – bouncy short hops, fast orbit
 *   glint_drone  – steady mid orbit, self-rotation
 *   null_kit     – irregular tumble on all three axes
 *   spark        – quick darting: orbit radius wobbles in/out
 *   mote_ultra   – wide slow arc, gentle breathing scale
 *   token_seraph – flat halo, fast self-spin, slow drift
 *   (default)    – fixed orbit + soft bob (the prior shipped behaviour)
 */
export function applyPetBehaviour(
  itemId: string | null,
  anchor: Group,
  mesh: Mesh,
  elapsed: number,
): void {
  switch (itemId) {
    case 'pet.byte_pup':
      anchor.rotation.y = elapsed * 1.2;
      mesh.position.y = Math.abs(Math.sin(elapsed * 6)) * 0.14;
      return;
    case 'pet.glint_drone':
      anchor.rotation.y = elapsed * 0.7;
      mesh.rotation.y = elapsed * 1.5;
      mesh.position.y = Math.sin(elapsed * 0.9) * 0.04;
      return;
    case 'pet.null_kit':
      anchor.rotation.y = elapsed * 0.4;
      mesh.rotation.set(elapsed * 2.3, elapsed * 1.7, elapsed * 1.1);
      mesh.position.y = Math.sin(elapsed * 1.8) * 0.06;
      return;
    case 'pet.spark':
      anchor.rotation.y = elapsed * 1.1;
      mesh.position.x = 0.45 + Math.sin(elapsed * 5) * 0.15;
      mesh.position.y = Math.sin(elapsed * 3.7) * 0.08;
      mesh.rotation.x = Math.sin(elapsed * 5) * 0.3;
      return;
    case 'pet.mote_ultra':
      anchor.rotation.y = elapsed * 0.35;
      mesh.position.y = Math.sin(elapsed * 0.6) * 0.12;
      mesh.scale.setScalar(1 + Math.sin(elapsed * 0.8) * 0.05);
      return;
    case 'pet.token_seraph':
      anchor.rotation.y = elapsed * 0.6;
      mesh.rotation.x = Math.PI / 2;
      mesh.rotation.y = elapsed * 4;
      mesh.position.y = Math.sin(elapsed * 1.2) * 0.04;
      return;
    default:
      anchor.rotation.y = elapsed * 0.8;
      mesh.position.y = Math.sin(elapsed * 2.2) * 0.05;
  }
}
