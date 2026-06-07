-- 0009 — Badge earn loop
--
-- Provides:
--   * Supabase Realtime publication for earned_badges (client Realtime push).
--   * award_pending_badges(p_uid) — internal helper; inserts earned_badges rows
--     for every tier the player has crossed but not yet received. Returns the
--     newly-inserted keys. Called by admin_grant_samaritan and (future) mission
--     completion RPCs.
--   * admin_grant_samaritan(target, p_faction, p_amount) — admin-only RPC that
--     increments profiles.samaritan_{corp|bitrunner} and calls
--     award_pending_badges. Returns the new score + freshly-awarded keys.
--
-- Samaritan scoring model (canon: docs/lore/010-badges-and-tiers.md):
--   Tier 1 (wood) at +10, tier 2 (stone) at +20, …, tier 10 (aether) at +100.
--   Both ladders (corp / br) are evaluated independently.
--
-- SECURITY:
--   * award_pending_badges is SECURITY DEFINER with NO direct client EXECUTE
--     grant — it is an internal helper, callable only from within SECURITY
--     DEFINER functions (e.g. admin_grant_samaritan, future mission RPCs) that
--     already have validated the caller.
--   * admin_grant_samaritan is granted to `authenticated` but gates on
--     is_admin(auth.uid()), so non-admins receive an error.
--   * earned_badges still has no client INSERT/UPDATE/DELETE policy; all writes
--     flow through SECURITY DEFINER callers.

-- ── Realtime publication ─────────────────────────────────────────────────────
-- Adds earned_badges to the supabase_realtime publication so clients can
-- subscribe to their own INSERT events (gated by the existing RLS SELECT
-- policy: auth.uid() = user_id).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'earned_badges'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.earned_badges;
  END IF;
END;
$$;

-- ── award_pending_badges (internal helper) ───────────────────────────────────
-- Inserts earned_badges rows for every tier threshold the user has crossed for
-- either faction that they do not already own. Returns an array of newly-
-- inserted badge keys (empty if nothing new).
--
-- NOT granted to authenticated/anon — internal only.
CREATE OR REPLACE FUNCTION public.award_pending_badges(p_uid UUID)
RETURNS TEXT[] AS $$
DECLARE
  v_corp_score INT;
  v_br_score   INT;
  v_tiers      TEXT[] := ARRAY[
    'wood','stone','bronze','steel','silver',
    'gold','platinum','diamond','obsidian','aether'
  ];
  v_new_keys   TEXT[] := '{}';
  v_key        TEXT;
  v_max_tier   INT;
  i            INT;
BEGIN
  SELECT samaritan_corporate, samaritan_bitrunner
    INTO v_corp_score, v_br_score
    FROM public.profiles
   WHERE id = p_uid;

  IF NOT FOUND THEN
    RETURN '{}';
  END IF;

  -- Corporate ladder
  v_max_tier := LEAST(10, v_corp_score / 10);
  FOR i IN 1..v_max_tier LOOP
    v_key := 'corp:' || v_tiers[i];
    INSERT INTO public.earned_badges (user_id, badge_key)
      VALUES (p_uid, v_key)
      ON CONFLICT (user_id, badge_key) DO NOTHING;
    IF FOUND THEN
      v_new_keys := array_append(v_new_keys, v_key);
    END IF;
  END LOOP;

  -- BitRunner ladder
  v_max_tier := LEAST(10, v_br_score / 10);
  FOR i IN 1..v_max_tier LOOP
    v_key := 'br:' || v_tiers[i];
    INSERT INTO public.earned_badges (user_id, badge_key)
      VALUES (p_uid, v_key)
      ON CONFLICT (user_id, badge_key) DO NOTHING;
    IF FOUND THEN
      v_new_keys := array_append(v_new_keys, v_key);
    END IF;
  END LOOP;

  RETURN v_new_keys;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
-- Intentionally NOT granted to authenticated: internal helper only.

-- ── admin_grant_samaritan ────────────────────────────────────────────────────
-- Admin-only: increments samaritan score for a target user and awards any
-- newly-crossed badge tiers. Caps at 100 per faction. Returns new_score and
-- new_badges (the badge keys inserted this call).
CREATE OR REPLACE FUNCTION public.admin_grant_samaritan(
  target     UUID,
  p_faction  TEXT,
  p_amount   INT
)
RETURNS TABLE (new_score INT, new_badges TEXT[]) AS $$
DECLARE
  v_score    INT;
  v_new_keys TEXT[];
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  IF p_faction NOT IN ('corp', 'br') THEN
    RAISE EXCEPTION 'faction must be corp or br';
  END IF;
  IF p_amount <= 0 OR p_amount > 100 THEN
    RAISE EXCEPTION 'amount must be 1..100';
  END IF;
  IF target IS NULL THEN
    RAISE EXCEPTION 'target required';
  END IF;

  IF p_faction = 'corp' THEN
    UPDATE public.profiles
       SET samaritan_corporate = LEAST(100, samaritan_corporate + p_amount),
           updated_at = NOW()
     WHERE id = target
     RETURNING samaritan_corporate INTO v_score;
  ELSE
    UPDATE public.profiles
       SET samaritan_bitrunner = LEAST(100, samaritan_bitrunner + p_amount),
           updated_at = NOW()
     WHERE id = target
     RETURNING samaritan_bitrunner INTO v_score;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'target user not found';
  END IF;

  v_new_keys := public.award_pending_badges(target);

  RETURN QUERY SELECT v_score, v_new_keys;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.admin_grant_samaritan(UUID, TEXT, INT) TO authenticated;
