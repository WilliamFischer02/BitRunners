# 0067 — Tether Hop minigame + chatter resource + exchange UI (Phase 3)

Branch: `claude/phase3-tether-hop` (off `claude/phase1-protocols-carousel`).
Draft PR pending. Builds on Phase 1's Protocols carousel.

## What ships

### new

- **`apps/web/src/games/tether-hop/game.ts`** — pure 2D canvas + RAF
  game logic. 3 channels recede to a horizon vanishing point; waveforms
  spawn on a tempo curve and scroll toward a strike line near the
  bottom. Tap a lane within ±0.06 t-units of the strike line for a
  hit. No three.js — keeps the game shader-free and lightweight.
  Module surface: `runTetherHop(canvas, onEnd, options)` returns a
  handle with `cancel()`.
- **`apps/web/src/games/tether-hop/TetherHop.tsx`** — protocol panel
  with four views: `ready` (boot splash + chatter balance), `running`
  (canvas + live HUD), `result` (captured/missed totals + "again" /
  "exchange" buttons), `exchange`.
- **`apps/web/src/games/tether-hop/Exchange.tsx`** — two-faction trade
  surface: route via The Admin or file with The Company. Rate is
  `5 credits / chatter` regardless of faction; faction picks change
  flavor only (no Samaritan award yet — that lands when full NPC
  interactions ship). All chatter is consumed in one click.
- **`docs/lore/017-tether-hop-and-chatter.md`** — canon for the
  minigame mechanics, exchange rate, and owner-tunable values
  (spawn cadence, wave speed, strike window).

### edits

- **`apps/web/src/economy.ts`** — `chatter: number` added to
  `EconomyState`. `normalize` seeds it to 0 for older blobs (additive,
  backward-compatible — no schema-version bump). New `addChatter(n)`
  and `spendChatter(n)` helpers.
- **`apps/web/src/protocols-registry.ts`** — third cartridge added
  (`tether_hop`, glyph `≋`, corp-tinted). Exports
  `TETHER_HOP_OPEN_EVENT` + `openTetherHop()` helper.
- **`apps/web/src/App.tsx`** — mounts `<TetherHop />` alongside the
  other surfaces.
- **`apps/web/src/style.css`** — `.tether-panel` modal + game canvas
  + HUD + result + exchange row styles. Mobile fallback at ≤540 px
  (shorter canvas, single-column exchange).

## Architecture

- **2D canvas instead of three.js.** Keeps the game light, avoids
  another `EffectComposer` per minigame, and dodges the iOS-Safari
  shader-compile risk. Phase 4's ASCII filter will wrap the rest of
  the menus but the game's own canvas stays 2D for legibility.
- **Pure game logic.** `game.ts` knows nothing about React or the
  economy — it just emits `(captured, missed, t)` ticks and a final
  `RunResult`. The React shell decides whether to award chatter and
  what view to show next.
- **Abort = early end.** `cancel()` invokes the same `onEnd` path as
  a natural run end, so the player keeps any chatter they captured
  before aborting. The result view renders next.

## Verification

- `pnpm typecheck` ✓
- `pnpm lint` ✓
- `pnpm --filter @bitrunners/web build` ✓
- Headless Chromium repro:
  - Protocols carousel now shows 3 cartridges (Scrape, Objectives,
    Tether Hop).
  - `ArrowRight → ArrowRight → Insert` opens the Tether Hop panel.
  - Pressing `[ boot protocol ]` mounts the canvas (638×131 dpr-px in
    the test viewport) and starts the run.
  - Random taps register as misses; live HUD updates to `0 / 10`.
  - Screenshot confirms the receding-channels layout, animated
    waveform pulses, time progress bar, and lane pads.

## Owner-tunable values

All in `game.ts` constants; safe to edit without affecting types:

| Constant | v1 default |
|---|---|
| `RUN_DURATION_MS` | 60 000 |
| `BASE_SPAWN_MS` | 1 500 |
| `FLOOR_SPAWN_MS` | 480 |
| `BASE_SPEED` | 0.5 t/s |
| `PEAK_SPEED` | 1.05 t/s |
| `STRIKE_WINDOW` | ±0.06 t |
| `CREDITS_PER_CHATTER` | 5 (in `Exchange.tsx`) |

## Roadmap

- Phase 1 (PR #70) — Protocols carousel + Objectives + minimap parity
- Phase 2 (PR #71) — Page-Visibility standby + spawn scatter
- **Phase 3 (this PR)** — Tether Hop + chatter + exchange
- Phase 4 — ASCII pixel-crush transition engine + circuit-board floor
- Phase 5 — Retrofit transitions to legacy modals

## No new dependencies. No protocol bump. No schema change.
