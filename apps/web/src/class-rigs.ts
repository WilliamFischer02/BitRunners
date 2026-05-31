// Per-class character rigs. All six classes share the IDENTICAL rig skeleton
// (root → visual → chest/hip, the same arm/leg pivots, a petAnchor on the chest)
// so the existing animation in scene.ts's tick loop drives them all unchanged.
// Differences live in body geometry, props, and material palette — chosen to
// match each class's lore (`docs/lore/003-classes-origins.md`).
//
// Optimisation: shared limb geometries are allocated ONCE at module load and
// reused across every class rig (and remote avatars built later). Distinct
// torso/head/extra geometries are still per-rig but only one rig is built per
// scene start, so the per-rig cost is bounded.

import {
  BoxGeometry,
  ConeGeometry,
  Group,
  Mesh as MeshClass,
  MeshStandardMaterial,
  type MeshStandardMaterial as MeshStandardMaterialType,
  OctahedronGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three';

export type ClassId =
  | 'bit_spekter'
  | 'server_speaker'
  | 'data_miner'
  | 'terminal_runner'
  | 'hash_kicker'
  | 'web_puller';

const VALID_CLASSES: ReadonlySet<string> = new Set<ClassId>([
  'bit_spekter',
  'server_speaker',
  'data_miner',
  'terminal_runner',
  'hash_kicker',
  'web_puller',
]);

export function isValidClass(s: string): s is ClassId {
  return VALID_CLASSES.has(s);
}

// One recolourable armour material + its factory defaults, so equipping a
// cosmetic can tint it and un-equipping can restore the original exactly.
export interface SkinTarget {
  mat: MeshStandardMaterialType;
  baseColor: number;
  baseEmissive: number;
  baseEmissiveIntensity: number;
}

function snapshotSkin(mat: MeshStandardMaterialType): SkinTarget {
  return {
    mat,
    baseColor: mat.color.getHex(),
    baseEmissive: mat.emissive.getHex(),
    baseEmissiveIntensity: mat.emissiveIntensity,
  };
}

export interface ClassRig {
  root: Group;
  visual: Group;
  chest: Group;
  hip: Group;
  armPivotL: Group;
  armPivotR: Group;
  legPivotL: Group;
  legPivotR: Group;
  skin: { head: SkinTarget; chest: SkinTarget; legs: SkinTarget };
  petAnchor: Group;
}

// ── Shared limb geometries (one allocation each, reused across every class)
const G_ARM_UPPER = new BoxGeometry(0.13, 0.34, 0.16);
const G_ARM_ELBOW = new BoxGeometry(0.15, 0.08, 0.18);
const G_ARM_LOWER = new BoxGeometry(0.11, 0.32, 0.14);
const G_HAND = new BoxGeometry(0.16, 0.14, 0.18);
const G_THIGH = new BoxGeometry(0.17, 0.32, 0.2);
const G_KNEE = new BoxGeometry(0.19, 0.09, 0.22);
const G_SHIN = new BoxGeometry(0.15, 0.3, 0.18);
const G_BOOT = new BoxGeometry(0.22, 0.09, 0.3);

function makeArm(
  side: -1 | 1,
  matUpper: MeshStandardMaterialType,
  matAccent: MeshStandardMaterialType,
): Group {
  const p = new Group();
  p.position.set(0.4 * side, 0.24, 0);
  const u = new MeshClass(G_ARM_UPPER, matUpper);
  u.position.y = -0.18;
  p.add(u);
  const e = new MeshClass(G_ARM_ELBOW, matAccent);
  e.position.y = -0.38;
  p.add(e);
  const l = new MeshClass(G_ARM_LOWER, matUpper);
  l.position.y = -0.58;
  p.add(l);
  const h = new MeshClass(G_HAND, matAccent);
  h.position.y = -0.81;
  p.add(h);
  return p;
}

function makeLeg(
  side: -1 | 1,
  matUpper: MeshStandardMaterialType,
  matAccent: MeshStandardMaterialType,
): Group {
  const p = new Group();
  p.position.set(0.16 * side, -0.05, 0);
  const t = new MeshClass(G_THIGH, matUpper);
  t.position.y = -0.17;
  p.add(t);
  const k = new MeshClass(G_KNEE, matAccent);
  k.position.y = -0.36;
  p.add(k);
  const s = new MeshClass(G_SHIN, matUpper);
  s.position.y = -0.56;
  p.add(s);
  const b = new MeshClass(G_BOOT, matAccent);
  b.position.set(0, -0.74, 0.04);
  p.add(b);
  return p;
}

interface Frame {
  root: Group;
  visual: Group;
  chest: Group;
  hip: Group;
  petAnchor: Group;
}

function makeFrame(chestY = 1.0, hipY = 0.65): Frame {
  const root = new Group();
  const visual = new Group();
  root.add(visual);
  const chest = new Group();
  chest.position.y = chestY;
  visual.add(chest);
  const hip = new Group();
  hip.position.y = hipY;
  visual.add(hip);
  const petAnchor = new Group();
  petAnchor.position.set(0, 0.4, 0);
  chest.add(petAnchor);
  return { root, visual, chest, hip, petAnchor };
}

// ─────────────────────────────────────────────────────────────────────────
// bit_spekter — IRL hackers, unsanctioned upload. Heavy plate armour with a
// crosshair visor. (Migrated from scene.ts; shape preserved, limb geometries
// now shared with the other classes.)
// ─────────────────────────────────────────────────────────────────────────
export function buildBitSpekter(): ClassRig {
  const { root, visual, chest, hip, petAnchor } = makeFrame(1.0, 0.65);
  const head = new MeshStandardMaterial({
    color: 0xeef2f6,
    roughness: 0.45,
    metalness: 0.3,
    emissive: 0x3a424c,
    emissiveIntensity: 1.6,
  });
  const torso = new MeshStandardMaterial({
    color: 0xe4e8ec,
    roughness: 0.5,
    metalness: 0.25,
    emissive: 0x222830,
    emissiveIntensity: 1.0,
  });
  const legs = new MeshStandardMaterial({
    color: 0xc8ccd2,
    roughness: 0.55,
    metalness: 0.2,
    emissive: 0x0c0e12,
    emissiveIntensity: 0.35,
  });
  const darkUpper = new MeshStandardMaterial({
    color: 0x52565c,
    roughness: 0.6,
    metalness: 0.2,
    emissive: 0x1c2028,
    emissiveIntensity: 0.8,
  });
  const darkLower = new MeshStandardMaterial({
    color: 0x3a3e44,
    roughness: 0.75,
    metalness: 0.1,
    emissive: 0x060810,
    emissiveIntensity: 0.2,
  });
  const accent = new MeshStandardMaterial({
    color: 0xcfd6e0,
    roughness: 0.6,
    metalness: 0.3,
    emissive: 0x4a5a6e,
    emissiveIntensity: 1.2,
  });

  const headMesh = new MeshClass(new SphereGeometry(0.26, 14, 10), head);
  headMesh.position.y = 0.58;
  headMesh.scale.set(0.95, 1.08, 0.88);
  chest.add(headMesh);
  const antenna = new MeshClass(new BoxGeometry(0.04, 0.22, 0.04), accent);
  antenna.position.set(0.08, 0.86, -0.04);
  chest.add(antenna);
  const antennaTip = new MeshClass(new BoxGeometry(0.07, 0.05, 0.07), accent);
  antennaTip.position.set(0.08, 0.99, -0.04);
  chest.add(antennaTip);
  const visor = new MeshClass(new BoxGeometry(0.42, 0.12, 0.04), darkUpper);
  visor.position.set(0, 0.6, 0.24);
  chest.add(visor);
  const visorCrossV = new MeshClass(new BoxGeometry(0.05, 0.42, 0.03), accent);
  visorCrossV.position.set(0, 0.5, 0.27);
  chest.add(visorCrossV);
  const visorCrossH = new MeshClass(new BoxGeometry(0.36, 0.05, 0.03), accent);
  visorCrossH.position.set(0, 0.62, 0.27);
  chest.add(visorCrossH);
  const neck = new MeshClass(new BoxGeometry(0.18, 0.1, 0.18), darkUpper);
  neck.position.set(0, 0.42, 0);
  chest.add(neck);

  const torsoMesh = new MeshClass(new BoxGeometry(0.55, 0.62, 0.32), torso);
  torsoMesh.position.y = 0.05;
  chest.add(torsoMesh);
  const torsoSeam = new MeshClass(new BoxGeometry(0.57, 0.04, 0.34), darkUpper);
  torsoSeam.position.y = 0.05;
  chest.add(torsoSeam);
  const chestPlateTop = new MeshClass(new BoxGeometry(0.38, 0.18, 0.04), accent);
  chestPlateTop.position.set(0, 0.18, 0.17);
  chest.add(chestPlateTop);
  const chestPlateBot = new MeshClass(new BoxGeometry(0.32, 0.16, 0.04), darkUpper);
  chestPlateBot.position.set(0, -0.04, 0.17);
  chest.add(chestPlateBot);
  const shoulderL = new MeshClass(new BoxGeometry(0.18, 0.16, 0.22), darkUpper);
  shoulderL.position.set(-0.4, 0.3, 0);
  chest.add(shoulderL);
  const shoulderR = shoulderL.clone();
  shoulderR.position.x = 0.4;
  chest.add(shoulderR);
  const beltSeam = new MeshClass(new BoxGeometry(0.62, 0.08, 0.36), darkUpper);
  beltSeam.position.y = -0.32;
  chest.add(beltSeam);

  const armPivotL = makeArm(-1, torso, darkUpper);
  chest.add(armPivotL);
  const armPivotR = makeArm(1, torso, darkUpper);
  chest.add(armPivotR);
  const legPivotL = makeLeg(-1, legs, darkLower);
  hip.add(legPivotL);
  const legPivotR = makeLeg(1, legs, darkLower);
  hip.add(legPivotR);

  return {
    root,
    visual,
    chest,
    hip,
    armPivotL,
    armPivotR,
    legPivotL,
    legPivotR,
    skin: { head: snapshotSkin(head), chest: snapshotSkin(torso), legs: snapshotSkin(legs) },
    petAnchor,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// server_speaker — clean Server-Space-compatible init; "package + wearable
// sensitivity" gets more out of equipment. Tall, slim, draped silhouette.
// Comm-ring on the head (the literal "speaker" cue), face band instead of a
// crosshair visor, a long sloped chest skirt suggesting a robe.
// ─────────────────────────────────────────────────────────────────────────
export function buildServerSpeaker(): ClassRig {
  const { root, visual, chest, hip, petAnchor } = makeFrame(1.05, 0.62);
  const head = new MeshStandardMaterial({
    color: 0xdde7f5,
    roughness: 0.4,
    metalness: 0.25,
    emissive: 0x6a82bb,
    emissiveIntensity: 1.4,
  });
  const torso = new MeshStandardMaterial({
    color: 0xc8d8ee,
    roughness: 0.45,
    metalness: 0.2,
    emissive: 0x3a5878,
    emissiveIntensity: 0.9,
  });
  const legs = new MeshStandardMaterial({
    color: 0xa3b6d4,
    roughness: 0.55,
    metalness: 0.15,
    emissive: 0x142840,
    emissiveIntensity: 0.4,
  });
  const accent = new MeshStandardMaterial({
    color: 0xe6d7a8,
    roughness: 0.5,
    metalness: 0.4,
    emissive: 0xa88638,
    emissiveIntensity: 1.0,
  });
  const dark = new MeshStandardMaterial({
    color: 0x2a3a52,
    roughness: 0.7,
    metalness: 0.2,
    emissive: 0x0a1428,
    emissiveIntensity: 0.4,
  });

  const headMesh = new MeshClass(new SphereGeometry(0.22, 14, 10), head);
  headMesh.position.y = 0.62;
  headMesh.scale.set(0.92, 1.12, 0.84);
  chest.add(headMesh);
  // Comm-ring: a thin torus crowning the head.
  const ring = new MeshClass(new TorusGeometry(0.18, 0.018, 6, 18), accent);
  ring.position.y = 0.86;
  ring.rotation.x = Math.PI / 2;
  chest.add(ring);
  // Face band (no crosshair).
  const band = new MeshClass(new BoxGeometry(0.36, 0.06, 0.03), dark);
  band.position.set(0, 0.6, 0.22);
  chest.add(band);
  // Slim torso.
  const torsoMesh = new MeshClass(new BoxGeometry(0.42, 0.6, 0.26), torso);
  torsoMesh.position.y = 0.05;
  chest.add(torsoMesh);
  // Robe-skirt panel: hangs below the belt, drapes over the hips.
  const skirt = new MeshClass(new ConeGeometry(0.42, 0.7, 8, 1, true), torso);
  skirt.position.y = -0.55;
  chest.add(skirt);
  // Subtle gold trim across the chest.
  const trim = new MeshClass(new BoxGeometry(0.44, 0.04, 0.04), accent);
  trim.position.set(0, 0.18, 0.14);
  chest.add(trim);

  const armPivotL = makeArm(-1, torso, accent);
  chest.add(armPivotL);
  const armPivotR = makeArm(1, torso, accent);
  chest.add(armPivotR);
  const legPivotL = makeLeg(-1, legs, dark);
  hip.add(legPivotL);
  const legPivotR = makeLeg(1, legs, dark);
  hip.add(legPivotR);

  return {
    root,
    visual,
    chest,
    hip,
    armPivotL,
    armPivotR,
    legPivotL,
    legPivotR,
    skin: { head: snapshotSkin(head), chest: snapshotSkin(torso), legs: snapshotSkin(legs) },
    petAnchor,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// data_miner — government prisoner-rehab program; passive labour shells.
// Hunched, stocky silhouette with a heavy backpack/load and an orange chest
// insignia (jumpsuit-tag). Drab institutional palette.
// ─────────────────────────────────────────────────────────────────────────
export function buildDataMiner(): ClassRig {
  const { root, visual, chest, hip, petAnchor } = makeFrame(0.92, 0.6);
  // Static hunched lean (animation overwrites chest.x only when moving — so
  // we lean the root instead and let the chest tilt stack on top).
  root.rotation.x = 0.08;

  const head = new MeshStandardMaterial({
    color: 0x9aa8a0,
    roughness: 0.85,
    metalness: 0.05,
    emissive: 0x1a221c,
    emissiveIntensity: 0.4,
  });
  const torso = new MeshStandardMaterial({
    color: 0x7b8a7e,
    roughness: 0.9,
    metalness: 0.05,
    emissive: 0x141c14,
    emissiveIntensity: 0.5,
  });
  const legs = new MeshStandardMaterial({
    color: 0x5e6a62,
    roughness: 0.95,
    metalness: 0.0,
    emissive: 0x0a1008,
    emissiveIntensity: 0.2,
  });
  const dark = new MeshStandardMaterial({
    color: 0x303834,
    roughness: 0.9,
    metalness: 0.05,
    emissive: 0x040806,
    emissiveIntensity: 0.15,
  });
  const tag = new MeshStandardMaterial({
    color: 0xb05a20,
    roughness: 0.7,
    metalness: 0.2,
    emissive: 0xff7a2a,
    emissiveIntensity: 1.1,
  });

  // Boxier head — institutional helmet.
  const headMesh = new MeshClass(new BoxGeometry(0.36, 0.34, 0.32), head);
  headMesh.position.y = 0.55;
  chest.add(headMesh);
  const cap = new MeshClass(new BoxGeometry(0.4, 0.06, 0.36), dark);
  cap.position.y = 0.74;
  chest.add(cap);
  const eyeline = new MeshClass(new BoxGeometry(0.3, 0.05, 0.03), tag);
  eyeline.position.set(0, 0.55, 0.18);
  chest.add(eyeline);

  // Stocky torso.
  const torsoMesh = new MeshClass(new BoxGeometry(0.58, 0.6, 0.36), torso);
  torsoMesh.position.y = 0.05;
  chest.add(torsoMesh);
  // Backpack/load hanging behind.
  const pack = new MeshClass(new BoxGeometry(0.42, 0.5, 0.18), dark);
  pack.position.set(0, 0.05, -0.28);
  chest.add(pack);
  const packStrap = new MeshClass(new BoxGeometry(0.5, 0.06, 0.4), dark);
  packStrap.position.set(0, 0.25, 0);
  chest.add(packStrap);
  // Orange jumpsuit tag.
  const insignia = new MeshClass(new BoxGeometry(0.14, 0.12, 0.04), tag);
  insignia.position.set(-0.16, 0.18, 0.18);
  chest.add(insignia);

  const armPivotL = makeArm(-1, torso, dark);
  chest.add(armPivotL);
  const armPivotR = makeArm(1, torso, dark);
  chest.add(armPivotR);
  const legPivotL = makeLeg(-1, legs, dark);
  hip.add(legPivotL);
  const legPivotR = makeLeg(1, legs, dark);
  hip.add(legPivotR);

  // Ankle bands.
  const bandL = new MeshClass(new BoxGeometry(0.24, 0.04, 0.3), tag);
  bandL.position.set(0, -0.68, 0.04);
  legPivotL.add(bandL);
  const bandR = new MeshClass(new BoxGeometry(0.24, 0.04, 0.3), tag);
  bandR.position.set(0, -0.68, 0.04);
  legPivotR.add(bandR);

  return {
    root,
    visual,
    chest,
    hip,
    armPivotL,
    armPivotR,
    legPivotL,
    legPivotR,
    skin: { head: snapshotSkin(head), chest: snapshotSkin(torso), legs: snapshotSkin(legs) },
    petAnchor,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// terminal_runner — personified data clusters that bootstrapped themselves
// into being. Asymmetric, fragmented silhouette: offset cube shards orbit a
// glowing torso. Purple/teal data palette with strong emissive accents.
// ─────────────────────────────────────────────────────────────────────────
export function buildTerminalRunner(): ClassRig {
  const { root, visual, chest, hip, petAnchor } = makeFrame(1.0, 0.65);
  const head = new MeshStandardMaterial({
    color: 0x2a1e3a,
    roughness: 0.4,
    metalness: 0.3,
    emissive: 0xb48bff,
    emissiveIntensity: 1.8,
  });
  const torso = new MeshStandardMaterial({
    color: 0x3a2a52,
    roughness: 0.45,
    metalness: 0.25,
    emissive: 0x7eedc8,
    emissiveIntensity: 1.4,
  });
  const legs = new MeshStandardMaterial({
    color: 0x241830,
    roughness: 0.55,
    metalness: 0.2,
    emissive: 0x4a3270,
    emissiveIntensity: 0.6,
  });
  const accent = new MeshStandardMaterial({
    color: 0x7eedc8,
    roughness: 0.3,
    metalness: 0.4,
    emissive: 0x7eedc8,
    emissiveIntensity: 2.0,
  });
  const dark = new MeshStandardMaterial({
    color: 0x140828,
    roughness: 0.8,
    metalness: 0.1,
    emissive: 0x100018,
    emissiveIntensity: 0.3,
  });

  // Angular octahedral head — not a clean sphere.
  const headMesh = new MeshClass(new OctahedronGeometry(0.28), head);
  headMesh.position.y = 0.6;
  chest.add(headMesh);
  // Asymmetric torso.
  const torsoMesh = new MeshClass(new BoxGeometry(0.5, 0.55, 0.3), torso);
  torsoMesh.position.y = 0.05;
  chest.add(torsoMesh);
  // Four cluster shards offset around the torso — the "bootstrapping" look.
  const shardGeom = new BoxGeometry(0.14, 0.14, 0.14);
  const shardSpecs: Array<[number, number, number, number]> = [
    [0.32, 0.2, 0.05, 0.35],
    [-0.3, 0.08, 0.08, 0.6],
    [0.06, -0.18, -0.32, 0.25],
    [-0.18, 0.32, -0.2, 0.5],
  ];
  for (const [x, y, z, rot] of shardSpecs) {
    const s = new MeshClass(shardGeom, accent);
    s.position.set(x, y, z);
    s.rotation.set(rot, rot * 1.3, rot * 0.7);
    chest.add(s);
  }
  // Glitching emissive seam across chest.
  const seam = new MeshClass(new BoxGeometry(0.52, 0.04, 0.04), accent);
  seam.position.set(0, 0.12, 0.16);
  chest.add(seam);

  const armPivotL = makeArm(-1, torso, accent);
  chest.add(armPivotL);
  const armPivotR = makeArm(1, torso, accent);
  chest.add(armPivotR);
  const legPivotL = makeLeg(-1, legs, dark);
  hip.add(legPivotL);
  const legPivotR = makeLeg(1, legs, dark);
  hip.add(legPivotR);

  return {
    root,
    visual,
    chest,
    hip,
    armPivotL,
    armPivotR,
    legPivotL,
    legPivotR,
    skin: { head: snapshotSkin(head), chest: snapshotSkin(torso), legs: snapshotSkin(legs) },
    petAnchor,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// hash_kicker — voluntary uploads in Company-built template bodies. Symmetric,
// branded, industrial — heavy shoulder pads, single visor strip, Company-
// orange brand stripe down the chest. Chrome/grey palette.
// ─────────────────────────────────────────────────────────────────────────
export function buildHashKicker(): ClassRig {
  const { root, visual, chest, hip, petAnchor } = makeFrame(1.02, 0.65);
  const head = new MeshStandardMaterial({
    color: 0xc8ccd0,
    roughness: 0.4,
    metalness: 0.45,
    emissive: 0x303840,
    emissiveIntensity: 0.9,
  });
  const torso = new MeshStandardMaterial({
    color: 0xb0b4b8,
    roughness: 0.45,
    metalness: 0.4,
    emissive: 0x282c30,
    emissiveIntensity: 0.7,
  });
  const legs = new MeshStandardMaterial({
    color: 0x8e9298,
    roughness: 0.55,
    metalness: 0.3,
    emissive: 0x141820,
    emissiveIntensity: 0.3,
  });
  const dark = new MeshStandardMaterial({
    color: 0x4a4e54,
    roughness: 0.65,
    metalness: 0.3,
    emissive: 0x0c0e14,
    emissiveIntensity: 0.4,
  });
  const brand = new MeshStandardMaterial({
    color: 0xc06028,
    roughness: 0.5,
    metalness: 0.4,
    emissive: 0xff8844,
    emissiveIntensity: 1.4,
  });

  // Blocky industrial helmet.
  const headMesh = new MeshClass(new BoxGeometry(0.36, 0.36, 0.34), head);
  headMesh.position.y = 0.58;
  chest.add(headMesh);
  // Single visor strip (no crosshair).
  const visor = new MeshClass(new BoxGeometry(0.42, 0.08, 0.04), brand);
  visor.position.set(0, 0.58, 0.2);
  chest.add(visor);
  // Broad torso.
  const torsoMesh = new MeshClass(new BoxGeometry(0.6, 0.6, 0.34), torso);
  torsoMesh.position.y = 0.05;
  chest.add(torsoMesh);
  // Vertical Company brand stripe down the centre.
  const stripe = new MeshClass(new BoxGeometry(0.1, 0.5, 0.04), brand);
  stripe.position.set(0, 0.05, 0.18);
  chest.add(stripe);
  // Exaggerated shoulder pads.
  const padL = new MeshClass(new BoxGeometry(0.24, 0.18, 0.26), dark);
  padL.position.set(-0.42, 0.32, 0);
  chest.add(padL);
  const padR = padL.clone();
  padR.position.x = 0.42;
  chest.add(padR);
  // Belt.
  const belt = new MeshClass(new BoxGeometry(0.66, 0.08, 0.38), dark);
  belt.position.y = -0.32;
  chest.add(belt);

  const armPivotL = makeArm(-1, torso, dark);
  chest.add(armPivotL);
  const armPivotR = makeArm(1, torso, dark);
  chest.add(armPivotR);
  const legPivotL = makeLeg(-1, legs, dark);
  hip.add(legPivotL);
  const legPivotR = makeLeg(1, legs, dark);
  hip.add(legPivotR);

  return {
    root,
    visual,
    chest,
    hip,
    armPivotL,
    armPivotR,
    legPivotL,
    legPivotR,
    skin: { head: snapshotSkin(head), chest: snapshotSkin(torso), legs: snapshotSkin(legs) },
    petAnchor,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// web_puller — Admin-created hall monitors with social authority. Tall,
// authoritative silhouette: a hanging cape behind the torso and a flat halo
// ring above the head. Dark purple/black palette with gold accents.
// ─────────────────────────────────────────────────────────────────────────
export function buildWebPuller(): ClassRig {
  const { root, visual, chest, hip, petAnchor } = makeFrame(1.05, 0.62);
  const head = new MeshStandardMaterial({
    color: 0x1a142e,
    roughness: 0.5,
    metalness: 0.25,
    emissive: 0x4a2880,
    emissiveIntensity: 1.0,
  });
  const torso = new MeshStandardMaterial({
    color: 0x251a3a,
    roughness: 0.55,
    metalness: 0.2,
    emissive: 0x281a48,
    emissiveIntensity: 0.7,
  });
  const legs = new MeshStandardMaterial({
    color: 0x18102a,
    roughness: 0.65,
    metalness: 0.15,
    emissive: 0x0c0822,
    emissiveIntensity: 0.3,
  });
  const gold = new MeshStandardMaterial({
    color: 0xd4b86a,
    roughness: 0.4,
    metalness: 0.5,
    emissive: 0xd4b86a,
    emissiveIntensity: 1.4,
  });
  const cape = new MeshStandardMaterial({
    color: 0x0c0820,
    roughness: 0.95,
    metalness: 0.0,
    emissive: 0x040214,
    emissiveIntensity: 0.2,
  });

  const headMesh = new MeshClass(new SphereGeometry(0.24, 14, 10), head);
  headMesh.position.y = 0.6;
  headMesh.scale.set(0.98, 1.05, 0.92);
  chest.add(headMesh);
  // Flat halo ring above the head.
  const halo = new MeshClass(new TorusGeometry(0.22, 0.022, 6, 18), gold);
  halo.position.y = 0.92;
  halo.rotation.x = Math.PI / 2;
  chest.add(halo);
  // Torso.
  const torsoMesh = new MeshClass(new BoxGeometry(0.46, 0.6, 0.28), torso);
  torsoMesh.position.y = 0.05;
  chest.add(torsoMesh);
  // Chest insignia.
  const insignia = new MeshClass(new BoxGeometry(0.18, 0.14, 0.04), gold);
  insignia.position.set(0, 0.1, 0.16);
  chest.add(insignia);
  // Cape: a flat panel behind the torso, slightly tilted out at the bottom.
  const capeMesh = new MeshClass(new BoxGeometry(0.7, 0.9, 0.04), cape);
  capeMesh.position.set(0, -0.1, -0.18);
  capeMesh.rotation.x = -0.12;
  chest.add(capeMesh);

  const armPivotL = makeArm(-1, torso, gold);
  chest.add(armPivotL);
  const armPivotR = makeArm(1, torso, gold);
  chest.add(armPivotR);
  const legPivotL = makeLeg(-1, legs, cape);
  hip.add(legPivotL);
  const legPivotR = makeLeg(1, legs, cape);
  hip.add(legPivotR);

  return {
    root,
    visual,
    chest,
    hip,
    armPivotL,
    armPivotR,
    legPivotL,
    legPivotR,
    skin: { head: snapshotSkin(head), chest: snapshotSkin(torso), legs: snapshotSkin(legs) },
    petAnchor,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Router: pick a builder by class id; unknown ids fall back to bit_spekter.
// ─────────────────────────────────────────────────────────────────────────
export function buildClassRig(className: string): ClassRig {
  switch (className) {
    case 'server_speaker':
      return buildServerSpeaker();
    case 'data_miner':
      return buildDataMiner();
    case 'terminal_runner':
      return buildTerminalRunner();
    case 'hash_kicker':
      return buildHashKicker();
    case 'web_puller':
      return buildWebPuller();
    default:
      return buildBitSpekter();
  }
}
