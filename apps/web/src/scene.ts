import { buildGlyphAtlas, createAsciiPass, setAsciiPassResolution } from '@bitrunners/ascii';
import {
  BoxGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';

export function startScene(host: HTMLElement): () => void {
  const renderer = new WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(1);
  host.appendChild(renderer.domElement);

  const scene = new Scene();
  scene.background = new Color(0x000000);

  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(2.5, 2.2, 3.2);
  camera.lookAt(0, 0, 0);

  scene.add(new HemisphereLight(0xffffff, 0x202020, 0.6));
  const sun = new DirectionalLight(0xffffff, 1.4);
  sun.position.set(3, 5, 2);
  scene.add(sun);

  const cube = new Mesh(
    new BoxGeometry(1, 1, 1),
    new MeshStandardMaterial({ color: 0xcccccc, roughness: 0.7, metalness: 0.1 }),
  );
  scene.add(cube);

  const atlas = buildGlyphAtlas({
    ramp: ' .,:;i1tfLCG08@',
    cellSize: 8,
  });

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const asciiPass = createAsciiPass({
    atlas,
    resolution: { width: 1, height: 1 },
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

  let raf = 0;
  let last = performance.now();
  function tick(now: number): void {
    const dt = (now - last) / 1000;
    last = now;
    cube.rotation.x += dt * 0.5;
    cube.rotation.y += dt * 0.7;
    composer.render();
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    composer.dispose();
    renderer.dispose();
    atlas.texture.dispose();
    if (renderer.domElement.parentNode === host) {
      host.removeChild(renderer.domElement);
    }
  };
}
