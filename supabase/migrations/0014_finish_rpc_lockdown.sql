-- 0014 — finish the RPC lockdown that 0013 intended (audit follow-up, devlog 0089)
--
-- ⚠️  NOT AUTO-APPLIED. Owner runs this in the Supabase SQL editor (CLAUDE.md
--     rule). Idempotent — safe to run more than once.
--
-- WHY THIS EXISTS
-- 0013's RECOMMENDED block tried to drop the anon REST surface for the admin /
-- maintenance RPCs with `REVOKE EXECUTE ... FROM anon`. A live-state check
-- (2026-06-16) showed 10 of them were STILL anon-executable. Root cause: those
-- functions also carry an EXECUTE grant to the PUBLIC pseudo-role (the `=X/...`
-- entry in pg_proc.proacl, applied by Supabase's default privileges on CREATE).
-- `anon` inherits EXECUTE through PUBLIC, so revoking only the *direct* anon
-- grant changed nothing. (The 3 emoticron admin RPCs DID flip, but only because
-- migration 0010 had already revoked PUBLIC on them.)
--
-- THE FIX
-- Revoke EXECUTE from PUBLIC (and from anon, redundantly + explicitly). Each of
-- these functions re-checks is_admin(auth.uid()) server-side, and the admin
-- console calls them as the `authenticated` role, which keeps its own direct
-- grant — so the console is unaffected and non-admins still can't use them.
-- `postgres` / `service_role` keep EXECUTE, so the owner's SQL-editor + cron
-- paths are unaffected.
--
-- 0013's CORE fixes (award_pending_badges fully revoked, touch_updated_at
-- search_path pinned) are already live and are NOT repeated here.

-- ── admin RPCs: drop anon/PUBLIC, keep authenticated (is_admin-gated) ────────
REVOKE EXECUTE ON FUNCTION public.admin_list_users()                              FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_grant_economy(UUID, BIGINT, BIGINT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_tier(UUID, TEXT)                      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_role(UUID, TEXT)                      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_pending_names()                      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_approve_name(UUID)                        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_reject_name(UUID, TEXT)                   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_grant_samaritan(UUID, TEXT, INT)          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_pending_emoticrons()                 FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_approve_emoticron(UUID)                   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_reject_emoticron(UUID, TEXT)              FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_dm_reports(INT)                      FROM PUBLIC, anon;

-- ── maintenance RPC: no client should call it at all (owner/cron only) ───────
-- dm_rate_counter_gc() has no internal auth gate, so also drop `authenticated`.
REVOKE EXECUTE ON FUNCTION public.dm_rate_counter_gc() FROM PUBLIC, anon, authenticated;

-- ── OPTIONAL: the signup trigger fn is also exposed as an anon RPC ───────────
-- handle_new_user() is a SECURITY DEFINER trigger function; calling it over
-- /rest/v1/rpc errors out (NEW is unassigned), so it is not exploitable, just
-- noise the linter flags. Revoking EXECUTE does NOT stop the trigger — Postgres
-- fires triggers regardless of the caller's EXECUTE privilege. Uncomment to
-- silence the lint, then confirm a fresh signup still creates a profile row.
-- REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ── verify (read-only) ──────────────────────────────────────────────────────
-- After running, paste audits/0002_state_audit.sql and confirm section
-- "G2 secdef anon-exec (informational)" dropped, and none of the admin_* RPCs
-- report anon EXECUTE. Quick spot check:
--   SELECT proname, has_function_privilege('anon', oid, 'EXECUTE') AS anon_exec
--     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND proname LIKE 'admin\_%'
--    ORDER BY proname;   -- every row should read anon_exec = false
