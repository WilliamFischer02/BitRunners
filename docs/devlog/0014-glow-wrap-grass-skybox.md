# 0014 — Glow gradient, plane wrap, grass tufts, digital-rain skybox

**Date:** 2026-05-09

Big batch of owner asks landed. Mobile FPS still solid 60.

Owner reported: "I'm not seeing a visual difference" between character and world. Wanted character at 80–100 % opacity, world at 50–70 %; a glow gradient strongest at the helmet falling to 80 % at the feet; the plane to loop seamlessly; ASCII grass tufts scattered randomly on the floor; a Matrix-style digital-rain skybox tinted purple.

Most of it ships in this commit. The "seamless" looping is partial (hard wrap; future polish lands true seamlessness via tile rendering).

## Glow gradient — using `charLum` from the existing height-banded materials

The character render-target already encodes a head→feet brightness gradient (per devlog 0013 the helmet emits at intensity 1.6, boots at 0.2). The shader now reads that as a per-cell signal and uses it to drive a glow boost.

Shader change in `packages/ascii/src/ascii-pass.ts`:

```glsl
if (uHasCharacterMask > 0.5) {
  float dim = mix(uBackgroundDim, 1.0, maskWeight);
  color *= dim;
  // Boost char output by characterGlow at the brightest charLum (helmet),
  // ramped down to ~0.95 at the dimmest (feet).
  float heightBoost = mix(0.95, uCharacterGlow, smoothstep(0.05, 0.55, charLum));
  color = mix(color, color * heightBoost, maskWeight);
}
```

Scene values: `backgroundDim: 0.55` (world at 55 % output), `characterGlow: 1.55`. Net: helmet renders ~1.55× the baseline, boots ~0.95×, world 0.55×. The contrast gap between the helmet and the floor is now roughly 3× — should be unmistakable on a phone.

If it's still too subtle: lower `backgroundDim` further (0.45 was tested last round and felt right), or raise `characterGlow` (2.0+ goes blown-out fast).

## Vertical screen tint — top purple, bottom green

A second tint color blends in along screen-Y, so the upper portion of the rendered ASCII frame inherits a violet hue and the lower keeps the cool grey-green:

```glsl
float vBlend = smoothstep(0.45, 0.85, vUv.y);
vec3 cellTint = mix(uTint, uTintTop, vBlend);
vec3 color = mix(uBackground, cellTint, glyphMask);
```

`tint = [0.86, 0.93, 0.88]` (existing cool grey), `tintTop = [0.72, 0.5, 0.95]` (lavender). Combined with the digital-rain skybox below, the top of the frame visually reads as a different "world" than the ground.

## Digital-rain skybox

`apps/web/src/scene.ts` now adds a 90-meter-circumference back-side cylinder around the player, with a custom `ShaderMaterial` running a procedural matrix-rain pattern:

```glsl
float colCount = 96.0;
float col = floor(vUvSky.x * colCount);
float colSeed = hash1(col + 7.13);
float speed = 0.45 + colSeed * 0.7;
float v = vUvSky.y * 12.0 - uTime * speed;
float row = floor(v);
float cellSeed = hash1(col * 17.31 + row * 31.7);
float headFrac = fract(v);
float onChar = step(0.55, cellSeed);
float intensity = onChar * smoothstep(0.0, 0.4, headFrac) * smoothstep(1.0, 0.55, headFrac);
intensity *= smoothstep(0.05, 0.35, vUvSky.y) * smoothstep(1.0, 0.6, vUvSky.y);
gl_FragColor = vec4(vec3(0.42, 0.28, 0.65) * intensity, 1.0);
```

Per-column random speed and per-cell random "head/tail" pattern — 96 columns × 12 rows worth of streaks falling at column-specific rates. Rendered with `BackSide` and `depthWrite: false` so the platform/character draw on top correctly. The cylinder follows the player each frame, so the rain always sits at the horizon regardless of position.

The shader outputs **scene-space purple**, but the ASCII pass tints all colors through `cellTint`. The combined effect: the upper half of the screen renders as bright lavender ASCII glyphs in a falling-rain pattern. Downstream of the ASCII tint shift above, the rain reads visually as purple-tinted "code clouds."

This works on mobile-WebGL — plain ShaderMaterial on a CylinderGeometry, no custom render target.

## Plane wrap — Pac-Man

Hard wrap at the platform edges:

```ts
if (rig.root.position.x > PLATFORM_HALF) rig.root.position.x -= PLATFORM_SIZE;
else if (rig.root.position.x < -PLATFORM_HALF) rig.root.position.x += PLATFORM_SIZE;
// ... and z
```

Walking off any edge teleports the bit_spekter to the opposite edge. Camera follows so it visually feels like the world wraps around the player.

**Caveat (intentional, future work)**: the world is currently a single fixed-size plane, so when the player wraps from +X to -X, the platform's edge IS visible on screen during the snap (1–2 frames). To make it truly seamless we'd need to render a 3×3 tile of the world centered on the player, with each tile offset by `PLATFORM_SIZE`. That's a meaningful refactor — listing it as a follow-up. For now, hard-wrap is functional and visible.

## Grass tufts — random patches

36 tuft-clusters scattered across the platform with a seeded PRNG (seed `0x5a17`, deterministic across reloads). Each cluster is 3–6 thin upright `BoxGeometry` blades with random sub-position, height, and Y-rotation. Material is a desaturated olive with mild emissive so the tufts read in shadow.

```ts
for (let i = 0; i < 36; i++) {
  // ... generate cluster of 3-6 blades at random sub-positions ...
}
```

In ASCII render the tufts produce vertical streaks of `+`, `*`, `:` in the world atlas — looks like sparse grass at the chosen camera distance. They're on the default scene layer (not character layer), so they go through the world atlas + dim path.

## What I deliberately deferred

- **True seamless wrap** — would require rendering a 3×3 tiled view with offset world replicas. Big change. Filed as follow-up.
- **Dedicated sky-tint pass via second mask** — simpler vertical-tint gradient was enough to give a "purple horizon" feel without another render target.
- **Stage B v0.2 normal-direction glyphs** — still queued behind a flag.

## Build

- 28 files lint-clean
- Bundle: 637.18 → 642.93 kB (+5.7 kB for skybox shader, grass loop, wrap helper)
- FPS impact (locally): negligible — skybox is one mesh, grass adds ~150 boxes total

## What's next

Per the active roadmap:

1. Fluttery polish — tune `backgroundDim`, `characterGlow`, `tintTop` based on owner reaction
2. Seamless 3×3 tiled rendering (true loop)
3. Stage B v0.2 normal-direction glyphs
4. **Phase 2 networking start** (Colyseus, Lucia, Neon, Upstash) once the visuals are signed off

If owner says "looks great", I'd take Phase 2. Otherwise iterate on visuals.
