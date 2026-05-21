# 0041 — Chunk C: SAMM, the gambling vending machine

**Date:** 2026-05-21
**Branch:** `claude/bitrunners-collaboration-EcqBv`

Third sprint chunk (roadmap 0039). A walk-up gambling NPC — **SAMM**, the State
Authored Money Machine. Lore recorded in `docs/lore/008-samm.md` + glossary.

## Owner Q&A (locked)

- **Name/personality:** SAMM — government-profit machine; **formal, jolly,
  impersonal** civic-service voice.
- **Access:** **in-world machine now** — reuses the `vending` prop already in
  the scene (at 6.0, −5.5); walk-up proximity opens the terminal.
- **Odds:** **real house edge** — a pull can lose outright; credit EV ≈ 0.84×
  bet. Items rare, Tokens very rare.

## What shipped

- **`samm.ts`** (new, isolated — imports only `economy.ts` + `shop.ts`):
  weighted outcome table (lose 0.40 / credits 0.5–25× / item / token), a
  placeholder prize pool, and `gamble(bet)` which spends up front then applies
  the roll. **All odds/payouts centralized here** (single tunable source).
- **Canon-safe Tokens:** Token *betting* is shown but disabled (no wallet); a
  Token *win* calls `economy.addLockedTokens` — display-only locked winnings,
  never spendable, surfaced as the proxy-wallet hook. Credits fully functional.
- **`economy.ts`** (additive, backward-compatible): `lockedTokens` field +
  `spendCredits` / `addCredits` / `grantItem` (free prize, falls back to
  consolation Credits if inventory full/owned) / `addLockedTokens`.
- **`Samm.tsx`** (new): a walk-up `use SAMM` prompt (shown while in range) +
  the betting terminal — 3-reel ASCII display with a spin animation
  (reduced-motion safe), bet-tier selector, PULL, result + a SAMM quip, and a
  credits / locked-tokens wallet readout.
- **`scene.ts`:** `checkSammApproach()` fires `bitrunners:samm-range`
  {inRange} on the existing vending machine's coords (no new mesh).
- **`App.tsx`:** listens for the range event, renders `<Samm inRange>`.

## Isolation / canon

`samm.ts` imports only economy/shop — no scene/network/server. The scene→React
link is a one-way CustomEvent (`bitrunners:samm-range`), same bus as the Admin
encounter. No new lore invented beyond the recorded SAMM Q&A; no `_sealed/`
content surfaced. Tokens canon (bit_spekter has no wallet) is preserved.

## Honest status

- Gates green: `pnpm lint` clean (47 files), `pnpm typecheck` 8/8,
  `pnpm build` 5/5.
- **Not verified live (headless).** Eyeball on the Pages preview: walk to the
  vending machine (≈6, −5.5) → `use SAMM` prompt appears; open → bet → reels
  spin → payout/loss applies to Credits; step away → prompt + panel dismiss.
- House edge (≈16% on the credit portion) is a **first pass** — tune in
  `samm.ts`. Prize pool is placeholder catalog items.
- **Deferred:** SAMM machine visual cue when near (glow), Token betting
  (proxy-wallet), any SAMM reputation/quests (it's a pure money sink for now).

## Files

`apps/web/src/samm.ts` (new), `apps/web/src/Samm.tsx` (new),
`apps/web/src/economy.ts` (credit/grant/locked-token primitives),
`apps/web/src/scene.ts` (proximity), `apps/web/src/App.tsx` (mount),
`apps/web/src/style.css` (terminal + prompt), `docs/lore/008-samm.md` (new) +
`docs/lore/README.md`, this devlog, `.claude/handoff.md`, `.claude/decisions.md`.
