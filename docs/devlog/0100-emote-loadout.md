# 0100 — Emote swap UI + premium emote pack (mega-batch 4.12)

**Date:** 2026-06-16
**Branch:** `claude/mega-batch-2026-06-16`
**Type:** P3 feature · client-only (Pages-only deploy)

## What shipped

- **`emotes.ts` (new)** — the emote catalog: 10 free **base** emotes
  (the prior 8 + `salute o7`, `heart <3`) and a 10-emote **premium "cooler"
  pack** (`grin >:)`, `cool 8)`, `laugh xD`, `cat :3`, `rock \m/`,
  `starry *_*`, `cry T_T`, `smug B)`, `chill ~_~`, `shock O_O`), each with
  id/glyph/label/premium/price.
- **`@bitrunners/shared`** — the new glyphs added to `EXTRA_EMOTE_GLYPHS`,
  folded into the server's `isValidEmote` allowlist so an equipped emote is
  accepted (still no free text).
- **`economy.ts`** — additive `ownedEmotes` (purchased premium ids) +
  `emoteLoadout` (4 slots) on the blob, with `purchaseEmote`,
  `ownsPremiumEmote`, `getOwnedEmotes`, `getEmoteLoadout`, `setEmoteSlot`.
  Base emotes are always available (resolved via the catalog; economy stays
  catalog-agnostic).
- **Shop `// emotes` tab** — lists the premium pack with buy buttons at
  `PREMIUM_EMOTE_PRICE = 100 cr` (**STOP-AND-ASK**: placeholder, tune later).
- **Inventory `$ emote slots`** — 4 equip slots; tapping a slot opens a
  picker over owned emotes (base ∪ purchased) and assigns via `setEmoteSlot`.
- **Emote wheel** — the 4 cardinal directions now reflect the equipped
  loadout (live via `subscribeEconomy`); the 4 diagonals stay fixed
  defaults. The wheel now emits the **glyph** directly (App
  `triggerEmote(glyph)`), supporting premium glyphs.

## Persistence decision (no migration)

The brief specified a `profiles.equipped_emotes` column + RPC + migration
`0013_emote_loadout.sql`. Instead the loadout rides the **account-synced
economy blob** (`player_economy`, migration 0002) like all other cosmetics —
so it persists per-account with **no new migration and no owner SQL step**.
A separate column would be a second source of truth for the same data. See
`.claude/decisions.md` (2026-06-16). **`0013` is intentionally not used.**

## Verify (owner)

Open `// inventory` → `$ emote slots`: tap a slot, pick an emote → the
emote wheel's matching direction updates. Buy a premium emote in the shop's
`// emotes` tab (needs 100 cr) → it appears in the picker. Sign in on
another device → loadout + owned emotes follow the account.

## Files

- `apps/web/src/emotes.ts` (new), `economy.ts`, `EmoteWheel.tsx`,
  `ScrapeMenu.tsx`, `App.tsx`, `style.css`
- `packages/shared/src/index.ts`
