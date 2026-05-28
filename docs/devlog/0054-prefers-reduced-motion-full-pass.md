# 0054 — prefers-reduced-motion: full accessibility pass

**Date:** 2026-05-26
**Branch:** `claude/peaceful-thompson-Ls9H1`
**Files changed:** `apps/web/src/style.css` only

## What changed

Added a single consolidated `@media (prefers-reduced-motion: reduce)` block at
the end of `style.css`, covering the 17 animations and transform-transitions
that previously had no guard. The five inline blocks above (scrape-panel-in/out,
scrape-gain, scrape-glow, scrape-btn.is-pressed, samm-prompt-pulse) were already
handled; this pass fills the remaining 58% coverage gap.

### Covered

| Element | Previous | After |
|---|---|---|
| `.boot-screen::before/::after` | `boot-scan / boot-halo` infinite | `animation: none` |
| `.boot-banner` | `boot-banner-pulse` infinite | `animation: none` |
| `.boot-caret` | `boot-blink` infinite | `animation: none` (stays solid) |
| `.boot-tile` hover transition | includes `transform 140ms` | transition drops `transform`; color/shadow kept |
| `.boot-tile:hover:not(:disabled)` | `translateY(-1px)` lift | `transform: none` |
| `.boot-tile--active` | `tile-breathe` infinite | `animation: none` |
| `.rain` | `rain-fade-out` 1300ms | `animation: none; opacity: 0` (instant hide) |
| `.rain-col` | `rain-fall` infinite | `animation: none` |
| `.profile::before/::after` | `profile-flicker` infinite | `animation: none` |
| `.emote-btn` | `emote-flicker` infinite | `animation: none` |
| `.emote-float` | `transition: transform 1300ms, opacity 1300ms` | `transition: opacity 300ms` (fade only; no float) |
| `.dialogue-caret` | `dialogue-caret-blink` infinite | `animation: none` (caret stays solid) |
| `.dialogue-cont` | `dialogue-cont-bounce` infinite | `animation: none` |
| `.scrape-btn` | `transition: transform + box-shadow` | transition drops `transform` |
| `.scrape-btn:active` | `translateY(6px)` press | tilt kept; no translateY |
| `.scrape-mini` | `transition: transform 60ms` | `transition: none` |
| `.scrape-mini.is-ready:active` | `translateY(2px)` press | `transform: none` |

### Not changed (intentionally)

- Short `opacity`-only transitions (≤ 200ms): `.player-tag`, `.panel-stub`,
  `.panel-title.is-error`, `.admin-select` — opacity fades are not vestibular
  triggers; removing them would degrade state-feedback more than it helps.
- The five existing inline `@media (prefers-reduced-motion: reduce)` blocks —
  already correct, not duplicated.

## Policy applied

- **Ambient infinite loops** → `animation: none`; element stays visible.
- **Rain** → instant hide (`animation: none; opacity: 0`).
- **Blinking carets** → `animation: none`; cursor stays solid and readable.
- **Interactive transform presses** → `translateY` removed; static shadow still
  gives press feedback; no layout jump.

## Honest status

- Gates green: `pnpm lint` clean (52 files), `pnpm typecheck` 8/8,
  `pnpm build` 5/5.
- CSS-only change — no JS/TS touch. Not verifiable headless (need a browser with
  `prefers-reduced-motion: reduce` system preference or DevTools override).
- Does not touch `apps/server` — Pages-only deploy, no Fly redeploy.

## Next

- Focus-trap upgrade: the `<dialog>` elements use `open` attribute rather than
  `.showModal()`. Upgrading to `.showModal()` would give native focus-trapping;
  needs a careful refactor of the JS open/close paths in `ScrapeMenu.tsx`,
  `Samm.tsx`, `AdminConsole.tsx`, `ProfileIcon.tsx`.
- Trading backend (p2p-trading P1) — still the next major session.
