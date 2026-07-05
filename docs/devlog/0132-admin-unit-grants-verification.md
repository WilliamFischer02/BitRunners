# 0132 — Admin unit grants + email-verification tooling

## TL;DR

- **Migration 0018** (owner applies via SQL editor / Supabase agent):
  - `economy_grants` gains `bits/strings/serials/passcodes` columns.
  - `admin_grant_economy` re-created with unit params (old 4-arg
    overload dropped to keep PostgREST rpc resolution unambiguous);
    same is_admin gate, non-negative checks, 1e6/unit fat-finger caps.
  - `claim_economy_grants` returns the unit sums (exactly-once,
    atomic, unchanged semantics).
  - `admin_list_users` exposes `email_confirmed`
    (`auth.users.email_confirmed_at IS NOT NULL`).
  - 0013/0014-style lockdown re-applied to all three.
- **Admin console**: four unit inputs beside the credits/tokens grant
  row (same queue-and-claim ledger flow); a `verified ✓ / NOT
  verified ✗` line per selected user with a `[ resend verification ]`
  button for unverified accounts.
- **Client claim path**: `claimEconomyGrants` returns units,
  `economy.addUnits()` folds them into the buffer, `applyPendingGrants`
  applies them under the same loading-guard + explicit-save flow.
- `resendVerificationEmail(email)` helper (supabase-js `auth.resend`,
  signup type, redirect to `#auth/verified`) — shared by the admin
  console and (next PR) the title-screen recovery menu.

## Ordering / compatibility

Client tolerates the migration not being applied yet: claim coerces
missing unit fields to 0, and the extended `admin_grant_economy` call
fails with a clear PostgREST signature error rather than corrupting
anything. Apply 0018 before using the new grant fields.

## Not included (deliberate)

- Negative adjustments / unit removal — grants only, matching the
  existing ledger's non-negative invariant.
- Admin-triggered verification for the user (Supabase can't confirm an
  email server-side without the user clicking the link; resend is the
  correct remediation).
