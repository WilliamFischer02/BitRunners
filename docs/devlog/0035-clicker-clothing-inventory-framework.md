# 0035 — Data Scrape: clothing/pets/upgrades + inventory + appearance seam

**Date:** 2026-05-16
**Branch:** `claude/bitrunners-collaboration-EcqBv` (rides PR #33; not merged)

## TL;DR

Continuation of 0033/0034. Owner Q&A locked all four to recommended:
framework + polish · isolated appearance seam · device-local + account seam ·
placeholder catalog (real content via later lore Q&A).

Delivered the **framework** for clothing, pets, rate upgrades, a 16-slot
inventory, equip/hide, an **isolated appearance seam**, and a concrete
**account-link seam** — plus **polish** on the existing clicker. No final art,
no rig rendering, no invented content/lore.

## What landed

- **`economy.ts`** — additive, backward-compatible state: `upgrades`,
  `slots[16]`, `equipped{head,chest,legs,pet}`, `appearanceHidden`. New:
  `purchaseItem` (auto-fills first free slot; inventory-full blocks),
  `purchaseUpgrade` (repeatable→maxLevel, rising cost), `equip`,
  `setAppearanceHidden`, `scrapeYield()` (scrape upgrade wired live),
  `exportProgress`/`importProgress` (the account-link seam),
  `subscribeAppearance` + `APPEARANCE_EVENT`. No schema-version bump.
- **`shop.ts`** — item kinds `clothing|pet|upgrade`; 3-rarity model with a
  data-only `visual` descriptor (normal=palette · rare=+effect ·
  ultra=+effect+texture+colour); pets priced far above clothing; placeholder
  catalog clearly marked; Token path stays hard-locked (canon).
- **`appearance.ts`** (new) — the isolation boundary. Resolves equipped →
  `EquippedAppearance`. **Nothing imports it yet**; scene.ts will later import
  only this to re-skin the rig. Mini-game still has zero scene/network/server
  coupling.
- **`ScrapeMenu.tsx`** — view nav (scrape/shop/inv), categorized shop with
  rarity badges, 16-slot inventory grid (equip toggle, equipped summary,
  show/hide cosmetics). **Polish:** SCRAPE press-pop animation, scrape-yield
  readout, and all transient timers tracked + cleared on unmount (no
  setState-after-unmount).
- **`style.css`** — rarity badges, inventory grid, nav active state, press-pop
  (reduced-motion safe).

## Canon / safety / isolation

- Credits-only purchasing; Token items hard-locked (bit_spekter no wallet —
  lore 003/007). Catalog is placeholder; real clothing/pet/rarity content +
  lore is an open owner Q&A — flagged in lore 007, not invented.
- IP linkage stays rejected; persistence is device-local with the
  export/import account seam.
- `appearance.ts` keeps the render boundary clean — the deliberate isolation
  decision holds; cannot regress Phase-2.

## Gates

`pnpm lint` clean (43 files), `pnpm typecheck` 8/8, `pnpm build` 5/5. No test
suite (pre-existing). Not browser-verified (headless) — gate-verified +
reasoned; needs a click-through on a deployed build.

## Files

`apps/web/src/economy.ts`, `apps/web/src/shop.ts`,
`apps/web/src/appearance.ts` (new), `apps/web/src/ScrapeMenu.tsx`,
`apps/web/src/style.css`; `docs/design/clicker-minigame.md` (§14),
`docs/lore/007-data-economy.md` (follow-ups), `.claude/decisions.md`,
`.claude/handoff.md`.

## Still deferred

Rig rendering of clothing/pets + real effect/texture/colour, non-`scrape`
upgrade effects, real catalog + rarity/lore (owner Q&A), balancing, idle
generation, reputation reward curve (faction-reward Q&A), full iso ASCII
button + glitch-close polish.
