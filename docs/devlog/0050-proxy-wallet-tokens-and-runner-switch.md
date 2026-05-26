# 0050 — Proxy-wallet (Tokens live) + runner switch

**Date:** 2026-05-26
**Branch:** `claude/bitrunners-collaboration-EcqBv`

Two owner-requested features: the **token wallet** (proxy-wallet unlock) and an
in-game **runner switch**.

## Token wallet — the proxy-wallet unlock (lore 009)

The long-locked "bit_spekter has no Token wallet" canon is now retired *as
planned* — the proxy wallet arrives. **No DB migration**: Tokens ride the
existing account-synced economy blob (`player_economy`).

- **`economy.ts`:** `tokens` is now a real spendable balance (replaces the
  display-only `lockedTokens`). On load, legacy `lockedTokens` blobs are
  **folded into** the spendable balance (`tokens = tokens + lockedTokens`) — the
  in-fiction moment held-in-trust winnings are released. New: `addTokens`,
  `spendTokens`, `exchangeCreditsForTokens` (one-way), `CREDITS_PER_TOKEN`
  (=100, tunable); `purchaseItem` takes a `currency`.
- **Exchange (Credits → Tokens, one-way):** a "buy tokens" control in the shop
  (`+1` / `+5`). Tokens stay a premium sink (no cash-out).
- **Store:** token-priced **premium** items (an aurora crown, a data seraph);
  `evaluate`/`buy` are currency-aware; rows show `tk`/`cr`.
- **SAMM:** bet **Credits or Tokens** (currency toggle + token bet tiers
  `[1,3,10]`); payouts in the bet currency; the rare token bonus awards a real
  spendable Token. `samm.ts` stays network-isolated (still emits a `quipKey`).
- **Display:** real token balance shown in the clicker HUD, SAMM, and shop; all
  "no wallet" copy retired (incl. the SAMM token-win line).

Still client-trusted (device-local blob synced to the account) — same posture
as Credits. Server-authoritative validation is the trading-epic concern.

## Runner switch (in-game class change)

- **`Boot.tsx`:** `startAtSelect` prop — re-entry skips the boot scroll, goes
  straight to the class-select grid.
- **`App.tsx` Shell:** listens for `bitrunners:change-runner` → returns to the
  select grid; picking a class re-enters the game (scene re-inits on the new
  class). Combined with the tutorial's `server_speaker` unlock, you can now
  swap between unlocked runners mid-session.
- **`ProfileIcon.tsx`:** a `change runner · [ switch ]` row in the profile
  panel dispatches the event + closes the panel.

## Honest status

- Gates green: `pnpm lint` clean (53 files), `pnpm typecheck` 8/8,
  `pnpm build` 5/5.
- **No migration** for this batch (tokens are in the JSONB blob) — Pages-only.
  Requires the account-sync (migration 0002) to persist tokens across devices;
  works device-local regardless.
- **Not verifiable headless** — verify: buy tokens with credits; bet tokens at
  SAMM; buy a token-priced item; token balance shows everywhere; "change
  runner" returns to select and swapping re-skins the scene.

## Files

`apps/web/src/economy.ts` (tokens + exchange), `shop.ts` (currency + premium
items), `samm.ts` + `Samm.tsx` (token bets), `ScrapeMenu.tsx` (HUD/shop tokens
+ exchange), `dialogue.ts` (token-win copy), `Boot.tsx` + `App.tsx` +
`ProfileIcon.tsx` (runner switch), `style.css`, `docs/lore/009-proxy-wallet.md`
(new) + `docs/lore/README.md`, this devlog, `.claude/decisions.md`,
`.claude/handoff.md`.
