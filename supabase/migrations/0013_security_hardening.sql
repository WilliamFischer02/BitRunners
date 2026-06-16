-- 0013 — security hardening (audit 2026-06-16, devlog 0089)
--
-- ⚠️  NOT YET APPLIED. The owner runs migrations manually in the Supabase SQL
--     editor (CLAUDE.md rule). This file was drafted by the audit session; no
--     DDL was executed against the live DB. Apply order: after 0012.
--     Idempotent — safe to re-run.
--
-- Context: the 2026-06-16 audit found ZERO schema drift between migrations
-- 0001–0012 and the live DB. These are hardening fixes for issues the Supabase
-- security advisor surfaced, NOT drift repairs. Nothing here changes table
-- shape or app behaviour; it only tightens the RPC EXECUTE surface and pins a
-- search_path. The client (apps/web) calls every RPC as the `authenticated`
-- role, which is preserved throughout.

-- ── CORE 1: re-seal award_pending_badges as an internal-only helper ─────────
-- 0009 declared this "internal only … NOT granted to authenticated", but
-- PostgreSQL/Supabase grant EXECUTE to PUBLIC + anon + authenticated by default
-- on CREATE, and 0009 never REVOKEd. Result: an anonymous caller can invoke a
-- SECURITY DEFINER function that takes an arbitrary p_uid and writes
-- earned_badges rows. Blast radius is small (it only materialises badge tiers
-- the target's admin-only samaritan score already justifies — it cannot raise a
-- score), but it is an unauthenticated, writing, SECURITY DEFINER function and
-- contradicts the documented contract. Its only legitimate callers
-- (admin_grant_samaritan) run as the function owner `postgres`, which keeps
-- EXECUTE, so revoking PUBLIC/anon/authenticated does not break them.
REVOKE EXECUTE ON FUNCTION public.award_pending_badges(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.award_pending_badges(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.award_pending_badges(UUID) FROM authenticated;

-- ── CORE 2: pin search_path on touch_updated_at ─────────────────────────────
-- Advisor: function_search_path_mutable. It is a SECURITY INVOKER trigger that
-- only does `NEW.updated_at = NOW()` (no schema-qualified refs), so the risk is
-- nil, but pinning clears the lint and matches every other function in the DB.
ALTER FUNCTION public.touch_updated_at() SET search_path = public;

-- ── RECOMMENDED: drop the anon EXECUTE grant on admin-only + maintenance RPCs
-- These all re-check is_admin(auth.uid()) internally, so an anon caller already
-- gets "admin only" / zero rows — this is defence-in-depth, not a live hole. It
-- removes 13 functions from the anonymous /rest/v1/rpc surface and clears the
-- matching `anon_security_definer_function_executable` advisor warnings. The
-- `authenticated` grant stays: the owner drives the admin console while logged
-- in, and is_admin() is the real gate.
REVOKE EXECUTE ON FUNCTION public.admin_list_users()                                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_grant_economy(UUID, BIGINT, BIGINT, TEXT)      FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_tier(UUID, TEXT)                           FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_role(UUID, TEXT)                           FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_pending_names()                           FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_approve_name(UUID)                             FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_reject_name(UUID, TEXT)                        FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_grant_samaritan(UUID, TEXT, INT)               FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_pending_emoticrons()                      FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_approve_emoticron(UUID)                        FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_reject_emoticron(UUID, TEXT)                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_dm_reports(INT)                           FROM anon;
REVOKE EXECUTE ON FUNCTION public.dm_rate_counter_gc()                                 FROM anon;

-- ── OPTIONAL (commented): covering indexes for the 6 unindexed FKs ───────────
-- Advisor: unindexed_foreign_keys (INFO). At pre-alpha scale (2 users) these
-- buy nothing and cost write throughput + storage. Uncomment only if/when the
-- referenced auth.users rows start getting deleted often or these tables grow.
--
-- CREATE INDEX IF NOT EXISTS dm_messages_from_user_idx     ON public.dm_messages (from_user);
-- CREATE INDEX IF NOT EXISTS dm_messages_to_user_idx       ON public.dm_messages (to_user);
-- CREATE INDEX IF NOT EXISTS dm_rate_counter_to_user_idx   ON public.dm_rate_counter (to_user);
-- CREATE INDEX IF NOT EXISTS economy_grants_granted_by_idx ON public.economy_grants (granted_by);
-- CREATE INDEX IF NOT EXISTS mission_witnesses_witness_idx ON public.mission_witnesses (witness_user_id);
-- CREATE INDEX IF NOT EXISTS session_events_user_idx       ON public.session_events (user_id);

-- ── NOT IN THIS FILE (tracked in devlog 0089) ───────────────────────────────
--  * auth_rls_initplan (WARN, ~28 policies): wrap auth.uid() as
--    (select auth.uid()) in RLS quals. The live DB matches the migration
--    source — both use the unoptimised form — so this is a source-wide policy
--    rewrite, deferred until traffic justifies it.
--  * auth_leaked_password_protection (WARN): toggle in Auth settings, not SQL.
--    The audit cannot touch auth.* — owner enables it in the dashboard.
--  * multiple_permissive_policies on emoticron_submissions (WARN): two SELECT
--    policies (user_read + admin_read) for the same roles. Functionally correct;
--    merge into one `USING (auth.uid() = user_id OR is_admin(auth.uid()))` only
--    if the per-row policy overhead ever matters.
