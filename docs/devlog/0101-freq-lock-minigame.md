# 0101 — freq_lock rhythm minigame (mega-batch 4.13)

**Date:** 2026-06-16
**Branch:** `claude/mega-batch-2026-06-16`
**Type:** P3 feature · client-only (Pages-only deploy)

## What shipped

A new **`// freq_lock`** protocol — a 4-lane rhythm minigame, lazy-loaded as
its own chunk (`FreqLock-*.js`, ~4.3 kB gzipped 1.7 kB) like the Tiptap
board.

- `apps/web/src/FreqLock.tsx` (new) — 4 lanes (`◀ ▼ ▲ ▶`), glyphs fall and
  the player taps the matching lane key (`D F J K` / arrows) or the lane
  itself on touch when the glyph reaches the hit-line. 60-second
  procedurally-generated chart (no audio file — `requestAnimationFrame` +
  `performance.now` timing). Perfect/good hit windows, combo, miss = combo
  break.
- Scoring → Credits: **1 credit per 10 points, capped at 100 credits/run**,
  awarded once via `economy.addCredits` on the end screen. Start / again /
  done controls; ESC closes.
- Registry: `freq_lock` added to `protocols-registry.ts` (glyph `♫`); its
  launch fires `FREQ_LOCK_OPEN_EVENT`. `App.tsx` lazy-mounts the component
  on first launch behind `<Suspense>`.

## STOP-AND-ASK (mechanics)

The brief left mechanics open. Defaults chosen (and easily retuned in the
constants block at the top of `FreqLock.tsx`): `TRAVEL_MS = 1500`,
`HIT_WINDOW_MS = 140`, `PERFECT_WINDOW_MS = 60`, note gap 460–860 ms,
points 100/50. Flagging for owner sign-off on feel + the credit economy
(a clean run can hit the 100-credit cap — intended as the ceiling).

## Verify (owner)

Open the protocols carousel → launch `freq_lock` → start. Glyphs fall down
4 lanes; hit them with D/F/J/K, arrows, or taps. After 60 s the end screen
shows score + credits earned, and your credit balance increases.

## Files

- `apps/web/src/FreqLock.tsx` (new)
- `apps/web/src/protocols-registry.ts`, `App.tsx`, `style.css`
