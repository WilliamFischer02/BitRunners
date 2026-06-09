// Circuit-board floor shader (Phase 4).
//
// Replaces the previous flat-plane + grid-strips floor with a procedural
// breadboard / circuit-trace look. Fractal-noise FBM acts as a pathbuilder:
// noise is thresholded to extract a thin "trace" mask, which gets tinted
// copper. A slow uTime-driven current pulse animates a brighter ridge
// along the highest-luminance traces.
//
// Constraints (devlog 0008):
//   - Plain RGBA float-free render targets, no derivatives ext, mediump.
//   - Output must survive the ASCII pass: high luminance contrast on
//     traces vs substrate so glyph selection picks them up.
//
// Embeds a public-domain 2D Simplex noise (Ashima Arts / Stefan Gustavson,
// MIT-licensed at github.com/ashima/webgl-noise). Re-rolled inline so we
// don't introduce a new dependency.

import { type IUniform, ShaderMaterial, Uniform, Vector3 } from 'three';

const VERT = /* glsl */ `
  varying vec2 vWorldXZ;
  varying vec3 vNormal;
  void main() {
    // Plane is XY in local space; rotated -PI/2 around X to lie flat. After
    // the rotation, model XY corresponds to world XZ. We forward position.xy
    // (the unrotated plane coords) so the trace pattern stays world-stable
    // even though the geometry is tiled at the wrap-clone level.
    vWorldXZ = position.xy;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Simplex noise from Ashima / Stefan Gustavson, public domain. Inlined.
const FRAG = /* glsl */ `
  precision mediump float;

  varying vec2 vWorldXZ;
  varying vec3 vNormal;

  uniform float uTime;
  uniform vec3  uTraceColor;
  uniform vec3  uSubstrateColor;
  uniform float uScale;
  uniform float uTraceThreshold;
  uniform float uTraceWidth;
  uniform float uCurrentSpeed;

  // ─── Simplex 2D (Ashima) ───────────────────────────────────────────────
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187,
                        0.366025403784439,
                       -0.577350269189626,
                        0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                   + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
                            dot(x12.zw, x12.zw)), 0.0);
    m = m*m;
    m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  // ─── FBM (3 octaves) ───────────────────────────────────────────────────
  float fbm(vec2 p) {
    float total = 0.0;
    float amp = 0.55;
    float freq = 1.0;
    for (int i = 0; i < 3; i++) {
      total += snoise(p * freq) * amp;
      freq *= 2.05;
      amp *= 0.5;
    }
    return total;
  }

  void main() {
    vec2 p = vWorldXZ * uScale;
    // Twist the noise field with itself for turbulent displacement — gives
    // the traces an organic, "wired" feel rather than rolling hills.
    vec2 q = vec2(fbm(p), fbm(p + vec2(5.2, 1.3)));
    vec2 r = vec2(fbm(p + 1.6 * q + vec2(1.7, 9.2) + 0.10 * uTime),
                  fbm(p + 1.6 * q + vec2(8.3, 2.8) - 0.10 * uTime));
    float n = fbm(p + 2.4 * r);

    // Extract a thin contour ring around the iso-line at uTraceThreshold.
    float dist = abs(n - uTraceThreshold);
    float trace = 1.0 - smoothstep(0.0, uTraceWidth, dist);

    // A second, brighter ridge for the secondary trace network.
    float dist2 = abs(n - (uTraceThreshold + 0.18));
    float trace2 = 1.0 - smoothstep(0.0, uTraceWidth * 0.55, dist2);

    // Current pulse: a sine bright-band that travels along the traces
    // (driven by uTime + the noise field so the pulse follows the wires
    //  rather than just sweeping linearly).
    float pulse = 0.5 + 0.5 * sin(n * 12.0 - uTime * uCurrentSpeed);
    pulse = pow(pulse, 6.0);

    vec3 col = uSubstrateColor;
    col = mix(col, uTraceColor, trace);
    col = mix(col, uTraceColor * 1.4, trace2);
    col += uTraceColor * pulse * trace * 0.6;

    // Very subtle response to lighting so the floor doesn't feel painted
    // on. Cheap: just dot the world-up with the surface normal.
    float lambert = clamp(dot(vNormal, vec3(0.0, 1.0, 0.0)), 0.0, 1.0);
    col *= mix(0.78, 1.0, lambert);

    gl_FragColor = vec4(col, 1.0);
  }
`;

export interface CircuitFloorUniforms {
  uTime: IUniform<number>;
  uTraceColor: IUniform<Vector3>;
  uSubstrateColor: IUniform<Vector3>;
  uScale: IUniform<number>;
  uTraceThreshold: IUniform<number>;
  uTraceWidth: IUniform<number>;
  uCurrentSpeed: IUniform<number>;
}

export interface CircuitFloorOptions {
  /** Trace tint in linear RGB [0..1] (copper #c66a32 ~ vec3(0.78, 0.42, 0.20)). */
  traceColor?: [number, number, number];
  /** Dark substrate tint (board background). */
  substrateColor?: [number, number, number];
  /** World-space scale of the noise field (smaller = more zoomed-out pattern). */
  scale?: number;
  /** Noise iso-level the primary trace contour follows (-1..+1). */
  threshold?: number;
  /** Trace contour thickness in noise-space. */
  width?: number;
  /** Pulse speed (radians per uTime second). */
  currentSpeed?: number;
}

export function createCircuitFloorMaterial(
  opts: CircuitFloorOptions = {},
): ShaderMaterial & { uniforms: CircuitFloorUniforms } {
  const trace = opts.traceColor ?? [0.78, 0.42, 0.2];
  const substrate = opts.substrateColor ?? [0.04, 0.06, 0.05];
  const uniforms: CircuitFloorUniforms = {
    uTime: new Uniform(0),
    uTraceColor: new Uniform(new Vector3(trace[0], trace[1], trace[2])),
    uSubstrateColor: new Uniform(new Vector3(substrate[0], substrate[1], substrate[2])),
    uScale: new Uniform(opts.scale ?? 0.36),
    uTraceThreshold: new Uniform(opts.threshold ?? 0.12),
    uTraceWidth: new Uniform(opts.width ?? 0.07),
    uCurrentSpeed: new Uniform(opts.currentSpeed ?? 2.4),
  };

  const mat = new ShaderMaterial({
    uniforms: uniforms as unknown as Record<string, IUniform>,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: false,
  });
  return mat as ShaderMaterial & { uniforms: CircuitFloorUniforms };
}
