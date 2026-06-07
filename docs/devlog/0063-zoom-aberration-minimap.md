# 0063 — camera zoom, weaker aberration, smaller ASCII cells, starmap minimap

Branch: `claude/zoom-aberration-minimap`. PR draft.

Four owner-requested polish + Sub-Phase F tweaks bundled into one shipping change.

## Camera zoom

`apps/web/src/scene.ts`:

- New `cameraZoom` scalar (range `0.55..2.2`) multiplies the existing
  `cameraOffset` vector so the ¾ iso angle is preserved while the runner can
  pull the camera closer or farther.
- Mouse `wheel` events on the canvas adjust zoom by ±10% per notch
  (`passive: false` so the page doesn't scroll behind it).
- Two-finger pinch on touch devices: tracks the initial finger distance and
  rescales zoom proportionally to the current spread. Single-finger touches
  fall through to the existing joystick / input layer.
- Persisted in `localStorage` under `bitrunners.settings.cameraZoom` so it
  survives reloads.

## CRT chromatic aberration reduced

`apps/web/src/scene.ts`:

- `createCrtPass({ ... aberration: 0.13 })` → `aberration: 0.05`. Per owner
  feedback. Scanline + vignette unchanged.

## ASCII resolution increased

`apps/web/src/scene.ts`:

- All three glyph atlases (`worldAtlas`, `characterAtlas`, `edgeAtlas`) drop
  from `cellSize: 5, fontSize: 7` to `cellSize: 4, fontSize: 6`. This
  increases the cell density by ~56% (4² vs 5² per cell, inverse) so the
  diode pattern looks finer and characters read sharper.
- Atlas canvases also shrink to match — minor texture-memory savings.

## Starmap HUD minimap (Sub-Phase F v1)

- `apps/web/src/minimap-state.ts` (new): module-level shared state with
  anchor positions for SAMM and the Admin obelisk, a `publishMinimapTick()`
  setter scene.ts calls, a `getMinimapTick()` getter the Starmap reads, and
  an `onMinimapTick()` event subscription. No per-tick object allocation
  inside the listener — the dispatched event carries no `detail`.
- `apps/web/src/Starmap.tsx` (new): floating top-right canvas HUD. Renders:
  - centered player dot + facing arrow
  - SAMM marker (gold) and Admin marker (purple)
  - off-map anchors clamp to the edge with reduced opacity so the runner
    still knows which direction to walk
  - HiDPI aware via `devicePixelRatio`; responsive box via `ResizeObserver`
- `apps/web/src/scene.ts`: per `NET_SEND_MS` cadence (~15 Hz, matches
  outbound moves), calls `publishMinimapTick(x, z, facing)`.
- `apps/web/src/App.tsx`: mounts `<Starmap />` beside `<Tutorial />`.
- `apps/web/src/style.css`: `.starmap` container (132 px desktop, 96 px
  ≤540 px viewport) + `.starmap-canvas` styles, pointer-events: none so
  it doesn't intercept clicks.

## Deferred

- The Company NPC anchor (third minimap pin from the plan) — needs Sub-Phase G
  to scaffold the NPC first. The minimap pin will drop in then.
- Active mission checkpoint pin — couples to Sub-Phase G missions.

## Verification

- `pnpm typecheck` ✓
- `pnpm lint` ✓
- `pnpm --filter @bitrunners/web build` ✓ (gzip main 252 kB)
- Headless Chromium repro: boot → class select → scene renders with
  minimap, wheel-scroll persists zoom to localStorage (~1.61 after 5
  steps out), no `pageerror`. Screenshot confirms sharper ASCII +
  weaker aberration.

## No new dependencies. No schema change. No PROTOCOL_VERSION bump.
