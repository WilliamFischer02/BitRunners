-- BitRunners — Supabase state audit v2 (read-only)
--
-- Supersedes audits/0001_state_audit.sql (kept as the historical snapshot).
-- This version covers migrations 0001 → 0012 (0001 only went to 0011) and adds
-- three sections the first script lacked: index presence, function EXECUTE
-- grants, and the 0012 dm_rate_counter table / dm_rate_counter_gc helper.
--
-- Paste the whole file into the Supabase SQL editor (Run as: your account) and
-- Run. Every block prints a labelled result. Anything that comes back "MISSING"
-- or "GAP" is a hole. Safe: SELECT-only. No DML, no DDL.
--
-- Expected migrations applied: 0001 → 0012 (see supabase/migrations/).
-- Devlog: docs/devlog/0089-supabase-audit-2026-06-16.md

\echo ════════════════════════════════════════════════════════════════════
\echo  SECTION A — extensions (pgcrypto)
\echo ════════════════════════════════════════════════════════════════════

SELECT extname, extversion
  FROM pg_extension
 WHERE extname IN ('pgcrypto')
 ORDER BY extname;

\echo ════════════════════════════════════════════════════════════════════
\echo  SECTION B — tables (20 expected, incl. dm_rate_counter from 0012)
\echo ════════════════════════════════════════════════════════════════════

WITH expected(name) AS (VALUES
  ('profiles'), ('inventory'), ('equipped_outfit'), ('achievements'),
  ('samaritan_status'), ('emoticron_submissions'), ('unlocked_emoticrons'),
  ('player_economy'), ('app_config'), ('dialogue'), ('session_events'),
  ('economy_grants'), ('earned_badges'), ('owned_themes'),
  ('emoticron_dictionary'), ('mission_progress'), ('dm_messages'),
  ('hack_qte_attempts'), ('mission_witnesses'), ('dm_rate_counter')
)
SELECT e.name AS expected,
       CASE WHEN t.tablename IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS state
  FROM expected e
  LEFT JOIN pg_tables t
    ON t.schemaname = 'public' AND t.tablename = e.name
 ORDER BY state DESC, e.name;

\echo ── any UNEXPECTED public tables (not created by 0001–0012)? ──────────
WITH expected(name) AS (VALUES
  ('profiles'), ('inventory'), ('equipped_outfit'), ('achievements'),
  ('samaritan_status'), ('emoticron_submissions'), ('unlocked_emoticrons'),
  ('player_economy'), ('app_config'), ('dialogue'), ('session_events'),
  ('economy_grants'), ('earned_badges'), ('owned_themes'),
  ('emoticron_dictionary'), ('mission_progress'), ('dm_messages'),
  ('hack_qte_attempts'), ('mission_witnesses'), ('dm_rate_counter')
)
SELECT t.tablename AS unexpected_table
  FROM pg_tables t
  LEFT JOIN expected e ON e.name = t.tablename
 WHERE t.schemaname = 'public' AND e.name IS NULL
 ORDER BY t.tablename;

\echo ════════════════════════════════════════════════════════════════════
\echo  SECTION C — row-level security (every public table must have it on)
\echo ════════════════════════════════════════════════════════════════════

SELECT n.nspname AS schema,
       c.relname AS "table",
       CASE WHEN c.relrowsecurity THEN 'OK' ELSE 'OFF — GAP' END AS rls
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind = 'r'
 ORDER BY rls DESC, c.relname;

\echo ════════════════════════════════════════════════════════════════════
\echo  SECTION D — RLS policy count per table
\echo    0 policies + RLS on = deny-all to clients (service-role / SECURITY
\echo    DEFINER only). Expected for: dm_rate_counter, mission_witnesses.
\echo ════════════════════════════════════════════════════════════════════

SELECT c.relname AS "table",
       COUNT(p.polname) AS policy_count,
       CASE
         WHEN COUNT(p.polname) > 0 THEN 'OK'
         WHEN c.relname IN ('dm_rate_counter','mission_witnesses') THEN 'OK (intentional deny-all)'
         ELSE 'GAP — RLS on but no policy'
       END AS state
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_policy p ON p.polrelid = c.oid
 WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
 GROUP BY c.relname
 ORDER BY policy_count, c.relname;

\echo ════════════════════════════════════════════════════════════════════
\echo  SECTION E — profiles columns (15 expected: 0001 + 0003 + 0006 + 0007)
\echo ════════════════════════════════════════════════════════════════════

WITH expected(col) AS (VALUES
  ('id'), ('display_name'), ('display_name_status'), ('display_name_note'),
  ('role'), ('tier'),
  ('equipped_badge'), ('equipped_theme'),
  ('samaritan_corporate'), ('samaritan_bitrunner'),
  ('hack_qte_streak'), ('dm_verified'), ('dm_blocked'),
  ('created_at'), ('updated_at')
)
SELECT e.col AS expected,
       CASE WHEN col.column_name IS NOT NULL THEN col.data_type ELSE 'MISSING' END AS state
  FROM expected e
  LEFT JOIN information_schema.columns col
    ON col.table_schema = 'public'
   AND col.table_name = 'profiles'
   AND col.column_name = e.col
 ORDER BY (col.column_name IS NULL) DESC, e.col;

\echo ════════════════════════════════════════════════════════════════════
\echo  SECTION F — column-level UPDATE grants on profiles (lockdown check)
\echo    Expected: ONLY display_name, display_name_status, display_name_note,
\echo    dm_blocked granted to "authenticated". ANY other column = client can
\echo    self-mutate it (privilege escalation). anon / PUBLIC = GAP.
\echo ════════════════════════════════════════════════════════════════════

SELECT grantee, column_name, privilege_type
  FROM information_schema.column_privileges
 WHERE table_schema = 'public'
   AND table_name = 'profiles'
   AND privilege_type = 'UPDATE'
   AND grantee IN ('anon', 'authenticated', 'PUBLIC')
 ORDER BY grantee, column_name;

\echo ════════════════════════════════════════════════════════════════════
\echo  SECTION G — functions (39 expected across 0001–0012)
\echo ════════════════════════════════════════════════════════════════════

WITH expected(name) AS (VALUES
  -- 0001
  ('handle_new_user'), ('touch_updated_at'),
  -- 0003
  ('is_admin'), ('is_dev_or_admin'),
  -- 0005
  ('get_daily_signins'),
  -- 0006
  ('admin_list_users'), ('admin_grant_economy'),
  ('admin_set_tier'), ('admin_set_role'), ('claim_economy_grants'),
  -- 0007
  ('submit_display_name'), ('admin_list_pending_names'),
  ('admin_approve_name'), ('admin_reject_name'),
  ('equip_badge'), ('acknowledge_badge'),
  ('get_my_identity'), ('get_my_badges'),
  -- 0008
  ('purchase_theme'), ('equip_theme'), ('get_my_themes'),
  -- 0009
  ('award_pending_badges'), ('admin_grant_samaritan'),
  -- 0010
  ('submit_emoticron'), ('get_my_emoticron_submission'),
  ('admin_list_pending_emoticrons'),
  ('admin_approve_emoticron'), ('admin_reject_emoticron'),
  -- 0011
  ('_validate_mission_key'), ('start_mission'), ('advance_checkpoint'),
  ('complete_mission'), ('get_mission_progress'),
  -- 0012
  ('dm_send_message'), ('dm_block_user'), ('dm_unblock_user'),
  ('dm_list_blocked'), ('admin_list_dm_reports'), ('dm_rate_counter_gc')
)
SELECT e.name AS expected,
       CASE WHEN p.proname IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS state
  FROM expected e
  LEFT JOIN pg_proc p
    ON p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
   AND p.proname = e.name
 ORDER BY state DESC, e.name;

\echo ════════════════════════════════════════════════════════════════════
\echo  SECTION G2 — function EXECUTE grants (security surface)
\echo    Every SECURITY DEFINER RPC is reachable over /rest/v1/rpc by whatever
\echo    role has EXECUTE. The `authenticated` grant is by design (these ARE the
\echo    client RPCs, each re-checks auth.uid()/is_admin internally). Watch for:
\echo      * award_pending_badges — documented INTERNAL-ONLY (0009); should be
\echo        EXECUTE-able by neither anon nor authenticated.
\echo      * admin_* — never need the anon role.
\echo ════════════════════════════════════════════════════════════════════

SELECT p.proname,
       p.prosecdef AS sec_definer,
       has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_exec,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
 ORDER BY anon_exec DESC, p.proname;

\echo ── focused: award_pending_badges must be FALSE/FALSE after 0013 ──────
SELECT has_function_privilege('anon',          'public.award_pending_badges(uuid)', 'EXECUTE') AS anon_exec_should_be_false,
       has_function_privilege('authenticated', 'public.award_pending_badges(uuid)', 'EXECUTE') AS auth_exec_should_be_false;

\echo ════════════════════════════════════════════════════════════════════
\echo  SECTION G3 — SECURITY DEFINER search_path pinned?
\echo    Mutable search_path on a SECURITY DEFINER fn is a hardening gap.
\echo    touch_updated_at (trigger, SECURITY INVOKER) is benign but flagged
\echo    by the linter; 0013 pins it.
\echo ════════════════════════════════════════════════════════════════════

SELECT p.proname,
       p.prosecdef AS sec_definer,
       CASE WHEN p.proconfig IS NULL THEN 'NONE (mutable)'
            ELSE array_to_string(p.proconfig, ', ') END AS proconfig
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND (p.proconfig IS NULL OR NOT (p.proconfig::text LIKE '%search_path%'))
 ORDER BY p.prosecdef DESC, p.proname;

\echo ════════════════════════════════════════════════════════════════════
\echo  SECTION H — indexes (named non-PK/UNIQUE indexes the migrations create)
\echo    NOTE: emoticron_submissions_user_idx / _status_idx (0001) are EXPECTED
\echo    TO BE ABSENT — 0010 dropped + recreated that table without them.
\echo ════════════════════════════════════════════════════════════════════

WITH expected(idx) AS (VALUES
  ('inventory_user_idx'), ('achievements_user_idx'),
  ('unlocked_emoticrons_user_idx'), ('economy_grants_user_unclaimed_idx'),
  ('earned_badges_user_unack_idx'), ('dm_messages_room_idx'),
  ('dm_messages_moderation_idx'), ('hack_qte_attempts_user_idx')
)
SELECT e.idx AS expected,
       CASE WHEN i.indexname IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS state
  FROM expected e
  LEFT JOIN pg_indexes i
    ON i.schemaname = 'public' AND i.indexname = e.idx
 ORDER BY state DESC, e.idx;

\echo ── these should be GONE (dropped by 0010) ───────────────────────────
SELECT i.indexname AS should_not_exist
  FROM pg_indexes i
 WHERE i.schemaname = 'public'
   AND i.indexname IN ('emoticron_submissions_user_idx','emoticron_submissions_status_idx');

\echo ════════════════════════════════════════════════════════════════════
\echo  SECTION I — emoticron_dictionary seed (expect 100: 32/32/16/20)
\echo ════════════════════════════════════════════════════════════════════

SELECT category, COUNT(*) AS words
  FROM public.emoticron_dictionary
 GROUP BY category
 ORDER BY category;

SELECT 'total' AS scope, COUNT(*) AS words FROM public.emoticron_dictionary;

\echo ════════════════════════════════════════════════════════════════════
\echo  SECTION J — app_config (under_construction must exist)
\echo ════════════════════════════════════════════════════════════════════

SELECT key, value, updated_at FROM public.app_config ORDER BY key;

\echo ════════════════════════════════════════════════════════════════════
\echo  SECTION K — realtime publication (earned_badges must be included)
\echo ════════════════════════════════════════════════════════════════════

SELECT pubname, schemaname, tablename
  FROM pg_publication_tables
 WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
 ORDER BY tablename;

\echo ════════════════════════════════════════════════════════════════════
\echo  SECTION L — auth user / profile coverage + admin bootstrap
\echo    missing_profile_rows must be 0 (handle_new_user trigger).
\echo    admin_count must be >= 1 (else the admin console is unusable).
\echo ════════════════════════════════════════════════════════════════════

SELECT
  (SELECT COUNT(*) FROM auth.users)                          AS auth_users,
  (SELECT COUNT(*) FROM public.profiles)                     AS profiles,
  (SELECT COUNT(*) FROM auth.users)
    - (SELECT COUNT(*) FROM public.profiles)                 AS missing_profile_rows,
  (SELECT COUNT(*) FROM public.profiles WHERE role = 'admin') AS admin_count;

\echo ════════════════════════════════════════════════════════════════════
\echo  Done. Anything reading "MISSING" / "GAP" is a gap. award_pending_badges
\echo  anon/auth EXECUTE = TRUE means migration 0013 has not been applied yet.
\echo ════════════════════════════════════════════════════════════════════
