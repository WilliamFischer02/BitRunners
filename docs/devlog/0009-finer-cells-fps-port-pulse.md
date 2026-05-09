# 0009 — Finer cells + FPS overlay + port pulse

**Date:** 2026-05-09

Owner reported the live build looks good and addressed the iOS black-screen — but the "pixels / edges are a bit chunky." Three small upgrades in this commit: cell size down, an FPS readout for perf monitoring across devices, and a subtle pulse on the port so it reads as alive.

## Smaller cells (8 → 6 px)

`apps/web/src/scene.ts` glyph atlas:

```ts
const atlas = buildGlyphAtlas({
  ramp: ' .·-:;=+*░#▒▓█',
  cellSize: 6,    // was 8
  fontSize: 8,    // was 10
});
```

Effect: ~1.78× more glyphs per unit area. Character at the chosen camera distance grows from ~40 cells tall to ~55–60. Silhouette edges read crisper, gradient transitions look less posterized. Letterform glyphs (`+ * #`) are now small enough that they read as texture rather than typography — appropriate for an ASCII rendering style. Block elements (`░ ▒ ▓ █`) are procedurally drawn so they stay pixel-perfect at any cell size.

`dither` nudged from 0.6 → 0.55 since the finer grid already breaks up bands a bit on its own.

## FPS overlay

Top-right corner shows current frame rate, refreshed every 500 ms. Implementation is scene-side only — no React state, no message passing:

```ts
const fpsEl = document.createElement('div');
fpsEl.className = 'fps';
fpsEl.textContent = '-- fps';
host.appendChild(fpsEl);
// ...inside tick:
frameCount++;
if (now - frameWindowStart >= 500) {
  const fps = Math.round((frameCount * 1000) / (now - frameWindowStart));
  fpsEl.textContent = `${fps} fps`;
  frameCount = 0;
  frameWindowStart = now;
}
```

Cleaned up in the existing dispose handler. CSS uses `font-variant-numeric: tabular-nums` so the digits don't jitter.

This matters because we now have data for the **mobile FPS probe** that the roadmap (devlog 0004) flagged as a Phase 1 exit criterion: the user can walk around on a real phone and tell me what they see in the corner. Kill criterion was <20 fps; target was ≥30. Once the user reports a number from their iPhone, we either log it as passing or tune.

## Port pulse + proximity glow

The port's inner panel (the "wirey Server Space" portal viewport) now pulses softly via `emissiveIntensity` modulation, and brightens further when the player approaches:

```ts
const portDist = sqrt(dx*dx + dz*dz);
const proximity = clamp01((5 - portDist) / 4);    // 0 far, 1 within ~1 unit
const pulse = 0.6 + sin(elapsed * 2.4) * 0.12;     // breathing baseline
portInside.material.emissiveIntensity = pulse + proximity * 0.5;
```

Effect: from across the platform, the port has a slow background pulse (~0.4 Hz). As the player walks toward it, it brightens noticeably, telegraphing "this is interactable." No interaction wired yet — that lands when the depot system arrives in Phase 3 — but the visual affordance is in place. Emissive color also shifted from cool teal (`0x355577`) to a saturated indigo (`0x4477aa`) to give the port a clear color identity distinct from the cool grey lighting.

## What stayed

- Walk cycle (legs, arms, chest counter-twist, hip yaw + roll, vertical bob)
- Camera angle (57° iso)
- Mobile-safe luminance-edge silhouette emphasis
- Stage A Unicode shading ramp with proc-rendered block elements

## Build

- Lint clean across 28 files
- Bundle 631.74 → 632.45 kB (+0.7 kB for FPS DOM + port pulse logic)

## What's next

This is a polishing pass. Strategic next steps from the roadmap:

1. **Stage B v0.2 — directional glyphs** via `MeshNormalMaterial` second pass. Risky on mobile (normal pass uses a custom render target same shape as the depth setup that just broke). Plan: gate behind `?stageB=on` URL param, default off, ask the owner to test on iPhone before merging the default-on switch.
2. **Atlas v2** — add box-drawing characters (`─│┌┐└┘`) as procedurally-rendered shapes (not font fillText) so they're pixel-perfect across systems. Pairs with Stage B v0.2 to render proper outline characters at silhouettes.
3. **A second prop or two** — vending machine, monolith stub — to make the scene feel less empty while we're still single-player.

Per the roadmap I'd take Stage B v0.2 first (highest visual return) but only behind a flag until the owner confirms it doesn't break their phone.
