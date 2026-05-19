# 0034 — Data Scrape: data/token HUD aesthetic + shop framework scaffold

**Date:** 2026-05-16
**Branch:** `claude/bitrunners-collaboration-EcqBv` (rides PR #33; not merged)

## TL;DR

Continuation of devlog 0033. Two things:

1. **Aesthetic pass on the data/token section under the SCRAPE button.** It's
   now a terminal-style HUD: per-tier rows with an ASCII ladder micro-bar
   (`█`/`░` filling toward the next 8× step), a passcode row, a Credits row, a
   dimmed **locked Tokens** row (`⌷ no wallet` — canon), a lifetime-scrapes
   stat, and a faint scanline overlay. Glyph-atlas/Caves-of-Qud terminal
   vocabulary; reduced-motion safe.
2. **Shop framework scaffold.** A small `shop ▸` header button swaps the panel
   body to a shop view. New isolated `apps/web/src/shop.ts`: catalog model,
   `evaluate`/`buy`, Credits-priced items, **Token items present but
   hard-locked** per canon.

## Canon / safety

- Shop spends **Credits only**. Token-priced entries are locked with a canon
  reason (`bit_spekter` has no Server-Space wallet; proxy-wallet planned —
  lore 003/007). The shop cannot spend or mint Tokens.
- Catalog is **placeholder scaffold** (2 benign Credits cosmetics + 1 locked
  Token entry). Real rewards + any lore are an **open owner Q&A** — cosmetics
  are Phase-3, emoticrons moderation-gated; not fabricated.
- Ownership stored in `EconomyState.owned: string[]` — **additive,
  backward-compatible**: older `v1` blobs without `owned` normalise to `[]` on
  load. No schema-version bump; the account-migration seam is unchanged.
- Still fully isolated: `economy.ts`/`shop.ts`/`ScrapeMenu.tsx` have no
  scene/network/server coupling. Cannot regress Phase-2.

## Status

- Functional: HUD live-updates; shop view lists items; affordable Credits
  items purchase (deduct + record owned + persist) and reflect `owned`;
  locked/owned/unaffordable states render correctly.
- Deferred (unchanged): full isometric ASCII button render + press juice,
  glitch polish, idle generation, balancing numbers, wiring purchased
  cosmetics to actual visual effects, reputation reward curve (faction-reward
  Q&A).

## Gates

`pnpm lint` clean (42 files), `pnpm typecheck` 8/8, `pnpm build` 5/5. No test
suite (pre-existing). Not browser-verified (headless) — gate-verified +
reasoned; needs a click-through on a deployed build.

## Files

- `apps/web/src/economy.ts` — `owned` field (additive/normalised),
  `getOwned`/`ownsItem`/`purchaseWithCredits`.
- `apps/web/src/shop.ts` — new shop framework.
- `apps/web/src/ScrapeMenu.tsx` — HUD, shop view, header shop toggle.
- `apps/web/src/style.css` — HUD + shop styles.
- `docs/design/clicker-minigame.md` — §13 shop framework + HUD note.
- `docs/lore/007-data-economy.md` — shop reward catalog added to open
  follow-ups.
- `.claude/decisions.md`, `.claude/handoff.md` — updated.
