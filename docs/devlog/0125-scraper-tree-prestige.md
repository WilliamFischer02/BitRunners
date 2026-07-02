# 0125 — Data-scraper tree overhaul + aura-scaled prestige

## Owner asks

- No duplicate tree upgrades.
- Auto-tapper with 4 tiers (slow / medium / fast / hold-down).
- Bots toggleable on/off.
- "Buy Supercomputer" (most expensive functional upgrade) — auto-holds every
  conversion for a constant scrape→passcode flow.
- "Corporate Greed Protocol" (5,000,000 passcodes) — persistent inner-edge
  screen glow while logged in.
- Prestige's permanent-scrape gain scales with accrued auras (≈10 → +1,
  ≈5000 → +20, gradual).

## Tree (`skilltree.ts`)

- **Removed the duplicate**: `t.auto` (hands-free auto-scrape) and
  `t.bot.scrape` (a bot that taps SCRAPE) did the same thing. Both are replaced
  by a single **`t.autotap`** node (`upgradeKey: autotap`, maxLevel **4** =
  slow / medium / fast / hold-down).
- **`t.supercomputer`** (Path 4, 2000 pc — the most expensive functional node):
  auto-holds every conversion at once.
- **`t.greed`** (Path 3, 5,000,000 pc): the cosmetic capstone.
- Converter bots (bits/strings/serials/passcodes) unchanged.

## Economy (`economy.ts`)

- `autoTapLevel()` (0–4) replaces `hasAutoScrape`/`hasBotScrape`. `normalize()`
  **grandfathers** anyone who owned the old `auto`/`bot_scrape` into `autotap`
  level 1 (additive, backward-compatible).
- `hasSupercomputer()`, `hasGreedProtocol()`.
- **Prestige buff is now accumulated + aura-scaled.** New field `prestigeBuff`
  (seeded on load from the legacy `prestiges × 1` so existing players keep their
  exact buff). `scrapeYield` uses `prestigeBuff` instead of `prestiges × 1`.
  `prestigeReset` adds `prestigeBuffGain()` = `max(1, round(sqrt(lifetimeAuras)
  × 0.28))` → ~10 auras +1, ~5000 auras +20 (gradual). Prestige now **preserves
  the Supercomputer + Corporate Greed capstones** through the wipe (they're
  permanent), everything else in the tree still resets.

## ScrapeMenu

- Auto-tapper interval by tier `[off, 900, 500, 220, 90] ms`; Supercomputer
  forces the top (continuous) tier. Converter loop runs each bought rung, or
  **all rungs + SCRAPE when the Supercomputer is owned**.
- **Bots on/off toggle** (`bitrunners.settings.bots`, default on) in the bots
  panel; both loops pause when off. `BotsStatus` shows the active tier /
  Supercomputer and a paused (⏸) state.
- Prestige panel shows the accumulated buff + the next aura-scaled gain.

## Corporate Greed glow

`GreedGlow.tsx` (mounted in `Game`) shows a gold inner-edge `box-shadow` glow
while **signed in AND** `hasGreedProtocol()` (the flag rides the account blob,
so it's account-tied). Pointer-events off; reduced-motion static.

## STOP-AND-ASK defaults (tune freely)

- Auto-tap intervals, Supercomputer cost (2000 pc), autotap tier costs
  `[25,60,140,400]`. Prestige buff uses **lifetime** (accrued) auras, per
  "accrued"; curve constant `0.28`. Greed is purely cosmetic (a 5M-passcode
  flex) — no gameplay effect, per the request.

No migration (all additive economy-blob fields).

## Verify (owner)

Buy `auto-tapper` → it taps; buy more tiers → faster; toggle bots off → pauses.
Buy Supercomputer → constant scrape→passcode. Prestige with more accrued auras
→ bigger permanent buff, and Supercomputer/Greed survive. Buy Greed (5M) while
signed in → gold edge glow.
