# 0036 — Data Scrape: completion + polish pass

**Date:** 2026-05-16
**Branch:** `claude/bitrunners-collaboration-EcqBv` (rides PR #33; not merged)

## TL;DR

Owner asked to finish/polish the concepts already added (not add scope). No
new content — catalog/rarity/pet lore + faction-reward stay owner-gated and
were **not** invented. Filled the half-built parts of devlogs 0033–0035.

## Done

- **`tabulate` upgrade now does something.** It was an inert stored level.
  Added `tabulateAll()` / `canTabulateAll()` / `tabulateReach()` in
  `economy.ts`: a cascading **bulk convert**, reach = upgrade level (capped 3
  tiers), persisting once. **Locked 8× ratio preserved exactly** — it just
  batches the audited single step. A `[ all ]` row appears once the cache is
  owned. Deliberately manual (no idle/auto timer — that's a separate owner
  balance decision, flagged in design §14).
- **Open *and* close transition.** Added `scrape-panel--out` glitch-out; all
  close paths (✕ / backdrop / Esc) go through `requestClose()` which plays the
  out-animation then unmounts. Reduced-motion → instant. (Original ask was
  "open and close"; close was missing.)
- **Core-action juice.** Floating `+N` on SCRAPE, press-pop, faint iso
  scanline frame on the button. Reduced-motion safe.
- **Failure states surfaced.** `inventory full` is now returned by shop
  `evaluate()` (was a silent buy failure); shop buttons show
  `owned`/`equipped`/`maxed`/reason; inventory shows an empty-state line.
- **Robustness.** Esc handler is mount-once via a ref (was re-binding every
  render); every transient timer tracked + cleared on unmount.

## Unchanged guarantees

- Still Credits-only; Token path hard-locked (canon). No invented
  clothing/pet/rarity content or lore. IP linkage still rejected.
- Still fully isolated — no scene/network/server imports;
  `appearance.ts` boundary intact.

## Gates

`pnpm lint` clean (43 files), `pnpm typecheck` 8/8, `pnpm build` 5/5. No test
suite (pre-existing). Not browser-verified (headless) — gate-verified +
reasoned; needs a click-through on a deployed build.

## Files

`apps/web/src/economy.ts`, `apps/web/src/shop.ts`,
`apps/web/src/ScrapeMenu.tsx`, `apps/web/src/style.css`;
`docs/design/clicker-minigame.md` (§14 update + §15), `.claude/handoff.md`.

## Still deferred (gated, not omitted)

Real catalog/rarity/pet content + lore (owner Q&A), then wire `scene.ts` →
`appearance.ts` to render gear on the rig; reputation reward curve
(faction-reward Q&A); balancing numbers; optional idle/auto generation
(owner balance call).
