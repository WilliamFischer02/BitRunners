# 0091 — RLS initplan performance pass (migration 0015)

Optional follow-up to the 0089 audit. Closes the last open Supabase advisor
category from that audit: `auth_rls_initplan`.

## TL;DR

- **26 RLS policies** called `auth.uid()` / `is_admin(auth.uid())` directly, so
  Postgres re-evaluated the auth function **once per row**.
- **`0015` wraps each call in `(SELECT …)`** so the planner hoists it to an
  InitPlan evaluated **once per query** — the canonical Supabase fix.
- **Behaviour is identical.** Same boolean predicates, same roles (PUBLIC, no
  `TO` clause added). Only the evaluation count changes. The 3 world-readable
  `USING (true)` policies are untouched.
- Wrapped in a single transaction (atomic swap, no RLS-on-but-no-policy window)
  and idempotent (`DROP POLICY IF EXISTS` + `CREATE`).
- **Run `supabase/migrations/0015_rls_initplan_perf.sql` in the SQL editor.**

## Why it's optional

At 2 users this changes nothing observable — it's a lint/scale-hygiene pass. It
clears the `auth_rls_initplan` WARN advisories and means the policies stay cheap
as row counts grow. Generated from a live `pg_policies` read so each rewrite
matches the deployed predicate exactly.

## Not included (deliberately)

- **`TO authenticated` role clauses.** Supabase also recommends scoping policies
  by role, but that needs per-policy judgement (the world-readable trio must
  stay reachable by `anon`), so it's left out to keep this a pure,
  behaviour-identical perf swap.
- **`multiple_permissive_policies`** on `emoticron_submissions` (two SELECT
  policies) — functionally fine; merge only if it ever matters.
- **`set search_path = ''`** on functions — invasive (schema-qualify every
  reference); tracked as future work.

## Owner action

- [ ] Run `0015_rls_initplan_perf.sql` in the Supabase SQL editor.
- [ ] Confirm in Advisors → Performance that `auth_rls_initplan` is cleared.

No new dependencies. No schema/behaviour change. No DB writes from this session.
