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
  uniform sampler2D tGlyphsCharacter;
  uniform sampler2D tEdgeGlyphs;
  uniform sampler2D tCharacter;
  uniform sampler2D tNormals;
  uniform vec2 uResolution;
  uniform float uCellSize;
  uniform float uGlyphCount;
  uniform float uEdgeGlyphCount;
  uniform vec3 uTint;
  uniform vec3 uTintTop;
  uniform vec3 uBackground;
  uniform float uLumGain;
  uniform float uLumBias;
  uniform float uGamma;
  uniform float uDither;
  uniform float uEdgeStrength;
  uniform float uEdgeThreshold;
  uniform float uHasCharacterMask;
  uniform float uBackgroundDim;
  uniform float uCharacterGlow;
  uniform float uHasNormals;

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

    float maskWeight = 0.0;
    float charLum = 0.0;
    if (uHasCharacterMask > 0.5) {
      vec4 cSample = texture2D(tCharacter, cellCenterUv);
      float cMask = max(cSample.a, lumOf(cSample.rgb));
      maskWeight = smoothstep(0.0, 0.04, cMask);
      charLum = lumOf(cSample.rgb);
    }

    bool isEdge = false;
    if (uEdgeStrength > 0.0 && maskWeight < 0.5) {
      vec2 step = vec2(uCellSize) / uResolution;
      float lL = lumOf(texture2D(tDiffuse, cellCenterUv - vec2(step.x, 0.0)).rgb);
      float lR = lumOf(texture2D(tDiffuse, cellCenterUv + vec2(step.x, 0.0)).rgb);
      float lU = lumOf(texture2D(tDiffuse, cellCenterUv - vec2(0.0, step.y)).rgb);
      float lD = lumOf(texture2D(tDiffuse, cellCenterUv + vec2(0.0, step.y)).rgb);
      float gx = lR - lL;
      float gy = lD - lU;
      float edge = sqrt(gx * gx + gy * gy) * uEdgeStrength;
      if (edge > uEdgeThreshold) {
        isEdge = true;
        glyphIdx = uGlyphCount - 1.0;
      }
    }

    vec2 cellLocal = (pixel - cellOrigin) / uCellSize;

    float vBlend = smoothstep(0.45, 0.85, vUv.y);
    vec3 cellTint = mix(uTint, uTintTop, vBlend);

    vec3 color;
    if (isEdge && uHasNormals > 0.5) {
      vec3 n = texture2D(tNormals, cellCenterUv).rgb * 2.0 - 1.0;
      float ax = abs(n.x);
      float ay = abs(n.y);
      float dirIdx;
      if (ay > ax) {
        dirIdx = n.y > 0.0 ? 1.0 : 2.0;
      } else {
        dirIdx = n.x > 0.0 ? 4.0 : 3.0;
      }
      vec2 edgeUv = vec2(
        (dirIdx + cellLocal.x) / uEdgeGlyphCount,
        1.0 - cellLocal.y
      );
      float edgeMask = texture2D(tEdgeGlyphs, edgeUv).r;
      color = mix(uBackground, cellTint, edgeMask);
    } else {
      vec2 glyphUv = vec2(
        (glyphIdx + cellLocal.x) / uGlyphCount,
        1.0 - cellLocal.y
      );
      float bgGlyph = texture2D(tGlyphs, glyphUv).r;
      float chGlyph = texture2D(tGlyphsCharacter, glyphUv).r;
      float glyphMask = mix(bgGlyph, chGlyph, maskWeight);
      color = mix(uBackground, cellTint, glyphMask);
    }

    if (uHasCharacterMask > 0.5) {
      float dim = mix(uBackgroundDim, 1.0, maskWeight);
      color *= dim;
      float heightBoost = mix(0.95, uCharacterGlow, smoothstep(0.05, 0.55, charLum));
      color = mix(color, color * heightBoost, maskWeight);
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

export interface AsciiPassOptions {
  atlas: GlyphAtlas;
  /** Optional second atlas used inside the character mask. Must match `atlas` in cellSize and glyphCount. */
  characterAtlas?: GlyphAtlas;
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
  /** Brightness boost on the highest-lum character cells (e.g. helmet). Default 1.0. */
  characterGlow?: number;
  /** Optional secondary tint blended toward the top of the screen. Default = `tint`. */
  tintTop?: [number, number, number];
  /** Optional atlas of directional edge glyphs (space ▀ ▄ ▌ ▐ at indices 0..4). */
  edgeAtlas?: GlyphAtlas;
  /** Optional RGBA texture of scene normals (MeshNormalMaterial pass). Enables Stage B v0.2. */
  normalsTexture?: Texture;
}

function placeholderTexture(): DataTexture {
  const data = new Uint8Array([0, 0, 0, 0]);
  const t = new DataTexture(data, 1, 1, RGBAFormat, UnsignedByteType);
  t.needsUpdate = true;
  return t;
}

export function createAsciiPass(options: AsciiPassOptions): ShaderPass {
  const { atlas, resolution } = options;
  const characterAtlas = options.characterAtlas ?? atlas;
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
  const characterGlow = options.characterGlow ?? 1.0;
  const tintTop = options.tintTop ?? tint;
  const edgeAtlas = options.edgeAtlas ?? atlas;
  const normalsTexture = options.normalsTexture;

  const material = new ShaderMaterial({
    uniforms: {
      tDiffuse: new Uniform(null),
      tGlyphs: new Uniform(atlas.texture),
      tGlyphsCharacter: new Uniform(characterAtlas.texture),
      tEdgeGlyphs: new Uniform(edgeAtlas.texture),
      tCharacter: new Uniform(characterTexture ?? placeholderTexture()),
      tNormals: new Uniform(normalsTexture ?? placeholderTexture()),
      uResolution: new Uniform(new Vector2(resolution.width, resolution.height)),
      uCellSize: new Uniform(atlas.cellSize),
      uGlyphCount: new Uniform(atlas.glyphCount),
      uEdgeGlyphCount: new Uniform(edgeAtlas.glyphCount),
      uTint: new Uniform(new Vector3(tint[0], tint[1], tint[2])),
      uTintTop: new Uniform(new Vector3(tintTop[0], tintTop[1], tintTop[2])),
      uBackground: new Uniform(new Vector3(background[0], background[1], background[2])),
      uLumGain: new Uniform(lumGain),
      uLumBias: new Uniform(lumBias),
      uGamma: new Uniform(gamma),
      uDither: new Uniform(dither),
      uEdgeStrength: new Uniform(edgeStrength),
      uEdgeThreshold: new Uniform(edgeThreshold),
      uHasCharacterMask: new Uniform(characterTexture ? 1.0 : 0.0),
      uBackgroundDim: new Uniform(backgroundDim),
      uCharacterGlow: new Uniform(characterGlow),
      uHasNormals: new Uniform(normalsTexture ? 1.0 : 0.0),
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
