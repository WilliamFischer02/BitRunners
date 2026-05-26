# 009 — The proxy wallet (Tokens unlocked for bit_spekter)

## Question(s) asked

The owner wants a real wallet holding both Credits and Tokens, so SAMM and the
store can use Tokens. This overrides the long-standing canon that `bit_spekter`
has no Token wallet (lore 003/007/008). How to frame it?

## Owner's answer (lightly edited)

**Frame it as the proxy-wallet unlock arriving** — the thing 003/007/008 always
said was "planned." `bit_spekter` now holds Tokens through the proxy wallet.
Canon is *extended*, not contradicted.

## In-game implications

- **Tokens are now a real, spendable currency** alongside Credits, held in the
  account-synced wallet (rides the existing `player_economy` blob — no new
  table). Previously "held in trust" winnings (`lockedTokens`, e.g. SAMM token
  prizes) are **released into the spendable balance** when the wallet loads —
  the in-fiction moment the proxy wallet comes online.
- **Acquisition:** Credits → Tokens **one-way** exchange (you can buy Tokens
  with Credits, not cash them back out — Tokens stay a premium sink). Rate is a
  single tunable constant (`CREDITS_PER_TOKEN`). Also via SAMM token prizes /
  token bets.
- **Spending:** token-priced **premium** store items; SAMM token bets.
- **Tone:** the "no wallet" lock copy (SAMM token-win quip, HUD "no wallet"
  row) is retired now that the wallet exists.

## Canon note

This **supersedes** the "bit_spekter cannot hold Tokens" restriction in
003/007/008. The restriction was always paired with "proxy-wallet planned";
this is that unlock. The 8× data ladder and Credits-as-clicker-output remain
unchanged. Tokens remain scarce/premium (one-way exchange + premium pricing).

## Open follow-ups

- Whether other classes get the wallet differently (currently universal).
- Server-authoritative validation once trading lands (Tokens are now tradeable-
  relevant; the device-local blob is still client-trusted — same posture as
  Credits today).
