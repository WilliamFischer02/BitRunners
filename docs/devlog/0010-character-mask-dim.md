# 0010 — Character mask + background dim

**Date:** 2026-05-09

Owner asked: "apply a slightly lower opacity to all pixels / voxels that aren't a part of the main character/user character to make it slightly easier to differentiate the character from the background."

## Approach

Render the character to its own **layer** and capture it in a separate RGBA render target. The ASCII shader then samples both the full scene (for color/glyph selection) and the character-only buffer (as a binary mask), and dims the final output color of any cell that isn't covered by the character.

This is mobile-safe: plain `WebGLRenderTarget` with `RGBAFormat` (no depth attachment, no fancy formats — those were the iOS Safari trip wires from the previous attempt).

## Implementation

### Layers

In `scene.ts`:

```ts
const CHARACTER_LAYER = 1;
// ...
rig.root.traverse((obj) => obj.layers.set(CHARACTER_LAYER));
hemi.layers.enableAll();
sun.layers.enableAll();
fill.layers.enableAll();
camera.layers.enableAll();
```

The character is now on layer 1 only. Lights and the camera see all layers, so the character renders correctly with the same lighting whether it's drawn alone (character-only pass) or combined with the world (composer's RenderPass).

### Two-pass rendering per frame

Each tick now does an extra cheap render: character-only to the side target, then the normal composer render of everything.

```ts
const characterTarget = new WebGLRenderTarget(1, 1, { format: RGBAFormat });
// resized alongside composer in resize()

// per-frame:
renderer.setClearColor(0x000000, 0);
camera.layers.set(CHARACTER_LAYER);
scene.background = null;                       // don't paint the bg into the mask
renderer.setRenderTarget(characterTarget);
renderer.clear();
renderer.render(scene, camera);
renderer.setRenderTarget(null);
scene.background = sceneBg;
camera.layers.enableAll();
renderer.setClearColor(savedClear, savedAlpha);

composer.render();
```

The clear color and clear alpha are saved/restored so the background pass on composer.render() isn't perturbed. `scene.background = null` for the character pass guarantees the mask is pure (RGBA 0,0,0,0) outside the character meshes — otherwise the scene's `0x070a09` bg would paint the entire mask.

### Shader

`packages/ascii/src/ascii-pass.ts` adds two uniforms:

- `tCharacter` — sampler bound to the character-only render-target texture
- `uHasCharacterMask` — feature flag (1.0 when mask present, 0.0 when not)
- `uBackgroundDim` — multiplier applied to non-character pixel output (default 1.0 = off)

Per-cell logic:

```glsl
if (uHasCharacterMask > 0.5) {
  vec4 cSample = texture2D(tCharacter, cellCenterUv);
  float cMask = max(cSample.a, lumOf(cSample.rgb));
  float maskWeight = smoothstep(0.0, 0.04, cMask);
  float dim = mix(uBackgroundDim, 1.0, maskWeight);
  color *= dim;
}
```

`maskWeight` smoothstep'd from 0 → 0.04 gives a tiny soft edge at the silhouette. `dim` is 1.0 inside the character, `uBackgroundDim` (0.7 here) outside. The final glyph color is multiplied — so background pixels render at 70 % intensity, character pixels at 100 %.

Result: character pops noticeably without losing the world.

## Tuning knobs the owner can twist

In `scene.ts` `createAsciiPass({...})`:

- `backgroundDim: 0.7` — 1.0 = off, 0.5 would dim more aggressively, 0.85 = subtler
- `characterTexture` — passing `undefined` disables the entire mask path

## Mobile-compat audit

- No `DepthTexture`, no `UnsignedShortType` — the things that broke iOS last time
- `WebGLRenderTarget` with `format: RGBAFormat` only — universally supported
- Two `renderer.render` calls per frame — minor cost, character is ~14 boxes
- Clear-color save/restore so we don't break composer's expected clear state
- `scene.background = null` is per-pass; the second composer pass paints the bg correctly

## Build

- 28 files lint-clean
- Bundle: 632.45 → 633.92 kB (+1.5 kB for layer + mask logic)

## Per-frame cost

The extra character pass renders ~14 mesh draws against a small render target. On the test machine, the FPS counter showed no observable change. If the user's iPhone reports a drop after this change, we can reduce it (e.g., character-pass at half resolution).

## What's next

Per the active roadmap, the next visual move is **Stage B v0.2** — directional glyphs at silhouettes via a `MeshNormalMaterial` second pass. That's a similar two-pass pattern to what we just landed, so the path is now de-risked. I'll gate the normal pass behind `?normals=on` for owner-side mobile verification before flipping the default.

After that: a vending machine + monolith stub to populate the platform, and the port becoming an actual interactable when the depot system arrives.
