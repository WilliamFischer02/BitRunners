# 0006 — Walk cycle + glyph variety fix

**Date:** 2026-05-06

Owner reported the live build at `bitrunners.app` looked correct in *aesthetic* but had two concrete issues from the screenshot:

1. **The render was a "dot matrix"** — only `·` and `.` were visible across the whole frame, none of the Unicode block characters (`░▒▓█`) the ramp called for.
2. **No walk animation** — limbs were rigid; only the body translated.

Both addressed in this commit.

## Why the dot-matrix happened

Two compounding causes:

**A. Font fallback eating block characters.** The default `monospace` family on the user's machine doesn't include the Unicode block elements `░ ▒ ▓ █`. `ctx.fillText('█', …)` was rendering empty (or near-empty) cells, so every "high density" glyph index produced the same blank cell as space. Whatever luminance the scene reached above ~0.4 mapped to a cell that visually wasn't there.

**B. Scene luminance didn't span the ramp.** Even with working glyphs, the lit floor came out around linear ~0.15–0.25, hitting glyph indices 1–3. Indices 4+ were never used.

## Fix: procedural shading + luminance gain

### `packages/ascii/src/glyph-atlas.ts`

Block elements and half-blocks are now drawn **procedurally** — `fillRect` with a known alpha (or sub-cell rectangle) instead of `fillText`. No font dependency, pixel-perfect output across systems.

| Glyph | Method | Output |
|---|---|---|
| ` ` | skip | empty cell |
| `░` | `fillRect` α=0.25 | uniform 25% |
| `▒` | `fillRect` α=0.5 | uniform 50% |
| `▓` | `fillRect` α=0.75 | uniform 75% |
| `█` | `fillRect` α=1.0 | uniform 100% |
| `▀ ▄ ▌ ▐ ▘ ▝ ▖ ▗` | sub-cell `fillRect` | half/quarter blocks |
| everything else | `fillText` | letterform glyph |

Default ramp updated to `' .·:-=+*░#▒▓█'` — sorted by density. Cell size up to 8 px (was 7) to give letterform glyphs more headroom.

### `packages/ascii/src/ascii-pass.ts`

Added three luminance-shaping uniforms so we can tune ASCII brightness without changing scene materials:

- `uLumGain` — multiplier (default 1.0). Push it >1 to spread mid-greys to the high end of the ramp.
- `uLumBias` — additive offset (default 0). Push small positive to lift shadows.
- `uGamma` — power applied after gain+bias. <1 brightens.

In Stage A on the bit_spekter scene we currently use `lumGain=1.6, lumBias=0.05, gamma=0.85`.

### `apps/web/src/scene.ts` lighting

- Background `0x000000` → `0x050807` (very dark grey instead of pure black so cells offscreen geometry register at the lowest non-zero glyph)
- Hemisphere intensity 0.45 → 0.85
- Sun intensity 1.7 → 2.4
- Fill 0.4 → 0.6
- Platform color `0x6a6e74` → `0xb8bcc2`
- Port color `0x9aa0a8` → `0xc4c8d0`, port-inside emissive added (`emissiveIntensity: 0.7`)
- `renderer.toneMappingExposure = 1.25`

Effect: the floor now reads as a clear `▒`/`#` field with `▓`/`█` at the highlight side; the character has crisp shading from `+/*` (shadowed plates) to `▓/█` (lit edges of helmet, shoulders).

## Walk cycle

`buildBitSpekter()` now returns a structured rig:

```ts
interface BitSpekterRig {
  root: Group;       // logical position (also rotated to face movement)
  visual: Group;     // visual offset (used for body bob)
  armPivotL/R: Group; // pivot at shoulder
  legPivotL/R: Group; // pivot at hip
}
```

Each limb is a child of its pivot Group, offset down so the pivot sits at shoulder/hip. Rotating the pivot swings the limb around the joint correctly, including the hand/boot which are also pivot children.

Per-frame in `tick`:

```ts
const swing = Math.sin(walkPhase) * walkActive;
rig.legPivotL.rotation.x =  swing * LEG_AMP;   // 0.45
rig.legPivotR.rotation.x = -swing * LEG_AMP;
rig.armPivotL.rotation.x = -swing * ARM_AMP;   // 0.55, opposite phase
rig.armPivotR.rotation.x =  swing * ARM_AMP;
rig.visual.position.y    = Math.abs(Math.cos(walkPhase)) * 0.04 * walkActive;
```

`walkPhase` advances at `9 rad/sec` while moving (so a full cycle is ~0.7 s). When idle, `walkActive` eases toward 0 over ~70 ms, snapping limbs to neutral standing pose. Bob is on the **`visual`** group, not the root, so the camera follows the steady `root` and doesn't bob with the head.

**"From all angles" handled implicitly**: `rig.root.rotation.y` is set to `atan2(moveX, moveZ)` whenever moving, and the limb pivots are children of `root.visual`, so the swing animation rotates with the body. Walk works correctly facing any of the eight cardinal/diagonal directions.

## Build status

- Lint, typecheck, build all green
- Bundle: 629.62 → 631.43 kB (+1.8 kB for atlas changes + rig structure)

## What this should look like

- Floor: a moving field of mid-density Unicode shading, clearly varied between `▒` and `▓` regions depending on where the sun hits
- bit_spekter: armor plates show as `▓`/`█` on lit sides, `*`/`#` in shadow, with the visor cross still readable
- Limbs swing back/forth in opposite phase as the character walks
- Body bobs slightly with each step
- Stationary character has neutral standing pose

## Pages redeploy

After commit, advance `main` to the new HEAD via the GitHub MCP so Cloudflare Pages picks it up. `bitrunners.app` updates within a few minutes of the merge.

## Next per the active roadmap

With Stage A now visually credible, **Stage B** is the natural next step — depth + normal sampling so the shader can pick *directional* glyphs (the half-blocks `▀▄▌▐` and box-drawing characters) at silhouettes, getting closer to the fidelity of the owner's reference ASCII portrait. That's the next devlog.
