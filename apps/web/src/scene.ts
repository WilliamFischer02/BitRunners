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

const MOVE_SPEED = 3.2;
const PLATFORM_HALF = 9.5;
const PLATFORM_SIZE = PLATFORM_HALF * 2;
const WALK_RATE = 8.5;
const ARM_AMP = 0.55;
const LEG_AMP = 0.45;
const CHEST_TWIST = 0.12;
const HIP_ROLL = 0.05;

const CHARACTER_LAYER = 1;

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

  const head = new MeshClass(new SphereGeometry(0.34, 18, 14), armorHead);
  head.position.y = 0.58;
  head.scale.set(1.0, 1.05, 0.92);
  chest.add(head);

  const visor = new MeshClass(new BoxGeometry(0.5, 0.18, 0.06), darkUpper);
  visor.position.set(0, 0.58, 0.31);
  chest.add(visor);

  const visorCrossV = new MeshClass(new BoxGeometry(0.06, 0.5, 0.04), accent);
  visorCrossV.position.set(0, 0.45, 0.34);
  chest.add(visorCrossV);
  const visorCrossH = new MeshClass(new BoxGeometry(0.42, 0.06, 0.04), accent);
  visorCrossH.position.set(0, 0.62, 0.34);
  chest.add(visorCrossH);

  const torso = new MeshClass(new BoxGeometry(0.78, 0.78, 0.46), armorTorso);
  torso.position.y = -0.02;
  chest.add(torso);

  const beltSeam = new MeshClass(new BoxGeometry(0.8, 0.08, 0.48), darkUpper);
  beltSeam.position.y = -0.38;
  chest.add(beltSeam);

  const chestPlate = new MeshClass(new BoxGeometry(0.5, 0.32, 0.04), darkUpper);
  chestPlate.position.set(0, 0.05, 0.24);
  chest.add(chestPlate);

  const armPivotL = new Group();
  armPivotL.position.set(-0.52, 0.32, 0);
  chest.add(armPivotL);
  const armMeshL: Mesh = new MeshClass(new BoxGeometry(0.2, 0.7, 0.24), armorTorso);
  armMeshL.position.y = -0.35;
  armPivotL.add(armMeshL);
  const handL: Mesh = new MeshClass(new BoxGeometry(0.22, 0.18, 0.26), darkUpper);
  handL.position.y = -0.79;
  armPivotL.add(handL);

  const armPivotR = new Group();
  armPivotR.position.set(0.52, 0.32, 0);
  chest.add(armPivotR);
  const armMeshR: Mesh = new MeshClass(new BoxGeometry(0.2, 0.7, 0.24), armorTorso);
  armMeshR.position.y = -0.35;
  armPivotR.add(armMeshR);
  const handR: Mesh = new MeshClass(new BoxGeometry(0.22, 0.18, 0.26), darkUpper);
  handR.position.y = -0.79;
  armPivotR.add(handR);

  const legPivotL = new Group();
  legPivotL.position.set(-0.2, -0.03, 0);
  hip.add(legPivotL);
  const legMeshL: Mesh = new MeshClass(new BoxGeometry(0.24, 0.62, 0.28), armorLegs);
  legMeshL.position.y = -0.31;
  legPivotL.add(legMeshL);
  const bootL: Mesh = new MeshClass(new BoxGeometry(0.28, 0.12, 0.36), darkLower);
  bootL.position.set(0, -0.68, 0.04);
  legPivotL.add(bootL);

  const legPivotR = new Group();
  legPivotR.position.set(0.2, -0.03, 0);
  hip.add(legPivotR);
  const legMeshR: Mesh = new MeshClass(new BoxGeometry(0.24, 0.62, 0.28), armorLegs);
  legMeshR.position.y = -0.31;
  legPivotR.add(legMeshR);
  const bootR: Mesh = new MeshClass(new BoxGeometry(0.28, 0.12, 0.36), darkLower);
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
    new MeshStandardMaterial({ color: 0xa8acb2, roughness: 0.95, metalness: 0.05 }),
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
      emissive: 0x88aa66,
      emissiveIntensity: 0.55,
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
      emissive: 0x66ccaa,
      emissiveIntensity: 0.45,
      roughness: 1,
    }),
  );
  terminalScreen.position.set(-5.5, 0.55, 6.81);
  terminalScreen.rotation.x = -0.3;
  worldTile.add(terminalScreen);

  const tuftMaterial = new MeshStandardMaterial({
    color: 0x6f8458,
    emissive: 0x1a2814,
    emissiveIntensity: 0.5,
    roughness: 0.9,
  });
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

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const asciiPass = createAsciiPass({
    atlas: worldAtlas,
    characterAtlas,
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
  });
  composer.addPass(asciiPass);
  composer.addPass(new OutputPass());

  const fpsEl = document.createElement('div');
  fpsEl.className = 'fps';
  fpsEl.textContent = '-- fps';
  host.appendChild(fpsEl);

  function resize(): void {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    characterTarget.setSize(w, h);
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
  const savedClear = new Color();

  let raf = 0;
  let last = performance.now();
  let facing = 0;
  let walkPhase = 0;
  let walkActive = 0;
  let elapsed = 0;
  let frameCount = 0;
  let frameWindowStart = last;

  function tick(now: number): void {
    const dt = Math.min((now - last) / 1000, 1 / 30);
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
    rig.visual.position.y = Math.abs(Math.cos(walkPhase)) * 0.05 * walkActive;

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

    composer.render();

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

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    input.dispose();
    composer.dispose();
    characterTarget.dispose();
    skyboxMaterial.dispose();
    renderer.dispose();
    worldAtlas.texture.dispose();
    characterAtlas.texture.dispose();
    if (fpsEl.parentNode === host) host.removeChild(fpsEl);
    if (renderer.domElement.parentNode === host) {
      host.removeChild(renderer.domElement);
    }
  };
}
