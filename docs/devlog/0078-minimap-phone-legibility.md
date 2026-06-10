# 0078 — Minimap phone legibility + tap-to-expand

Branch: `claude/minimap-phone-detail`. Draft PR pending.

This is PR 85 in the polish push (see
`/root/.claude/plans/nested-tickling-reddy.md`). The starmap minimap
read fine on desktop but was a tiny 96 × 96 box on phones with 7 px
labels. Owner wanted "more detail / legibility on a smaller (phone)
screen" while preserving the lo-fi aesthetic.

## What ships

### Painter overhaul

- **`apps/web/src/Starmap.tsx`** — extract `paint(ctx, pxSize, opts)`
  as a pure function so the same render code drives both the HUD
  canvas and the expanded modal canvas.
- New decorations:
  - **Compass labels** (N / E / S / W) around the edge so orientation
    never feels lost when you're in a corner of the world.
  - **Mid-ring guideline** at 32 % radius for distance estimation
    between the player and an off-center anchor.
  - **Filled circle markers with halo** in place of the 4 × 4 px
    squares. Halo is the same tint at 25 % alpha, marker is full
    intensity. Reads from a much greater distance.
  - **Per-anchor full-name labels** (SAMM / ADMIN / OBJ) with a 1 px
    dark text-shadow so the label survives over noisy backdrops.
  - **Live x,z coordinate readout** in the bottom-left corner. Two
    digits, padded so the cursor doesn't twitch when the values
    flip signs.
  - **Heavier facing arrow** with a longer reach so the player's
    heading still reads at thumb-distance on a phone.
- Big-mode (`opts.big = true`) doubles all font + marker scales for
  the expanded view.

### Tap-to-expand

- Minimap container is now a `<button>`. Tapping it opens a centered
  modal at `min(420px, 92vw)` with a 2× larger canvas. ESC + backdrop
  click + the explicit ✕ button all close it.
- The expanded canvas reuses the same `paint()` function so the
  two views can never drift visually.

### CSS

- **`apps/web/src/style.css`** — `.starmap` size becomes
  `clamp(120px, 18vw, 156px)` (desktop) and `clamp(108px, 30vw, 132px)`
  (≤ 540 px). Up from a flat 96/132. Hover/focus tint added.
- Adds `.starmap-expanded-back`, `.starmap-expanded`,
  `.starmap-expanded-head/close/canvas/foot` styles. Modal lives at
  `z-index: 60`, above all other game HUD overlays.

## Architecture decisions

- **Pure `paint()` function, not two parallel painters.** Keeping
  the small + big canvases in lockstep is a one-line bug magnet
  otherwise. The painter takes `pxSize` + opts and reads the same
  module state for player + mission anchor.
- **No new state.** Both canvases subscribe to the existing
  `onMinimapTick` + `subscribeMissionChanges` plumbing. The
  expanded modal is just one more subscriber.
- **No mobile-only feature branching at the JS level.** The same
  component renders on both desktop and phone; CSS clamp() handles
  the size curve. Tap-to-expand works on desktop too (handy when
  you're playing on a small window).
- **`clamp()` instead of media-query break.** The transition is
  smooth across all viewport widths, which matches the design
  tokens added in PR 77.

## Verification

- `pnpm lint` ✓ (79 files, no fixes applied)
- `pnpm typecheck` ✓ (8/8 tasks)
- `pnpm --filter @bitrunners/web build` ✓ (5.32 s)
- Manual:
  - Desktop 1440 × 900 → minimap ~156 px, compass + coords readable.
  - 540 × 900 phone-portrait → minimap ~132 px, full-name labels
    survive.
  - Tap minimap → centered 420 × 420 modal opens, all markers and
    labels render at the larger scale. ESC closes.
  - Move the runner → coords + facing arrow + checkpoint pin all
    track in real time on both views.

## Owner-tunable values

| What | v1 default | Where |
|---|---|---|
| HUD min size | 108 px (mobile) / 120 px (desktop) | `style.css` `.starmap` clamp |
| HUD max size | 132 px (mobile) / 156 px (desktop) | `style.css` `.starmap` clamp |
| Big-mode size | `min(420px, 92vw)` | `style.css` `.starmap-expanded` |
| Marker radius | 3 (HUD) / 5 (big) | `Starmap.tsx` `markerSize` |
| Label font size | 9 (HUD) / 12 (big) | `Starmap.tsx` `fontPx` |
| Compass labels | N / E / S / W | `Starmap.tsx` `paint` |

## Roadmap

- PR 76 (merged) — Auth verify, password reset, signup grant
- PR 77 (merged) — Responsive design tokens
- PR 78 (merged) — Persistent credits HUD
- PR 81 (merged) — 10-mission chain + lore + complete-state hydration
- PR 79 (open) — Badges modal + name styling
- PR 80 (open) — Shop + Inventory 2-tab modal
- PR 82 (open) — Bit scraper depth
- PR 83 (open) — Tether chat protocol
- PR 84 — Custom name + emote approval debugging (deferred — server-side)
- **PR 85 (this PR)** — Minimap phone legibility + tap-to-expand

## No new dependencies. No protocol bump. No schema change.
