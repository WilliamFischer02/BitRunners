-- BitRunners — Supabase state audit v2 (read-only, single result set)
--
-- Supersedes audits/0001_state_audit.sql (kept as the 0001-0011 snapshot).
-- Covers migrations 0001 -> 0012.
--
-- HOW TO RUN: paste this whole file into the Supabase SQL editor and Run. It is
-- ONE statement that returns ONE result grid. There are no psql meta-commands
-- (\echo) and no bare text — it is Supabase-editor safe. Scan the `status`
-- column: anything reading MISSING / GAP / OFF / UNEXPECTED / SHOULD NOT EXIST,
-- or a `true` where the row says "want false", is a hole. Everything else is OK.
--
-- Read-only: SELECT against system catalogs + seed tables only. No DML/DDL.
-- Devlog: docs/devlog/0089-supabase-audit-2026-06-16.md

WITH
expected_tables(name) AS (VALUES
  ('profiles'),('inventory'),('equipped_outfit'),('achievements'),
  ('samaritan_status'),('emoticron_submissions'),('unlocked_emoticrons'),
  ('player_economy'),('app_config'),('dialogue'),('session_events'),
  ('economy_grants'),('earned_badges'),('owned_themes'),
  ('emoticron_dictionary'),('mission_progress'),('dm_messages'),
  ('hack_qte_attempts'),('mission_witnesses'),('dm_rate_counter')
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
  ('advance_checkpoint'),('complete_mission'),('get_mission_progress'),
  ('dm_send_message'),('dm_block_user'),('dm_unblock_user'),
  ('dm_list_blocked'),('admin_list_dm_reports'),('dm_rate_counter_gc')
),
expected_indexes(idx) AS (VALUES
  ('inventory_user_idx'),('achievements_user_idx'),
  ('unlocked_emoticrons_user_idx'),('economy_grants_user_unclaimed_idx'),
  ('earned_badges_user_unack_idx'),('dm_messages_room_idx'),
  ('dm_messages_moderation_idx'),('hack_qte_attempts_user_idx')
)
SELECT * FROM (
  SELECT 1 AS ord, 'A extensions'::text AS section, 'pgcrypto'::text AS check_item,
         (CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname='pgcrypto')
               THEN 'OK' ELSE 'MISSING' END)::text AS status
  UNION ALL
  SELECT 2, 'B tables', e.name::text,
         (CASE WHEN t.tablename IS NOT NULL THEN 'OK' ELSE 'MISSING' END)::text
    FROM expected_tables e
    LEFT JOIN pg_tables t ON t.schemaname='public' AND t.tablename=e.name
  UNION ALL
  SELECT 2, 'B tables', t.tablename::text, 'UNEXPECTED (not in 0001-0012)'::text
    FROM pg_tables t LEFT JOIN expected_tables e ON e.name=t.tablename
   WHERE t.schemaname='public' AND e.name IS NULL
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
  SELECT 6, 'F profiles update grant', 'lockdown verdict'::text,
         (CASE WHEN EXISTS (
            SELECT 1 FROM information_schema.column_privileges
             WHERE table_schema='public' AND table_name='profiles' AND privilege_type='UPDATE'
               AND (grantee IN ('anon','PUBLIC')
                    OR (grantee='authenticated' AND column_name NOT IN
                        ('display_name','display_name_note','display_name_status','dm_blocked')))
          ) THEN 'GAP - unexpected update grant' ELSE 'OK - locked to 4 cols' END)::text
  UNION ALL
  SELECT 7, 'G functions', e.name::text,
         (CASE WHEN p.proname IS NOT NULL THEN 'OK' ELSE 'MISSING' END)::text
    FROM expected_functions e
    LEFT JOIN pg_proc p
      ON p.pronamespace=(SELECT oid FROM pg_namespace WHERE nspname='public') AND p.proname=e.name
  UNION ALL
  SELECT 8, 'G2 award_pending_badges internal-only', 'anon EXECUTE (want false)'::text,
         COALESCE(has_function_privilege('anon', to_regprocedure('public.award_pending_badges(uuid)'), 'EXECUTE')::text, 'fn missing')
  UNION ALL
  SELECT 8, 'G2 award_pending_badges internal-only', 'authenticated EXECUTE (want false)'::text,
         COALESCE(has_function_privilege('authenticated', to_regprocedure('public.award_pending_badges(uuid)'), 'EXECUTE')::text, 'fn missing')
  UNION ALL
  SELECT 8, 'G2 secdef anon-exec (informational)', 'count'::text,
         (SELECT COUNT(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           WHERE n.nspname='public' AND p.prosecdef AND has_function_privilege('anon', p.oid, 'EXECUTE'))
  UNION ALL
  SELECT 9, 'G3 search_path unpinned (want 0 rows)', p.proname::text,
         (CASE WHEN p.proconfig IS NULL THEN 'NONE (mutable)'
               ELSE array_to_string(p.proconfig, ', ') END)::text
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public'
     AND (p.proconfig IS NULL OR NOT (p.proconfig::text LIKE '%search_path%'))
  UNION ALL
  SELECT 10, 'H indexes', e.idx::text,
         (CASE WHEN i.indexname IS NOT NULL THEN 'OK' ELSE 'MISSING' END)::text
    FROM expected_indexes e
    LEFT JOIN pg_indexes i ON i.schemaname='public' AND i.indexname=e.idx
  UNION ALL
  SELECT 10, 'H indexes', i.indexname::text, 'SHOULD NOT EXIST (dropped by 0010)'::text
    FROM pg_indexes i
   WHERE i.schemaname='public'
     AND i.indexname IN ('emoticron_submissions_user_idx','emoticron_submissions_status_idx')
  UNION ALL
  SELECT 11, 'I dictionary', category::text, COUNT(*)::text
    FROM public.emoticron_dictionary GROUP BY category
  UNION ALL
  SELECT 11, 'I dictionary', 'TOTAL (want 100)'::text, COUNT(*)::text FROM public.emoticron_dictionary
  UNION ALL
  SELECT 12, 'J app_config', key::text, value::text FROM public.app_config
  UNION ALL
  SELECT 13, 'K realtime', 'earned_badges in supabase_realtime'::text,
         (CASE WHEN EXISTS (SELECT 1 FROM pg_publication_tables
                             WHERE pubname='supabase_realtime' AND schemaname='public'
                               AND tablename='earned_badges') THEN 'OK' ELSE 'MISSING' END)::text
  UNION ALL
  SELECT 14, 'L coverage', 'auth_users'::text, (SELECT COUNT(*)::text FROM auth.users)
  UNION ALL
  SELECT 14, 'L coverage', 'profiles'::text, (SELECT COUNT(*)::text FROM public.profiles)
  UNION ALL
  SELECT 14, 'L coverage', 'missing_profile_rows (want 0)'::text,
         ((SELECT COUNT(*) FROM auth.users) - (SELECT COUNT(*) FROM public.profiles))::text
  UNION ALL
  SELECT 14, 'L coverage', 'admin_count (want >= 1)'::text,
         (SELECT COUNT(*)::text FROM public.profiles WHERE role='admin')
) audit
ORDER BY ord, section, check_item;
