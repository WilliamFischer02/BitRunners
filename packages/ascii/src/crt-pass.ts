import { ShaderMaterial, Uniform } from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Lightweight CRT/diode finishing pass: fixed-count scanlines, edge vignette,
// and a faint chromatic split toward the corners. Plain-RGBA, single texture
// read fan-out, all UV-space math (resolution-independent) — deliberately
// mobile/iOS-safe (no DepthTexture, no MRT, no float targets; see devlog 0008).
// Sits AFTER the ASCII pass, BEFORE OutputPass.

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform float uScanline;       // 0..1 darkening on scan troughs
  uniform float uScanlineCount;  // fixed band count (resolution-independent)
  uniform float uVignette;       // 0..1 corner darkening
  uniform float uAberration;     // chromatic split amount (UV-scaled)

  varying vec2 vUv;

  void main() {
    vec2 center = vUv - 0.5;
    float dist = dot(center, center); // 0 .. ~0.5

    // Chromatic aberration: split R/B outward, growing toward the edges.
    vec2 off = center * (uAberration * dist);
    vec3 color;
    color.r = texture2D(tDiffuse, vUv + off).r;
    color.g = texture2D(tDiffuse, vUv).g;
    color.b = texture2D(tDiffuse, vUv - off).b;

    // Fixed-count horizontal scanlines (no resize moiré, no time roll).
    float line = sin(vUv.y * uScanlineCount * 3.14159265);
    float scanMul = 1.0 - uScanline * (0.5 - 0.5 * line);
    color *= scanMul;

    // Soft corner vignette.
    float vig = 1.0 - uVignette * smoothstep(0.18, 0.85, dist * 2.4);
    color *= vig;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export interface CrtPassOptions {
  /** Scanline trough darkening, 0..1. Default 0.10. */
  scanline?: number;
  /** Number of scanline bands across the height (resolution-independent). Default 300. */
  scanlineCount?: number;
  /** Corner vignette strength, 0..1. Default 0.25. */
  vignette?: number;
  /** Chromatic aberration amount (UV-scaled). Default 0.4. */
  aberration?: number;
}

export function createCrtPass(options: CrtPassOptions = {}): ShaderPass {
  const material = new ShaderMaterial({
    uniforms: {
      tDiffuse: new Uniform(null),
      uScanline: new Uniform(options.scanline ?? 0.1),
      uScanlineCount: new Uniform(options.scanlineCount ?? 300),
      uVignette: new Uniform(options.vignette ?? 0.25),
      uAberration: new Uniform(options.aberration ?? 0.4),
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
  });

  return new ShaderPass(material, 'tDiffuse');
}
