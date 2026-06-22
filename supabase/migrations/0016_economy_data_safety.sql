-- 0016 — player_economy data-safety: history + capture trigger + guarded save +
--        admin restore (incident response, devlog 0092)
--
-- ⚠️  NOT AUTO-APPLIED. Owner runs this in the Supabase SQL editor. Idempotent.
--
-- WHY
-- player_economy is a single client-trusted JSONB blob, written by the client as
-- a last-write-wins upsert (policies economy_insert_own / economy_update_own,
-- migration 0002) with NO trigger, NO history, NO validation. A client that
-- syncs a fresh/empty/default blob (cache cleared, reinstall, new device, or a
-- load-before-fetch race) silently and PERMANENTLY overwrites good progress, and
-- nothing snapshots the prior value, so it is unrecoverable. This migration adds
-- the missing safety net.
--
-- ROLLOUT (important)
--   * The history TRIGGER protects you immediately — every overwrite is now
--     snapshotted even while the client keeps doing raw upserts. No client
--     change needed for RECOVERY to work.
--   * save_economy() is the guarded write path. PREVENTION (rejecting bad
--     writes) only kicks in once the client calls this RPC instead of the raw
--     upsert. Phase 2 (after the client switches) revokes the direct
--     INSERT/UPDATE grants — left commented at the bottom so we don't break the
--     current client today.

-- ── 1. history table (append-only snapshots of prior blobs) ─────────────────
CREATE TABLE IF NOT EXISTS public.player_economy_history (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blob            JSONB NOT NULL,
  blob_updated_at TIMESTAMPTZ,            -- updated_at of the row being replaced
  captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason          TEXT NOT NULL DEFAULT 'overwrite'  -- overwrite | pre-restore | manual
);
CREATE INDEX IF NOT EXISTS pe_history_user_idx
  ON public.player_economy_history (user_id, captured_at DESC);

ALTER TABLE public.player_economy_history ENABLE ROW LEVEL SECURITY;
-- No client policy: history is reachable only via the admin SECURITY DEFINER
-- RPCs below (and service_role). Deny-all to anon/authenticated by default.

-- ── 2. capture trigger: snapshot OLD.blob before it is overwritten ───────────
-- AFTER UPDATE only. We intentionally do NOT capture on DELETE: a user delete
-- cascades from auth.users and the history FK would be gone too — and clobbers,
-- not deletes, are the loss vector we are protecting against.
CREATE OR REPLACE FUNCTION public.capture_economy_history()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.blob IS DISTINCT FROM NEW.blob THEN
    INSERT INTO public.player_economy_history (user_id, blob, blob_updated_at, reason)
    VALUES (OLD.user_id, OLD.blob, OLD.updated_at, 'overwrite');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS player_economy_capture_history ON public.player_economy;
CREATE TRIGGER player_economy_capture_history
  AFTER UPDATE ON public.player_economy
  FOR EACH ROW EXECUTE FUNCTION public.capture_economy_history();

-- ── 3. guarded save RPC (the safe write path the client should adopt) ────────
-- Returns (accepted, reason, server_updated_at). On accepted=false the client
-- MUST NOT keep trying to write that blob — it should re-fetch the server state.
-- Guards:
--   * optimistic concurrency: reject blobs whose updatedAt is OLDER than stored
--     (a stale device cannot overwrite newer progress).
--   * anti-rollback: reject blobs whose lifetimeScrapes is LOWER than stored
--     (lifetime counters never decrease, so a fresh/empty blob is rejected —
--     this is the direct fix for the clobber).
--   * shape + size validation.
CREATE OR REPLACE FUNCTION public.save_economy(p_blob JSONB)
RETURNS TABLE (accepted BOOLEAN, reason TEXT, server_updated_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_old          JSONB;
  v_old_updated  TIMESTAMPTZ;
  v_old_ms       NUMERIC;
  v_new_ms       NUMERIC;
  v_old_scrapes  NUMERIC;
  v_new_scrapes  NUMERIC;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_blob IS NULL OR jsonb_typeof(p_blob) <> 'object' THEN
    RAISE EXCEPTION 'invalid blob (must be a json object)';
  END IF;
  IF pg_column_size(p_blob) > 131072 THEN          -- 128 KB hard cap
    RAISE EXCEPTION 'blob too large';
  END IF;

  SELECT blob, updated_at INTO v_old, v_old_updated
    FROM public.player_economy WHERE user_id = v_uid FOR UPDATE;

  IF v_old IS NOT NULL THEN
    v_old_ms      := COALESCE((v_old  ->> 'updatedAt')::NUMERIC, 0);
    v_new_ms      := COALESCE((p_blob ->> 'updatedAt')::NUMERIC, 0);
    v_old_scrapes := COALESCE((v_old  ->> 'lifetimeScrapes')::NUMERIC, 0);
    v_new_scrapes := COALESCE((p_blob ->> 'lifetimeScrapes')::NUMERIC, 0);

    IF v_new_ms < v_old_ms THEN
      RETURN QUERY SELECT FALSE, 'stale: server has a newer snapshot', v_old_updated;
      RETURN;
    END IF;

    IF v_old_scrapes > 0 AND v_new_scrapes < v_old_scrapes THEN
      RETURN QUERY SELECT FALSE, 'rejected: lifetime counter rollback (possible clobber)', v_old_updated;
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.player_economy (user_id, blob, updated_at)
    VALUES (v_uid, p_blob, NOW())
    ON CONFLICT (user_id) DO UPDATE SET blob = EXCLUDED.blob, updated_at = NOW();

  RETURN QUERY SELECT TRUE, 'ok', NOW();
END;
$$;
REVOKE ALL ON FUNCTION public.save_economy(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_economy(JSONB) TO authenticated;

-- ── 4. admin: browse a user's snapshots ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_list_economy_history(p_user UUID, p_limit INT DEFAULT 50)
RETURNS TABLE (
  id              BIGINT,
  captured_at     TIMESTAMPTZ,
  reason          TEXT,
  blob_bytes      INT,
  credits         TEXT,
  tokens          TEXT,
  lifetime_scrapes TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  RETURN QUERY
    SELECT h.id, h.captured_at, h.reason, pg_column_size(h.blob),
           h.blob ->> 'credits', h.blob ->> 'tokens', h.blob ->> 'lifetimeScrapes'
      FROM public.player_economy_history h
     WHERE h.user_id = p_user
     ORDER BY h.captured_at DESC
     LIMIT GREATEST(1, LEAST(p_limit, 500));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_economy_history(UUID, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_economy_history(UUID, INT) TO authenticated;

-- ── 5. admin: restore a snapshot (itself reversible — snapshots current first)
CREATE OR REPLACE FUNCTION public.admin_restore_economy(p_user UUID, p_history_id BIGINT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_blob JSONB;
  v_cur  JSONB;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  IF p_history_id IS NULL THEN     -- default: most recent snapshot
    SELECT blob INTO v_blob FROM public.player_economy_history
      WHERE user_id = p_user ORDER BY captured_at DESC LIMIT 1;
  ELSE
    SELECT blob INTO v_blob FROM public.player_economy_history
      WHERE id = p_history_id AND user_id = p_user;
  END IF;
  IF v_blob IS NULL THEN
    RAISE EXCEPTION 'no matching history snapshot for that user';
  END IF;

  -- Snapshot the CURRENT blob first so a restore can itself be undone. We insert
  -- directly (not via the trigger) so the reason is explicit.
  SELECT blob INTO v_cur FROM public.player_economy WHERE user_id = p_user;
  IF v_cur IS NOT NULL THEN
    INSERT INTO public.player_economy_history (user_id, blob, reason)
    VALUES (p_user, v_cur, 'pre-restore');
  END IF;

  INSERT INTO public.player_economy (user_id, blob, updated_at)
    VALUES (p_user, v_blob, NOW())
    ON CONFLICT (user_id) DO UPDATE SET blob = EXCLUDED.blob, updated_at = NOW();

  RETURN v_blob;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_restore_economy(UUID, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_restore_economy(UUID, BIGINT) TO authenticated;

-- ── 6. OPTIONAL: prune old snapshots (keep newest 50 per user) ───────────────
-- History grows one row per accepted overwrite. Negligible now; wire to pg_cron
-- or run manually if it ever grows. Owner/cron only.
CREATE OR REPLACE FUNCTION public.prune_economy_history(p_keep INT DEFAULT 50)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n INT;
BEGIN
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY captured_at DESC) AS rn
      FROM public.player_economy_history
  )
  DELETE FROM public.player_economy_history h
   USING ranked r
   WHERE h.id = r.id AND r.rn > GREATEST(1, p_keep);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.prune_economy_history(INT) FROM PUBLIC, anon, authenticated;

-- ── 7. PHASE 2 (DO NOT RUN until the web client calls save_economy()) ───────
-- Once the client writes through save_economy() instead of the raw upsert,
-- make the guard mandatory by removing the direct write grants. Until then this
-- stays commented or the current client breaks.
-- DROP POLICY IF EXISTS "economy_insert_own" ON public.player_economy;
-- DROP POLICY IF EXISTS "economy_update_own" ON public.player_economy;
-- (economy_select_own stays — the client still reads its own row directly.)
