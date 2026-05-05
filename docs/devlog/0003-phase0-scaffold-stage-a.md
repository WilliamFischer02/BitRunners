# 0003 — Phase 0: monorepo scaffold + Stage A ASCII shader

**Date:** 2026-05-05

## What landed

A working pnpm + Turborepo workspace with one real feature (Stage A ASCII post-process on a rotating cube) and skeletons for everything else.

```
.github/workflows/ci.yml         GitHub Actions: install + lint + typecheck + build
biome.json                       Biome 1.9 config (formatter + linter, single tool)
turbo.json                       Build / typecheck / dev pipeline
tsconfig.base.json               Strict TS, ES2022, bundler resolution, verbatimModuleSyntax
pnpm-workspace.yaml              Workspaces: apps/*, packages/*
.npmrc                           Pnpm settings (auto-install peers, no shameful hoist)

apps/
  web/                           Vite + React + three.js. Stage A shader runs here. ✅ real
  server/                        Skeleton — re-exports protocol/tick constants. Real next phase.
packages/
  ascii/                         Glyph atlas builder + ASCII ShaderPass. ✅ real
  shared/                        PROTOCOL_VERSION = 0
  game-core/                     TICK_HZ = 15
```

### Verification

- `pnpm install` — clean, 115 pkgs, 7s
- `pnpm lint` — 27 files, 0 errors
- `pnpm typecheck` — 5 packages, all green
- `pnpm build` — 5 successful. `apps/web` outputs `dist/` (624 KB JS, 168 KB gzipped)

## Stage A ASCII pipeline

### Architecture

Three.js `EffectComposer` with three passes:

1. **`RenderPass`** — renders the 3D scene (rotating cube + hemisphere/directional lights) to an offscreen target.
2. **Custom `ShaderPass` (`createAsciiPass`)** — for each screen pixel, finds its 8×8 cell, samples the scene at the cell center, computes luminance, picks a glyph from the atlas by luminance, samples the atlas at the local position within the cell, and outputs the glyph's mask multiplied by a phosphor-green tint.
3. **`OutputPass`** — handles linear→sRGB conversion (modern three.js color management).

### Glyph atlas (`packages/ascii/src/glyph-atlas.ts`)

Built at runtime from a `<canvas>`:

- Default ramp: `' .,:;i1tfLCG08@'` (15 glyphs, sparse → dense)
- Cell size: 8 px square
- Layout: single horizontal row, one glyph per cell
- White-on-black with `NearestFilter` to keep glyph edges crisp under upscaling
- Returns a `THREE.CanvasTexture` ready to plug into the shader

### Shader (`packages/ascii/src/ascii-pass.ts`)

```glsl
// per-pixel:
//   1. find which 8x8 cell I'm in
//   2. sample the scene at the cell center -> luminance
//   3. pick glyph index = floor(lum * glyphCount)
//   4. sample atlas at (glyphIdx + cellLocal.x) / glyphCount, 1 - cellLocal.y
//   5. mix(background, tint, mask)
```

Tint defaults to phosphor green `vec3(0.55, 0.95, 0.65)`, background near-black `vec3(0.02, 0.04, 0.03)`. Both override-able per call.

### What's still missing (intentional, future stages)

- **Stage B**: per-fragment depth + normal sampling for layered glyph density. Stage A samples scene color only.
- **Stage C**: CRT/diode post-pass (scanlines, slot mask, bloom, barrel distortion).
- **Glyph atlas v2**: numerals + symbols matching the `02-ascii-dither-three` reference, with a curated density ramp instead of the default ASCII ramp.
- **Dithering**: ordered dither at the luminance-quantization step to break up banding.

## How to run it

```bash
pnpm install
pnpm --filter @bitrunners/web dev
# open http://localhost:5173
```

You should see a rotating cube rendered as green ASCII glyphs on a dark background. Resize the window — the cell grid stays at 8 px, the cube fills more cells.

> Verified: builds clean. Visual verification requires running `pnpm dev` locally — I can't open a browser from here.

## Dependencies added

Per the working agreement, every new dependency is logged here.

### Tooling (root)

| Package | Version | Why |
|---|---|---|
| `@biomejs/biome` | ^1.9.4 | One-tool formatter + linter. Replaces ESLint+Prettier. |
| `turbo` | ^2.3.3 | Monorepo task runner. Caches builds, parallelizes typecheck. |
| `typescript` | ^5.7.2 | Type system. Strict mode, bundler resolution. |
| `vitest` | ^2.1.8 | Test runner (no tests yet, but reserved). |

### Web client (`apps/web`)

| Package | Version | Why |
|---|---|---|
| `react` / `react-dom` | ^18.3.1 | UI shell that hosts the canvas. Also for terminal-style menus next phase. |
| `three` | ^0.170.0 | 3D scene + EffectComposer pipeline. |
| `vite` | ^6.0.3 | Dev server + production bundler. |
| `@vitejs/plugin-react` | ^4.3.4 | JSX + Fast Refresh. |
| `@types/react`, `@types/react-dom`, `@types/three` | matched | TS types. |

### `packages/ascii`

| Package | Version | Why |
|---|---|---|
| `three` | ^0.170.0 (peer + dev) | ShaderPass, ShaderMaterial, CanvasTexture. |
| `@types/three` | ^0.170.0 | TS types. |

**Not added** (deliberate):

- `postprocessing` (Vanruesc) — wanted to own the pass. Three's built-in EffectComposer is enough for Stage A.
- `bitecs` — no ECS needed for one cube; will add when sim systems land.
- `colyseus`, `fastify` — server is a stub. Real deps in Phase 2.
- `lucia`, `kysely`, drivers — auth/DB not needed yet.

## Choices worth flagging

- **Biome over ESLint+Prettier**: single binary, no plugin churn, fast (27 files in ~7 ms). Trade-off: smaller rule ecosystem. Reversible if it bites us.
- **Workspace packages export `.ts` source** (no build step on internal packages). Vite handles transformation; `tsc --noEmit` validates. Avoids dual-build complexity. We can switch to compiled outputs later if we want strict package boundaries.
- **`verbatimModuleSyntax`** is on. All type-only imports/exports must use the `type` keyword. Stricter but clearer.
- **`noUncheckedIndexedAccess`** is on. Array/object indexing returns `T | undefined`. Catches a real class of bugs at the cost of a few extra null checks.
- **No animation loop abstraction yet** — `requestAnimationFrame` directly in `scene.ts`. Will extract a clock when we have more than one updater.

## CI

`.github/workflows/ci.yml` runs on push to `main` and `claude/**`, plus PRs. Pipeline: install (frozen lockfile) → lint → typecheck → build. The Fly.io deploy is **not** wired into CI yet — that comes when `apps/server` has real code and a Dockerfile.

## What's next (Phase 1 prep)

1. Owner runs `pnpm dev` locally to confirm the cube renders correctly. If colors look off or glyphs are blurry, we tune the atlas / pass.
2. Replace the cube with a low-poly isometric scene (a small platform, a hero capsule).
3. Stage B: depth-aware glyph selection.
4. Begin terminal_runner kit + walkable controls.

Lore round 2 questions are still open in `0002`. Not blocking.
