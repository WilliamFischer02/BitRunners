-- 0005 — sign-on activity log (admin console phase 4, devlog 0050)
--
-- Lightweight event log: one row per sign-in, no PII beyond the user_id FK.
-- Used by the admin console activity-stats panel to show daily active users.
--
-- SECURITY:
--   INSERT: users may only log their own rows (auth.uid() = user_id).
--   SELECT: admin-only (is_admin() from migration 0003). No public read.
--   No UPDATE / DELETE policies — the log is append-only.

CREATE TABLE IF NOT EXISTS public.sign_on_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signed_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for admin daily-aggregation query (last N days, grouped by day)
CREATE INDEX IF NOT EXISTS sign_on_log_at ON public.sign_on_log (signed_in_at DESC);

ALTER TABLE public.sign_on_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sign_on_log_insert_own" ON public.sign_on_log;
CREATE POLICY "sign_on_log_insert_own" ON public.sign_on_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "sign_on_log_admin_read" ON public.sign_on_log;
CREATE POLICY "sign_on_log_admin_read" ON public.sign_on_log
  FOR SELECT USING (public.is_admin(auth.uid()));
