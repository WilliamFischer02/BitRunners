-- BitRunners — Supabase state audit (read-only, single result set)
--
-- Historical snapshot: covers migrations 0001 -> 0011, plus a section M that
-- reports whether the 0012 DM-moderation RPCs have landed. For the full
-- 0001 -> 0012 audit (adds dm_rate_counter, index + function-grant + search_path
-- checks) use audits/0002_state_audit.sql instead.
--
-- HOW TO RUN: paste this whole file into the Supabase SQL editor and Run. It is
-- ONE statement that returns ONE result grid. No psql meta-commands (\echo), no
-- bare text — Supabase-editor safe. Scan the `status` column: MISSING / GAP /
-- OFF means a hole; everything else is OK.
--
-- Read-only: SELECT against system catalogs + seed tables only. No DML/DDL.
-- Devlog: docs/devlog/0085-supabase-audit.md (original), 0089 (live-verified).

WITH
expected_tables(name) AS (VALUES
  ('profiles'),('inventory'),('equipped_outfit'),('achievements'),
  ('samaritan_status'),('emoticron_submissions'),('unlocked_emoticrons'),
  ('player_economy'),('app_config'),('dialogue'),('session_events'),
  ('economy_grants'),('earned_badges'),('owned_themes'),
  ('emoticron_dictionary'),('mission_progress'),('dm_messages'),
  ('hack_qte_attempts'),('mission_witnesses')
),
expected_profile_cols(col) AS (VALUES
  ('id'),('display_name'),('display_name_status'),('display_name_note'),
  ('role'),('tier'),('equipped_badge'),('equipped_theme'),
  ('samaritan_corporate'),('samaritan_bitrunner'),('hack_qte_streak'),
  ('dm_verified'),('dm_blocked'),('created_at'),('updated_at')
),
expected_functions(name) AS (VALUES
  ('handle_new_user'),('touch_updated_at'),('is_admin'),('is_dev_or_admin'),
  ('get_daily_signins'),('admin_list_users'),('admin_grant_economy'),
  ('admin_set_tier'),('admin_set_role'),('claim_economy_grants'),
  ('submit_display_name'),('admin_list_pending_names'),('admin_approve_name'),
  ('admin_reject_name'),('equip_badge'),('acknowledge_badge'),
  ('get_my_identity'),('get_my_badges'),('purchase_theme'),('equip_theme'),
  ('get_my_themes'),('award_pending_badges'),('admin_grant_samaritan'),
  ('submit_emoticron'),('get_my_emoticron_submission'),
  ('admin_list_pending_emoticrons'),('admin_approve_emoticron'),
  ('admin_reject_emoticron'),('_validate_mission_key'),('start_mission'),
  ('advance_checkpoint'),('complete_mission'),('get_mission_progress')
),
expected_dm_rpcs(name) AS (VALUES
  ('dm_send_message'),('dm_block_user'),('dm_unblock_user'),
  ('dm_list_blocked'),('admin_list_dm_reports')
)
SELECT * FROM (
  SELECT 1 AS ord, 'A extensions'::text AS section, 'pgcrypto'::text AS check_item,
         (CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname='pgcrypto')
               THEN 'OK' ELSE 'MISSING' END)::text AS status
  UNION ALL
  SELECT 2, 'B tables', e.name::text,
         (CASE WHEN t.tablename IS NOT NULL THEN 'OK' ELSE 'MISSING' END)::text
    FROM expected_tables e LEFT JOIN pg_tables t ON t.schemaname='public' AND t.tablename=e.name
  UNION ALL
  SELECT 3, 'C rls', c.relname::text,
         (CASE WHEN c.relrowsecurity THEN 'OK' ELSE 'OFF - GAP' END)::text
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind='r'
  UNION ALL
  SELECT 4, 'D policies', c.relname::text,
         (COUNT(p.polname)::text || ' policies - ' ||
          CASE WHEN COUNT(p.polname)>0 THEN 'OK'
               WHEN c.relname IN ('dm_rate_counter','mission_witnesses') THEN 'OK (intentional deny-all)'
               ELSE 'GAP' END)::text
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_policy p ON p.polrelid=c.oid
   WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity
   GROUP BY c.relname
  UNION ALL
  SELECT 5, 'E profiles col', e.col::text,
         (CASE WHEN c.column_name IS NOT NULL THEN c.data_type::text ELSE 'MISSING' END)::text
    FROM expected_profile_cols e
    LEFT JOIN information_schema.columns c
      ON c.table_schema='public' AND c.table_name='profiles' AND c.column_name=e.col
  UNION ALL
  SELECT 6, 'F profiles update grant', (grantee::text || '.' || column_name::text), privilege_type::text
    FROM information_schema.column_privileges
   WHERE table_schema='public' AND table_name='profiles' AND privilege_type='UPDATE'
     AND grantee IN ('anon','authenticated','PUBLIC')
  UNION ALL
  SELECT 7, 'G functions', e.name::text,
         (CASE WHEN p.proname IS NOT NULL THEN 'OK' ELSE 'MISSING' END)::text
    FROM expected_functions e
    LEFT JOIN pg_proc p
      ON p.pronamespace=(SELECT oid FROM pg_namespace WHERE nspname='public') AND p.proname=e.name
  UNION ALL
  SELECT 8, 'H dictionary', category::text, COUNT(*)::text
    FROM public.emoticron_dictionary GROUP BY category
  UNION ALL
  SELECT 8, 'H dictionary', 'TOTAL (want 100)'::text, COUNT(*)::text FROM public.emoticron_dictionary
  UNION ALL
  SELECT 9, 'I app_config', key::text, value::text FROM public.app_config
  UNION ALL
  SELECT 10, 'J realtime', 'earned_badges in supabase_realtime'::text,
         (CASE WHEN EXISTS (SELECT 1 FROM pg_publication_tables
                             WHERE pubname='supabase_realtime' AND schemaname='public'
                               AND tablename='earned_badges') THEN 'OK' ELSE 'MISSING' END)::text
  UNION ALL
  SELECT 11, 'K coverage', 'auth_users'::text, (SELECT COUNT(*)::text FROM auth.users)
  UNION ALL
  SELECT 11, 'K coverage', 'profiles'::text, (SELECT COUNT(*)::text FROM public.profiles)
  UNION ALL
  SELECT 11, 'K coverage', 'missing_profile_rows (want 0)'::text,
         ((SELECT COUNT(*) FROM auth.users) - (SELECT COUNT(*) FROM public.profiles))::text
  UNION ALL
  SELECT 12, 'L admin bootstrap', 'admin_count (want >= 1)'::text,
         (SELECT COUNT(*)::text FROM public.profiles WHERE role='admin')
  UNION ALL
  SELECT 13, 'M dm rpcs (0012)', e.name::text,
         (CASE WHEN p.proname IS NOT NULL THEN 'OK (0012 applied)' ELSE 'MISSING (0012 not run)' END)::text
    FROM expected_dm_rpcs e
    LEFT JOIN pg_proc p
      ON p.pronamespace=(SELECT oid FROM pg_namespace WHERE nspname='public') AND p.proname=e.name
) audit
ORDER BY ord, section, check_item;
