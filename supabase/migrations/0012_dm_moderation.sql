-- 0012 — DM moderation RPCs (closes the gap reserved in 0007)
--
-- Background: migration 0007 reserved dm_messages + profiles.dm_blocked +
-- profiles.dm_verified for the chat-policy spec in docs/lore/015 but never
-- added the RPCs that actually drive the moderation stack. PR #88 (tether
-- moderation V1) and PR #90 (client-side block list) both deferred the
-- server-side enforcement to this migration. The client work is done; this
-- closes the loop.
--
-- What's here
--   * dm_send_message — gates + audit-log + rate limit
--   * dm_block_user / dm_unblock_user / dm_list_blocked
--   * admin_list_dm_reports — flagged + blocked review queue
--   * dm_rate_counter table (per-pair sliding window)
--
-- Design notes
--   * "clean" messages are NOT persisted (spec: docs/lore/015 §audit trail).
--     The RPC returns a verdict the client uses to render locally; only
--     flagged + blocked messages write a dm_messages row.
--   * Rate limit (30 msg / 60 s / pair) uses a tiny per-pair counter row
--     instead of a log table, so the working set stays O(1) per send.
--   * Profanity classification is owner-pickable (docs/lore/015 open
--     questions). The RPC accepts a verdict the *server* (apps/server) has
--     already computed via the profanity library — it does NOT compute the
--     verdict itself, because Postgres has no NPM ecosystem. This keeps the
--     library swap a server-only decision while the audit trail + gates
--     remain in the DB.
--   * Length cap mirrors apps/web/src/tether-chat.ts TETHER_MAX_CHARS (25).
--   * Block-list cap: 256 entries per spec open-question. Hard-stop on add.
--
-- Apply order: after 0011. Idempotent (safe to re-run).

-- ── per-pair rate counter ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dm_rate_counter (
  from_user    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  count        INT NOT NULL DEFAULT 0,
  PRIMARY KEY (from_user, to_user)
);

ALTER TABLE public.dm_rate_counter ENABLE ROW LEVEL SECURITY;
-- No client policies — only SECURITY DEFINER RPCs touch this table.

-- ── RPC: dm_send_message ────────────────────────────────────────────────────
-- Runs the full moderation stack inline. Returns the moderation verdict the
-- caller already computed alongside the body (clean | flagged | blocked) so
-- the client can route to display or drop. Audit-logs flagged + blocked.
--
-- Gates, in order:
--   1. authenticated
--   2. body length 1..25 and not whitespace
--   3. moderation verdict is one of clean | flagged | blocked
--   4. sender dm_verified = true
--   5. sender is NOT in target.dm_blocked
--   6. target is NOT in sender.dm_blocked (you can't DM someone you blocked)
--   7. rate limit: < 30 messages / 60 s in this pair direction
--
-- Returns the verdict (always equal to p_moderation if it survived gating)
-- and an `accepted` bool so the client knows whether to render the message
-- locally.
CREATE OR REPLACE FUNCTION public.dm_send_message(
  p_to         UUID,
  p_room       TEXT,
  p_body       TEXT,
  p_moderation TEXT
)
RETURNS TABLE (accepted BOOLEAN, verdict TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  v_uid           UUID := auth.uid();
  v_dm_verified   BOOLEAN;
  v_sender_blocks UUID[];
  v_target_blocks UUID[];
  v_count         INT;
  v_window_start  TIMESTAMPTZ;
BEGIN
  -- 1. authenticated
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_to IS NULL OR p_to = v_uid THEN
    RAISE EXCEPTION 'invalid target';
  END IF;

  -- 2. body length + non-empty
  IF p_body IS NULL OR length(trim(p_body)) = 0 OR length(p_body) > 25 THEN
    RAISE EXCEPTION 'invalid message length';
  END IF;

  -- 3. verdict whitelist
  IF p_moderation NOT IN ('clean', 'flagged', 'blocked') THEN
    RAISE EXCEPTION 'invalid moderation verdict';
  END IF;

  IF p_room IS NULL OR length(p_room) = 0 OR length(p_room) > 64 THEN
    RAISE EXCEPTION 'invalid room id';
  END IF;

  -- 4. sender dm_verified
  SELECT dm_verified, dm_blocked INTO v_dm_verified, v_sender_blocks
    FROM public.profiles WHERE id = v_uid;
  IF NOT COALESCE(v_dm_verified, FALSE) THEN
    RAISE EXCEPTION 'sender not dm-verified';
  END IF;

  -- 5. target's block list (silent drop — we still return accepted=false so
  --    the sender sees no signal that they're blocked)
  SELECT dm_blocked INTO v_target_blocks FROM public.profiles WHERE id = p_to;
  IF v_target_blocks IS NULL THEN
    RAISE EXCEPTION 'target user missing profile';
  END IF;
  IF v_uid = ANY(v_target_blocks) THEN
    RETURN QUERY SELECT FALSE, 'blocked'::TEXT;
    RETURN;
  END IF;

  -- 6. sender's own block list
  IF p_to = ANY(COALESCE(v_sender_blocks, '{}'::UUID[])) THEN
    RAISE EXCEPTION 'recipient is blocked by you';
  END IF;

  -- 7. rate limit (30/min/pair)
  SELECT window_start, count INTO v_window_start, v_count
    FROM public.dm_rate_counter
   WHERE from_user = v_uid AND to_user = p_to
   FOR UPDATE;

  IF v_window_start IS NULL OR NOW() - v_window_start > INTERVAL '60 seconds' THEN
    INSERT INTO public.dm_rate_counter (from_user, to_user, window_start, count)
      VALUES (v_uid, p_to, NOW(), 1)
      ON CONFLICT (from_user, to_user) DO UPDATE
        SET window_start = EXCLUDED.window_start,
            count        = 1;
  ELSIF v_count >= 30 THEN
    RAISE EXCEPTION 'rate limit exceeded';
  ELSE
    UPDATE public.dm_rate_counter
       SET count = count + 1
     WHERE from_user = v_uid AND to_user = p_to;
  END IF;

  -- audit-log flagged + blocked (clean is session-only per spec)
  IF p_moderation IN ('flagged', 'blocked') THEN
    INSERT INTO public.dm_messages (room_id, from_user, to_user, body, moderation)
      VALUES (p_room, v_uid, p_to, LEFT(p_body, 200), p_moderation);
  END IF;

  -- blocked verdicts do not reach the recipient
  IF p_moderation = 'blocked' THEN
    RETURN QUERY SELECT FALSE, 'blocked'::TEXT;
  ELSE
    RETURN QUERY SELECT TRUE, p_moderation;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dm_send_message(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- ── RPC: dm_block_user ──────────────────────────────────────────────────────
-- Adds a UUID to profiles.dm_blocked. Cap at 256 entries per docs/lore/015.
-- Idempotent — blocking someone already on the list is a no-op.
CREATE OR REPLACE FUNCTION public.dm_block_user(p_target UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_blocked   UUID[];
  v_max_size  CONSTANT INT := 256;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_target IS NULL OR p_target = v_uid THEN
    RAISE EXCEPTION 'invalid target';
  END IF;

  SELECT dm_blocked INTO v_blocked FROM public.profiles WHERE id = v_uid;
  v_blocked := COALESCE(v_blocked, '{}'::UUID[]);

  IF p_target = ANY(v_blocked) THEN
    RETURN;
  END IF;

  IF array_length(v_blocked, 1) >= v_max_size THEN
    RAISE EXCEPTION 'block list full';
  END IF;

  UPDATE public.profiles
     SET dm_blocked = array_append(v_blocked, p_target),
         updated_at = NOW()
   WHERE id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dm_block_user(UUID) TO authenticated;

-- ── RPC: dm_unblock_user ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dm_unblock_user(p_target UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_target IS NULL THEN
    RAISE EXCEPTION 'invalid target';
  END IF;

  UPDATE public.profiles
     SET dm_blocked = array_remove(COALESCE(dm_blocked, '{}'::UUID[]), p_target),
         updated_at = NOW()
   WHERE id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dm_unblock_user(UUID) TO authenticated;

-- ── RPC: dm_list_blocked ────────────────────────────────────────────────────
-- Returns the caller's blocked uuids joined with display names for the
-- BlockedListPanel UI. Returns zero rows for guests.
CREATE OR REPLACE FUNCTION public.dm_list_blocked()
RETURNS TABLE (user_id UUID, display_name TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT p.id, p.display_name
      FROM public.profiles caller
      CROSS JOIN LATERAL unnest(COALESCE(caller.dm_blocked, '{}'::UUID[])) AS blocked_id
      JOIN public.profiles p ON p.id = blocked_id
     WHERE caller.id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dm_list_blocked() TO authenticated;

-- ── RPC: admin_list_dm_reports ──────────────────────────────────────────────
-- Owner-only review queue. Returns flagged + blocked messages newest first,
-- bounded to the last `p_days` days (default 14) so the result stays small.
CREATE OR REPLACE FUNCTION public.admin_list_dm_reports(p_days INT DEFAULT 14)
RETURNS TABLE (
  id         UUID,
  room_id    TEXT,
  from_user  UUID,
  to_user    UUID,
  body       TEXT,
  moderation TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  IF p_days <= 0 OR p_days > 365 THEN
    RAISE EXCEPTION 'invalid days window';
  END IF;
  RETURN QUERY
    SELECT m.id, m.room_id, m.from_user, m.to_user, m.body, m.moderation, m.created_at
      FROM public.dm_messages m
     WHERE m.moderation IN ('flagged', 'blocked')
       AND m.created_at > NOW() - (p_days || ' days')::INTERVAL
     ORDER BY m.created_at DESC
     LIMIT 500;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_dm_reports(INT) TO authenticated;

-- ── housekeeping: stale rate-counter rows ──────────────────────────────────
-- Expose a maintenance function the owner can run periodically (or wire to
-- pg_cron if it's enabled). Drops counter rows whose window expired > 5 min
-- ago. Cheap; no privileges granted to clients.
CREATE OR REPLACE FUNCTION public.dm_rate_counter_gc()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_n INT;
BEGIN
  DELETE FROM public.dm_rate_counter
   WHERE window_start < NOW() - INTERVAL '5 minutes';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;
