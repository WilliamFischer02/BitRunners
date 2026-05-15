import { buildGlyphAtlas, createAsciiPass, setAsciiPassResolution } from '@bitrunners/ascii';
import {
  BackSide,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  type Mesh,
  Mesh as MeshClass,
  MeshNormalMaterial,
  MeshStandardMaterial,
  type MeshStandardMaterial as MeshStandardMaterialType,
  PerspectiveCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Uniform,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { createInput } from './input.js';
import { type NetworkSession, getServerUrl, joinSphere } from './network.js';

const MOVE_SPEED = 3.2;
const PLATFORM_HALF = 9.5;
const PLATFORM_SIZE = PLATFORM_HALF * 2;
const WALK_RATE = 8.5;
const ARM_AMP = 0.55;
const LEG_AMP = 0.45;
const CHEST_TWIST = 0.12;
const HIP_ROLL = 0.05;

const CHARACTER_LAYER = 1;

const NET_SEND_HZ = 15;
const NET_SEND_MS = 1000 / NET_SEND_HZ;

function buildRemoteAvatar(): Group {
  const g = new Group();
  const armor = new MeshStandardMaterial({
    color: 0xa8acb4,
    roughness: 0.7,
    metalness: 0.2,
    emissive: 0x141820,
    emissiveIntensity: 0.35,
  });
  const dark = new MeshStandardMaterial({
    color: 0x404448,
    roughness: 0.8,
    metalness: 0.1,
  });
  const head = new MeshClass(new SphereGeometry(0.34, 12, 8), armor);
  head.position.y = 1.58;
  head.scale.set(1.0, 1.05, 0.92);
  g.add(head);
  const visor = new MeshClass(new BoxGeometry(0.5, 0.18, 0.06), dark);
  visor.position.set(0, 1.58, 0.31);
  g.add(visor);
  const torso = new MeshClass(new BoxGeometry(0.78, 0.78, 0.46), armor);
  torso.position.y = 0.98;
  g.add(torso);
  const belt = new MeshClass(new BoxGeometry(0.8, 0.08, 0.48), dark);
  belt.position.y = 0.62;
  g.add(belt);
  const legs = new MeshClass(new BoxGeometry(0.68, 0.6, 0.32), armor);
  legs.position.y = 0.32;
  g.add(legs);
  const boots = new MeshClass(new BoxGeometry(0.74, 0.12, 0.36), dark);
  boots.position.set(0, 0.06, 0.04);
  g.add(boots);
  return g;
}

interface BitSpekterRig {
  root: Group;
  visual: Group;
  chest: Group;
  hip: Group;
  armPivotL: Group;
  armPivotR: Group;
  legPivotL: Group;
  legPivotR: Group;
}

function buildBitSpekter(): BitSpekterRig {
  const root = new Group();
  const visual = new Group();
  root.add(visual);

  const chest = new Group();
  chest.position.y = 1.0;
  visual.add(chest);

  const hip = new Group();
  hip.position.y = 0.65;
  visual.add(hip);

  const armorHead = new MeshStandardMaterial({
    color: 0xeef2f6,
    roughness: 0.45,
    metalness: 0.3,
    emissive: 0x3a424c,
    emissiveIntensity: 1.6,
  });
  const armorTorso = new MeshStandardMaterial({
    color: 0xe4e8ec,
    roughness: 0.5,
    metalness: 0.25,
    emissive: 0x222830,
    emissiveIntensity: 1.0,
  });
  const armorLegs = new MeshStandardMaterial({
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

  // Skinnier, more angular robot rig (Marathon-Rook-inspired, miniaturized).
  // Narrower torso, thinner limbs, antenna, segmented chest plate, knee
  // sections, ankle wedges. Per devlog 0026 item 5.

  const head = new MeshClass(new SphereGeometry(0.26, 14, 10), armorHead);
  head.position.y = 0.58;
  head.scale.set(0.95, 1.08, 0.88);
  chest.add(head);

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

  const torso = new MeshClass(new BoxGeometry(0.55, 0.62, 0.32), armorTorso);
  torso.position.y = 0.05;
  chest.add(torso);

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

  const armPivotL = new Group();
  armPivotL.position.set(-0.4, 0.24, 0);
  chest.add(armPivotL);
  const armUpperL: Mesh = new MeshClass(new BoxGeometry(0.13, 0.34, 0.16), armorTorso);
  armUpperL.position.y = -0.18;
  armPivotL.add(armUpperL);
  const elbowL: Mesh = new MeshClass(new BoxGeometry(0.15, 0.08, 0.18), darkUpper);
  elbowL.position.y = -0.38;
  armPivotL.add(elbowL);
  const armLowerL: Mesh = new MeshClass(new BoxGeometry(0.11, 0.32, 0.14), armorTorso);
  armLowerL.position.y = -0.58;
  armPivotL.add(armLowerL);
  const handL: Mesh = new MeshClass(new BoxGeometry(0.16, 0.14, 0.18), darkUpper);
  handL.position.y = -0.81;
  armPivotL.add(handL);

  const armPivotR = new Group();
  armPivotR.position.set(0.4, 0.24, 0);
  chest.add(armPivotR);
  const armUpperR: Mesh = new MeshClass(new BoxGeometry(0.13, 0.34, 0.16), armorTorso);
  armUpperR.position.y = -0.18;
  armPivotR.add(armUpperR);
  const elbowR: Mesh = new MeshClass(new BoxGeometry(0.15, 0.08, 0.18), darkUpper);
  elbowR.position.y = -0.38;
  armPivotR.add(elbowR);
  const armLowerR: Mesh = new MeshClass(new BoxGeometry(0.11, 0.32, 0.14), armorTorso);
  armLowerR.position.y = -0.58;
  armPivotR.add(armLowerR);
  const handR: Mesh = new MeshClass(new BoxGeometry(0.16, 0.14, 0.18), darkUpper);
  handR.position.y = -0.81;
  armPivotR.add(handR);

  const legPivotL = new Group();
  legPivotL.position.set(-0.16, -0.05, 0);
  hip.add(legPivotL);
  const thighL: Mesh = new MeshClass(new BoxGeometry(0.17, 0.32, 0.2), armorLegs);
  thighL.position.y = -0.17;
  legPivotL.add(thighL);
  const kneeL: Mesh = new MeshClass(new BoxGeometry(0.19, 0.09, 0.22), darkLower);
  kneeL.position.y = -0.36;
  legPivotL.add(kneeL);
  const shinL: Mesh = new MeshClass(new BoxGeometry(0.15, 0.3, 0.18), armorLegs);
  shinL.position.y = -0.56;
  legPivotL.add(shinL);
  const bootL: Mesh = new MeshClass(new BoxGeometry(0.22, 0.09, 0.3), darkLower);
  bootL.position.set(0, -0.74, 0.04);
  legPivotL.add(bootL);

  const legPivotR = new Group();
  legPivotR.position.set(0.16, -0.05, 0);
  hip.add(legPivotR);
  const thighR: Mesh = new MeshClass(new BoxGeometry(0.17, 0.32, 0.2), armorLegs);
  thighR.position.y = -0.17;
  legPivotR.add(thighR);
  const kneeR: Mesh = new MeshClass(new BoxGeometry(0.19, 0.09, 0.22), darkLower);
  kneeR.position.y = -0.36;
  legPivotR.add(kneeR);
  const shinR: Mesh = new MeshClass(new BoxGeometry(0.15, 0.3, 0.18), armorLegs);
  shinR.position.y = -0.56;
  legPivotR.add(shinR);
  const bootR: Mesh = new MeshClass(new BoxGeometry(0.22, 0.09, 0.3), darkLower);
  bootR.position.set(0, -0.74, 0.04);
  legPivotR.add(bootR);

  return { root, visual, chest, hip, armPivotL, armPivotR, legPivotL, legPivotR };
}

export interface SceneControls {
  dispose(): void;
  triggerEmote(text: string): void;
}

export function startScene(host: HTMLElement, _className: string): SceneControls {
  const renderer = new WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(1);
  renderer.toneMappingExposure = 1.15;
  host.appendChild(renderer.domElement);

  const scene = new Scene();
  scene.background = new Color(0x070a09);

  const camera = new PerspectiveCamera(38, 1, 0.1, 200);
  const cameraOffset = new Vector3(4.5, 9.5, 4.5);
  camera.layers.enableAll();

  const hemi = new HemisphereLight(0xffffff, 0x303338, 1.05);
  hemi.layers.enableAll();
  scene.add(hemi);
  const sun = new DirectionalLight(0xffffff, 1.9);
  sun.position.set(6, 10, 4);
  sun.layers.enableAll();
  scene.add(sun);
  const fill = new DirectionalLight(0x9aaecc, 0.55);
  fill.position.set(-5, 4, -5);
  fill.layers.enableAll();
  scene.add(fill);

  const worldTile = new Group();

  const platform = new MeshClass(
    new PlaneGeometry(PLATFORM_HALF * 2, PLATFORM_HALF * 2, 1, 1),
    new MeshStandardMaterial({ color: 0x1a2a1c, roughness: 0.95, metalness: 0.05 }),
  );
  platform.rotation.x = -Math.PI / 2;
  worldTile.add(platform);

  const gridProto = new MeshClass(
    new BoxGeometry(PLATFORM_HALF * 2 - 0.4, 0.02, 0.06),
    new MeshStandardMaterial({ color: 0x4c5056, roughness: 1 }),
  );
  for (let i = -3; i <= 3; i++) {
    const a = gridProto.clone();
    a.position.set(0, 0.01, i * 2.4);
    worldTile.add(a);
    const b = gridProto.clone();
    b.rotation.y = Math.PI / 2;
    b.position.set(i * 2.4, 0.01, 0);
    worldTile.add(b);
  }

  const port = new MeshClass(
    new BoxGeometry(1.4, 2.2, 0.4),
    new MeshStandardMaterial({ color: 0xc4c8d0, roughness: 0.4, metalness: 0.4 }),
  );
  port.position.set(-6.5, 1.1, -6.5);
  worldTile.add(port);
  const portInsideMaterial = new MeshStandardMaterial({
    color: 0x141820,
    emissive: 0x4477aa,
    emissiveIntensity: 0.6,
    roughness: 1,
  });
  const portInside = new MeshClass(new BoxGeometry(0.95, 1.55, 0.05), portInsideMaterial);
  portInside.position.set(-6.5, 1.1, -6.29);
  worldTile.add(portInside);

  const vending = new MeshClass(
    new BoxGeometry(1.0, 1.7, 0.55),
    new MeshStandardMaterial({ color: 0xb0b4ba, roughness: 0.55, metalness: 0.3 }),
  );
  vending.position.set(6.0, 0.85, -5.5);
  worldTile.add(vending);
  const vendingScreen = new MeshClass(
    new BoxGeometry(0.7, 0.45, 0.05),
    new MeshStandardMaterial({
      color: 0x0c1014,
      emissive: 0xff8844,
      emissiveIntensity: 0.7,
      roughness: 1,
    }),
  );
  vendingScreen.position.set(6.0, 1.25, -5.21);
  worldTile.add(vendingScreen);
  const vendingSlot = new MeshClass(
    new BoxGeometry(0.55, 0.12, 0.06),
    new MeshStandardMaterial({ color: 0x2a2e33, roughness: 1 }),
  );
  vendingSlot.position.set(6.0, 0.3, -5.2);
  worldTile.add(vendingSlot);

  const monolith = new MeshClass(
    new BoxGeometry(0.65, 3.6, 0.65),
    new MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.4, metalness: 0.6 }),
  );
  monolith.position.set(5.5, 1.8, 5.5);
  worldTile.add(monolith);
  const monolithGlow = new MeshClass(
    new BoxGeometry(0.06, 2.8, 0.06),
    new MeshStandardMaterial({
      color: 0x000000,
      emissive: 0xff8844,
      emissiveIntensity: 0.9,
      roughness: 1,
    }),
  );
  monolithGlow.position.set(5.5, 1.8, 5.83);
  worldTile.add(monolithGlow);

  const terminal = new MeshClass(
    new BoxGeometry(1.5, 0.9, 0.6),
    new MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.5, metalness: 0.35 }),
  );
  terminal.position.set(-5.5, 0.45, 6.5);
  worldTile.add(terminal);
  const terminalScreen = new MeshClass(
    new BoxGeometry(1.1, 0.55, 0.05),
    new MeshStandardMaterial({
      color: 0x0a0c10,
      emissive: 0xff8844,
      emissiveIntensity: 0.55,
      roughness: 1,
    }),
  );
  terminalScreen.position.set(-5.5, 0.55, 6.81);
  terminalScreen.rotation.x = -0.3;
  worldTile.add(terminalScreen);

  const tuftMaterial = new MeshStandardMaterial({
    color: 0x88c466,
    emissive: 0x2a4818,
    emissiveIntensity: 0.65,
    roughness: 0.9,
  });

  const traceMaterial = new MeshStandardMaterial({
    color: 0x6a3a1a,
    emissive: 0xff6a20,
    emissiveIntensity: 0.55,
    metalness: 0.7,
    roughness: 0.4,
  });
  const traceGeom = new BoxGeometry(1, 0.03, 0.08);
  let traceSeed = 0xa3c1;
  function traceRand(): number {
    traceSeed = (traceSeed * 1103515245 + 12345) & 0x7fffffff;
    return traceSeed / 0x7fffffff;
  }
  for (let i = 0; i < 14; i++) {
    const trace = new MeshClass(traceGeom, traceMaterial);
    trace.position.set(
      (traceRand() - 0.5) * (PLATFORM_SIZE - 1.5),
      0.025,
      (traceRand() - 0.5) * (PLATFORM_SIZE - 1.5),
    );
    if (traceRand() < 0.5) trace.rotation.y = Math.PI / 2;
    trace.scale.x = 0.6 + traceRand() * 2.4;
    worldTile.add(trace);
  }
  const tuftBladeGeom = new BoxGeometry(0.05, 0.32, 0.05);
  const tufts = new Group();
  let tuftSeed = 0x5a17;
  function tuftRand(): number {
    tuftSeed = (tuftSeed * 1103515245 + 12345) & 0x7fffffff;
    return tuftSeed / 0x7fffffff;
  }
  for (let i = 0; i < 36; i++) {
    const cx = (tuftRand() - 0.5) * (PLATFORM_SIZE - 1.5);
    const cz = (tuftRand() - 0.5) * (PLATFORM_SIZE - 1.5);
    const blades = 3 + Math.floor(tuftRand() * 4);
    const tuft = new Group();
    for (let b = 0; b < blades; b++) {
      const blade = new MeshClass(tuftBladeGeom, tuftMaterial);
      blade.position.set(
        (tuftRand() - 0.5) * 0.3,
        0.16 + tuftRand() * 0.08,
        (tuftRand() - 0.5) * 0.3,
      );
      blade.rotation.y = tuftRand() * Math.PI;
      blade.scale.y = 0.7 + tuftRand() * 0.6;
      tuft.add(blade);
    }
    tuft.position.set(cx, 0, cz);
    tufts.add(tuft);
  }
  worldTile.add(tufts);

  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      if (dx === 0 && dz === 0) {
        scene.add(worldTile);
      } else {
        const tile = worldTile.clone();
        tile.position.set(dx * PLATFORM_SIZE, 0, dz * PLATFORM_SIZE);
        scene.add(tile);
      }
    }
  }

  const skyboxMaterial = new ShaderMaterial({
    uniforms: { uTime: new Uniform(0) },
    vertexShader: /* glsl */ `
      varying vec2 vUvSky;
      void main() {
        vUvSky = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUvSky;

      float hash1(float x) { return fract(sin(x * 12.9898) * 43758.5453); }

      void main() {
        float colCount = 96.0;
        float col = floor(vUvSky.x * colCount);
        float colSeed = hash1(col + 7.13);
        float speed = 0.45 + colSeed * 0.7;
        float v = vUvSky.y * 12.0 - uTime * speed;
        float row = floor(v);
        float cellSeed = hash1(col * 17.31 + row * 31.7);
        float headFrac = fract(v);
        float onChar = step(0.55, cellSeed);
        float intensity = onChar * smoothstep(0.0, 0.4, headFrac) * smoothstep(1.0, 0.55, headFrac);
        float vFade = smoothstep(0.05, 0.35, vUvSky.y) * smoothstep(1.0, 0.6, vUvSky.y);
        intensity *= vFade;
        vec3 color = vec3(0.42, 0.28, 0.65) * intensity;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: BackSide,
    depthWrite: false,
    depthTest: true,
  });
  const skybox = new MeshClass(new CylinderGeometry(45, 45, 32, 48, 1, true), skyboxMaterial);
  skybox.position.y = 8;
  scene.add(skybox);

  const rig = buildBitSpekter();
  rig.root.traverse((obj) => {
    obj.layers.set(CHARACTER_LAYER);
  });
  scene.add(rig.root);

  // ─── Admin shadow figure (hidden until encounter) ────────────────────
  // Shadow/silhouette of a hunched man made of black/dark gray boxes,
  // appears beside the obelisk during the "admin hacks user" event (item 13).
  const adminShadow = new Group();
  const adminMat = new MeshStandardMaterial({
    color: 0x06060a,
    roughness: 1,
    metalness: 0,
    emissive: 0x0c0820,
    emissiveIntensity: 0.35,
  });
  const adminDark = new MeshStandardMaterial({
    color: 0x121420,
    roughness: 1,
    metalness: 0,
    emissive: 0x080414,
    emissiveIntensity: 0.25,
  });
  const adminTorso = new MeshClass(new BoxGeometry(0.5, 0.62, 0.36), adminMat);
  adminTorso.position.set(0, 0.95, 0.04);
  adminTorso.rotation.x = 0.32;
  adminShadow.add(adminTorso);
  const adminHead = new MeshClass(new SphereGeometry(0.18, 12, 8), adminMat);
  adminHead.position.set(0, 1.4, 0.18);
  adminShadow.add(adminHead);
  const adminHood = new MeshClass(new BoxGeometry(0.32, 0.26, 0.28), adminDark);
  adminHood.position.set(0, 1.46, 0.16);
  adminHood.rotation.x = 0.42;
  adminShadow.add(adminHood);
  const adminArmL = new MeshClass(new BoxGeometry(0.13, 0.7, 0.14), adminMat);
  adminArmL.position.set(-0.3, 0.78, 0.16);
  adminArmL.rotation.x = 0.18;
  adminShadow.add(adminArmL);
  const adminArmR = adminArmL.clone();
  adminArmR.position.x = 0.3;
  adminShadow.add(adminArmR);
  const adminLegL = new MeshClass(new BoxGeometry(0.16, 0.6, 0.2), adminMat);
  adminLegL.position.set(-0.12, 0.32, 0);
  adminShadow.add(adminLegL);
  const adminLegR = adminLegL.clone();
  adminLegR.position.x = 0.12;
  adminShadow.add(adminLegR);
  adminShadow.visible = false;
  scene.add(adminShadow);

  // ─── Tendril particle pool (item 3c) ────────────────────────────────
  // Thin vertical streaks that spawn at random ground positions near the
  // player and rise toward the body. Spawn rate scales with player motion.
  const TENDRIL_POOL = 36;
  const tendrilGeom = new BoxGeometry(0.05, 0.42, 0.05);
  const tendrilMaterial = new MeshStandardMaterial({
    color: 0x6a4aa8,
    emissive: 0xb48bff,
    emissiveIntensity: 1.6,
    roughness: 0.6,
    metalness: 0.1,
    transparent: true,
    opacity: 1,
  });
  interface Tendril {
    mesh: Mesh;
    active: boolean;
    velocity: number;
    lifetime: number;
    age: number;
  }
  const tendrils: Tendril[] = [];
  for (let i = 0; i < TENDRIL_POOL; i++) {
    const mesh = new MeshClass(tendrilGeom, tendrilMaterial);
    mesh.visible = false;
    scene.add(mesh);
    tendrils.push({ mesh, active: false, velocity: 0, lifetime: 0, age: 0 });
  }
  let tendrilSpawnAcc = 0;

  function spawnTendril(): void {
    const slot = tendrils.find((t) => !t.active);
    if (!slot) return;
    const radius = 0.4 + Math.random() * 1.6;
    const angle = Math.random() * Math.PI * 2;
    slot.mesh.position.set(
      rig.root.position.x + Math.cos(angle) * radius,
      0.21,
      rig.root.position.z + Math.sin(angle) * radius,
    );
    slot.mesh.scale.set(1, 1, 1);
    slot.mesh.rotation.y = Math.random() * Math.PI;
    slot.mesh.visible = true;
    slot.active = true;
    slot.velocity = 0.8 + Math.random() * 0.9;
    slot.lifetime = 1.1 + Math.random() * 0.7;
    slot.age = 0;
  }

  function updateTendrils(dt: number, isMoving: boolean): void {
    const targetRate = isMoving ? 14 : 1.6;
    tendrilSpawnAcc += dt * targetRate;
    while (tendrilSpawnAcc >= 1) {
      tendrilSpawnAcc -= 1;
      spawnTendril();
    }
    for (const t of tendrils) {
      if (!t.active) continue;
      t.age += dt;
      if (t.age >= t.lifetime) {
        t.active = false;
        t.mesh.visible = false;
        continue;
      }
      t.mesh.position.y += t.velocity * dt;
      const lifeT = t.age / t.lifetime;
      t.mesh.scale.y = Math.max(0.05, 1 - lifeT * 0.7);
    }
  }

  // ─── Obelisk approach event (item 13) ───────────────────────────────
  let adminEncountered = false;
  const OBELISK_X = 5.5;
  const OBELISK_Z = 5.5;
  const OBELISK_TRIGGER_DIST = 2.6;
  function checkObeliskApproach(): void {
    if (adminEncountered) return;
    const dx = rig.root.position.x - OBELISK_X;
    const dz = rig.root.position.z - OBELISK_Z;
    const wdx =
      ((((dx + PLATFORM_HALF) % PLATFORM_SIZE) + PLATFORM_SIZE) % PLATFORM_SIZE) - PLATFORM_HALF;
    const wdz =
      ((((dz + PLATFORM_HALF) % PLATFORM_SIZE) + PLATFORM_SIZE) % PLATFORM_SIZE) - PLATFORM_HALF;
    const dist = Math.sqrt(wdx * wdx + wdz * wdz);
    if (dist < OBELISK_TRIGGER_DIST) {
      adminEncountered = true;
      adminShadow.position.set(OBELISK_X - 1.6, 0, OBELISK_Z - 0.2);
      adminShadow.lookAt(rig.root.position.x, 0, rig.root.position.z);
      adminShadow.visible = true;
      window.dispatchEvent(new CustomEvent('bitrunners:admin-encounter'));
    }
  }

  const characterTarget = new WebGLRenderTarget(1, 1, { format: RGBAFormat });

  const worldAtlas = buildGlyphAtlas({
    ramp: ' .·-:;=+*░#▒▓█',
    cellSize: 6,
    fontSize: 8,
  });
  const characterAtlas = buildGlyphAtlas({
    ramp: " '.,:;-+=*#%&@",
    cellSize: 6,
    fontSize: 8,
  });
  const edgeAtlas = buildGlyphAtlas({
    ramp: ' ▀▄▌▐█',
    cellSize: 6,
    fontSize: 8,
  });

  const useNormals =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('normals') === 'on';
  let normalsTarget: WebGLRenderTarget | null = null;
  let normalsMaterial: MeshNormalMaterial | null = null;
  if (useNormals) {
    normalsTarget = new WebGLRenderTarget(1, 1, { format: RGBAFormat });
    normalsMaterial = new MeshNormalMaterial();
  }

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const asciiPass = createAsciiPass({
    atlas: worldAtlas,
    characterAtlas,
    edgeAtlas,
    resolution: { width: 1, height: 1 },
    tint: [0.86, 0.93, 0.88],
    tintTop: [0.72, 0.5, 0.95],
    background: [0.025, 0.04, 0.035],
    lumGain: 1.18,
    lumBias: 0.04,
    gamma: 1.0,
    dither: 0.55,
    edgeStrength: 1.0,
    edgeThreshold: 0.22,
    characterTexture: characterTarget.texture,
    backgroundDim: 0.55,
    characterGlow: 1.55,
    normalsTexture: normalsTarget?.texture,
  });
  composer.addPass(asciiPass);
  composer.addPass(new OutputPass());

  const fpsEl = document.createElement('div');
  fpsEl.className = 'fps';
  fpsEl.textContent = '-- fps';
  host.appendChild(fpsEl);

  // Random 6-char [A-Z0-9] session code shown above the player when no account is wired.
  const playerCode = (() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 6; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
    return out;
  })();
  const playerTagEl = document.createElement('div');
  playerTagEl.className = 'player-tag';
  playerTagEl.innerHTML = `<span class="player-tag-name">${playerCode}</span><span class="player-tag-sub">// session</span>`;
  host.appendChild(playerTagEl);

  function resize(): void {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    characterTarget.setSize(w, h);
    normalsTarget?.setSize(w, h);
    setAsciiPassResolution(asciiPass, w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();

  const ro = new ResizeObserver(resize);
  ro.observe(host);

  const input = createInput(host);

  const remoteAvatars = new Map<string, Group>();
  let netSession: NetworkSession | null = null;
  let lastNetSend = 0;
  const serverUrl = getServerUrl();

  const netEl = document.createElement('div');
  netEl.className = 'net-status';
  host.appendChild(netEl);
  function setNet(text: string, kind: 'idle' | 'connecting' | 'ok' | 'error' = 'idle'): void {
    netEl.textContent = text;
    netEl.dataset.kind = kind;
  }

  console.info('[bitrunners] VITE_SERVER_URL =', serverUrl ?? '(unset)');
  if (!serverUrl) {
    setNet('net: offline · VITE_SERVER_URL unset', 'idle');
  } else {
    setNet(`net: connecting · ${serverUrl}`, 'connecting');
    void (async () => {
      try {
        const session = await joinSphere(serverUrl, 'bit_spekter', {
          onJoin(p) {
            if (remoteAvatars.has(p.id)) return;
            const avatar = buildRemoteAvatar();
            avatar.position.set(p.x, 0, p.z);
            avatar.rotation.y = p.rotY;
            scene.add(avatar);
            remoteAvatars.set(p.id, avatar);
            setNet(`net: connected · ${remoteAvatars.size} other(s)`, 'ok');
          },
          onLeave(id) {
            const avatar = remoteAvatars.get(id);
            if (!avatar) return;
            scene.remove(avatar);
            remoteAvatars.delete(id);
            setNet(`net: connected · ${remoteAvatars.size} other(s)`, 'ok');
          },
          onUpdate(p) {
            const avatar = remoteAvatars.get(p.id);
            if (!avatar) return;
            avatar.position.set(p.x, 0, p.z);
            avatar.rotation.y = p.rotY;
          },
        });
        netSession = session;
        setNet(`net: connected · session ${session.sessionId.slice(0, 6)}`, 'ok');
        console.info('[bitrunners] joined sphere as', session.sessionId);
      } catch (err) {
        const msg = (err as Error)?.message ?? String(err);
        console.warn('[bitrunners] multiplayer disabled — connect failed:', err);
        setNet(`net: error · ${msg.slice(0, 80)}`, 'error');
      }
    })();
  }

  const tempFwd = new Vector3();
  const tempRight = new Vector3();
  const tempMove = new Vector3();
  const worldUp = new Vector3(0, 1, 0);
  const savedClear = new Color();

  let raf = 0;
  let last = performance.now();
  let facing = 0;
  let walkPhase = 0;
  let walkActive = 0;
  let elapsed = 0;
  let frameCount = 0;
  let frameWindowStart = last;
  let hoverY = 0;
  const HOVER_HEIGHT = 0.45;
  const FRAME_INTERVAL_MS = 1000 / 18;
  const tempTag = new Vector3();

  function tick(now: number): void {
    const sinceLast = now - last;
    if (sinceLast < FRAME_INTERVAL_MS - 1) {
      raf = requestAnimationFrame(tick);
      return;
    }
    const dt = Math.min(sinceLast / 1000, 1 / 12);
    last = now;
    elapsed += dt;

    const m = input.intent();
    const moving = m.x !== 0 || m.y !== 0;

    if (moving) {
      tempFwd.subVectors(rig.root.position, camera.position).setY(0).normalize();
      tempRight.crossVectors(tempFwd, worldUp).normalize();
      tempMove.set(0, 0, 0).addScaledVector(tempFwd, -m.y).addScaledVector(tempRight, m.x);
      if (tempMove.lengthSq() > 1) tempMove.normalize();
      rig.root.position.addScaledVector(tempMove, MOVE_SPEED * dt);
      if (rig.root.position.x > PLATFORM_HALF) rig.root.position.x -= PLATFORM_SIZE;
      else if (rig.root.position.x < -PLATFORM_HALF) rig.root.position.x += PLATFORM_SIZE;
      if (rig.root.position.z > PLATFORM_HALF) rig.root.position.z -= PLATFORM_SIZE;
      else if (rig.root.position.z < -PLATFORM_HALF) rig.root.position.z += PLATFORM_SIZE;
      facing = Math.atan2(tempMove.x, tempMove.z);
      walkPhase += dt * WALK_RATE;
    }
    rig.root.rotation.y = facing;

    const targetActive = moving ? 1 : 0;
    walkActive += (targetActive - walkActive) * Math.min(dt * 14, 1);

    const swing = Math.sin(walkPhase) * walkActive;
    rig.legPivotL.rotation.x = swing * LEG_AMP;
    rig.legPivotR.rotation.x = -swing * LEG_AMP;
    rig.armPivotL.rotation.x = -swing * ARM_AMP;
    rig.armPivotR.rotation.x = swing * ARM_AMP;
    rig.chest.rotation.y = -swing * CHEST_TWIST;
    rig.hip.rotation.y = swing * CHEST_TWIST * 0.6;
    rig.hip.rotation.z = swing * HIP_ROLL;
    const targetHover = moving ? HOVER_HEIGHT : 0;
    hoverY += (targetHover - hoverY) * Math.min(dt * 5, 1);
    const bob = Math.abs(Math.cos(walkPhase)) * 0.05 * walkActive;
    rig.visual.position.y = bob + hoverY;

    updateTendrils(dt, moving || hoverY > 0.05);
    checkObeliskApproach();

    const portRelX = rig.root.position.x - port.position.x;
    const portRelZ = rig.root.position.z - port.position.z;
    const wrappedDx =
      ((((portRelX + PLATFORM_HALF) % PLATFORM_SIZE) + PLATFORM_SIZE) % PLATFORM_SIZE) -
      PLATFORM_HALF;
    const wrappedDz =
      ((((portRelZ + PLATFORM_HALF) % PLATFORM_SIZE) + PLATFORM_SIZE) % PLATFORM_SIZE) -
      PLATFORM_HALF;
    const portDist = Math.sqrt(wrappedDx * wrappedDx + wrappedDz * wrappedDz);
    const proximity = Math.max(0, Math.min(1, (5 - portDist) / 4));
    const pulse = 0.6 + Math.sin(elapsed * 2.4) * 0.12;
    (portInside.material as MeshStandardMaterialType).emissiveIntensity = pulse + proximity * 0.5;

    camera.position.copy(rig.root.position).add(cameraOffset);
    camera.lookAt(rig.root.position.x, rig.root.position.y + 0.9, rig.root.position.z);

    if (netSession && now - lastNetSend >= NET_SEND_MS) {
      netSession.sendMove(rig.root.position.x, rig.root.position.z, facing);
      lastNetSend = now;
    }

    skybox.position.x = rig.root.position.x;
    skybox.position.z = rig.root.position.z;
    const uTimeUniform = skyboxMaterial.uniforms.uTime as Uniform<number> | undefined;
    if (uTimeUniform) uTimeUniform.value = elapsed;

    renderer.getClearColor(savedClear);
    const savedAlpha = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);
    camera.layers.set(CHARACTER_LAYER);
    const sceneBg = scene.background;
    scene.background = null;
    renderer.setRenderTarget(characterTarget);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    scene.background = sceneBg;
    camera.layers.enableAll();
    renderer.setClearColor(savedClear, savedAlpha);

    if (normalsTarget && normalsMaterial) {
      const prevOverride = scene.overrideMaterial;
      scene.overrideMaterial = normalsMaterial;
      const prevBg = scene.background;
      scene.background = null;
      renderer.setClearColor(0x808080, 1);
      renderer.setRenderTarget(normalsTarget);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      scene.overrideMaterial = prevOverride;
      scene.background = prevBg;
      renderer.setClearColor(savedClear, savedAlpha);
    }

    composer.render();

    // Project the player code badge to screen space (above the head).
    tempTag.set(rig.root.position.x, rig.root.position.y + 2.55 + hoverY, rig.root.position.z);
    tempTag.project(camera);
    const tagX = (tempTag.x * 0.5 + 0.5) * (host.clientWidth || 1);
    const tagY = (-tempTag.y * 0.5 + 0.5) * (host.clientHeight || 1);
    const visible = tempTag.z > -1 && tempTag.z < 1;
    playerTagEl.style.opacity = visible ? '1' : '0';
    playerTagEl.style.transform = `translate(${tagX}px, ${tagY}px) translate(-50%, -100%)`;

    frameCount++;
    if (now - frameWindowStart >= 500) {
      const fps = Math.round((frameCount * 1000) / (now - frameWindowStart));
      fpsEl.textContent = `${fps} fps`;
      frameCount = 0;
      frameWindowStart = now;
    }

    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  function triggerEmote(text: string): void {
    const bubble = document.createElement('div');
    bubble.className = 'emote-float';
    bubble.textContent = text;
    host.appendChild(bubble);
    requestAnimationFrame(() => {
      bubble.classList.add('emote-float--rise');
    });
    setTimeout(() => {
      if (bubble.parentNode === host) host.removeChild(bubble);
    }, 1400);
  }

  const dispose = (): void => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    input.dispose();
    if (netSession) {
      void netSession.dispose();
    }
    for (const avatar of remoteAvatars.values()) {
      scene.remove(avatar);
    }
    remoteAvatars.clear();
    composer.dispose();
    characterTarget.dispose();
    normalsTarget?.dispose();
    normalsMaterial?.dispose();
    skyboxMaterial.dispose();
    renderer.dispose();
    worldAtlas.texture.dispose();
    characterAtlas.texture.dispose();
    edgeAtlas.texture.dispose();
    if (fpsEl.parentNode === host) host.removeChild(fpsEl);
    if (netEl.parentNode === host) host.removeChild(netEl);
    if (playerTagEl.parentNode === host) host.removeChild(playerTagEl);
    if (renderer.domElement.parentNode === host) {
      host.removeChild(renderer.domElement);
    }
  };

  return { dispose, triggerEmote };
}
