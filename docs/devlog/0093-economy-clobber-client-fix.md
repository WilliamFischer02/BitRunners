# 0093 — economy clobber: root cause + client fix

Follow-up to 0092. Read the client sync path and found the actual bug behind the
reported data loss, then fixed it client-side and tightened 0016's guard.

## Root cause (confirmed in code)

Two bugs in the device-local economy made a shared browser overwrite a good
account with a poorer one:

1. **One global localStorage key** — `bitrunners.economy.v1` (economy.ts) — is
   shared across every account on a device. It is not namespaced per user.
2. **`importProgress()` re-stamps `updatedAt = Date.now()`** (economy.ts
   `persist()`). So after loading any account the local `updatedAt` is "now,"
   which beats a real account's stored `updatedAt`.

`loadFromAccount()` merged on `updatedAt` and pushed local **up** when local
looked newer. On a shared family device: sign into `the4dmin`, localStorage
still holds another/older blob stamped "now" → client thinks local is newer →
uploads the poorer blob over `the4dmin`'s good remote. Two accounts
(`the4dmin`, `one`), shared devices — matches the report exactly.

## Fix

**Client (`economy-sync.ts`, `supabase.ts`):**

- **Merge on `lifetimeScrapes`, not `updatedAt`.** `lifetimeScrapes` is
  monotonic and clock-independent. `loadFromAccount` now adopts the remote
  whenever the account has `>=` lifetime progress, so a lower-progress local
  state can never be pushed up over a richer account.
- **Save through the guarded `save_economy` RPC** (`saveEconomy()` in
  supabase.ts), with a fallback to the legacy direct upsert when the RPC isn't
  deployed yet (so the client is deploy-order-safe vs. 0016). On a server
  rejection the client re-loads the authoritative remote instead of fighting it.

**DB (`0016`, guard tightened):** `save_economy` now rejects primarily on a
`lifetimeScrapes` rollback (clobber), with an `updatedAt` tie-break only at
equal lifetime progress — avoiding cross-device false rejections from clock
skew that the first cut could cause. 0016 is still owner-applied and idempotent
(`CREATE OR REPLACE`), so re-running the updated version over the first cut is
safe.

## Verification

- `pnpm --filter @bitrunners/web typecheck` ✓
- `biome check` on both changed files ✓
- No new dependencies.

## Still recommended (not in this PR)

- **Per-account localStorage namespacing** (`…v1:<uid>`) so accounts don't share
  a device blob at all — removes the ambiguity at the source. Follow-up; the
  `lifetimeScrapes` merge + server guard already stop the loss.
- **Recover the two clobbered accounts** from a device's `localStorage`
  (`bitrunners.economy.v1`) if a higher state survives there — Free tier has no
  DB backup to restore from.
