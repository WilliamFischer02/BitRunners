import { ShaderMaterial, Uniform, Vector2, Vector3 } from 'three';
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
  uniform vec2 uResolution;
  uniform float uCellSize;
  uniform float uGlyphCount;
  uniform vec3 uTint;
  uniform vec3 uBackground;
  uniform float uLumGain;
  uniform float uLumBias;
  uniform float uGamma;

  varying vec2 vUv;

  void main() {
    vec2 pixel = vUv * uResolution;
    vec2 cellIdx = floor(pixel / uCellSize);
    vec2 cellOrigin = cellIdx * uCellSize;
    vec2 cellCenterUv = (cellOrigin + uCellSize * 0.5) / uResolution;

    vec3 sceneColor = texture2D(tDiffuse, cellCenterUv).rgb;
    float lum = dot(sceneColor, vec3(0.299, 0.587, 0.114));
    lum = pow(clamp(lum * uLumGain + uLumBias, 0.0, 1.0), uGamma);

    float glyphIdx = floor(lum * uGlyphCount);
    glyphIdx = clamp(glyphIdx, 0.0, uGlyphCount - 1.0);

    vec2 cellLocal = (pixel - cellOrigin) / uCellSize;
    vec2 glyphUv = vec2(
      (glyphIdx + cellLocal.x) / uGlyphCount,
      1.0 - cellLocal.y
    );

    float mask = texture2D(tGlyphs, glyphUv).r;
    vec3 color = mix(uBackground, uTint, mask);
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
}

export function createAsciiPass(options: AsciiPassOptions): ShaderPass {
  const { atlas, resolution } = options;
  const tint = options.tint ?? [0.55, 0.95, 0.65];
  const background = options.background ?? [0.02, 0.04, 0.03];
  const lumGain = options.lumGain ?? 1.0;
  const lumBias = options.lumBias ?? 0.0;
  const gamma = options.gamma ?? 1.0;

  const material = new ShaderMaterial({
    uniforms: {
      tDiffuse: new Uniform(null),
      tGlyphs: new Uniform(atlas.texture),
      uResolution: new Uniform(new Vector2(resolution.width, resolution.height)),
      uCellSize: new Uniform(atlas.cellSize),
      uGlyphCount: new Uniform(atlas.glyphCount),
      uTint: new Uniform(new Vector3(tint[0], tint[1], tint[2])),
      uBackground: new Uniform(new Vector3(background[0], background[1], background[2])),
      uLumGain: new Uniform(lumGain),
      uLumBias: new Uniform(lumBias),
      uGamma: new Uniform(gamma),
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
