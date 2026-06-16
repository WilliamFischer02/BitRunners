# 0089 — Supabase audit (2026-06-16, live-DB verified)

First Supabase audit run **with the MCP connected**, so this verifies the live
database directly instead of reading-through migrations like 0085 did. Project
audited: **`BitRunners`** (`sqmakffzbhalyflhieoz`, us-east-1). Read-only — no
DDL/DML executed against the live DB.

## TL;DR

- **Audit clean. Zero schema drift** across migrations 0001 → 0012. Every
  table, column, function, index, RLS policy, grant, seed count, and the
  realtime publication matches the migration source exactly.
- **20/20 tables, 39/39 functions, 15/15 profiles columns, 8/8 named indexes**,
  RLS on for all 20 tables, profiles column-grant lockdown intact, 1 admin, 0
  users missing a profile row. Supabase's migration ledger also records 0001–12.
- Findings are **hardening + perf only, not drift.** The one worth acting on:
  `award_pending_badges` (documented "internal only" in 0009) is actually
  callable by `anon` + `authenticated` — a writing SECURITY DEFINER function on
  the public REST surface. Low blast radius, but wrong. Fix drafted.
- Drafted **`migrations/0013_security_hardening.sql`** (NOT applied — owner runs
  it) and a refreshed **`audits/0002_state_audit.sql`** (0001 was a migration
  behind: no `dm_rate_counter`, no 0012 funcs in the main section, no index or
  grant checks).
- Two owner-only follow-ups that the audit can't do itself: enable Auth
  leaked-password protection (dashboard toggle), and decide whether the
  `auth.uid()` RLS perf rewrite is worth it yet (probably not at 2 users).

## How it was verified

Read all 12 migrations + both audit scripts to build the expected-state model,
then queried the live catalogs via the Supabase MCP: `pg_class`/`pg_policy`
(tables, RLS, policies), `information_schema.columns` + `column_privileges`
(profiles), `pg_proc` (functions, signatures, `prosecdef`, `proacl`,
`proconfig`), `pg_indexes`, `pg_publication_tables`, the seed tables, and
`get_advisors` (security + performance). Migration ledger checked via
`list_migrations`.

## Per-section findings (A–H)

### A. Extensions — OK
`pgcrypto` 1.3 enabled.

### B. Tables — OK (20/20)
All expected tables present, **including `dm_rate_counter` from 0012** (which
the 0001 audit script doesn't list). No unexpected/extra public tables. The
`emoticron_submissions` table is in its **0010 shape** (drop+recreate happened —
confirmed via index check in H), not the original 0001 shape.

### C. RLS — OK (20/20 enabled)
Every public table has `relrowsecurity = true`.

### D. Policies — OK
Counts match design. Two tables have **0 policies on purpose** —
`dm_rate_counter` ("No client policies — only SECURITY DEFINER RPCs", 0012) and
`mission_witnesses` ("Reserved: no policies, no client access", 0007). RLS-on +
no-policy = deny-all to clients, which is the intent. The advisor flags these
`rls_enabled_no_policy` (INFO) — expected, not a gap. All other policy quals
verified: world-readable only on `app_config` / `dialogue` /
`emoticron_dictionary` (`USING (true)`), everything else gated by
`auth.uid()` or `is_admin(auth.uid())`. `profiles_update_own` keeps its
`display_name_status IN ('unset','pending')` WITH CHECK.

### E. Profiles columns — OK (15/15)
`id, display_name, display_name_status, display_name_note, created_at,
updated_at` (0001), `role` (0003), `tier` (0006), `equipped_badge,
equipped_theme, samaritan_corporate, samaritan_bitrunner, hack_qte_streak,
dm_verified, dm_blocked` (0007). All types + NOT NULL/defaults as written.
`dm_blocked` is `uuid[]` default `'{}'`.

### F. Column-grant lockdown — OK
`authenticated` has UPDATE on **exactly** `display_name, display_name_note,
display_name_status, dm_blocked` and nothing else. No `anon`, no `PUBLIC`. The
self-escalation hole that 0006 fixed and 0007 tightened is intact — `role`,
`tier`, `samaritan_*`, `equipped_*`, `dm_verified` are not client-writable.

### G. Functions / RPCs — OK (39/39, signatures match)
Every `CREATE FUNCTION` from 0001–0012 exists with the expected argument
signature, `SECURITY DEFINER` where specified, and `search_path` pinned (except
`touch_updated_at` — see Gaps). Includes the full 0012 set
(`dm_send_message, dm_block_user, dm_unblock_user, dm_list_blocked,
admin_list_dm_reports, dm_rate_counter_gc`).

### H. Indexes / seed / realtime / permissions
- **Indexes — OK (8/8).** All named indexes present. The two 0001 indexes
  `emoticron_submissions_user_idx` / `_status_idx` are **correctly absent**
  (0010 dropped the table); `emoticron_submissions_user_id_key` (0010's UNIQUE)
  is present. This is the cleanest proof 0010 actually ran.
- **Seed — OK.** `emoticron_dictionary` = **100** (emote 32 / object 32 /
  action 16 / name 20, exactly the 0007 seed). `app_config.under_construction =
  false`. `dialogue` = 13 owner-authored rows (`admin.opening/happy/help/okay/
  tired` = The Admin first-encounter per devlog 0027; `mission.aether01.opening`;
  7× `samm.*` gambling NPC per devlog 0041). Dialogue being non-empty is
  expected — 0004 stores only owner-edited overrides.
- **Realtime — OK.** `earned_badges` is in `supabase_realtime` (0009).
- **Permissions — mostly OK, one real issue + posture note.** See Gaps. The
  `service_role` retains EXECUTE everywhere; admin RPCs gate on
  `is_admin(auth.uid())` server-side.
- **Coverage.** 2 auth users / 2 profiles / **0 missing** / **1 admin**.
  Migration ledger records 0001–0012.

## Gaps to close

None are schema drift. Severity is low — this is a tidy DB.

| # | Finding | Severity | Fix | Where |
|---|---------|----------|-----|-------|
| 1 | `award_pending_badges` is EXECUTE-able by `anon` + `authenticated` despite 0009 documenting it internal-only. SECURITY DEFINER, takes arbitrary `p_uid`, writes `earned_badges`. Can only materialise badge tiers a target's (admin-only) samaritan score already justifies — can't inflate a score — but it's an unauthenticated writing function on the REST surface. | Low–Med | `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated`. Internal callers run as owner `postgres`, unaffected. | 0013 CORE 1 |
| 2 | `touch_updated_at` has a mutable `search_path` (advisor `function_search_path_mutable`). SECURITY INVOKER trigger, no schema refs — risk is nil, but it's the one unpinned function. | Info | `ALTER FUNCTION … SET search_path = public`. | 0013 CORE 2 |
| 3 | 13 admin/maintenance RPCs carry a default `anon` EXECUTE grant. They all reject non-admins internally, so not a live hole, but anon never needs them. | Info | `REVOKE EXECUTE … FROM anon` (keep `authenticated`). Clears 13 advisor warnings. | 0013 RECOMMENDED |
| 4 | Auth leaked-password protection (HaveIBeenPwned) disabled. | Low | Owner toggles in **Auth → Settings** (not SQL; audit can't touch `auth.*`). | dashboard |
| 5 | `auth_rls_initplan` (WARN, ~28 policies): `auth.uid()` re-evaluated per row instead of `(select auth.uid())`. **Live DB matches the migration source** — the migrations themselves use the unoptimised form — so this is a source-wide rewrite, not drift. | Perf, deferred | Wrap as `(select auth.uid())` across policies when traffic justifies. | noted, not in 0013 |
| 6 | 6 unindexed FKs (INFO); `emoticron_submissions` has 2 permissive SELECT policies (WARN); 6 "unused index" (INFO, just no traffic). | Info | Optional FK indexes commented in 0013; policy merge noted. Unused-index is benign at this scale. | 0013 OPTIONAL |

### On the 74 `*_security_definer_function_executable` advisor warnings
The advisor flags all 37 SECURITY DEFINER functions as anon-executable **and**
all 37 as authenticated-executable (74 total). This is the standard Supabase RPC
model: the `authenticated` half is **by design** — these *are* the client RPCs,
and each re-checks `auth.uid()` / `is_admin()` before doing anything. Revoking
`authenticated` would break the app. So we only act on the subset that genuinely
shouldn't be anon/authenticated-reachable (#1 and #3 above); the rest is
expected noise inherent to PostgREST RPCs.

## What the audit could NOT verify (and why)

- **`auth.*` schema** — off-limits per CLAUDE.md / the audit rules. Leaked-
  password protection (#4) was detected via the advisor but not changed.
- **`player_economy.blob` integrity** — it's client-trusted by design (0002
  comment; server-authoritative economy waits on the trading epic). Nothing
  DB-side to verify.
- **DM profanity verdict correctness** — computed in the Node server, not
  Postgres (0012 design). The DB only audit-logs the verdict; the audit can't
  judge the classifier.
- **Client wiring** — whether `apps/web` actually calls each RPC is an app
  concern, out of scope for an infra audit.
- **Perf claims under load** — `auth_rls_initplan` is the advisor's static
  analysis; not load-tested (and not worth it at 2 users).

## Deliverables in this PR

1. `supabase/audits/0002_state_audit.sql` — refreshed audit script (covers
   0001–0012, adds index + function-grant + search_path sections). 0001 kept as
   the historical snapshot.
2. `supabase/migrations/0013_security_hardening.sql` — **drafted, not applied.**
   Owner runs it in the SQL editor. Idempotent. After applying, re-run
   `0002_state_audit.sql` §G2 — `award_pending_badges` anon/auth EXECUTE should
   flip to FALSE/FALSE.

## Owner actions

- [ ] Apply `migrations/0013_security_hardening.sql` (SQL editor). Optional but
      recommended — it's the only thing standing between "clean" and "clean +
      hardened".
- [ ] Enable leaked-password protection in **Auth → Settings**.
- [ ] (Optional) Decide on the `auth.uid()` RLS rewrite + FK indexes later;
      neither matters at current scale.

No new dependencies. No client-facing change. No DB writes performed by the
audit.
