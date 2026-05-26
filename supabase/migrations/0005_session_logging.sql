-- 0005 — session event logging (admin console phase 4, devlog 0050)
--
-- Records sign-in events so the admin console can display daily active-user
-- (DAU) counts. The table is insert-only from the client; only admins may
-- read the aggregate data.
--
-- SECURITY:
--   - Users can only insert their own rows (auth.uid() = user_id).
--   - No user SELECT policy — users cannot read their own or others' events.
--   - Admins read via get_daily_signins() SECURITY DEFINER (re-checks role).
--   - No client-visible raw rows: the aggregate function returns bucketed counts.

CREATE TABLE IF NOT EXISTS public.session_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.session_events ENABLE ROW LEVEL SECURITY;

-- Users may log their own sign-in events; no SELECT for ordinary users.
DROP POLICY IF EXISTS "session_events_insert_own" ON public.session_events;
CREATE POLICY "session_events_insert_own" ON public.session_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins may read all rows (for the aggregate function to use internally).
DROP POLICY IF EXISTS "session_events_admin_select" ON public.session_events;
CREATE POLICY "session_events_admin_select" ON public.session_events
  FOR SELECT USING (public.is_admin(auth.uid()));

-- Aggregate: daily active users (distinct users per calendar day) for the
-- last N days. Returns rows ordered newest-first.
-- SECURITY DEFINER so the caller doesn't need SELECT on session_events; the
-- function re-checks the caller's admin role before returning data.
CREATE OR REPLACE FUNCTION public.get_daily_signins(days_back INT DEFAULT 30)
RETURNS TABLE(day DATE, dau BIGINT)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;
  RETURN QUERY
    SELECT occurred_at::DATE AS day,
           COUNT(DISTINCT user_id)::BIGINT AS dau
    FROM public.session_events
    WHERE occurred_at >= NOW() - (days_back || ' days')::INTERVAL
    GROUP BY occurred_at::DATE
    ORDER BY occurred_at::DATE DESC;
END;
$$;
