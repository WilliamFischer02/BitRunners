-- 0003 — admin role + global app config (admin console, devlog 0047)
--
-- Foundation for the owner-only admin console. SECURITY: privilege lives in the
-- DB (profiles.role) + RLS, never in the client. The client can READ its own
-- role (to decide whether to show admin UI) but CANNOT set it, and admin-only
-- writes (e.g. the construction flag) are enforced by policy, not by the UI.

-- Role on profiles. Settable only via the SQL editor / service role (no client
-- UPDATE policy grants it — see note below).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'dev', 'admin'));

-- Helpers: SECURITY DEFINER so a policy can check a caller's role without the
-- caller needing to read others' profile rows. STABLE; pinned search_path.
CREATE OR REPLACE FUNCTION public.is_admin(uid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_dev_or_admin(uid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND role IN ('dev', 'admin'));
$$;

-- Global key/value config. The under_construction flag gates the whole app, so
-- it must be readable by everyone (incl. anon); only admins may write it.
CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO public.app_config (key, value) VALUES ('under_construction', 'false'::jsonb)
  ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_config_read_all" ON public.app_config;
CREATE POLICY "app_config_read_all" ON public.app_config
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "app_config_admin_update" ON public.app_config;
CREATE POLICY "app_config_admin_update" ON public.app_config
  FOR UPDATE USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "app_config_admin_insert" ON public.app_config;
CREATE POLICY "app_config_admin_insert" ON public.app_config
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

-- ── OWNER: after signing up, make yourself admin (run once) ──
--   UPDATE public.profiles SET role = 'admin'
--   WHERE id = (SELECT id FROM auth.users WHERE email = 'you@example.com');
