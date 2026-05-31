# 0055 — Render polish: PS2-in-ASCII look (fog, ordered dither, CRT pass)

**Date:** 2026-05-28
**Branch:** `claude/render-polish-ps2-ascii`

Phase 1 of a six-part push (render polish → world+collision+AI → tutorial+account
CTA → tap-to-lock → emoticron editor). Goal this phase: a more "rendered, slightly
polished, almost PS2-rendered-in-ASCII" look — **within budget and mobile-safe**
(owner picked "tasteful polish in budget" over full retro emulation). No bloom,
no colour-quantize, no vertex-warp; nothing that risks iOS Safari (devlog 0008).

## What changed

### 1. Depth fog (`scene.ts`)
- `scene.fog = new Fog(0x0a1212, PLATFORM_HALF * 0.8, PLATFORM_SIZE * 2.0)` — distant
  ground + the wrapped 3×3 tiles fade into a dark haze. Near/far derive from the world
  constants so the fog stays tuned if `PLATFORM_HALF` changes (it will, in Phase 2).
- **Why it helps the ASCII look:** fog widens the luminance gradient between near-bright
  and far-dark geometry, so the Stage-A edge pass draws crisper silhouettes at depth.
- **Runner stays crisp:** fog is nulled during the offscreen character pass (and the
  optional normals pass) — same save/restore the code already does for `scene.background`
  — so the hero is never dimmed by camera distance, and normal data isn't fog-corrupted.

### 2. Ordered (Bayer) dither (`packages/ascii/ascii-pass.ts`)
- New `orderedDither` option + `uOrderedDither` uniform. A compact recursive 4×4 Bayer
  matrix (`bayer2`/`bayer4`) replaces the per-cell hash noise when enabled. This is the
  classic "rendered" cross-hatch gradient instead of random speckle.
- `scene.ts` enables it (`orderedDither: true`). Default stays `false`, so any other
  caller of `createAsciiPass` is unchanged.

### 3. CRT/diode finishing pass (`packages/ascii/crt-pass.ts`, new)
- A second `ShaderPass` inserted **after** the ASCII pass, **before** `OutputPass`:
  fixed-count horizontal scanlines, a soft corner vignette, and a faint chromatic
  split that grows toward the corners.
- **Mobile-safe by construction:** plain RGBA, one input texture, all UV-space math
  (resolution-independent — no resize moiré), no time roll, no DepthTexture/MRT/float
  targets.
- **Escape hatch:** on by default; `?crt=off` skips the pass entirely for weak devices.
- Material disposed on scene teardown.

## Files changed
- `packages/ascii/src/crt-pass.ts` — new CRT `ShaderPass` factory.
- `packages/ascii/src/index.ts` — export `createCrtPass` + `CrtPassOptions`.
- `packages/ascii/src/ascii-pass.ts` — `orderedDither` option, `uOrderedDither`,
  `bayer2`/`bayer4`.
- `apps/web/src/scene.ts` — `Fog`, rim light, fog null/restore in the character +
  normals passes, `orderedDither: true`, CRT pass wiring + `?crt=off` gate + dispose.
- `docs/devlog/0055-render-polish-ps2-ascii.md` — this file.

## Honest status
- Gates green: `pnpm lint` clean, `pnpm typecheck` 8/8, `pnpm build` 5/5.
- **Not verifiable headless.** GLSL only compiles in a live WebGL context, which this
  container doesn't have. The shaders are correct by inspection (valid GLSL ES 1.0;
  Bayer + CRT are standard forms) and the bundle builds, but the *visual* result and the
  **iOS Safari** check are owner-side. Tunables to eyeball: fog colour/near/far, CRT
  `scanline`/`vignette`/`aberration`, and whether ordered dither reads better than the
  old noise. `?crt=off` toggles the CRT pass for an A/B.
- No new dependencies.

## Next (Phase 2)
2× world (`PLATFORM_HALF 9.5 → 19`) + obstacle collision (none today) + render the
server's existing `npc:*` dwellers (robot/husk/spirit). Separate branch + draft PR.
