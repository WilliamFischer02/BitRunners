import { buildGlyphAtlas, createAsciiPass, setAsciiPassResolution } from '@bitrunners/ascii';
import {
  BoxGeometry,
  Color,
  DepthTexture,
  DirectionalLight,
  Group,
  HemisphereLight,
  type Mesh,
  Mesh as MeshClass,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  SphereGeometry,
  UnsignedShortType,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { createInput } from './input.js';

const MOVE_SPEED = 3.2;
const PLATFORM_HALF = 9.5;
const WALK_RATE = 8.5;
const ARM_AMP = 0.55;
const LEG_AMP = 0.45;
const CHEST_TWIST = 0.12;
const HIP_ROLL = 0.05;

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

  const armor = new MeshStandardMaterial({ color: 0xd4d8dc, roughness: 0.55, metalness: 0.25 });
  const dark = new MeshStandardMaterial({ color: 0x3c4046, roughness: 0.7, metalness: 0.15 });
  const accent = new MeshStandardMaterial({ color: 0xa6acb4, roughness: 0.8, metalness: 0.1 });

  const head = new MeshClass(new SphereGeometry(0.34, 18, 14), armor);
  head.position.y = 0.58;
  head.scale.set(1.0, 1.05, 0.92);
  chest.add(head);

  const visor = new MeshClass(new BoxGeometry(0.5, 0.18, 0.06), dark);
  visor.position.set(0, 0.58, 0.31);
  chest.add(visor);

  const visorCrossV = new MeshClass(new BoxGeometry(0.06, 0.5, 0.04), accent);
  visorCrossV.position.set(0, 0.45, 0.34);
  chest.add(visorCrossV);
  const visorCrossH = new MeshClass(new BoxGeometry(0.42, 0.06, 0.04), accent);
  visorCrossH.position.set(0, 0.62, 0.34);
  chest.add(visorCrossH);

  const torso = new MeshClass(new BoxGeometry(0.78, 0.78, 0.46), armor);
  torso.position.y = -0.02;
  chest.add(torso);

  const beltSeam = new MeshClass(new BoxGeometry(0.8, 0.08, 0.48), dark);
  beltSeam.position.y = -0.38;
  chest.add(beltSeam);

  const chestPlate = new MeshClass(new BoxGeometry(0.5, 0.32, 0.04), dark);
  chestPlate.position.set(0, 0.05, 0.24);
  chest.add(chestPlate);

  const armPivotL = new Group();
  armPivotL.position.set(-0.52, 0.32, 0);
  chest.add(armPivotL);
  const armMeshL: Mesh = new MeshClass(new BoxGeometry(0.2, 0.7, 0.24), armor);
  armMeshL.position.y = -0.35;
  armPivotL.add(armMeshL);
  const handL: Mesh = new MeshClass(new BoxGeometry(0.22, 0.18, 0.26), dark);
  handL.position.y = -0.79;
  armPivotL.add(handL);

  const armPivotR = new Group();
  armPivotR.position.set(0.52, 0.32, 0);
  chest.add(armPivotR);
  const armMeshR: Mesh = new MeshClass(new BoxGeometry(0.2, 0.7, 0.24), armor);
  armMeshR.position.y = -0.35;
  armPivotR.add(armMeshR);
  const handR: Mesh = new MeshClass(new BoxGeometry(0.22, 0.18, 0.26), dark);
  handR.position.y = -0.79;
  armPivotR.add(handR);

  const legPivotL = new Group();
  legPivotL.position.set(-0.2, -0.03, 0);
  hip.add(legPivotL);
  const legMeshL: Mesh = new MeshClass(new BoxGeometry(0.24, 0.62, 0.28), armor);
  legMeshL.position.y = -0.31;
  legPivotL.add(legMeshL);
  const bootL: Mesh = new MeshClass(new BoxGeometry(0.28, 0.12, 0.36), dark);
  bootL.position.set(0, -0.68, 0.04);
  legPivotL.add(bootL);

  const legPivotR = new Group();
  legPivotR.position.set(0.2, -0.03, 0);
  hip.add(legPivotR);
  const legMeshR: Mesh = new MeshClass(new BoxGeometry(0.24, 0.62, 0.28), armor);
  legMeshR.position.y = -0.31;
  legPivotR.add(legMeshR);
  const bootR: Mesh = new MeshClass(new BoxGeometry(0.28, 0.12, 0.36), dark);
  bootR.position.set(0, -0.68, 0.04);
  legPivotR.add(bootR);

  return { root, visual, chest, hip, armPivotL, armPivotR, legPivotL, legPivotR };
}

export function startScene(host: HTMLElement): () => void {
  const renderer = new WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(1);
  renderer.toneMappingExposure = 1.15;
  host.appendChild(renderer.domElement);

  const scene = new Scene();
  scene.background = new Color(0x070a09);

  const camera = new PerspectiveCamera(38, 1, 0.1, 200);
  const cameraOffset = new Vector3(4.5, 9.5, 4.5);

  scene.add(new HemisphereLight(0xffffff, 0x303338, 1.05));
  const sun = new DirectionalLight(0xffffff, 1.9);
  sun.position.set(6, 10, 4);
  scene.add(sun);
  const fill = new DirectionalLight(0x9aaecc, 0.55);
  fill.position.set(-5, 4, -5);
  scene.add(fill);

  const platform = new MeshClass(
    new PlaneGeometry(PLATFORM_HALF * 2, PLATFORM_HALF * 2, 1, 1),
    new MeshStandardMaterial({ color: 0xa8acb2, roughness: 0.95, metalness: 0.05 }),
  );
  platform.rotation.x = -Math.PI / 2;
  scene.add(platform);

  const gridProto = new MeshClass(
    new BoxGeometry(PLATFORM_HALF * 2 - 0.4, 0.02, 0.06),
    new MeshStandardMaterial({ color: 0x4c5056, roughness: 1 }),
  );
  for (let i = -3; i <= 3; i++) {
    const a = gridProto.clone();
    a.position.set(0, 0.01, i * 2.4);
    scene.add(a);
    const b = gridProto.clone();
    b.rotation.y = Math.PI / 2;
    b.position.set(i * 2.4, 0.01, 0);
    scene.add(b);
  }

  const port = new MeshClass(
    new BoxGeometry(1.4, 2.2, 0.4),
    new MeshStandardMaterial({ color: 0xc4c8d0, roughness: 0.4, metalness: 0.4 }),
  );
  port.position.set(-6.5, 1.1, -6.5);
  scene.add(port);
  const portInside = new MeshClass(
    new BoxGeometry(0.95, 1.55, 0.05),
    new MeshStandardMaterial({
      color: 0x141820,
      emissive: 0x355577,
      emissiveIntensity: 0.7,
      roughness: 1,
    }),
  );
  portInside.position.set(-6.5, 1.1, -6.29);
  scene.add(portInside);

  const rig = buildBitSpekter();
  scene.add(rig.root);

  const atlas = buildGlyphAtlas({
    ramp: ' .·-:;=+*░#▒▓█',
    cellSize: 8,
    fontSize: 10,
  });

  const depthTexture = new DepthTexture(1, 1);
  depthTexture.type = UnsignedShortType;
  const composerTarget = new WebGLRenderTarget(1, 1, {
    format: RGBAFormat,
    depthBuffer: true,
    depthTexture,
  });

  const composer = new EffectComposer(renderer, composerTarget);
  composer.addPass(new RenderPass(scene, camera));
  const asciiPass = createAsciiPass({
    atlas,
    resolution: { width: 1, height: 1 },
    tint: [0.86, 0.93, 0.88],
    background: [0.025, 0.04, 0.035],
    lumGain: 1.2,
    lumBias: 0.04,
    gamma: 1.0,
    dither: 0.6,
    depthTexture,
    cameraNear: camera.near,
    cameraFar: camera.far,
    edgeThreshold: 0.06,
  });
  composer.addPass(asciiPass);
  composer.addPass(new OutputPass());

  function resize(): void {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    setAsciiPassResolution(asciiPass, w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();

  const ro = new ResizeObserver(resize);
  ro.observe(host);

  const input = createInput(host);

  const tempFwd = new Vector3();
  const tempRight = new Vector3();
  const tempMove = new Vector3();
  const worldUp = new Vector3(0, 1, 0);

  let raf = 0;
  let last = performance.now();
  let facing = 0;
  let walkPhase = 0;
  let walkActive = 0;

  function tick(now: number): void {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;

    const m = input.intent();
    const moving = m.x !== 0 || m.y !== 0;

    if (moving) {
      tempFwd.subVectors(rig.root.position, camera.position).setY(0).normalize();
      tempRight.crossVectors(tempFwd, worldUp).normalize();
      tempMove.set(0, 0, 0).addScaledVector(tempFwd, -m.y).addScaledVector(tempRight, m.x);
      if (tempMove.lengthSq() > 1) tempMove.normalize();
      rig.root.position.addScaledVector(tempMove, MOVE_SPEED * dt);
      rig.root.position.x = Math.max(-PLATFORM_HALF, Math.min(PLATFORM_HALF, rig.root.position.x));
      rig.root.position.z = Math.max(-PLATFORM_HALF, Math.min(PLATFORM_HALF, rig.root.position.z));
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
    rig.visual.position.y = Math.abs(Math.cos(walkPhase)) * 0.05 * walkActive;

    camera.position.copy(rig.root.position).add(cameraOffset);
    camera.lookAt(rig.root.position.x, rig.root.position.y + 0.9, rig.root.position.z);

    composer.render();
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    input.dispose();
    composer.dispose();
    composerTarget.dispose();
    depthTexture.dispose();
    renderer.dispose();
    atlas.texture.dispose();
    if (renderer.domElement.parentNode === host) {
      host.removeChild(renderer.domElement);
    }
  };
}
