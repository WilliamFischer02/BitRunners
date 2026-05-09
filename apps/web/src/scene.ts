import { buildGlyphAtlas, createAsciiPass, setAsciiPassResolution } from '@bitrunners/ascii';
import {
  BoxGeometry,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { createInput } from './input.js';

const MOVE_SPEED = 3.2;
const PLATFORM_HALF = 9.5;

function buildBitSpekter(): Group {
  const g = new Group();
  const armor = new MeshStandardMaterial({ color: 0xbcc2c8, roughness: 0.55, metalness: 0.25 });
  const dark = new MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.7, metalness: 0.15 });
  const accent = new MeshStandardMaterial({ color: 0x8a9098, roughness: 0.8, metalness: 0.1 });

  const head = new Mesh(new SphereGeometry(0.34, 18, 14), armor);
  head.position.y = 1.58;
  head.scale.set(1.0, 1.05, 0.92);
  g.add(head);

  const visor = new Mesh(new BoxGeometry(0.5, 0.18, 0.06), dark);
  visor.position.set(0, 1.58, 0.31);
  g.add(visor);

  const visorCrossV = new Mesh(new BoxGeometry(0.06, 0.5, 0.04), accent);
  visorCrossV.position.set(0, 1.45, 0.34);
  g.add(visorCrossV);
  const visorCrossH = new Mesh(new BoxGeometry(0.42, 0.06, 0.04), accent);
  visorCrossH.position.set(0, 1.62, 0.34);
  g.add(visorCrossH);

  const torso = new Mesh(new BoxGeometry(0.78, 0.78, 0.46), armor);
  torso.position.y = 0.98;
  g.add(torso);

  const beltSeam = new Mesh(new BoxGeometry(0.8, 0.08, 0.48), dark);
  beltSeam.position.y = 0.62;
  g.add(beltSeam);

  const chestPlate = new Mesh(new BoxGeometry(0.5, 0.32, 0.04), dark);
  chestPlate.position.set(0, 1.05, 0.24);
  g.add(chestPlate);

  const armL = new Mesh(new BoxGeometry(0.2, 0.7, 0.24), armor);
  armL.position.set(-0.52, 1.0, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.52;
  g.add(armR);

  const handL = new Mesh(new BoxGeometry(0.22, 0.18, 0.26), dark);
  handL.position.set(-0.52, 0.6, 0);
  g.add(handL);
  const handR = handL.clone();
  handR.position.x = 0.52;
  g.add(handR);

  const legL = new Mesh(new BoxGeometry(0.24, 0.62, 0.28), armor);
  legL.position.set(-0.2, 0.31, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.2;
  g.add(legR);

  const bootL = new Mesh(new BoxGeometry(0.28, 0.12, 0.36), dark);
  bootL.position.set(-0.2, 0.06, 0.04);
  g.add(bootL);
  const bootR = bootL.clone();
  bootR.position.x = 0.2;
  g.add(bootR);

  return g;
}

export function startScene(host: HTMLElement): () => void {
  const renderer = new WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(1);
  host.appendChild(renderer.domElement);

  const scene = new Scene();
  scene.background = new Color(0x000000);

  const camera = new PerspectiveCamera(38, 1, 0.1, 200);
  const cameraOffset = new Vector3(7, 9, 7);

  scene.add(new HemisphereLight(0xffffff, 0x202020, 0.45));
  const sun = new DirectionalLight(0xffffff, 1.7);
  sun.position.set(6, 10, 4);
  scene.add(sun);
  const fill = new DirectionalLight(0x8aa0c0, 0.4);
  fill.position.set(-5, 4, -5);
  scene.add(fill);

  const platform = new Mesh(
    new PlaneGeometry(PLATFORM_HALF * 2, PLATFORM_HALF * 2, 1, 1),
    new MeshStandardMaterial({ color: 0x6a6e74, roughness: 0.95, metalness: 0.05 }),
  );
  platform.rotation.x = -Math.PI / 2;
  scene.add(platform);

  const grid = new Mesh(
    new BoxGeometry(PLATFORM_HALF * 2 - 0.4, 0.02, 0.06),
    new MeshStandardMaterial({ color: 0x3a3e44, roughness: 1 }),
  );
  for (let i = -3; i <= 3; i++) {
    const a = grid.clone();
    a.position.set(0, 0.01, i * 2.4);
    scene.add(a);
    const b = grid.clone();
    b.rotation.y = Math.PI / 2;
    b.position.set(i * 2.4, 0.01, 0);
    scene.add(b);
  }

  const port = new Mesh(
    new BoxGeometry(1.2, 2.0, 0.4),
    new MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.4, metalness: 0.4 }),
  );
  port.position.set(-6, 1.0, -6);
  scene.add(port);
  const portInside = new Mesh(
    new BoxGeometry(0.8, 1.4, 0.05),
    new MeshStandardMaterial({ color: 0x101418, emissive: 0x223344, roughness: 1 }),
  );
  portInside.position.set(-6, 1.0, -5.79);
  scene.add(portInside);

  const player = buildBitSpekter();
  scene.add(player);

  const atlas = buildGlyphAtlas({
    ramp: ' ·.:-=+*#░▒▓█',
    cellSize: 7,
    fontSize: 9,
  });

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const asciiPass = createAsciiPass({
    atlas,
    resolution: { width: 1, height: 1 },
    tint: [0.84, 0.92, 0.86],
    background: [0.03, 0.05, 0.04],
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

  function tick(now: number): void {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;

    const m = input.intent();
    if (m.x !== 0 || m.y !== 0) {
      tempFwd.subVectors(player.position, camera.position).setY(0).normalize();
      tempRight.crossVectors(tempFwd, worldUp).normalize();
      tempMove.set(0, 0, 0).addScaledVector(tempFwd, -m.y).addScaledVector(tempRight, m.x);
      if (tempMove.lengthSq() > 1) tempMove.normalize();
      player.position.addScaledVector(tempMove, MOVE_SPEED * dt);
      player.position.x = Math.max(-PLATFORM_HALF, Math.min(PLATFORM_HALF, player.position.x));
      player.position.z = Math.max(-PLATFORM_HALF, Math.min(PLATFORM_HALF, player.position.z));
      facing = Math.atan2(tempMove.x, tempMove.z);
    }
    player.rotation.y = facing;

    camera.position.copy(player.position).add(cameraOffset);
    camera.lookAt(player.position.x, player.position.y + 1, player.position.z);

    composer.render();
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    input.dispose();
    composer.dispose();
    renderer.dispose();
    atlas.texture.dispose();
    if (renderer.domElement.parentNode === host) {
      host.removeChild(renderer.domElement);
    }
  };
}
