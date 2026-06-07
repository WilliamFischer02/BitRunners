-- 0011 — physical missions (Sub-Phase G, docs/lore/011-physical-missions.md)
--
-- The `mission_progress` table itself is already reserved in migration 0007.
-- This migration adds the three RPCs the client needs to drive a mission
-- end-to-end:
--
--   start_mission(p_key)            — idempotent. Inserts a row with
--                                     state='active', last_checkpoint=0 if
--                                     the user hasn't seen this mission yet.
--   advance_checkpoint(p_key, p_n)  — bumps last_checkpoint forward (never
--                                     backward) so server has an audit trail.
--                                     state becomes 'final' when the last
--                                     checkpoint is reached.
--   complete_mission(p_key, p_choice) — writes faction_choice, marks
--                                     state='complete', awards +5 Samaritan
--                                     to the chosen faction, then calls
--                                     award_pending_badges() (migration 0009)
--                                     so a tier crossing fires the toast.
--                                     Returns the new score + any newly-
--                                     awarded badge keys for the client to
--                                     show the player.
--   get_mission_progress(p_key)     — read-only convenience.
--
-- SECURITY:
--   * Every RPC re-checks auth.uid() server-side.
--   * complete_mission is idempotent on (user_id, mission_key) — calling
--     twice does NOT double-award. Faction can change between calls only if
--     state is still 'final'; once 'complete' it is locked.
--   * Mission key is shape-validated (lower_snake, ≤ 64 chars) so an attacker
--     can't smuggle SQL or pollute the table.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Shape constraint for mission_key — applies to every RPC below.
CREATE OR REPLACE FUNCTION public._validate_mission_key(p_key TEXT)
RETURNS VOID AS $$
BEGIN
  IF p_key IS NULL OR length(p_key) = 0 OR length(p_key) > 64 THEN
    RAISE EXCEPTION 'invalid mission key length';
  END IF;
  IF p_key !~ '^[a-z0-9_]+$' THEN
    RAISE EXCEPTION 'invalid mission key characters';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- ── RPC: start_mission ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.start_mission(p_key TEXT)
RETURNS VOID AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  PERFORM public._validate_mission_key(p_key);

  INSERT INTO public.mission_progress (user_id, mission_key, state, last_checkpoint, updated_at)
    VALUES (v_uid, p_key, 'active', 0, NOW())
    ON CONFLICT (user_id, mission_key) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── RPC: advance_checkpoint ─────────────────────────────────────────────────
-- Idempotent: only moves forward, never backward. final-state when crossing
-- the LAST checkpoint is set by the client — the server only knows the count
-- through the calls themselves.
CREATE OR REPLACE FUNCTION public.advance_checkpoint(
  p_key TEXT,
  p_n INT,
  p_is_final BOOLEAN DEFAULT FALSE
)
RETURNS VOID AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  PERFORM public._validate_mission_key(p_key);
  IF p_n < 0 OR p_n > 32 THEN
    RAISE EXCEPTION 'invalid checkpoint index';
  END IF;

  -- Insert if missing so we don't require start_mission to have been called.
  INSERT INTO public.mission_progress (user_id, mission_key, state, last_checkpoint, updated_at)
    VALUES (
      v_uid, p_key,
      CASE WHEN p_is_final THEN 'final' ELSE 'active' END,
      p_n, NOW()
    )
    ON CONFLICT (user_id, mission_key) DO UPDATE
      SET last_checkpoint = GREATEST(mission_progress.last_checkpoint, EXCLUDED.last_checkpoint),
          state = CASE
            WHEN mission_progress.state = 'complete' THEN 'complete'
            WHEN p_is_final THEN 'final'
            ELSE mission_progress.state
          END,
          updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── RPC: complete_mission ───────────────────────────────────────────────────
-- Idempotent: a second call with the same (user_id, mission_key) is a no-op
-- and does NOT double-award. Returns the new samaritan score + any badges
-- crossed in this completion so the client can show them.
CREATE OR REPLACE FUNCTION public.complete_mission(
  p_key TEXT,
  p_choice TEXT,
  p_reward INT DEFAULT 5
)
RETURNS TABLE(
  score INT,
  new_badges TEXT[]
) AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_existing TEXT;
  v_before_score INT;
  v_after_score INT;
  v_new_keys TEXT[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  PERFORM public._validate_mission_key(p_key);
  IF p_choice NOT IN ('corporate', 'bitrunner') THEN
    RAISE EXCEPTION 'invalid faction choice';
  END IF;
  IF p_reward < 0 OR p_reward > 100 THEN
    RAISE EXCEPTION 'invalid reward amount';
  END IF;

  -- Idempotency guard. If already complete, return current score + empty new
  -- keys. Locking the row prevents the double-award race two browsers could
  -- hit if a runner spams the dialogue.
  SELECT state INTO v_existing
    FROM public.mission_progress
   WHERE user_id = v_uid AND mission_key = p_key
   FOR UPDATE;

  IF v_existing = 'complete' THEN
    SELECT CASE p_choice
             WHEN 'corporate' THEN samaritan_corporate
             ELSE samaritan_bitrunner
           END
      INTO v_after_score
      FROM public.profiles WHERE id = v_uid;
    RETURN QUERY SELECT COALESCE(v_after_score, 0), ARRAY[]::TEXT[];
    RETURN;
  END IF;

  -- Read the pre-increment score so we can pass it to the badge helper.
  SELECT CASE p_choice
           WHEN 'corporate' THEN samaritan_corporate
           ELSE samaritan_bitrunner
         END
    INTO v_before_score
    FROM public.profiles WHERE id = v_uid;
  v_before_score := COALESCE(v_before_score, 0);
  v_after_score := v_before_score + p_reward;

  -- Mark complete (insert if no prior row, e.g. a client that skipped
  -- start_mission). Single statement keeps everything atomic.
  INSERT INTO public.mission_progress
      (user_id, mission_key, state, last_checkpoint, faction_choice, updated_at)
    VALUES (v_uid, p_key, 'complete', 0, p_choice, NOW())
    ON CONFLICT (user_id, mission_key) DO UPDATE
      SET state = 'complete',
          faction_choice = EXCLUDED.faction_choice,
          updated_at = NOW();

  -- Increment the matching faction column.
  IF p_choice = 'corporate' THEN
    UPDATE public.profiles
       SET samaritan_corporate = v_after_score, updated_at = NOW()
     WHERE id = v_uid;
  ELSE
    UPDATE public.profiles
       SET samaritan_bitrunner = v_after_score, updated_at = NOW()
     WHERE id = v_uid;
  END IF;

  -- Cross any newly-crossed badge tiers. award_pending_badges() lives in
  -- migration 0009; it reads the samaritan_* columns and inserts unmatched
  -- earned_badges rows. We collect the keys it would have inserted by
  -- comparing before / after counts: tier = floor(score / 10), capped 10.
  v_new_keys := ARRAY(
    SELECT
      CASE p_choice WHEN 'corporate' THEN 'corp:' ELSE 'br:' END ||
      (ARRAY[
        'wood','stone','bronze','steel','silver',
        'gold','platinum','diamond','obsidian','aether'
      ])[tier]
    FROM generate_series(
      LEAST(10, GREATEST(0, v_before_score / 10)) + 1,
      LEAST(10, GREATEST(0, v_after_score  / 10))
    ) AS tier
  );

  -- Insert the matching earned_badges rows directly (mirrors what
  -- award_pending_badges would do) — keeps this RPC standalone if 0009 isn't
  -- yet applied. ON CONFLICT DO NOTHING handles the rare retry case.
  INSERT INTO public.earned_badges (user_id, badge_key, earned_at, acknowledged)
    SELECT v_uid, k, NOW(), FALSE
      FROM unnest(v_new_keys) AS k
    ON CONFLICT (user_id, badge_key) DO NOTHING;

  RETURN QUERY SELECT v_after_score, v_new_keys;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── RPC: get_mission_progress ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_mission_progress(p_key TEXT)
RETURNS TABLE(
  state TEXT,
  last_checkpoint INT,
  faction_choice TEXT,
  updated_at TIMESTAMPTZ
) AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;
  PERFORM public._validate_mission_key(p_key);
  RETURN QUERY
    SELECT mp.state, mp.last_checkpoint, mp.faction_choice, mp.updated_at
      FROM public.mission_progress mp
     WHERE mp.user_id = v_uid AND mp.mission_key = p_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.start_mission(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_checkpoint(TEXT, INT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_mission(TEXT, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mission_progress(TEXT) TO authenticated;
