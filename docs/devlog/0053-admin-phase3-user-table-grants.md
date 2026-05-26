# 0053 — Admin phase 3: user table + currency grants (+ a profiles RLS security fix)

**Date:** 2026-05-26
**Branch:** `claude/admin-phase3-user-grants`
**Migration:** `0006_admin_user_management.sql` (owner runs it; additive)

Built admin-panel-epic.md feature (b): an owner-only **user table** with
permissions/tier controls and **credit/token grants**. Plus a **critical
pre-existing security fix** the work surfaced (profile self-escalation).

## ⚠️ Security finding (critical, pre-existing) — FIXED in 0006

RLS is **row-level, not column-level.** The `profiles_update_own` policy
(migration 0001) lets a user UPDATE their *own* profile row, and Supabase's
default column grants let that update touch **any** column. Since 0003 added
`role` to `profiles`, that means any authenticated user could:

```
PATCH /rest/v1/profiles?id=eq.<their-own-id>   {"role":"admin"}
```

…and **self-escalate to admin** (the row passes `auth.uid() = id`, and the
existing `WITH CHECK` only constrains `display_name_status`, default `'unset'`).
The 0003 comment ("no client UPDATE policy grants it") was mistaken — 0001
already grants the row update.

**Fix (in 0006):** revoke table-wide UPDATE from `PUBLIC, anon, authenticated`
and re-grant column UPDATE *only* on the display-name columns the self-service
flow needs. `role`/`tier` are now writable solely via the SECURITY DEFINER
`admin_set_*` functions; `service_role` still bypasses (SQL editor unaffected).

> **Owner action:** running migration 0006 closes this. At pre-alpha scale it's
> almost certainly only your own account, but worth a one-line audit:
> `SELECT id, role FROM profiles WHERE role <> 'user';` — confirm only you are
> admin/dev.

There is currently **no** client `profiles` update flow (only a `SELECT role`),
so the column re-grant breaks nothing today and keeps the door open for the
future display-name setter.

## Design — grant *ledger*, not a direct blob write

The economy is account-**synced**, not server-**authoritative**: the client
owns its `player_economy.blob` (own-row RLS, 0002). A naive admin "grant" that
writes another user's blob would **race with — and be clobbered by — that
user's own client sync** (last-write-wins by `updatedAt`).

So grants go through an **append-only `economy_grants` ledger**:

- `admin_grant_economy(target, credits, tokens, reason)` (SECURITY DEFINER,
  re-checks `is_admin`) inserts a row. Non-negative + capped (≤10M credits /
  ≤1M tokens) + target-exists guards.
- The recipient claims via `claim_economy_grants()` — a single atomic
  `UPDATE … RETURNING` in a CTE that marks all their unclaimed rows claimed and
  returns the sums. **Exactly-once**; anon/other users can't touch rows that
  aren't theirs (`WHERE user_id = auth.uid()`).
- Client side: `economy-sync.ts` calls it right after the load guard clears, so
  `addCredits/addTokens` fold the grant into the balance and the debounced +
  one immediate `saveNow` push it back up.

This gives audited, robust cross-user grants **without** building the full
server-authoritative economy (that still belongs to the trading epic, P1).
Failure mode is benign: if a client dies in the ~instant between claim and
local persist, the grant is lost (not duplicated) — currency can't be minted by
replay. localStorage persists immediately, so in practice the window is tiny.

## Migration 0006 surface

- `profiles.tier TEXT 'free'|'elevated'` (+ the column-grant lockdown above).
- `economy_grants` table (append-only) + `SELECT own` RLS only (no client
  insert/update/delete — functions are the only writers) + partial index on
  unclaimed rows.
- `admin_list_users()` — SECURITY DEFINER; `is_admin` gate in `WHERE` (non-admins
  get zero rows). Joins `auth.users` (email **only** exposed to admins) +
  `player_economy` (balance mirror) + unclaimed-grant sums. `LIMIT 500`.
- `admin_grant_economy`, `admin_set_tier`, `admin_set_role` — all SECURITY
  DEFINER, all re-check `is_admin`, all validate inputs. `admin_set_role` blocks
  changing **your own** role (lockout guard; bootstrap admin via SQL, 0003).
- `claim_economy_grants()` — recipient-side, own-rows-only, atomic.

## Client

- `supabase.ts`: `AdminUser`/`Tier` types, `adminListUsers`, `adminGrantEconomy`,
  `adminSetTier`, `adminSetRole`, `claimEconomyGrants` (+ `GrantClaim`).
- `economy-sync.ts`: `applyPendingGrants()` after load → claim → apply → push.
  Emits `bitrunners:grant-received` (unconsumed seam for a future toast).
- `AdminConsole.tsx`: `$ users` section — scrollable user list (email · role ·
  tier ★ · ¢credits ◈tokens · +pending), click to open an editor with role
  `<select>`, tier `<select>`, and a credits/tokens/reason grant form.
- `style.css`: `.admin-userlist/.admin-userrow/.admin-usereditor/.admin-grant-*`
  (matches the dialogue-editor green palette; coarse-pointer min-heights).

## Honest status

- Gates green: `pnpm lint` clean (53 files), `pnpm typecheck` 8/8,
  `pnpm build` 5/5.
- **Not verifiable headless.** The whole flow needs live auth + migration 0006
  run + an admin account. Verify on the deploy preview:
  1. `$ users` lists accounts; non-admins never see the console (and `admin_list_users`
     returns nothing if they call it directly).
  2. Set a test user's role/tier — confirm it sticks; confirm you **cannot**
     change your own role ("cannot change your own role").
  3. Grant credits/tokens to a second account; sign in as that account →
     balance reflects the grant on load.
  4. Confirm the escalation fix: as a normal user, a direct
     `PATCH profiles {"role":"admin"}` is rejected.
- Disjoint from any other in-flight work (branched off `main` post-#47).

## Next
- **Trading backend** — server-authoritative economy (p2p-trading-epic P1). Once
  it exists, grants could move from the ledger to direct authoritative writes,
  and the deferred clicker auto-click "premium" gate can key off `tier='elevated'`.
- Optional: a small in-game toast on `bitrunners:grant-received`.
