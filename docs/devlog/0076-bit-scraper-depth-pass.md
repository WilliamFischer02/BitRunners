# 0076 — Bit scraper depth pass (auras + bots + prestige)

Branch: `claude/scraper-depth-pass`. Draft PR pending.

This is PR 82 in the polish push (see
`/root/.claude/plans/nested-tickling-reddy.md`). Covers buckets
**E1–E4**: more upgrade nodes, auto-converter bots, the post-passcode
tier, and prestige reset → tokens. **E5** (scraper-mastery badge
ladder) is deferred so this PR doesn't need a server-side badge-key
migration in the same diff.

## What ships

### Post-passcode tier — auras

- **`apps/web/src/economy.ts`** —
  - New fields on `EconomyState`: `auras`, `lifetimeAuras`, `prestiges`.
    Backward-compatible normalize() seeds the lifetime counter from the
    current `auras` so existing blobs migrate cleanly.
  - `PASSCODE_AURA_STEP = STEP` (8) — same ladder ratio as the
    canonical bit/string/serial chain.
  - New actions: `tabulateAura()`, `canTabulateAura()`, `calculateAura(faction)`,
    `canCalculateAura()`. The aura trade pays `CREDITS_PER_AURA = 48`
    plus `+yield * STEP` per skill-tree level. Aura trades grant +2
    samaritan vs. +1 for passcodes.

### Auto-converter bots

- **`apps/web/src/economy.ts`** — five single-level upgrade flags:
  `bot_scrape`, `bot_bits`, `bot_strings`, `bot_serials`,
  `bot_passcodes`. Each is queried by the matching `hasBot*` helper.
- **`apps/web/src/skilltree.ts`** —
  - New Path 4 "autonomous swarm" with five nodes (one per rung).
    Costs ramp 25 → 30 → 50 → 80 → 140 passcodes.
  - Path 1 and Path 3 `maxLevel` extended from 12 → 30 for late-game
    headroom.
- **`apps/web/src/ScrapeMenu.tsx`** — single shared interval at
  `BOT_TICK_MS` (1.1 s) walks the ladder once per tick, gating each
  rung on the matching upgrade flag. The interval runs only while the
  scrape panel is open — bots are active-panel automation, not truly
  background workers (deliberate: keeps battery cost predictable on
  mobile).
- New `BotsStatus` UI section under the scrape view renders one row
  per active bot when at least one is bought.

### Prestige reset

- **`apps/web/src/economy.ts`** —
  - `isPrestigeUnlocked()` — true once the runner has minted at least
    one aura. Prevents prestige from being available before there's
    anything to trade.
  - `prestigeTokenPayout()` — `PRESTIGE_TOKEN_BASE + floor(lifetimePasscodes / PRESTIGE_TOKEN_DIVISOR)`.
    Surfaced separately so the UI can preview the payout.
  - `prestigeReset()` — burns `bits`, `strings`, `serials`,
    `passcodes`, `auras`, `credits`, and `upgrades`. Preserves
    `tokens`, `owned`, `equipped`, reputation, badges, and lifetime
    counters. Increments `prestiges`. Fires
    `bitrunners:prestige-reset` for any future toast handler.
  - `scrapeYield()` now adds `prestiges * PRESTIGE_BUFF_PER_LEVEL`
    so the permanent buff is felt immediately.
- **`apps/web/src/ScrapeMenu.tsx`** — new `$ prestige · clean slate`
  section in the scrape view, conditional on `isPrestigeUnlocked()`.
  Shows current tier + buff + reset payout.

### HUD

- **`apps/web/src/ScrapeMenu.tsx`** — `DataHud` adds an `auras` row
  between passcodes and the currency divider.
- **`apps/web/src/style.css`** — `.scrape-hud--aura` (iris tint
  matching the BR badge color so auras feel BitRunner-leaning by
  default), `.scrape-prestige` (iris top border), `.scrape-bots`
  (dashed mint top border).

## Architecture decisions

- **Auras share the STEP = 8 ratio.** The canon "8× costs" rule
  applies one ladder step further up. Doesn't break anything that
  depends on STEP.
- **Aura trade payout is non-linear vs. 8 passcodes.** 8 passcodes
  traded individually = `8 * creditsPerPasscode()`. One aura =
  `CREDITS_PER_AURA + yield * STEP` ≈ 48 + … which intentionally
  beats the raw passcode trade once `yield` is up. This is the
  long-game payoff for going deeper.
- **Bots tick only while the panel is open.** Trading background
  worker ergonomics for predictability: clear opt-in, no surprise
  battery drain, no hidden state mutations while the user is
  elsewhere. If/when membership unlocks true autonomy, that can be a
  separate flag.
- **Single shared bot timer.** One `setInterval`, one bot loop. Each
  rung re-checks the upgrade flag every tick so a level bought in the
  tree view turns the matching bot on without a panel reopen.
- **Prestige wipes upgrades.** The permanent buff is the trade-off;
  upgrades are the thing being sold. The alternative — keeping
  upgrades — would have made prestige a free token printer.
- **Mastery badge ladder deferred.** Adding a third `mastery:*`
  faction would need a `supabase/migrations/00XX` to extend the
  `earned_badges.badge_key` CHECK constraint. That belongs in a
  later PR alongside the server-side trigger that materializes
  rows. The client-side ladder will plug into the same BadgesModal
  list once the migration ships.

## Verification

- `pnpm lint` ✓ (79 files, no fixes applied)
- `pnpm typecheck` ✓ (8/8 tasks)
- `pnpm --filter @bitrunners/web build` ✓ (5.08 s)
- Manual:
  - Mint 8 passcodes → tabulate → 1 aura appears in the HUD.
  - Buy `t.bot.bits` in the tree → wait one BOT_TICK_MS while the
    scrape view is open → bits tally drops by 8, strings by +1.
  - Mint first aura → `$ prestige` section appears → tap "trade" →
    buffers reset, +tokens, `prestiges` increments, `scrapeYield()`
    returns 1 + prestige levels.

## Owner-tunable values

| What | v1 default | Where |
|---|---|---|
| Aura step ratio | 8 (= STEP) | `economy.ts` `PASSCODE_AURA_STEP` |
| Credits per aura | 48 | `economy.ts` `CREDITS_PER_AURA` |
| Aura samaritan grant | +2 / trade | `economy.ts` `calculateAura` |
| Bot tick interval | 1100 ms | `economy.ts` `BOT_TICK_MS` |
| Bot costs | 25 / 30 / 50 / 80 / 140 pc | `skilltree.ts` per node `costFor` |
| Prestige token base | 1 | `economy.ts` `PRESTIGE_TOKEN_BASE` |
| Prestige token divisor | 30 lifetimePasscodes | `economy.ts` `PRESTIGE_TOKEN_DIVISOR` |
| Prestige scrape buff | +1 bit / SCRAPE / level | `economy.ts` `PRESTIGE_BUFF_PER_LEVEL` |
| Scrape maxLevel | 30 | `skilltree.ts` `t.scrape.maxLevel` |
| Yield maxLevel | 30 | `skilltree.ts` `t.yield.maxLevel` |

## Roadmap

- PR 76 (merged) — Auth verify, password reset, signup grant
- PR 77 (merged) — Responsive design tokens
- PR 78 (merged) — Persistent credits HUD
- PR 81 (merged) — 10-mission chain + lore + complete-state hydration
- PR 79 (open) — Badges modal + name styling
- PR 80 (open) — Shop + Inventory 2-tab modal
- **PR 82 (this PR)** — Bit scraper depth (auras + bots + prestige)
- PR 83 — Tether chat protocol
- PR 84 — Custom name + emote approval debugging
- PR 85 — Minimap detail / legibility on phone
- Future — Mastery badge ladder (server-side migration + client-side
  third ladder)

## No new dependencies. No protocol bump. No schema change.
