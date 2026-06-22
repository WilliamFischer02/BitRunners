# 0112 — Economy persistence audit: stop losing scrape progress

## What broke (field report)

Owner reported his data scrape progress was reset. He asked for a deep
audit of the persistence flow to make sure progress + credits actually
land on the account, not just localStorage.

## Audit findings

The full `EconomyState` blob (bits / strings / serials / passcodes,
credits, tokens, owned cosmetics, equipped, upgrades, emote loadout,
lifetime counters, repCorporate / repBitrunner, tutorialDone, unlocks)
**is** persisted server-side in `player_economy.blob` via the existing
sync layer. The DB schema is correct; the bug is in **how the client
loads and flushes** that blob.

Two concrete loss vectors found:

### Vector A — Guest→signup tie-breaking clobber (likely the user's bug)

`apps/web/src/economy-sync.ts:49` (before this PR) used:

```ts
if (remote && remoteUpdated >= getEconomy().updatedAt) {
  importProgress(remote); // adopt server
} else {
  await saveNow(uid);     // push local up
}
```

When a guest plays for hours offline then signs up:

| State | `updatedAt` |
| --- | --- |
| Local (guest scrapes) | `T` (recent mutation timestamp) |
| Remote (fresh row created at signup) | `T_signup ≈ T` (also NOW()) |

If the server row is created in the same second as the local mutation
(common — signup → load fires within ms of NOW()), the `>=` comparison
adopts the EMPTY server blob and overwrites the guest's hours of
scrape progress.

### Vector B — Debounce timer doesn't fire if the tab closes first

The save path is debounced 1500 ms. If the user makes mutations and
then closes the tab (or backgrounds it on mobile) inside that window,
the timer never fires and the latest state is lost. No `beforeunload`
/ `visibilitychange` handler existed.

### Vector C — Grant sequencing race (defence in depth)

`applyPendingGrants()` was called AFTER `loading = false`, so the
addCredits / addTokens calls fired the debounce listener in parallel
with the explicit `saveNow()` at the end of grant-apply. Rarely
visible but could land a stale save just after the explicit one.

## What I changed

`apps/web/src/economy-sync.ts`:

1. **`>=` → `>`** in `loadFromAccount`. On a tie, local wins. A guest
   who's been playing keeps their progress; the freshly-minted empty
   account blob gets pushed back up.
2. **`applyPendingGrants` moved INSIDE the `try` block**. `loading`
   stays true while grants apply, so the addCredits / addTokens calls
   don't fight the explicit saveNow that follows them.
3. **`flushPendingSave()` + `beforeunload` and `visibilitychange`
   handlers**. On tab hide / unload, any pending debounce is cancelled
   and `saveNow()` fires immediately. The fetch may or may not finish
   on a hard unload, but the more common visibility-hide path
   (alt-tab, phone-lock, app-switch) reliably catches.

Total diff: ~20 lines in one file.

## What I did NOT change

- **No schema change.** The blob shape is fine.
- **No server-authoritative validation.** The blob is still
  client-authored; per `.claude/decisions.md` (2026-05-21 (a)) that's
  deferred to the P2P-trading epic. Out of scope for a save-loss fix.
- **No merge strategy.** `importProgress()` still clobbers local on
  adoption. With Vector A patched, adoption only happens when the
  server is genuinely newer, so a merge isn't strictly needed; if loss
  reports continue I'd reach for that next.
- **Tabs sync.** Two tabs on the same account can still race each
  other's writes. Acceptable; a single-session-per-account constraint
  (devlog 0091) helps but doesn't eliminate it.

## How a user recovers (manual)

If a player believes they lost progress from this bug specifically,
the `player_economy.updated_at` column on the server is the
authoritative record of when their account last took a write. If
they have an older `localStorage` snapshot in another browser/device
they can sign in there and that write will overtake the current
server state under the new tie-breaker.

Otherwise: no, the data isn't recoverable. The server only stores
the latest blob, not a history.
