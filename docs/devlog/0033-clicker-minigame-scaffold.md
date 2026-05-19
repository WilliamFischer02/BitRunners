# 0033 — Data Scrape mini-game: design + scaffold

**Date:** 2026-05-16
**Branch:** `claude/bitrunners-collaboration-EcqBv` (rides PR #33; not merged to `main`)

## TL;DR

Designed and scaffolded a cookie-clicker economy mini-game opened from a
launcher **directly under the profile/account button**. This pass = the
**design doc + a working scaffold**; full isometric ASCII art, press juice, and
balancing are deferred (owner chose "design doc + menu scaffold").

- **Design:** `docs/design/clicker-minigame.md` (full architecture, locked
  decisions, open seams).
- **Lore (Q&A recorded per mandate):** `docs/lore/007-data-economy.md` +
  glossary/index update. Canon **preserved**.
- **Code:** `apps/web/src/economy.ts` (pure model + device-local persistence),
  `apps/web/src/ScrapeMenu.tsx` (launcher + panel scaffold), mounted in
  `App.tsx`, styles in `style.css`. Fully isolated from scene/network/server.

## Loop

SCRAPE (+1 bit) → TABULATING (8 bits→1 string→1 serial→1 passcode, uniform 8×)
→ CALCULATING (trade 1 passcode → Credits with **The Company** = recycle / +1
Corporate, or **The Admin** = destroy-for-privacy / +1 BitRunner).

## Owner decisions locked (Q&A this session)

1. **Device-local persistence** (`localStorage['bitrunners.economy.v1']`,
   versioned, `bitrunners:economy-changed` event — mirrors the settings
   pattern). **IP-based guest sync was rejected** (PII/privacy, contradicts the
   Admin's own anti-data lore, age-gate risk, backend not wired). Account
   migration is a documented seam (`migrateEconomyToAccount()` stub).
2. **Currency canon preserved:** clicker mints **Credits** (common). **Tokens**
   stay scarce/premium, **not** clicker-minted; `bit_spekter` cannot earn Tokens
   (proxy-wallet planned, lore 003). The clicker never mints Tokens.
3. **Serials**, uniform **8×** ladder.

## Status / seams (honest)

- Scaffold is functional: SCRAPE works, tier conversions and trades mutate
  state, readout is live, progress persists across reloads on the device.
- **Deferred:** full isometric ASCII button render + press animation, glitch
  open/close polish (a CSS stub is in), idle/passive generation, balancing
  numbers (`STEP=8`, `CREDITS_PER_PASSCODE=4` are placeholders).
- **Blocked seam:** reputation **reward curve** — open faction-reward owner Q&A
  (`.claude/handoff.md`). Trades increment a raw counter and emit a
  `bitrunners:reputation-earned` intent; no rewards wired. Intentional.
- Anti-cheat: device-local state is trivially editable. Acceptable for a
  single-player cosmetic loop; revisit if it ever grants multiplayer-visible
  value.

## Roadmap note

Not on the `0004` Phase-2 roadmap — owner-directed. Built fully isolated (no
imports to/from `scene.ts`/`network.ts`/server) so it cannot regress Phase-2
multiplayer. Balancing/polish is its own track.

## Gates

`pnpm lint` clean (41 files), `pnpm typecheck` 8/8, `pnpm build` 5/5. No test
suite (pre-existing). **Not browser-verified** (headless env) — logic is
gate-verified and reasoned; needs a click-through on a deployed build.

## Files

- `docs/design/clicker-minigame.md`, `docs/lore/007-data-economy.md`,
  `docs/lore/README.md` (index+glossary), this devlog — new/updated docs.
- `apps/web/src/economy.ts`, `apps/web/src/ScrapeMenu.tsx` — new.
- `apps/web/src/App.tsx`, `apps/web/src/style.css` — wired/styled.
- `.claude/decisions.md`, `.claude/handoff.md` — updated.
