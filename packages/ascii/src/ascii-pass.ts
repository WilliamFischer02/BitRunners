import {
  DataTexture,
  RGBAFormat,
  ShaderMaterial,
  type Texture,
  Uniform,
  UnsignedByteType,
  Vector2,
  Vector3,
} from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import type { GlyphAtlas } from './glyph-atlas.js';

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform sampler2D tGlyphs;
  uniform sampler2D tCharacter;
  uniform vec2 uResolution;
  uniform float uCellSize;
  uniform float uGlyphCount;
  uniform vec3 uTint;
  uniform vec3 uBackground;
  uniform float uLumGain;
  uniform float uLumBias;
  uniform float uGamma;
  uniform float uDither;
  uniform float uEdgeStrength;
  uniform float uEdgeThreshold;
  uniform float uHasCharacterMask;
  uniform float uBackgroundDim;

  varying vec2 vUv;

  float lumOf(vec3 c) {
    return dot(c, vec3(0.299, 0.587, 0.114));
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec2 pixel = vUv * uResolution;
    vec2 cellIdx = floor(pixel / uCellSize);
    vec2 cellOrigin = cellIdx * uCellSize;
    vec2 cellCenterUv = (cellOrigin + uCellSize * 0.5) / uResolution;

    vec3 sceneColor = texture2D(tDiffuse, cellCenterUv).rgb;
    float lumRaw = lumOf(sceneColor);
    float lum = pow(clamp(lumRaw * uLumGain + uLumBias, 0.0, 1.0), uGamma);
    lum += (hash(cellIdx) - 0.5) * uDither / uGlyphCount;
    lum = clamp(lum, 0.0, 1.0);

    float glyphIdx = floor(lum * uGlyphCount);
    glyphIdx = clamp(glyphIdx, 0.0, uGlyphCount - 1.0);

    if (uEdgeStrength > 0.0) {
      vec2 step = vec2(uCellSize) / uResolution;
      float lL = lumOf(texture2D(tDiffuse, cellCenterUv - vec2(step.x, 0.0)).rgb);
      float lR = lumOf(texture2D(tDiffuse, cellCenterUv + vec2(step.x, 0.0)).rgb);
      float lU = lumOf(texture2D(tDiffuse, cellCenterUv - vec2(0.0, step.y)).rgb);
      float lD = lumOf(texture2D(tDiffuse, cellCenterUv + vec2(0.0, step.y)).rgb);
      float gx = lR - lL;
      float gy = lD - lU;
      float edge = sqrt(gx * gx + gy * gy) * uEdgeStrength;
      if (edge > uEdgeThreshold) {
        glyphIdx = uGlyphCount - 1.0;
      }
    }

    vec2 cellLocal = (pixel - cellOrigin) / uCellSize;
    vec2 glyphUv = vec2(
      (glyphIdx + cellLocal.x) / uGlyphCount,
      1.0 - cellLocal.y
    );

    float mask = texture2D(tGlyphs, glyphUv).r;
    vec3 color = mix(uBackground, uTint, mask);

    if (uHasCharacterMask > 0.5) {
      vec4 cSample = texture2D(tCharacter, cellCenterUv);
      float cMask = max(cSample.a, lumOf(cSample.rgb));
      float maskWeight = smoothstep(0.0, 0.04, cMask);
      float dim = mix(uBackgroundDim, 1.0, maskWeight);
      color *= dim;
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

export interface AsciiPassOptions {
  atlas: GlyphAtlas;
  resolution: { width: number; height: number };
  /** RGB 0..1 for lit glyph pixels. Default phosphor green. */
  tint?: [number, number, number];
  /** RGB 0..1 for unlit pixels. Default near-black. */
  background?: [number, number, number];
  /** Luminance multiplier before glyph lookup. Default 1.0. */
  lumGain?: number;
  /** Luminance offset before glyph lookup. Default 0.0. */
  lumBias?: number;
  /** Gamma applied to luminance before glyph lookup. <1 brightens shadows. Default 1.0. */
  gamma?: number;
  /** Per-cell luminance noise as a fraction of one glyph step. Default 0.5. */
  dither?: number;
  /** Multiplier on luminance edge. 0 disables silhouette emphasis. Default 0. */
  edgeStrength?: number;
  /** Luminance-gradient threshold for silhouette emphasis. Default 0.18. */
  edgeThreshold?: number;
  /** Optional RGBA texture containing a render of the player character only. */
  characterTexture?: Texture;
  /** Multiplier applied to non-character pixel output color. Default 1.0 (off). */
  backgroundDim?: number;
}

function placeholderTexture(): DataTexture {
  const data = new Uint8Array([0, 0, 0, 0]);
  const t = new DataTexture(data, 1, 1, RGBAFormat, UnsignedByteType);
  t.needsUpdate = true;
  return t;
}

export function createAsciiPass(options: AsciiPassOptions): ShaderPass {
  const { atlas, resolution } = options;
  const tint = options.tint ?? [0.55, 0.95, 0.65];
  const background = options.background ?? [0.02, 0.04, 0.03];
  const lumGain = options.lumGain ?? 1.0;
  const lumBias = options.lumBias ?? 0.0;
  const gamma = options.gamma ?? 1.0;
  const dither = options.dither ?? 0.5;
  const edgeStrength = options.edgeStrength ?? 0.0;
  const edgeThreshold = options.edgeThreshold ?? 0.18;
  const characterTexture = options.characterTexture;
  const backgroundDim = options.backgroundDim ?? 1.0;

  const material = new ShaderMaterial({
    uniforms: {
      tDiffuse: new Uniform(null),
      tGlyphs: new Uniform(atlas.texture),
      tCharacter: new Uniform(characterTexture ?? placeholderTexture()),
      uResolution: new Uniform(new Vector2(resolution.width, resolution.height)),
      uCellSize: new Uniform(atlas.cellSize),
      uGlyphCount: new Uniform(atlas.glyphCount),
      uTint: new Uniform(new Vector3(tint[0], tint[1], tint[2])),
      uBackground: new Uniform(new Vector3(background[0], background[1], background[2])),
      uLumGain: new Uniform(lumGain),
      uLumBias: new Uniform(lumBias),
      uGamma: new Uniform(gamma),
      uDither: new Uniform(dither),
      uEdgeStrength: new Uniform(edgeStrength),
      uEdgeThreshold: new Uniform(edgeThreshold),
      uHasCharacterMask: new Uniform(characterTexture ? 1.0 : 0.0),
      uBackgroundDim: new Uniform(backgroundDim),
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
  });

  return new ShaderPass(material, 'tDiffuse');
}

export function setAsciiPassResolution(pass: ShaderPass, width: number, height: number): void {
  const u = pass.uniforms.uResolution as Uniform<Vector2> | undefined;
  if (u) u.value.set(width, height);
}
