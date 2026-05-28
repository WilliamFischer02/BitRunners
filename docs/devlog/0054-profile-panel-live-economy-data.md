# 0054 — Profile panel: live economy data + stale copy fixes

**Date:** 2026-05-27
**Branch:** `claude/peaceful-thompson-F9dTL`

## What changed

Two UI-correctness fixes. No server touch, Pages-only deploy.

### 1. Profile panel wired to live economy

`ProfilePanel` in `ProfileIcon.tsx` previously showed hardcoded placeholders:
- `$ inventory`: "─── empty. tokens and outfits unlock in phase 3." + static `─` for
  tokens and outfits.
- `$ samaritan status`: hardcoded `0` for both corporate and bitrunner rep.

Both have been live since devlog 0049 (proxy-wallet, Tokens spendable) and the
tabulate/calculate reputation system existed before that. The profile panel was just
never wired up.

**Fix:** added `subscribeEconomy` to `ProfilePanel` and replaced all hardcoded
stubs with live reads from `getEconomy()`:

- `$ economy` (renamed from `$ inventory`): shows `credits`, `tokens`, `items owned`
  (count from `eco.owned`), plus a pointer to the scrape panel for the full view.
- `$ samaritan status`: shows `eco.repCorporate` and `eco.repBitrunner`.

Also removed a dead `<section hidden>` ("$ account-stub") that was never rendered.

### 2. Stale InventoryView stub text

`ScrapeMenu.tsx` `InventoryView` said:

> "equipped look feeds appearance.ts; the 3D render reads it in a later pass."

This was written before `scene.ts` consumed `appearance.ts` (Chunk B, devlog 0040).
The wiring landed in a prior session. Updated to player-facing copy:

> "tap a slot to equip it. equipped clothing + pets appear on your runner in the 3D
> scene."

## Security scan (this run)

- No `dangerouslySetInnerHTML`, no `eval`, no free-text player input — clean.
- Board API (`functions/api/board/[slug].ts`): no auth on PUT, content-length
  guard + 512 KB cap in place. The board is intentionally public-writable
  (collaborative writer board). No rate limiting — minor concern at current scale;
  flag for when DAU grows. No injection vector (slug is alphanumeric-validated;
  content served as `text/markdown` to Tiptap which handles rendering).
- Open PRs #49 (auto-reconnect + grant toast) and #50 (reduced-motion a11y) are
  both clean and disjoint from this work.

## Honest status

- Gates green: `pnpm lint` clean (52 files), `pnpm typecheck` 8/8, `pnpm build`
  5/5.
- **Not verifiable headless.** The profile panel needs a browser. Verify:
  1. Open profile panel → `$ economy` shows real credits/tokens/item count.
  2. Buy something or earn credits, reopen panel → values update live.
  3. Trade a passcode → samaritan rep increments.
  4. Guest with no economy data → items owned shows `─`, credits/tokens show 0.
- Pages-only. Does not touch `apps/server` — no Fly redeploy needed.

## Files touched

- `apps/web/src/ProfileIcon.tsx` — eco state + live sections.
- `apps/web/src/ScrapeMenu.tsx` — stub text update.
- `docs/devlog/0054-profile-panel-live-economy-data.md` — this file.
- `.claude/handoff.md` — updated.
