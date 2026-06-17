# 0092 — Desktop launcher pills drop below the minimap (mega-batch 4.4)

**Date:** 2026-06-16
**Branch:** `claude/mega-batch-2026-06-16`
**Type:** P1 broken UX · CSS-only (Pages-only deploy)

## Symptom

On desktop/tablet (> mobile breakpoint) the profile + protocols launcher
tiles rendered in the top-right corner, **overlapping the minimap** and
sitting too high. The mobile layout was reworked across devlogs
0082/0084/0086 but the desktop layout was never re-checked.

## Root cause

The launcher's *global* rules (outside any media query) put the tiles in
the top-right column where the minimap already lives:

- `.starmap` — `top:12px; right:12px; height: clamp(120px,18vw,156px)`.
- `.profile` (global, line ~2059) — `top: ~10px`, right derived to sit one
  tile-width left of protocols → lands right over the minimap.
- `.protocols-launch` (global, line ~4093) — `top:156px; right:12px` →
  clips the minimap's bottom edge.

Only the `max-width: 540px` mobile block repositioned them; everything
above 540px fell through to the overlapping globals.

## Fix

Added a complementary **`@media (min-width: 541px)`** block (covers the
whole non-mobile range, not just ≥720px, so the 541–720 tablet band is
fixed too). It drops both tiles into the right column **below** the
minimap, stair-stepped to match the mobile feel:

- Both: `top = calc(12px + clamp(120px,18vw,156px) + 10px)` — i.e. the
  minimap's bottom edge + a 10px gutter. Height `clamp(56px,8.4vw,72px)`,
  `min-height: 44px`.
- `.profile` (upper): `right: 24px` (nudged inward), width auto 120–168px.
- `.protocols-launch` (lower): `right: 12px` (flush), stacked one
  tile-height + 8px below the profile.

## Before / after (computed @ 1280px viewport, minimap = 156px)

| element | before | after |
|---|---|---|
| minimap | top 12–168, right 12–168 | unchanged |
| profile | top ~10, right 98–228 → **over minimap** | top 178–250, right 24–~150 → clear |
| protocols | top 156–234, right 12–90 → **clips minimap** | top 258–330, right 12–90 → clear |

No overlap remains; both tiles keep a ≥44px tap target.

## Verify (owner)

Open the live build on a desktop browser ≥721px wide (and resize down to
~600px to check the tablet band). The profile + protocols tiles should sit
in a tidy stack under the minimap, not on top of it. A headless screenshot
wasn't captured (no browser-automation dep installed) — dimensions above
are from the CSS math.

## Files

- `apps/web/src/style.css`
