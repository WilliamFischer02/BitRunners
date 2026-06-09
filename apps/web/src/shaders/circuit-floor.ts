// Circuit-board floor shader (Phase 4 — v2 PCB-style rewrite).
//
// v1 thresholded an FBM noise field into blob contours — wrong vibe; read
// as a spray of pixel debris under the ASCII pass, not as wiring. v2
// builds an actual orthogonal wire grid with right-angle bends and round
// vias at junctions. The FBM still plays a role: it drives the
// **density** of the wiring spatially, so some regions are dense and
// chaotic and others have just a few sparse traces. That's the
// "fractal-noise-as-pathbuilder" the owner asked for.
//
// Algorithm (per fragment):
//   1. Quantize world UV into cells (one cell per ~0.6 world units).
//   2. For each of the 4 edges that touch this cell (N/S/E/W), hash both
//      endpoints together so neighboring cells AGREE on whether the
//      edge exists. The hash is biased by FBM density so denser-noise
//      regions get more edges.
//   3. Render each existing edge as a thin straight wire segment from
//      cell-center to cell-center.
//   4. If two or more edges meet at the cell center, draw a round via
//      (slightly larger than the wire), with a darker rim — looks like
//      a PCB through-hole.
//   5. uTime-driven sine pulse modulates intensity so power feels like
//      it's flowing along the traces.
//
// Constraints (devlog 0008):
//   * Plain RGBA float-free targets. No DepthTexture, no MRT, no
//     derivatives extension.
//   * Mediump throughout. Loop body kept tight enough to stay under iOS
//     Safari's frame budget.

import { type IUniform, ShaderMaterial, Uniform, Vector3 } from 'three';

const VERT = /* glsl */ `
  varying vec2 vWorldXZ;
  varying vec3 vNormal;
  void main() {
    // Plane is XY in local space; rotated -PI/2 around X to lie flat. After
    // the rotation, model XY corresponds to world XZ. We forward position.xy
    // (the unrotated plane coords) so the wire pattern stays world-stable
    // across the 3x3 wrap-tile clones.
    vWorldXZ = position.xy;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;

  varying vec2 vWorldXZ;
  varying vec3 vNormal;

  uniform float uTime;
  uniform vec3  uTraceColor;
  uniform vec3  uSubstrateColor;
  uniform float uCellSize;       // world units per cell
  uniform float uWireWidth;      // wire thickness in cell-local space (0..0.5)
  uniform float uDensity;        // global density bias (probability of an edge)
  uniform float uFbmInfluence;   // how strongly FBM modulates local density
  uniform float uCurrentSpeed;   // pulse animation speed (rad / s)

  // ─── Hash + noise ──────────────────────────────────────────────────────
  // Deterministic hash for a 2D point. Used both for per-edge existence
  // and (via 3-octave FBM) for the spatial density envelope.
  float hash21(vec2 p) {
    p = fract(p * vec2(443.897, 441.423));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
  }
  float hash22(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  // Value noise from the hash — cheap, smooth, sufficient for density.
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash22(i);
    float b = hash22(i + vec2(1.0, 0.0));
    float c = hash22(i + vec2(0.0, 1.0));
    float d = hash22(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p) {
    float total = 0.0, amp = 0.55, freq = 1.0;
    for (int i = 0; i < 3; i++) {
      total += vnoise(p * freq) * amp;
      freq *= 2.05;
      amp *= 0.5;
    }
    return total;
  }

  // ─── Edge existence ────────────────────────────────────────────────────
  // Hash a canonical edge key (sorted endpoints) so a -- b and b -- a
  // produce the same hash. Pair with a density threshold so neighboring
  // cells agree on whether the edge between them is wired.
  float edgeOn(vec2 a, vec2 b, float density) {
    vec2 lo = min(a, b);
    vec2 hi = max(a, b);
    float h = hash21(lo * 31.7 + hi * 113.1);
    return step(h, density);
  }

  // Distance to a segment between (0,0) and (vec2)endpt within the cell.
  // The cell-local frame is centered at 0; segment endpoints are at
  // (0, +/-0.5) for N/S, (+/-0.5, 0) for E/W.
  float distToSegment(vec2 p, vec2 a, vec2 b) {
    vec2 ab = b - a;
    float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
    return length(p - (a + t * ab));
  }

  void main() {
    vec2 worldP = vWorldXZ;
    // FBM-driven density envelope. Slow large-scale noise so the dense
    // regions are sphere-of-influence-shaped, not pixel-fine.
    float fbmVal = fbm(worldP * 0.18);
    float density = clamp(uDensity + (fbmVal - 0.5) * uFbmInfluence, 0.05, 0.95);

    // Cell quantization in world space.
    vec2 cellCoord = floor(worldP / uCellSize);
    vec2 cellOriginWorld = cellCoord * uCellSize + uCellSize * 0.5;
    vec2 local = (worldP - cellOriginWorld) / uCellSize; // local in [-0.5, +0.5]

    // Which of the 4 cardinal edges of THIS cell exist?
    vec2 nbN = cellCoord + vec2(0.0, 1.0);
    vec2 nbS = cellCoord + vec2(0.0, -1.0);
    vec2 nbE = cellCoord + vec2(1.0, 0.0);
    vec2 nbW = cellCoord + vec2(-1.0, 0.0);
    float eN = edgeOn(cellCoord, nbN, density);
    float eS = edgeOn(cellCoord, nbS, density);
    float eE = edgeOn(cellCoord, nbE, density);
    float eW = edgeOn(cellCoord, nbW, density);
    float degree = eN + eS + eE + eW;

    // Wire mask: distance to each existing half-segment from cell center
    // to the cell edge midpoint.
    float wireRadius = uWireWidth;
    float wire = 0.0;
    if (eN > 0.5) wire = max(wire, 1.0 - smoothstep(0.0, wireRadius,
                              distToSegment(local, vec2(0.0, 0.0), vec2(0.0, 0.5))));
    if (eS > 0.5) wire = max(wire, 1.0 - smoothstep(0.0, wireRadius,
                              distToSegment(local, vec2(0.0, 0.0), vec2(0.0, -0.5))));
    if (eE > 0.5) wire = max(wire, 1.0 - smoothstep(0.0, wireRadius,
                              distToSegment(local, vec2(0.0, 0.0), vec2(0.5, 0.0))));
    if (eW > 0.5) wire = max(wire, 1.0 - smoothstep(0.0, wireRadius,
                              distToSegment(local, vec2(0.0, 0.0), vec2(-0.5, 0.0))));

    // Via mask: round contact disc at the cell center when at least 2
    // edges meet (or when there's only one edge — terminate the trace
    // with a small pad).
    float viaInner = uWireWidth * 1.8;
    float viaOuter = uWireWidth * 2.6;
    float r = length(local);
    float viaCore = (degree >= 1.5) ? (1.0 - smoothstep(0.0, viaInner, r)) : 0.0;
    float viaRim  = (degree >= 1.5)
      ? (smoothstep(viaInner, viaOuter, r) - smoothstep(viaInner * 1.05, viaOuter, r))
      : 0.0;
    // Single-edge cells get a tiny round terminator pad so wires don't
    // taper to a sharp end.
    float pad = (degree >= 0.5 && degree < 1.5)
      ? (1.0 - smoothstep(0.0, viaInner * 0.6, r))
      : 0.0;

    // Per-cell current pulse — phase varies by hash so the whole board
    // isn't pulsing in unison.
    float phase = hash21(cellCoord + 9.1) * 6.2831;
    float pulse = 0.5 + 0.5 * sin(uTime * uCurrentSpeed + phase);
    pulse = pow(pulse, 4.0);

    // Compose color.
    vec3 col = uSubstrateColor;
    // Wires + pad + via core all use the trace color.
    float metal = max(max(wire, viaCore), pad);
    col = mix(col, uTraceColor, metal);
    // Via rim is darker — reads as the through-hole.
    col = mix(col, uSubstrateColor * 0.4, viaRim);
    // Current pulse brightens the metal slightly.
    col += uTraceColor * pulse * metal * 0.5;

    // Subtle lighting response so the floor doesn't feel painted on.
    float lambert = clamp(dot(vNormal, vec3(0.0, 1.0, 0.0)), 0.0, 1.0);
    col *= mix(0.78, 1.0, lambert);

    gl_FragColor = vec4(col, 1.0);
  }
`;

export interface CircuitFloorUniforms {
  uTime: IUniform<number>;
  uTraceColor: IUniform<Vector3>;
  uSubstrateColor: IUniform<Vector3>;
  uCellSize: IUniform<number>;
  uWireWidth: IUniform<number>;
  uDensity: IUniform<number>;
  uFbmInfluence: IUniform<number>;
  uCurrentSpeed: IUniform<number>;
}

export interface CircuitFloorOptions {
  /** Trace tint in linear RGB [0..1]. Default is warm copper. */
  traceColor?: [number, number, number];
  /** Dark substrate tint (board background). */
  substrateColor?: [number, number, number];
  /** World-space cell size — one wire segment per cell-to-cell hop. */
  cellSize?: number;
  /** Wire thickness in cell-local space (0..0.5). */
  wireWidth?: number;
  /** Base probability that any given edge between two cells is wired
   *  (before FBM modulation). 0..1. */
  density?: number;
  /** How strongly FBM noise pulls density up/down spatially. */
  fbmInfluence?: number;
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
    uCellSize: new Uniform(opts.cellSize ?? 0.6),
    uWireWidth: new Uniform(opts.wireWidth ?? 0.07),
    uDensity: new Uniform(opts.density ?? 0.55),
    uFbmInfluence: new Uniform(opts.fbmInfluence ?? 0.55),
    uCurrentSpeed: new Uniform(opts.currentSpeed ?? 1.6),
  };

  const mat = new ShaderMaterial({
    uniforms: uniforms as unknown as Record<string, IUniform>,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: false,
  });
  return mat as ShaderMaterial & { uniforms: CircuitFloorUniforms };
}
