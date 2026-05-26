-- 0004 — editable NPC dialogue (admin console phase 2, devlog 0048)
--
-- Stores admin-authored overrides for scripted NPC dialogue, keyed by a stable
-- registry key (see apps/web/src/dialogue.ts). The client reads overrides and
-- falls back to the in-code defaults, so the table only needs rows the owner
-- has actually edited.
--
-- SECURITY: dialogue is player-facing, so it's world-readable; only admins may
-- write (RLS via is_admin(), migration 0003). Admin-authored content is exempt
-- from the no-free-text moderation rule (owner-only).

CREATE TABLE IF NOT EXISTS public.dialogue (
  key TEXT PRIMARY KEY,
  lines JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.dialogue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dialogue_read_all" ON public.dialogue;
CREATE POLICY "dialogue_read_all" ON public.dialogue
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "dialogue_admin_update" ON public.dialogue;
CREATE POLICY "dialogue_admin_update" ON public.dialogue
  FOR UPDATE USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "dialogue_admin_insert" ON public.dialogue;
CREATE POLICY "dialogue_admin_insert" ON public.dialogue
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
