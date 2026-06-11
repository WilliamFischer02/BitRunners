# 0079 — Mobile HUD polish: badge slot, FPS/net pill, cartridge labels

Owner reported four phone-Firefox-on-iPhone-15-Pro issues:

1. Player name tag had no visible badge icon when no badge equipped → the
   Badges modal had no discoverable entry point.
2. The bottom-right HUD stacked the FPS counter + `NET: CONNECTED ·
   SESSION xxxxxx` pill behind / through the emote wheel buttons.
3. Protocol cartridge labels (e.g. `server_speaker`) read as clipped
   on the carousel.
4. Generic "buttons overlapping / titles not fitting" complaints.

## Fixes

### Always-visible badge slot on the local name tag

- **`apps/web/src/scene.ts`** — `applyTag()` gains an `isSelf` flag.
  When the local runner has no badge equipped, the slot now renders a
  dim `◇` placeholder so the tap region is discoverable. Remote
  runners + NPCs without a badge keep the hidden behavior (no clutter
  in crowds). The placeholder uses `player-tag-badge--empty` class for
  dimmed styling.
- **`apps/web/src/style.css`** — adds `.player-tag-badge--empty`
  (dim tint, no glow) and bumps the self-only `.player-tag-slot--badge`
  to an 18×18 px minimum so a fingertip can reliably land on it.

### Move FPS + NET pill off the emote wheel

- **`apps/web/src/style.css`** (≤540 px breakpoint) — FPS counter
  moves from bottom-right (right above the emote wheel) to top-left,
  stacked below `.hint`. The NET status pill moves from bottom-center
  to top-left, stacked below FPS. Both anchored to the safe-area
  inset. NET pill now uses
  `max-width: calc(100vw - 156px)` so it doesn't reach into the
  top-right minimap zone.
- Bottom-right region is now exclusively the emote wheel; bottom-left
  is exclusively the virtual stick; bottom-center is empty.

### Cartridge label wrapping

- **`apps/web/src/style.css`** — `.cart-label` gains
  `width: 100%; min-width: 0; overflow-wrap: anywhere` so long labels
  like `server_speaker` always wrap to a second line inside the 140 px
  cartridge instead of clipping. Letter-spacing tightened slightly
  (0.08em → 0.06em) so the common labels still fit on one line at
  desktop sizes.

## What did NOT change

- Username editor tint grid (`plain · mint · ember · iris · gradient ·
  glow`) — the layout is `flex-wrap` already. The screenshot showed
  what looked like missing pills but it's just the natural 4-up wrap;
  not a bug.
- Cartridge horizontal scroll behavior — labels wrap instead of
  truncating, no scroll change.

## Verification

- `pnpm lint` ✓ (87 files)
- `pnpm typecheck` ✓ (8/8)
- `pnpm --filter @bitrunners/web build` ✓
- Manual smoke (iPhone 15 Pro Safari simulated viewport):
  - Bottom-right shows only the emote wheel. No FPS / NET pill behind
    the buttons.
  - Top-left stacks `.hint` → `.fps` → `.net-status` cleanly.
  - Name tag without an equipped badge shows the `◇` placeholder; tap
    opens the Badges modal.
  - `server_speaker` cartridge label wraps to two lines inside the
    cartridge box instead of clipping.

No new dependencies. No protocol bump. No schema change.
