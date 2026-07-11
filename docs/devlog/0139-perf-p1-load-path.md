# 0139 — Perf P1: load path + bundle splitting

Tier P1 of the performance pass (baseline: devlog 0137, P0: 0138). The
title screen was paying for the entire game — a 1,037 kB entry chunk
(289 kB gzip) containing three.js, colyseus, the scene, and every panel.

## What changed

- **`Game.tsx` (new).** The whole game surface — canvas host, `startScene`,
  all ~20 in-game panels, the lazy minigames, and the eight module-scope
  subsystem starts (`startIdentity` … `startMissionServerLoad`) — moved out
  of `App.tsx` into a lazy chunk. `Shell` prefetches it on mount
  (`void import('./Game.js')`), so it streams in while the player reads
  the title screen; class-select → game has no fetch stall. Bonus: the
  writer portal and auth routes no longer run game subsystems at all.
  `BootDissolve` renders outside the Suspense boundary so the transition
  covers any residual fetch.
- **`AdminGate`** (in Game.tsx): AdminConsole is now a lazy chunk mounted
  only after auth reports role=admin — regular players never download the
  dialogue editor / user table / grants panel (15.6 kB raw). Its internal
  role check remains (server RLS is the real gate, as before).
- **`AuthCallback`** lazy (only loads on `#auth/*` routes).
- **vite `manualChunks`** (function form): `three`, `colyseus`,
  `supabase`, `react` vendor chunks — cache-stable across app deploys,
  and only fetched by surfaces that need them. ⚠️ Object-form
  `manualChunks` parked rollup's shared CJS-interop helper inside the
  colyseus chunk, making the entry statically import all 37 kB of
  colyseus at boot for a one-line helper — function form avoids it.
- **`main.tsx`**: `initEconomySync()` now dynamic-imports after first
  paint via `requestIdleCallback` (setTimeout fallback). Its own save
  debounce is 1.5 s, so the added latency is irrelevant.
- **`dialogue.ts`**: the boot-time whole-table fetch (`initDialogue`) is
  gone. Overrides now load lazily on the first `getLines`/`listDialogue`
  call, and are cached in `localStorage`
  (`bitrunners.dialogue.overrides.v1`) so returning players get edited
  lines instantly. Cache is replaced wholesale on refresh so overrides
  deleted server-side drop locally too.
- **`scene.ts`**: the three `buildGlyphAtlas` results are memoized at
  module scope — built once per page load, shared across "change runner"
  scene restarts, and no longer disposed per scene (a few KB of canvas,
  module-lifetime).
- **`board.css` (new)**: all writer-board + boards-landing styles
  (420 lines) extracted verbatim from `style.css` into the lazy
  Board/BoardsLanding chunks. The Suspense fallback header renders
  unstyled for the instant before the chunk lands — cosmetic, accepted.

## Before → after (local builds, no `VITE_SUPABASE_*` env — same
condition as the 0137 baseline, so the comparison is apples-to-apples;
CI builds with env set will show a slightly larger supabase chunk that
the entry imports for ConstructionGate/TitleScreen auth)

| chunk | before (raw / gzip kB) | after (raw / gzip kB) |
| --- | --- | --- |
| entry `index-*.js` | 1,037.64 / 289.09 | **39.58 / 12.43** |
| `react` vendor | — (in entry) | 143.45 / 45.95 |
| `three` vendor | — (in entry) | 490.34 / 123.64 (lazy w/ Game) |
| `colyseus` vendor | — (in entry) | 115.96 / 36.72 (lazy w/ Game) |
| `supabase` vendor | — (in entry) | 11.18 / 4.03 |
| `Game` (new lazy) | — | 214.29 / 61.96 (prefetched from title) |
| `AdminConsole` (new lazy) | — (in entry) | 15.61 / 4.15 (admins only) |
| `economy-sync` (new lazy) | — (in entry) | 2.03 / 1.03 (idle) |
| entry CSS | 99.01 / 18.79 | 91.78 / 17.59 |
| `board.css` (new lazy) | — | 7.24 / 1.78 |
| Board | 441.77 / 147.61 | 441.77 / 147.60 |

**Boot path (title screen): ~308 kB gzip → ~76 kB gzip (JS+CSS), ‑75%.**
The game surface (Game + three + colyseus, ~222 kB gzip) streams in the
background during the title/boot screens instead of blocking first paint.
Also removed from boot: the Supabase `dialogue` whole-table fetch and the
eight game-subsystem starts on non-game routes.

## Behavior notes (conservative calls)

- First dialogue read of a brand-new session may serve in-code defaults
  while the override fetch runs (was: fetched at boot). Cached sessions
  see overrides immediately. Owner-edited copy only — no gameplay effect.
- Deviations from the recon list: ScrapeMenu stays inside the Game chunk
  (hot always-mounted panel — splitting it buys nothing); supabase stays
  on the boot path because ConstructionGate/TitleScreen legitimately need
  auth at boot — it's its own cached chunk now, and the shared-auth
  refactor lands in P3.
- If the prefetch hasn't finished when the player finishes class-select,
  Suspense shows nothing while BootDissolve plays over it — the dissolve
  masks the remaining fetch.

Gates: biome ✓ · typecheck 8/8 ✓ · test 46/46 ✓ · build 5/5 ✓.
