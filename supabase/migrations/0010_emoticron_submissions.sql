-- Migration: 0010 — emoticron submissions + review queue (Sub-Phase D)
--
-- Players submit a 2-word combo from the emoticron_dictionary for manual review.
-- One pending submission per account (upsert replaces the prior one).
-- Admins approve or reject via SECURITY DEFINER RPCs.
--
-- Prerequisites: migration 0003 (is_admin()), migration 0007 (emoticron_dictionary).

CREATE TABLE IF NOT EXISTS public.emoticron_submissions (
  id           UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word1        TEXT         NOT NULL,
  word2        TEXT         NOT NULL,
  status       TEXT         NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'approved', 'rejected')),
  note         TEXT,                        -- reviewer note, surfaced to user on rejection
  submitted_at TIMESTAMPTZ  DEFAULT now(),
  reviewed_at  TIMESTAMPTZ,
  UNIQUE (user_id)                           -- one active record per account
);

ALTER TABLE public.emoticron_submissions ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own row.
CREATE POLICY "emoticron_sub_user_read"
  ON public.emoticron_submissions FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all rows (needed for the review queue).
-- is_admin() is a SECURITY DEFINER helper from migration 0003.
CREATE POLICY "emoticron_sub_admin_read"
  ON public.emoticron_submissions FOR SELECT
  USING (is_admin());

-- No direct INSERT/UPDATE/DELETE from clients; all writes go through RPCs below.

-- ── RPCs ─────────────────────────────────────────────────────────────────────

-- submit_emoticron: user submits a 2-word combo.
-- Validates both words exist in emoticron_dictionary and are distinct.
-- Upserts: replaces any prior submission with a fresh 'pending' record.
CREATE OR REPLACE FUNCTION public.submit_emoticron(p_word1 TEXT, p_word2 TEXT)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF trim(p_word1) = '' OR trim(p_word2) = '' THEN
    RAISE EXCEPTION 'words must not be empty';
  END IF;

  IF p_word1 = p_word2 THEN
    RAISE EXCEPTION 'both words must be different';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM emoticron_dictionary WHERE word = p_word1) THEN
    RAISE EXCEPTION 'word1 not in dictionary: %', p_word1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM emoticron_dictionary WHERE word = p_word2) THEN
    RAISE EXCEPTION 'word2 not in dictionary: %', p_word2;
  END IF;

  INSERT INTO emoticron_submissions (user_id, word1, word2, status, submitted_at, reviewed_at, note)
  VALUES (v_uid, p_word1, p_word2, 'pending', now(), NULL, NULL)
  ON CONFLICT (user_id) DO UPDATE
    SET word1        = EXCLUDED.word1,
        word2        = EXCLUDED.word2,
        status       = 'pending',
        submitted_at = now(),
        reviewed_at  = NULL,
        note         = NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_emoticron FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_emoticron TO authenticated;

-- get_my_emoticron_submission: user reads their own current record.
CREATE OR REPLACE FUNCTION public.get_my_emoticron_submission()
  RETURNS TABLE (word1 TEXT, word2 TEXT, status TEXT, note TEXT, submitted_at TIMESTAMPTZ)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT s.word1, s.word2, s.status, s.note, s.submitted_at
  FROM   emoticron_submissions s
  WHERE  s.user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_emoticron_submission FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_emoticron_submission TO authenticated;

-- admin_list_pending_emoticrons: returns queue of pending submissions with
-- enough context (email + words + timestamp) for a reviewer.
-- Returns zero rows to non-admins.
CREATE OR REPLACE FUNCTION public.admin_list_pending_emoticrons()
  RETURNS TABLE (
    user_id      UUID,
    email        TEXT,
    word1        TEXT,
    word2        TEXT,
    submitted_at TIMESTAMPTZ
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT s.user_id,
         u.email,
         s.word1,
         s.word2,
         s.submitted_at
  FROM   emoticron_submissions s
  JOIN   auth.users u ON u.id = s.user_id
  WHERE  s.status = 'pending'
  ORDER BY s.submitted_at;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_pending_emoticrons FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_pending_emoticrons TO authenticated;

-- admin_approve_emoticron: marks a pending submission as approved.
CREATE OR REPLACE FUNCTION public.admin_approve_emoticron(p_user_id UUID)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'not admin';
  END IF;

  UPDATE emoticron_submissions
  SET    status      = 'approved',
         reviewed_at = now(),
         note        = NULL
  WHERE  user_id = p_user_id
    AND  status   = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no pending submission for that user';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_approve_emoticron FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_approve_emoticron TO authenticated;

-- admin_reject_emoticron: marks a pending submission as rejected with an
-- optional reviewer note that is shown to the submitting user.
CREATE OR REPLACE FUNCTION public.admin_reject_emoticron(p_user_id UUID, p_note TEXT DEFAULT '')
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'not admin';
  END IF;

  UPDATE emoticron_submissions
  SET    status      = 'rejected',
         reviewed_at = now(),
         note        = NULLIF(trim(p_note), '')
  WHERE  user_id = p_user_id
    AND  status   = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no pending submission for that user';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reject_emoticron FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reject_emoticron TO authenticated;
