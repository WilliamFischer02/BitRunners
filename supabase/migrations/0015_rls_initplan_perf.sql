-- 0015 — RLS initplan performance pass (audit follow-up, devlog 0089)
--
-- ⚠️  NOT AUTO-APPLIED. Owner runs this in the Supabase SQL editor (CLAUDE.md
--     rule). Idempotent (DROP POLICY IF EXISTS + CREATE) and wrapped in a single
--     transaction so the policy swap is atomic — there is never a window where a
--     table has RLS on but no policy.
--
-- WHY
-- The Supabase advisor `auth_rls_initplan` (WARN) flags ~26 policies that call
-- `auth.uid()` / `is_admin(auth.uid())` directly: Postgres re-evaluates the auth
-- function once PER ROW. Wrapping the call in a scalar subquery — `(select
-- auth.uid())` — makes the planner hoist it to an InitPlan evaluated ONCE per
-- query. This is the canonical Supabase fix.
--   docs: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
--
-- BEHAVIOUR IS IDENTICAL. Every predicate is the same boolean as before — only
-- the evaluation count changes. Roles are preserved (no TO clause = applies to
-- PUBLIC, exactly as the originals). The three world-readable policies
-- (app_config_read_all, dialogue_read_all, dictionary_select_all) use `USING
-- (true)`, never call auth.*, and are intentionally left untouched.
--
-- This is a pre-alpha-optional perf/lint pass: at the current scale it changes
-- nothing observable; it clears the advisor warnings and scales cleanly later.

BEGIN;

-- ── achievements ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "achievements_select_own" ON public.achievements;
CREATE POLICY "achievements_select_own" ON public.achievements
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- ── app_config (admin write; read_all left untouched) ───────────────────────
DROP POLICY IF EXISTS "app_config_admin_update" ON public.app_config;
CREATE POLICY "app_config_admin_update" ON public.app_config
  FOR UPDATE USING (is_admin((SELECT auth.uid())))
  WITH CHECK (is_admin((SELECT auth.uid())));
DROP POLICY IF EXISTS "app_config_admin_insert" ON public.app_config;
CREATE POLICY "app_config_admin_insert" ON public.app_config
  FOR INSERT WITH CHECK (is_admin((SELECT auth.uid())));

-- ── dialogue (admin write; read_all left untouched) ─────────────────────────
DROP POLICY IF EXISTS "dialogue_admin_update" ON public.dialogue;
CREATE POLICY "dialogue_admin_update" ON public.dialogue
  FOR UPDATE USING (is_admin((SELECT auth.uid())))
  WITH CHECK (is_admin((SELECT auth.uid())));
DROP POLICY IF EXISTS "dialogue_admin_insert" ON public.dialogue;
CREATE POLICY "dialogue_admin_insert" ON public.dialogue
  FOR INSERT WITH CHECK (is_admin((SELECT auth.uid())));

-- ── dm_messages ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "dm_messages_select_participant" ON public.dm_messages;
CREATE POLICY "dm_messages_select_participant" ON public.dm_messages
  FOR SELECT USING (((SELECT auth.uid()) = from_user) OR ((SELECT auth.uid()) = to_user));

-- ── earned_badges ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "earned_badges_select_own" ON public.earned_badges;
CREATE POLICY "earned_badges_select_own" ON public.earned_badges
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- ── economy_grants ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "grants_select_own" ON public.economy_grants;
CREATE POLICY "grants_select_own" ON public.economy_grants
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- ── emoticron_submissions ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "emoticron_sub_admin_read" ON public.emoticron_submissions;
CREATE POLICY "emoticron_sub_admin_read" ON public.emoticron_submissions
  FOR SELECT USING (is_admin((SELECT auth.uid())));
DROP POLICY IF EXISTS "emoticron_sub_user_read" ON public.emoticron_submissions;
CREATE POLICY "emoticron_sub_user_read" ON public.emoticron_submissions
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- ── equipped_outfit ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "outfit_select_own" ON public.equipped_outfit;
CREATE POLICY "outfit_select_own" ON public.equipped_outfit
  FOR SELECT USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "outfit_update_own" ON public.equipped_outfit;
CREATE POLICY "outfit_update_own" ON public.equipped_outfit
  FOR UPDATE USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "outfit_insert_own" ON public.equipped_outfit;
CREATE POLICY "outfit_insert_own" ON public.equipped_outfit
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

-- ── hack_qte_attempts ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "hack_qte_select_own" ON public.hack_qte_attempts;
CREATE POLICY "hack_qte_select_own" ON public.hack_qte_attempts
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- ── inventory ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "inventory_select_own" ON public.inventory;
CREATE POLICY "inventory_select_own" ON public.inventory
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- ── mission_progress ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "mission_progress_select_own" ON public.mission_progress;
CREATE POLICY "mission_progress_select_own" ON public.mission_progress
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- ── owned_themes ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "owned_themes_select_own" ON public.owned_themes;
CREATE POLICY "owned_themes_select_own" ON public.owned_themes
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- ── player_economy ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "economy_select_own" ON public.player_economy;
CREATE POLICY "economy_select_own" ON public.player_economy
  FOR SELECT USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "economy_update_own" ON public.player_economy;
CREATE POLICY "economy_update_own" ON public.player_economy
  FOR UPDATE USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "economy_insert_own" ON public.player_economy;
CREATE POLICY "economy_insert_own" ON public.player_economy
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

-- ── profiles (update keeps the display_name_status guard) ───────────────────
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING ((SELECT auth.uid()) = id);
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING ((SELECT auth.uid()) = id)
  WITH CHECK (((SELECT auth.uid()) = id)
              AND (display_name_status = ANY (ARRAY['unset'::text, 'pending'::text])));

-- ── samaritan_status ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "samaritan_select_own" ON public.samaritan_status;
CREATE POLICY "samaritan_select_own" ON public.samaritan_status
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- ── session_events ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "session_events_admin_select" ON public.session_events;
CREATE POLICY "session_events_admin_select" ON public.session_events
  FOR SELECT USING (is_admin((SELECT auth.uid())));
DROP POLICY IF EXISTS "session_events_insert_own" ON public.session_events;
CREATE POLICY "session_events_insert_own" ON public.session_events
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

-- ── unlocked_emoticrons ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "unlocked_select_own" ON public.unlocked_emoticrons;
CREATE POLICY "unlocked_select_own" ON public.unlocked_emoticrons
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

COMMIT;

-- ── verify (read-only) ──────────────────────────────────────────────────────
-- Re-run get_advisors (performance) or: the Supabase dashboard → Advisors →
-- Performance should show the `auth_rls_initplan` warnings cleared. Spot check a
-- rewritten qual:
--   SELECT policyname, qual FROM pg_policies
--    WHERE schemaname='public' AND tablename='profiles';
--   -- qual should now read: ((SELECT auth.uid()) = id)
