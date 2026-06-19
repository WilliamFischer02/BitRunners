# 0090 — finish the RPC anon lockdown (migration 0014)

Follow-up to the 0089 Supabase audit. Live-state recheck found 0013's hardening
only partly took effect; 0014 closes it correctly.

## TL;DR

- **0013's `REVOKE ... FROM anon` was a no-op for 10 admin RPCs.** They still
  carry an EXECUTE grant to the `PUBLIC` pseudo-role, and `anon` inherits
  EXECUTE through PUBLIC — so dropping only the *direct* anon grant changed
  nothing.
- **0014 revokes `EXECUTE ... FROM PUBLIC`** (the missing piece) on the 12
  admin RPCs + `dm_rate_counter_gc`. `authenticated` keeps its own direct grant,
  so the admin console is unaffected and each RPC still re-checks
  `is_admin(auth.uid())`.
- 0013's CORE fixes are already live (`award_pending_badges` fully revoked,
  `touch_updated_at` search_path pinned), so 0014 does not repeat them.
- **Run `supabase/migrations/0014_finish_rpc_lockdown.sql` in the SQL editor.**

## Why 0013 looked applied but wasn't

`0013` is recorded in `supabase_migrations.schema_migrations`, and its CORE
statements did land. But the RECOMMENDED block used `REVOKE EXECUTE ON FUNCTION
... FROM anon`, which only removes the direct grant. PostgreSQL's
`has_function_privilege('anon', fn, 'EXECUTE')` returns true if anon has EXECUTE
**directly OR via PUBLIC**, and Supabase's default privileges grant EXECUTE to
PUBLIC (`=X/postgres` in `pg_proc.proacl`) on every function at CREATE time.
Result for the 10 admin RPCs that never had PUBLIC revoked: anon stayed
executable. The 3 emoticron admin RPCs flipped correctly only because migration
0010 had already done `REVOKE ALL ... FROM PUBLIC` on them.

Takeaway for future migrations: to remove anon/auth from an RPC, revoke from
`PUBLIC` (not just `anon`); the role-specific grants sit on top of the PUBLIC
grant.

## Not exploitable, just untidy

Every one of these RPCs gates on `is_admin(auth.uid())` internally, so an anon
caller already gets "admin only" / zero rows. This is surface reduction +
clearing the Supabase advisor `anon_security_definer_function_executable`
warnings, not a live-vuln fix.

## Owner action

- [ ] Run `0014_finish_rpc_lockdown.sql` in the Supabase SQL editor (idempotent).
- [ ] Re-run `audits/0002_state_audit.sql`; the admin RPCs should no longer be
      anon-reachable.

No new dependencies. No schema/behaviour change. No DB writes from this session.
