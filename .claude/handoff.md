# Handoff — 2026-05-26, session: admin phase 3 (user table + grants) + RLS security fix

## State of the build

- **⚠️ DEPLOY STATE:** prod `main` (`0ab40c9`) has everything through **PR #47**
  (merged): proxy-wallet/Tokens, runner switch, a11y (`<dialog>`), admin phases
  1/2/4, SAMM glow + security, the autonomous open-PR protocol, distinct pet
  shapes. **Migrations 0001–0005 are run.**
- **⚠️ NEW MIGRATION 0006 — NOT YET RUN.** This session adds
  `0006_admin_user_management.sql`. It is **additive** and **closes a critical
  pre-existing privilege-escalation hole** (see below). Owner: run it in the
  Supabase SQL editor.
- **Tokens are LIVE** (proxy-wallet, lore 009) — spendable, account-synced.
  Canon "bit_spekter can't hold Tokens" RETIRED — do not re-lock. (The *clicker*
  still mints Credits only, never Tokens directly — that's unchanged.)
- **Live server (Fly):** protocol v1, idle-disconnect, ambient NPCs.
- **This session (devlog 0053, NEW branch `claude/admin-phase3-user-grants`,
  PR pending):** admin phase 3 — owner-only user table + permissions/tier
  controls + credit/token grants (via an append-only ledger) — plus the RLS fix.
- **Next big item:** trading backend (server-authoritative economy, p2p-trading
  P1). Once it lands, grants can move from the ledger to direct authoritative
  writes, and the clicker auto-click "premium" gate can key off `tier='elevated'`.
- **CI status:** local gates green — `pnpm lint` clean (53 files),
  `pnpm typecheck` 8/8, `pnpm build` 5/5.

## ⚠️ Critical security finding this session (FIXED in migration 0006)

RLS is **row-level, not column-level.** `profiles_update_own` (0001) lets a user
UPDATE their own row; Supabase's default column grants then let that update touch
**any** column. So once 0003 added `role`, any authenticated user could
`PATCH /profiles?id=eq.<self> {"role":"admin"}` and **self-escalate to admin.**
0006 revokes table-wide UPDATE and re-grants only the display-name columns;
role/tier now change solely via SECURITY DEFINER `admin_set_*`.

> **Owner:** running 0006 closes it. Quick audit after:
> `SELECT id, role FROM profiles WHERE role <> 'user';` — expect only you.

## What I did this session

- **Migration 0006:** `profiles.tier` (free|elevated) + the column-grant
  lockdown; `economy_grants` ledger (append-only, SELECT-own RLS only);
  SECURITY DEFINER fns `admin_list_users` (email exposed to admins only),
  `admin_grant_economy`, `admin_set_tier`, `admin_set_role` (blocks self-role
  change), `claim_economy_grants` (atomic, exactly-once, own-rows).
- **`supabase.ts`:** `AdminUser`/`Tier` + `adminListUsers`/`adminGrantEconomy`/
  `adminSetTier`/`adminSetRole`/`claimEconomyGrants`.
- **`economy-sync.ts`:** claims pending grants right after the load guard clears,
  folds them into the balance, pushes up. Emits `bitrunners:grant-received`.
- **`AdminConsole.tsx`:** `$ users` section (list + per-user editor: role select,
  tier select, grant form). Replaced the "$ coming next" stub.
- **`style.css`:** user-table styles.

## Design note — grant *ledger*, not direct blob write

Economy is account-**synced**, not server-**authoritative** (client owns its
blob, 0002). A direct admin write to another user's blob would be clobbered by
that user's own sync. So grants append to `economy_grants`; the recipient claims
them exactly-once on load. Robust + audited **without** the full
server-authoritative economy (that stays with the trading epic). Failure mode is
benign: a crash between claim and persist loses the grant (never duplicates it).

## What's blocking / not verified

- **Not verifiable headless.** Needs live auth + 0006 run + an admin account.
  See devlog 0053 "Honest status" for the 4-step verification checklist.
- **Trading backend** (server-authoritative economy) still the prerequisite for
  a "real" economy; the ledger is the scoped bridge until then.

## What I would do next, in priority order

1. **Owner: run migration 0006** (closes the escalation hole) + the role audit.
2. **Verify admin phase 3 on the deploy preview** (devlog 0053 checklist):
   list users, set role/tier, confirm self-role-change is blocked, grant
   currency to a 2nd account and confirm it lands on their next load, and
   confirm a normal user can't `PATCH` their own role.
3. **Trading backend** (p2p-trading P1) — the next big focused session.
4. Optional: in-game toast on `bitrunners:grant-received`.
5. Deferred polish: client auto-reconnect after idle-disconnect; tutorial-card
   placement eyeball; `.showModal()` focus-trap upgrade for the panels.

## Files touched this session

- `supabase/migrations/0006_admin_user_management.sql` — new.
- `apps/web/src/supabase.ts` — admin fns + grant claim.
- `apps/web/src/economy-sync.ts` — claim/apply grants on load.
- `apps/web/src/AdminConsole.tsx` — `$ users` table + editor.
- `apps/web/src/style.css` — user-table styles.
- `docs/devlog/0053-admin-phase3-user-table-grants.md` — new.
- `.claude/handoff.md` (this), `.claude/decisions.md`.

## Do NOT do these things

- Don't push to `main` — prod branch; deploys Pages + Fly.
- Don't merge any PR — owner-gated.
- Don't let the *clicker* mint Tokens (it mints Credits; Tokens come from
  exchange / SAMM — lore 007/009).
- Don't add a client-side `profiles` UPDATE of `role`/`tier` — that would
  re-open the escalation hole. Use the `admin_set_*` functions.
- Don't edit `docs/lore/_sealed/`. Don't hand-edit `pnpm-lock.yaml`.
- Don't deploy to Fly from shell — GitHub Actions owns deploys.

## Open questions for the owner

- **Run migration 0006?** (closes the escalation hole; additive.) Strongly yes.
- After 0006: any unexpected admin/dev rows in `profiles`? (the audit query.)
- Grant caps OK (≤10M credits / ≤1M tokens per grant)? Tune if needed.
- Trading backend: ready to scope a dedicated session?
