// Server-side NPC ("dweller") avatars. Three archetypes, each a distinct
// silhouette. NPCs are non-animated on the client (the server drives their
// position + rotation via PlayerState); these are intentionally cheap shells —
// 6-10 meshes each, single shared limb geometries via class-rigs.ts module
// constants would be over-coupling, so we use modest inline primitives sized
// for the archetype.
//
// Archetypes are tagged on the server by setting PlayerState.className to one
// of the values in @bitrunners/shared's DWELLER_ARCHETYPES.

import {
  BoxGeometry,
  ConeGeometry,
  Group,
  Mesh as MeshClass,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three';

export type DwellerKind = 'dweller.robot' | 'dweller.husk' | 'dweller.spirit';

// ── dweller.robot — boxy industrial, single cyan visor strip, small antenna.
// Cool blue palette. Reads as "machine".
function buildRobot(): Group {
  const g = new Group();
  const armor = new MeshStandardMaterial({
    color: 0x6a8aa8,
    roughness: 0.55,
    metalness: 0.55,
    emissive: 0x182838,
    emissiveIntensity: 0.5,
  });
  const dark = new MeshStandardMaterial({
    color: 0x303a48,
    roughness: 0.7,
    metalness: 0.4,
  });
  const visorMat = new MeshStandardMaterial({
    color: 0x4080a0,
    roughness: 0.4,
    metalness: 0.5,
    emissive: 0x5cc8ff,
    emissiveIntensity: 1.6,
  });

  const head = new MeshClass(new BoxGeometry(0.38, 0.34, 0.34), armor);
  head.position.y = 1.58;
  g.add(head);
  const antenna = new MeshClass(new BoxGeometry(0.05, 0.18, 0.05), dark);
  antenna.position.set(0.1, 1.86, -0.06);
  g.add(antenna);
  const visor = new MeshClass(new BoxGeometry(0.4, 0.08, 0.04), visorMat);
  visor.position.set(0, 1.58, 0.19);
  g.add(visor);
  const torso = new MeshClass(new BoxGeometry(0.74, 0.78, 0.46), armor);
  torso.position.y = 0.98;
  g.add(torso);
  const stripe = new MeshClass(new BoxGeometry(0.1, 0.62, 0.04), visorMat);
  stripe.position.set(0, 0.98, 0.24);
  g.add(stripe);
  const belt = new MeshClass(new BoxGeometry(0.78, 0.08, 0.48), dark);
  belt.position.y = 0.62;
  g.add(belt);
  const legs = new MeshClass(new BoxGeometry(0.62, 0.6, 0.32), armor);
  legs.position.y = 0.32;
  g.add(legs);
  const boots = new MeshClass(new BoxGeometry(0.7, 0.12, 0.36), dark);
  boots.position.set(0, 0.06, 0.04);
  g.add(boots);
  return g;
}

// ── dweller.husk — hunched dark hollow, weathered. Reads as "decayed".
// Sphere head with faint dim glow; root tilted forward so they slump.
function buildHusk(): Group {
  const g = new Group();
  g.rotation.x = 0.14; // permanent slump
  const flesh = new MeshStandardMaterial({
    color: 0x303030,
    roughness: 0.95,
    metalness: 0.0,
    emissive: 0x100808,
    emissiveIntensity: 0.4,
  });
  const dark = new MeshStandardMaterial({
    color: 0x1c1c1c,
    roughness: 0.98,
    metalness: 0.0,
  });
  const ember = new MeshStandardMaterial({
    color: 0x60302a,
    roughness: 0.9,
    metalness: 0.0,
    emissive: 0xff5a30,
    emissiveIntensity: 1.0,
  });

  const head = new MeshClass(new SphereGeometry(0.3, 10, 8), flesh);
  head.position.y = 1.5;
  head.scale.set(0.95, 1.0, 0.92);
  g.add(head);
  // Sunken eye sockets — two small ember boxes.
  const eyeL = new MeshClass(new BoxGeometry(0.06, 0.06, 0.04), ember);
  eyeL.position.set(-0.09, 1.5, 0.22);
  g.add(eyeL);
  const eyeR = new MeshClass(new BoxGeometry(0.06, 0.06, 0.04), ember);
  eyeR.position.set(0.09, 1.5, 0.22);
  g.add(eyeR);
  // Slumped torso (slightly thinner than robot).
  const torso = new MeshClass(new BoxGeometry(0.66, 0.7, 0.42), flesh);
  torso.position.y = 0.92;
  g.add(torso);
  // Tattered hangs.
  const hangL = new MeshClass(new BoxGeometry(0.18, 0.36, 0.05), dark);
  hangL.position.set(-0.28, 0.78, 0.18);
  hangL.rotation.z = 0.18;
  g.add(hangL);
  const hangR = new MeshClass(new BoxGeometry(0.18, 0.36, 0.05), dark);
  hangR.position.set(0.28, 0.78, 0.18);
  hangR.rotation.z = -0.18;
  g.add(hangR);
  // Legs.
  const legs = new MeshClass(new BoxGeometry(0.6, 0.58, 0.3), flesh);
  legs.position.y = 0.32;
  g.add(legs);
  const boots = new MeshClass(new BoxGeometry(0.66, 0.1, 0.32), dark);
  boots.position.set(0, 0.05, 0.04);
  g.add(boots);
  return g;
}

// ── dweller.spirit — translucent emissive, cone body, halo above. Floats a
// little higher than other dwellers (no boots; tapered base). Reads as
// "ethereal".
function buildSpirit(): Group {
  const g = new Group();
  const glow = new MeshStandardMaterial({
    color: 0x6a4aa8,
    roughness: 0.4,
    metalness: 0.1,
    emissive: 0xb48bff,
    emissiveIntensity: 1.6,
    transparent: true,
    opacity: 0.78,
  });
  const wisp = new MeshStandardMaterial({
    color: 0x3a2a52,
    roughness: 0.5,
    metalness: 0.0,
    emissive: 0x7eedc8,
    emissiveIntensity: 1.0,
    transparent: true,
    opacity: 0.62,
  });

  const head = new MeshClass(new SphereGeometry(0.26, 12, 10), glow);
  head.position.y = 1.7;
  g.add(head);
  // Halo above the head — flat torus.
  const halo = new MeshClass(new TorusGeometry(0.26, 0.022, 6, 18), wisp);
  halo.position.y = 1.96;
  halo.rotation.x = Math.PI / 2;
  g.add(halo);
  // Tapered cone body — wider at the bottom, narrower at the head.
  const body = new MeshClass(new ConeGeometry(0.5, 1.4, 10, 1, true), glow);
  body.position.y = 0.8;
  g.add(body);
  // Two small trailing wisp orbs on the sides.
  const orbL = new MeshClass(new SphereGeometry(0.07, 8, 6), wisp);
  orbL.position.set(-0.45, 1.1, 0);
  g.add(orbL);
  const orbR = new MeshClass(new SphereGeometry(0.07, 8, 6), wisp);
  orbR.position.set(0.45, 1.1, 0);
  g.add(orbR);
  return g;
}

export function buildDweller(kind: string): Group {
  switch (kind) {
    case 'dweller.husk':
      return buildHusk();
    case 'dweller.spirit':
      return buildSpirit();
    default:
      return buildRobot();
  }
}
