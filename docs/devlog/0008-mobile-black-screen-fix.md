# 0008 — Mobile black-screen hotfix

**Date:** 2026-05-09

Owner reported the previous build (`8a419c4`) showed a **black screen on iPhone Safari** — the hint text and D-pad overlay rendered, but the canvas behind them was empty. Desktop was fine.

## Root cause

Stage B v0.1 (devlog 0007) plumbed a `DepthTexture`-equipped `WebGLRenderTarget` through `EffectComposer` and bound the depth as a custom shader uniform. That works on desktop Chrome but is fragile on mobile WebGL — iOS Safari in particular has known issues with:

- `DepthTexture` + custom render target as the composer's read buffer
- The combination of depth attachment + `RGBAFormat` color + EffectComposer's automatic ping-pong write target

Likely it failed at WebGL state validation and silently produced a blank framebuffer. No JavaScript error — just a black canvas.

## Fix: luminance-edge instead of depth-edge

Stage B's silhouette emphasis didn't *need* depth — luminance contrast at cell boundaries is a strong proxy for silhouettes against a contrasting background, and it's mobile-safe.

Removed:

- `DepthTexture`, `WebGLRenderTarget`, `RGBAFormat`, `UnsignedShortType` imports from `apps/web/src/scene.ts`
- The custom `composerTarget` arg to `EffectComposer` (now uses default)
- `tDepth`, `uCameraNear`, `uCameraFar`, `uEdgeEnabled` uniforms
- The `linearDepth()` helper in the fragment shader
- The `placeholderTexture()` workaround in `createAsciiPass`

Replaced with a 4-tap luminance gradient using only `tDiffuse`:

```glsl
if (uEdgeStrength > 0.0) {
  vec2 step = vec2(uCellSize) / uResolution;
  float lL = lumOf(texture2D(tDiffuse, cellCenterUv - vec2(step.x, 0)).rgb);
  float lR = lumOf(texture2D(tDiffuse, cellCenterUv + vec2(step.x, 0)).rgb);
  float lU = lumOf(texture2D(tDiffuse, cellCenterUv - vec2(0, step.y)).rgb);
  float lD = lumOf(texture2D(tDiffuse, cellCenterUv + vec2(0, step.y)).rgb);
  float gx = lR - lL;
  float gy = lD - lU;
  float edge = sqrt(gx*gx + gy*gy) * uEdgeStrength;
  if (edge > uEdgeThreshold) glyphIdx = uGlyphCount - 1.0;
}
```

This works on every WebGL target — `tDiffuse` is the standard composer input, no custom attachments required.

## Behavior trade-off

Depth-edge catches all silhouettes regardless of color contrast. Luminance-edge misses the small fraction of silhouettes where the character and background happen to share luminance. In our scene (medium-grey floor, character with a mix of light armor and dark plates), most silhouettes have strong luminance contrast, so the visible result is very similar to depth-edge.

Stage B v0.2 (normal-aware directional glyphs) will go through a separate `MeshNormalMaterial` render-to-target pass — a different mobile-compat surface that we'll test on a real device before merging to main.

## Tuning

- `edgeStrength` defaulted to **0** in the package (off by default). Scene calls `createAsciiPass` with `edgeStrength: 1.0, edgeThreshold: 0.22`.
- All other Stage A tuning from `0007` is preserved (lumGain 1.2, gamma 1.0, dither 0.6, softer lighting, steeper camera, gait additions).

## Build

- 28 files lint clean
- Build green, bundle 633.04 → 631.74 kB (slightly smaller — depth texture and helpers gone)

## Action

After merge to main, the Pages deploy will replace the broken build. The owner's iPhone should show the same scene desktop sees: walking bit_spekter on a grey platform, silhouettes drawn as solid blocks against the floor, on-screen D-pad responsive.

If the screen still goes black after this hotfix, the root cause is something else (WebGL context loss, three.js color management, etc.) and we'll instrument with `webglcontextlost` listeners + a fallback Stage A.
