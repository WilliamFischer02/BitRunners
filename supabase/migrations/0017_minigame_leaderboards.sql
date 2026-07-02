-- 0017 — Minigame + datascraper leaderboards (mega-batch 2, owner-requested).
--
-- AUTHORED BY the autonomous session, NOT yet applied to prod. The owner's
-- Supabase agent applies this against the live DB. Until then the client's
-- leaderboard.ts degrades gracefully (fetches return null, submits no-op), so
-- shipping the client ahead of the migration is safe.
--
-- Adds:
--   * minigame_scores        — per-(user, game) best score + completion count.
--   * submit_minigame_score  — SECURITY DEFINER monotonic upsert (server clamp).
--   * get_leaderboard        — top-N for a game, joined to approved names.
--   * get_economy_leaderboard— top-N by a player_economy blob metric
--                              (passcodes / credits) for the data-scrape game.
--
-- Follows the 0013/0014 lockdown pattern: EXECUTE revoked from anon + PUBLIC,
-- granted only to authenticated; no direct table writes.

-- ── table ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.minigame_scores (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_key    TEXT NOT NULL CHECK (game_key IN ('freq_lock', 'circuit_patch', 'core_run')),
  best_score  INT  NOT NULL DEFAULT 0 CHECK (best_score >= 0),
  completions INT  NOT NULL DEFAULT 0 CHECK (completions >= 0),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game_key)
);

ALTER TABLE public.minigame_scores ENABLE ROW LEVEL SECURITY;

-- Leaderboards are public in-game: any authenticated user may read all rows.
DROP POLICY IF EXISTS minigame_scores_select ON public.minigame_scores;
CREATE POLICY minigame_scores_select ON public.minigame_scores
  FOR SELECT TO authenticated USING (true);

-- All writes go through submit_minigame_score (SECURITY DEFINER) — no direct
-- INSERT/UPDATE/DELETE from clients, so a player can't post an arbitrary score.
REVOKE INSERT, UPDATE, DELETE ON public.minigame_scores FROM anon, authenticated;

-- ── submit (monotonic upsert, server-side clamp) ───────────────────────────
CREATE OR REPLACE FUNCTION public.submit_minigame_score(p_game TEXT, p_score INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max INT;
  v_score INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  -- Per-game server-side ceiling (defends against a tampered client). Tuned to
  -- the actual scoring: freq_lock points, circuit_patch "seconds under par",
  -- core_run seconds remaining.
  v_max := CASE p_game
    WHEN 'freq_lock' THEN 6000
    WHEN 'circuit_patch' THEN 300
    WHEN 'core_run' THEN 100
    ELSE -1
  END;
  IF v_max < 0 THEN
    RAISE EXCEPTION 'invalid game key: %', p_game;
  END IF;
  v_score := GREATEST(0, LEAST(COALESCE(p_score, 0), v_max));

  INSERT INTO public.minigame_scores (user_id, game_key, best_score, completions, updated_at)
    VALUES (auth.uid(), p_game, v_score, 1, now())
  ON CONFLICT (user_id, game_key) DO UPDATE
    SET best_score  = GREATEST(public.minigame_scores.best_score, EXCLUDED.best_score),
        completions = public.minigame_scores.completions + 1,
        updated_at  = now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_minigame_score(TEXT, INT) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_minigame_score(TEXT, INT) TO authenticated;

-- ── read: minigame leaderboard ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_leaderboard(p_game TEXT, p_limit INT DEFAULT 10)
RETURNS TABLE (rank INT, display_name TEXT, best_score INT, completions INT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ROW_NUMBER() OVER (ORDER BY s.best_score DESC, s.updated_at ASC)::INT AS rank,
         COALESCE(p.display_name, 'runner') AS display_name,
         s.best_score,
         s.completions
  FROM public.minigame_scores s
  LEFT JOIN public.profiles p
    ON p.id = s.user_id AND p.display_name_status = 'approved'
  WHERE s.game_key = p_game
  ORDER BY s.best_score DESC, s.updated_at ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50);
$$;

REVOKE EXECUTE ON FUNCTION public.get_leaderboard(TEXT, INT) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(TEXT, INT) TO authenticated;

-- ── read: data-scrape economy leaderboard ─────────────────────────────────
-- Ranks every account by a metric pulled from its player_economy blob.
-- SECURITY DEFINER so it can read across rows (own-row RLS forbids the client
-- from seeing other players' blobs directly). Read-only, approved names only.
CREATE OR REPLACE FUNCTION public.get_economy_leaderboard(p_metric TEXT, p_limit INT DEFAULT 10)
RETURNS TABLE (rank INT, display_name TEXT, value BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ROW_NUMBER() OVER (ORDER BY v.value DESC)::INT AS rank,
         COALESCE(p.display_name, 'runner') AS display_name,
         v.value
  FROM (
    SELECT e.user_id,
           CASE p_metric
             WHEN 'passcodes' THEN COALESCE((e.blob->>'lifetimePasscodes')::BIGINT, 0)
             WHEN 'credits'   THEN COALESCE((e.blob->>'credits')::BIGINT, 0)
             ELSE 0
           END AS value
    FROM public.player_economy e
    WHERE p_metric IN ('passcodes', 'credits')
  ) v
  LEFT JOIN public.profiles p
    ON p.id = v.user_id AND p.display_name_status = 'approved'
  WHERE v.value > 0
  ORDER BY v.value DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50);
$$;

REVOKE EXECUTE ON FUNCTION public.get_economy_leaderboard(TEXT, INT) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_economy_leaderboard(TEXT, INT) TO authenticated;
