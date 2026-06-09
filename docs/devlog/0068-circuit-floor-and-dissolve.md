# 0068 — Circuit-board floor + ASCII pixel-crush boot dissolve (Phase 4)

Branch: `claude/phase4-floor-and-transitions`. Draft PR pending.

Two related polish changes for the world's visual unity:

1. **Circuit-board floor.** The flat dark plane + grid-strip floor is
   replaced with a procedural breadboard / circuit-trace look. Fractal-
   noise FBM acts as a pathbuilder; thresholded contours form thin
   "copper" traces with a current pulse animating along them.
2. **ASCII pixel-crush dissolve.** Boot → Game now plays a unified
   dithered-glyph transition instead of `TransitionRain`. Same helper
   will retrofit the other modal surfaces in Phase 5.

## What ships

### new

- **`apps/web/src/shaders/circuit-floor.ts`** — `createCircuitFloorMaterial()`
  returns a `ShaderMaterial` with:
  - Inlined public-domain 2D Simplex noise (Ashima / Stefan Gustavson).
  - 3-octave FBM, twisted with itself for turbulent displacement so the
    traces feel "wired" rather than rolling-hill.
  - Two thresholded contour rings (primary + secondary) painted in copper
    over a dark substrate.
  - `uTime`-driven sine current pulse that brightens a ridge along the
    primary traces, simulating power flow along the wiring.
  - All math at `mediump`, no derivatives ext, no DepthTexture / MRT —
    iOS Safari safe (devlog 0008).
- **`apps/web/src/transitions/dissolve.ts`** — `playDissolve(host, dir, opts, onDone)`
  paints a fixed-position overlay canvas with a Bayer-thresholded glyph
  dither. Reuses the project's `RAIN_CHARS` palette. `prefers-reduced-
  motion` snaps to end state. Single helper for both 'in' (reveal) and
  'out' (vanish).
- **`apps/web/src/transitions/Dissolve.tsx`** — generic React wrapper
  for the helper. Mount/unmount orchestrated through `onExited`.
- **`apps/web/src/transitions/BootDissolve.tsx`** — thin wrapper that
  fires a single full-viewport 'out' dissolve (~520 ms) then calls
  `onDone`. Replaces `TransitionRain` at the boot→game seam.

### edits

- **`apps/web/src/scene.ts`** —
  - Imports the circuit floor material.
  - Floor build replaces `MeshStandardMaterial` (and the static grid-
    strip loop) with `createCircuitFloorMaterial()`. The grid strips
    remain ONLY when `?floor=plain` is set, as an emergency rollback
    for low-end devices.
  - Drives `uTime` on the floor uniform each tick (mirrors the existing
    skybox pattern).
- **`apps/web/src/App.tsx`** — boot→game transition switches from
  `<TransitionRain />` to `<BootDissolve />`. `TransitionRain.tsx`
  remains exported for any caller that wants the rain look.

## Architecture decisions

- **2D-canvas dissolve, not WebGL.** Simpler, doesn't require a second
  `EffectComposer`, runs cheaply over arbitrary host elements. The
  glyph palette matches `TransitionRain.tsx` so the visual vocabulary
  stays unified.
- **Floor shader survives the ASCII pass.** Trace tint (`#c66a32`)
  contrasts strongly with the dark substrate, so the ASCII pass's
  luminance-based glyph selection picks up the trace mask reliably.
- **`?floor=plain` rollback flag.** Same pattern as the existing
  `?crt=off` and `?normals=on` escape hatches. Lets us turn off the
  shader without a redeploy if low-end Android frame budget is
  exceeded.
- **Boot dissolve, not a generic React `<Dissolve>` on every modal.**
  Per the plan: build the engine + wire it into the new seam first;
  Phase 5 retrofits the legacy modals once the look is dialed in.

## Verification

- `pnpm typecheck` ✓
- `pnpm lint` ✓
- `pnpm --filter @bitrunners/web build` ✓
- Headless Chromium repro:
  - Boot scrawl completes; class-select tile click triggers the
    boot dissolve.
  - After ~2.5 s the canvas host is present and the dissolve overlay
    canvases have been cleaned up (`zIndex === 1000` overlays
    remaining: 0).
  - No `pageerror` / `console.error`.
  - Screenshot confirms the new floor pattern (bright copper-tinted
    speckle field after the ASCII pass) replaces the old grid.

## Owner-tunable values

| What | v1 default | Where |
|---|---|---|
| Trace color | copper `#c66a32` | `circuit-floor.ts` `traceColor` |
| Substrate color | very dark green | `circuit-floor.ts` `substrateColor` |
| Noise scale | 0.36 | `uScale` |
| Trace threshold | 0.12 | `uTraceThreshold` |
| Trace width | 0.07 | `uTraceWidth` |
| Current pulse speed | 2.4 rad/s | `uCurrentSpeed` |
| Dissolve duration | 520 ms (boot) / 320 ms (default) | `BootDissolve.tsx`, `dissolve.ts` |
| Dissolve cell size | 12 px | `dissolve.ts` |

## Roadmap

- Phase 1 (PR #70) — Protocols carousel + Objectives + minimap parity
- Phase 2 (PR #71) — Standby + spawn scatter
- Phase 3 (PR #72) — Tether Hop + chatter + exchange
- **Phase 4 (this PR)** — Circuit floor + boot dissolve engine
- Phase 5 — Retrofit dissolve to AdminConsole / Samm / UsernameEditor / AdminDialogue / MissionDialogue

## No new dependencies. No protocol bump. No schema change.
