-- BitRunners — Supabase state audit (read-only)
--
-- Paste the whole file into the Supabase SQL editor (Run as: your account)
-- and Run. Every block prints a labelled result. Anything that comes back
-- empty or with "MISSING" is a gap to close.
--
-- Safe: SELECT-only. No DML, no DDL.
--
-- Expected migrations applied: 0001 → 0011 (see supabase/migrations/).
-- Devlog: 0085-supabase-audit.md

\echo ════════════════════════════════════════════════════════════════════
\echo  SECTION A — extensions
\echo ════════════════════════════════════════════════════════════════════

SELECT extname, extversion
  FROM pg_extension
 WHERE extname IN ('pgcrypto')
 ORDER BY extname;

\echo ════════════════════════════════════════════════════════════════════
\echo  SECTION B — tables (every public table the migrations create)
\echo ════════════════════════════════════════════════════════════════════

WITH expected(name) AS (VALUES
  ('profiles'), ('inventory'), ('equipped_outfit'), ('achievements'),
  ('samaritan_status'), ('emoticron_submissions'), ('unlocked_emoticrons'),
  ('player_economy'), ('app_config'), ('dialogue'), ('session_events'),
  ('economy_grants'), ('earned_badges'), ('owned_themes'),
  ('emoticron_dictionary'), ('mission_progress'), ('dm_messages'),
  ('hack_qte_attempts'), ('mission_witnesses')
)
SELECT e.name AS expected,
       CASE WHEN t.tablename IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS state
  FROM expected e
  LEFT JOIN pg_tables t
    ON t.schemaname = 'public' AND t.tablename = e.name
 ORDER BY state DESC, e.name;

\echo ════════════════════════════════════════════════════════════════════
\echo  SECTION C — row-level security (every public table must have it on)
\echo ════════════════════════════════════════════════════════════════════

SELECT n.nspname AS schema,
       c.relname AS table,
       CASE WHEN c.relrowsecurity THEN 'OK' ELSE 'OFF — GAP' END AS rls
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind = 'r'
 ORDER BY rls DESC, c.relname;

\echo ════════════════════════════════════════════════════════════════════
\echo  SECTION D — RLS policies (count per table; 0 on a table with RLS on
\echo                            means nothing is reachable except service
\echo                            role / SECURITY DEFINER RPC)
\echo ════════════════════════════════════════════════════════════════════

SELECT n.nspname AS schema,
       c.relname AS table,
       COUNT(p.polname) AS policy_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_policy p ON p.polrelid = c.oid
 WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
 GROUP BY n.nspname, c.relname
 ORDER BY policy_count, c.relname;

\echo ════════════════════════════════════════════════════════════════════
\echo  SECTION E — profile columns (every column the migrations add)
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
\echo  Expected: ONLY display_name, display_name_status, display_name_note,
\echo            dm_blocked — granted to "authenticated". Anything else means
\echo            client can self-mutate it.
\echo ════════════════════════════════════════════════════════════════════

SELECT grantee, column_name, privilege_type
  FROM information_schema.column_privileges
 WHERE table_schema = 'public'
   AND table_name = 'profiles'
   AND privilege_type = 'UPDATE'
   AND grantee IN ('anon', 'authenticated', 'PUBLIC')
 ORDER BY grantee, column_name;

\echo ════════════════════════════════════════════════════════════════════
\echo  SECTION G — functions (every RPC + helper the migrations declare)
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
  ('complete_mission'), ('get_mission_progress')
)
SELECT e.name AS expected,
       CASE WHEN p.proname IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS state
  FROM expected e
  LEFT JOIN pg_proc p
    ON p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
   AND p.proname = e.name
 ORDER BY state DESC, e.name;

\echo ════════════════════════════════════════════════════════════════════
\echo  SECTION H — emoticron_dictionary seed (should be ~100 words)
\echo ════════════════════════════════════════════════════════════════════

SELECT category, COUNT(*) AS words
  FROM public.emoticron_dictionary
 GROUP BY category
 ORDER BY category;

SELECT 'total' AS scope, COUNT(*) AS words FROM public.emoticron_dictionary;

\echo ════════════════════════════════════════════════════════════════════
\echo  SECTION I — app_config (under_construction must exist and be false
\echo                          unless the owner intentionally flipped it)
\echo ════════════════════════════════════════════════════════════════════

SELECT key, value, updated_at FROM public.app_config ORDER BY key;

\echo ════════════════════════════════════════════════════════════════════
\echo  SECTION J — realtime publication (earned_badges must be included)
\echo ════════════════════════════════════════════════════════════════════

SELECT pubname, schemaname, tablename
  FROM pg_publication_tables
 WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
 ORDER BY tablename;

\echo ════════════════════════════════════════════════════════════════════
\echo  SECTION K — auth user counts + profile coverage
\echo ════════════════════════════════════════════════════════════════════

SELECT
  (SELECT COUNT(*) FROM auth.users) AS auth_users,
  (SELECT COUNT(*) FROM public.profiles) AS profiles,
  (SELECT COUNT(*) FROM auth.users)
    - (SELECT COUNT(*) FROM public.profiles) AS missing_profile_rows;

\echo ════════════════════════════════════════════════════════════════════
\echo  SECTION L — admin bootstrap (does ANY user have role = admin?)
\echo  Expected: at least one row (you). Zero rows means no one can use the
\echo            admin console at all and admin RPCs will reject.
\echo ════════════════════════════════════════════════════════════════════

SELECT COUNT(*) AS admin_count FROM public.profiles WHERE role = 'admin';

-- Owner self-check: replace the email and uncomment to confirm your own role.
-- SELECT id, role, tier, display_name, display_name_status
--   FROM public.profiles
--  WHERE id = (SELECT id FROM auth.users
--               WHERE email = 'williamsfischer2002@gmail.com');

\echo ════════════════════════════════════════════════════════════════════
\echo  SECTION M — dm_messages send path coverage
\echo  Migration 0007 reserves the dm_messages table but no INSERT RPC
\echo  exists yet. PR #88 deferred server-side moderation. This block
\echo  reports whether the DM RPCs from migration 0012 have landed.
\echo ════════════════════════════════════════════════════════════════════

WITH expected(name) AS (VALUES
  ('dm_send_message'), ('dm_block_user'), ('dm_unblock_user'),
  ('dm_list_blocked'), ('admin_list_dm_reports')
)
SELECT e.name AS expected,
       CASE WHEN p.proname IS NOT NULL THEN 'OK (0012 applied)' ELSE 'MISSING (0012 not yet run)' END AS state
  FROM expected e
  LEFT JOIN pg_proc p
    ON p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
   AND p.proname = e.name
 ORDER BY state DESC, e.name;

\echo ════════════════════════════════════════════════════════════════════
\echo  Done. Anything reading "MISSING" or "GAP" is a gap.
\echo ════════════════════════════════════════════════════════════════════
