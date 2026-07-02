# 0123 — Guest→account progress carryover on signup (fix)

## Symptom (owner)

A player plays as a guest, then signs up in the same session — and their guest
progress does not carry into the new account.

## Root cause

`economy-sync.ts` `loadFromAccount` decided local-vs-remote by comparing
`lifetimeScrapes` only (`remoteScrapes >= local.lifetimeScrapes` → adopt
remote). A guest who earned via the **minigames** (freq_lock / circuit_patch /
core_run credits, shop purchases, emote loadout) but never ran the data-scrape
clicker has `lifetimeScrapes = 0`. Against a fresh/empty account row (also
`lifetimeScrapes = 0`) the `>=` tie adopted the **empty** remote and
`importProgress()` **wiped** the guest's credits/items/loadout.

## Fix

Merge on a broad `progressScore(blob)` instead of `lifetimeScrapes` alone. The
score folds in every earning dimension — cumulative counters (lifetimeScrapes,
lifetimePasscodes×8, lifetimeAuras×64, prestiges×500) weighted heaviest, plus
credits, tokens×100, owned/ownedEmotes/unlocks counts, reputation, and the
circuit first-clear flag. Adoption rule is unchanged in shape
(`remoteScore >= localScore` → adopt remote; else push local up), so:

- **Guest→signup** (local has any progress, remote empty): `local > remote` →
  local is pushed up. Now covers minigame-only guests. ✓ (the bug)
- **Shared device** (devlog 0093): a richer remote account still out-scores a
  poorer leftover local blob → adopt remote, no clobber. ✓
- **Returning player, new device** (local fresh, remote rich): adopt remote. ✓
- **Returning player, offline gains** (local richer than last sync): push
  local up, no loss. ✓

Not a security change — the blob is still client-authored (server-authoritative
validation remains the trading-epic concern). No migration; no schema change.

## Known limitation (unchanged, pre-existing)

`localStorage` is a single global blob per device (not namespaced per user —
devlog 0093 flagged `…v1:<uid>` namespacing as the real fix, still not done).
So a *fresh signup on a device that holds another account's leftover blob* will
inherit it. That's the same tradeoff that makes guest carryover possible; the
proper fix is per-account namespacing (future).

## Verify (owner)

As a guest, play a minigame to earn credits (don't touch the data scraper), buy
an emote, then sign up + verify in the same browser → the new account shows the
guest credits + emote. Also confirm a real account signed into on a second
device still loads its (richer) server progress rather than an empty local.
