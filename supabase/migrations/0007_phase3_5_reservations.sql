-- 0007 — Phase 3.5 reservations (badges, themes, missions, hack-QTE, DMs, dictionary)
--
-- See docs/lore/010..016 for canon. This migration RESERVES all columns and
-- tables for the Phase 3.5 → Phase 4 roadmap so we never bump schema later in
-- the cycle. Some surfaces ship UI in the same window (Sub-Phase B uses
-- display_name + emoticron_dictionary). Others reserve for later sub-phases.
--
-- SECURITY (mirrors 0006):
--   * Every privileged write goes through a SECURITY DEFINER RPC that
--     re-checks ownership / is_admin server-side.
--   * Column lockdown on `profiles`: revoke broad UPDATE, re-grant ONLY the
--     columns the self-service flow legitimately needs. equipped_badge,
--     equipped_theme, samaritan_*, hack_qte_streak, dm_verified are writable
--     only via the SECURITY DEFINER functions below; service_role bypasses.
--   * Owner-only review queues are gated by is_admin(auth.uid()).
--
-- Apply order: this file replaces 0006's `REVOKE UPDATE ... GRANT UPDATE(...)`
-- with a tighter list. The grant list MUST stay narrow.

-- ── extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── profiles: badge + theme + samaritan + dm + qte ──────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS equipped_badge      TEXT,            -- 'corp:bronze' | 'br:silver' | NULL
  ADD COLUMN IF NOT EXISTS equipped_theme      TEXT,            -- 'terminal_green' | NULL
  ADD COLUMN IF NOT EXISTS samaritan_corporate INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS samaritan_bitrunner INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hack_qte_streak     INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dm_verified         BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dm_blocked          UUID[] NOT NULL DEFAULT '{}';

-- ── column-grant lockdown (tighter than 0006) ───────────────────────────────
-- 0006 granted UPDATE(display_name, display_name_status, display_name_note).
-- Add `dm_blocked` so users can self-manage their block list, but nothing else.
-- Every other writable column flows through a SECURITY DEFINER RPC below.
REVOKE UPDATE ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT UPDATE (display_name, display_name_status, display_name_note, dm_blocked)
  ON public.profiles TO authenticated;

-- ── earned_badges (per-user badge unlocks + acknowledgement flag) ───────────
CREATE TABLE IF NOT EXISTS public.earned_badges (
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_key    TEXT NOT NULL,                      -- 'corp:wood' .. 'br:aether'
  earned_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged BOOLEAN NOT NULL DEFAULT FALSE,     -- false → '!' dot on label
  PRIMARY KEY (user_id, badge_key),
  CHECK (badge_key ~ '^(corp|br):(wood|stone|bronze|steel|silver|gold|platinum|diamond|obsidian|aether)$')
);
CREATE INDEX IF NOT EXISTS earned_badges_user_unack_idx
  ON public.earned_badges (user_id) WHERE acknowledged = FALSE;

ALTER TABLE public.earned_badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "earned_badges_select_own" ON public.earned_badges;
CREATE POLICY "earned_badges_select_own" ON public.earned_badges
  FOR SELECT USING (auth.uid() = user_id);
-- No client INSERT/UPDATE/DELETE policy — all writes via SECURITY DEFINER.

-- ── owned_themes ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.owned_themes (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme_key   TEXT NOT NULL,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, theme_key)
);
ALTER TABLE public.owned_themes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owned_themes_select_own" ON public.owned_themes;
CREATE POLICY "owned_themes_select_own" ON public.owned_themes
  FOR SELECT USING (auth.uid() = user_id);

-- ── emoticron_dictionary (seed words for usernames + emoticron combos) ──────
CREATE TABLE IF NOT EXISTS public.emoticron_dictionary (
  word     TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('emote', 'object', 'action', 'name'))
);
ALTER TABLE public.emoticron_dictionary ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dictionary_select_all" ON public.emoticron_dictionary;
CREATE POLICY "dictionary_select_all" ON public.emoticron_dictionary
  FOR SELECT USING (TRUE);

-- Seed the ~100-word dictionary from docs/lore/014.
-- ON CONFLICT lets us re-run this migration safely if the owner has touched rows.
INSERT INTO public.emoticron_dictionary (word, category) VALUES
  -- emote (32)
  ('happy','emote'),('tired','emote'),('broken','emote'),('online','emote'),
  ('offline','emote'),('cold','emote'),('warm','emote'),('cool','emote'),
  ('bright','emote'),('dark','emote'),('loud','emote'),('quiet','emote'),
  ('sharp','emote'),('dull','emote'),('fast','emote'),('slow','emote'),
  ('dim','emote'),('glowing','emote'),('flickering','emote'),('stable','emote'),
  ('unstable','emote'),('corrupted','emote'),('clean','emote'),('dirty','emote'),
  ('safe','emote'),('risky','emote'),('lucky','emote'),('cursed','emote'),
  ('numb','emote'),('awake','emote'),('drifting','emote'),('humming','emote'),
  -- object (32)
  ('port','object'),('depot','object'),('token','object'),('cache','object'),
  ('string','object'),('serial','object'),('passcode','object'),('signal','object'),
  ('shard','object'),('pulse','object'),('node','object'),('loop','object'),
  ('mesh','object'),('wire','object'),('frame','object'),('glyph','object'),
  ('bit','object'),('byte','object'),('packet','object'),('relay','object'),
  ('ledger','object'),('vault','object'),('kiosk','object'),('obelisk','object'),
  ('monolith','object'),('terminal','object'),('console','object'),('cursor','object'),
  ('prompt','object'),('socket','object'),('tunnel','object'),('gate','object'),
  -- action (16)
  ('run','action'),('ping','action'),('drop','action'),('scrape','action'),
  ('kick','action'),('pull','action'),('push','action'),('read','action'),
  ('write','action'),('clear','action'),('flush','action'),('bounce','action'),
  ('tag','action'),('mark','action'),('seed','action'),('harvest','action'),
  -- name (20)
  ('runner','name'),('walker','name'),('seeker','name'),('keeper','name'),
  ('breaker','name'),('maker','name'),('watcher','name'),('whisper','name'),
  ('echo','name'),('glitch','name'),('static','name'),('aether','name'),
  ('cipher','name'),('prism','name'),('vector','name'),('axis','name'),
  ('orbit','name'),('rune','name'),('nova','name'),('halo','name')
ON CONFLICT (word) DO NOTHING;

-- ── mission_progress ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mission_progress (
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_key     TEXT NOT NULL,
  state           TEXT NOT NULL CHECK (state IN ('active', 'final', 'complete')),
  last_checkpoint INT NOT NULL DEFAULT 0,
  faction_choice  TEXT CHECK (faction_choice IN ('corporate', 'bitrunner')),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, mission_key)
);
ALTER TABLE public.mission_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mission_progress_select_own" ON public.mission_progress;
CREATE POLICY "mission_progress_select_own" ON public.mission_progress
  FOR SELECT USING (auth.uid() = user_id);

-- ── dm_messages (free-text DM audit; canon-reversal per docs/lore/015) ──────
CREATE TABLE IF NOT EXISTS public.dm_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    TEXT NOT NULL,
  from_user  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  moderation TEXT NOT NULL CHECK (moderation IN ('clean', 'flagged', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS dm_messages_room_idx
  ON public.dm_messages (room_id, created_at);
CREATE INDEX IF NOT EXISTS dm_messages_moderation_idx
  ON public.dm_messages (moderation) WHERE moderation != 'clean';

ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;
-- Participants may read messages they sent or received.
DROP POLICY IF EXISTS "dm_messages_select_participant" ON public.dm_messages;
CREATE POLICY "dm_messages_select_participant" ON public.dm_messages
  FOR SELECT USING (auth.uid() = from_user OR auth.uid() = to_user);
-- No client INSERT — all messages flow through the server-side moderation RPC.

-- ── hack_qte_attempts (audit log of QTE wins / fails) ───────────────────────
CREATE TABLE IF NOT EXISTS public.hack_qte_attempts (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  result     TEXT NOT NULL CHECK (result IN ('win', 'fail')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS hack_qte_attempts_user_idx
  ON public.hack_qte_attempts (user_id, created_at DESC);

ALTER TABLE public.hack_qte_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hack_qte_select_own" ON public.hack_qte_attempts;
CREATE POLICY "hack_qte_select_own" ON public.hack_qte_attempts
  FOR SELECT USING (auth.uid() = user_id);

-- ── mission_witnesses (RESERVED — no UI in this roadmap) ────────────────────
CREATE TABLE IF NOT EXISTS public.mission_witnesses (
  mission_id      UUID NOT NULL,
  witness_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (mission_id, witness_user_id)
);
ALTER TABLE public.mission_witnesses ENABLE ROW LEVEL SECURITY;
-- Reserved: no policies, no client access.

-- ── default display_name generator on signup ────────────────────────────────
-- The existing handle_new_user() trigger (migration 0001) inserts a profile
-- row with NULL display_name. Set the visible default to `runner_<6 chars>`
-- so newly signed-up runners get a non-empty placeholder.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, display_name_status)
    VALUES (
      NEW.id,
      'runner_' || substring(NEW.id::text, 1, 6),
      'approved'  -- the auto-assigned placeholder is implicitly approved
    )
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.equipped_outfit (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.samaritan_status (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

  -- Seed the 4 base ship-with-the-game emoticrons (matches docs/lore/014).
  INSERT INTO public.unlocked_emoticrons (user_id, emoticron_key) VALUES
    (NEW.id, 'happy'),
    (NEW.id, 'tired'),
    (NEW.id, 'okay'),
    (NEW.id, 'help')
  ON CONFLICT (user_id, emoticron_key) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Backfill: existing profile rows with NULL display_name get the default.
UPDATE public.profiles
   SET display_name = 'runner_' || substring(id::text, 1, 6),
       display_name_status = 'approved'
 WHERE display_name IS NULL;

-- ── RPC: submit_display_name (user requests a name change) ──────────────────
-- Marks display_name_status = 'pending' with the requested name. The world
-- keeps showing the previously-approved name (or the auto-assigned placeholder)
-- until the owner approves via admin_approve_name(). This intentionally hides
-- unapproved names from public view.
CREATE OR REPLACE FUNCTION public.submit_display_name(p_name TEXT)
RETURNS VOID AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_name IS NULL OR length(p_name) < 3 OR length(p_name) > 24 THEN
    RAISE EXCEPTION 'invalid name length';
  END IF;
  IF p_name !~ '^[a-z0-9_]+$' THEN
    RAISE EXCEPTION 'invalid name characters';
  END IF;
  UPDATE public.profiles
     SET display_name_note = p_name,
         display_name_status = 'pending',
         updated_at = NOW()
   WHERE id = v_uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── RPC: admin_list_pending_names (owner sees the username queue) ───────────
CREATE OR REPLACE FUNCTION public.admin_list_pending_names()
RETURNS TABLE (
  id           UUID,
  current_name TEXT,
  requested    TEXT,
  submitted_at TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  RETURN QUERY
    SELECT p.id,
           p.display_name        AS current_name,
           p.display_name_note   AS requested,
           p.updated_at          AS submitted_at
      FROM public.profiles p
     WHERE p.display_name_status = 'pending'
     ORDER BY p.updated_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── RPC: admin_approve_name / admin_reject_name ─────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_approve_name(target UUID)
RETURNS VOID AS $$
DECLARE
  v_requested TEXT;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  SELECT display_name_note INTO v_requested FROM public.profiles WHERE id = target;
  IF v_requested IS NULL THEN
    RAISE EXCEPTION 'no pending name';
  END IF;
  UPDATE public.profiles
     SET display_name        = v_requested,
         display_name_status = 'approved',
         display_name_note   = NULL,
         updated_at          = NOW()
   WHERE id = target;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.admin_reject_name(target UUID, p_note TEXT)
RETURNS VOID AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  UPDATE public.profiles
     SET display_name_status = 'rejected',
         display_name_note   = COALESCE(p_note, 'rejected'),
         updated_at          = NOW()
   WHERE id = target;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── RPC: equip_badge / acknowledge_badge ────────────────────────────────────
-- equip_badge writes profiles.equipped_badge only if the user actually owns
-- the badge (row exists in earned_badges).
CREATE OR REPLACE FUNCTION public.equip_badge(p_key TEXT)
RETURNS VOID AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_key IS NOT NULL AND p_key != '' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.earned_badges
       WHERE user_id = v_uid AND badge_key = p_key
    ) THEN
      RAISE EXCEPTION 'badge not owned';
    END IF;
  END IF;
  UPDATE public.profiles
     SET equipped_badge = NULLIF(p_key, ''),
         updated_at = NOW()
   WHERE id = v_uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.acknowledge_badge(p_key TEXT)
RETURNS VOID AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  UPDATE public.earned_badges
     SET acknowledged = TRUE
   WHERE user_id = v_uid AND badge_key = p_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── RPC: get_my_identity (client reads its own profile fields in one trip) ──
CREATE OR REPLACE FUNCTION public.get_my_identity()
RETURNS TABLE (
  display_name        TEXT,
  display_name_status TEXT,
  display_name_note   TEXT,
  equipped_badge      TEXT,
  equipped_theme      TEXT,
  samaritan_corporate INT,
  samaritan_bitrunner INT,
  unacknowledged      INT
) AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT p.display_name,
           p.display_name_status,
           p.display_name_note,
           p.equipped_badge,
           p.equipped_theme,
           p.samaritan_corporate,
           p.samaritan_bitrunner,
           (SELECT COUNT(*)::INT FROM public.earned_badges eb
             WHERE eb.user_id = v_uid AND eb.acknowledged = FALSE)
      FROM public.profiles p
     WHERE p.id = v_uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── RPC: get_my_badges (returns owned badges for the BadgeStrip UI) ─────────
CREATE OR REPLACE FUNCTION public.get_my_badges()
RETURNS TABLE (
  badge_key    TEXT,
  earned_at    TIMESTAMPTZ,
  acknowledged BOOLEAN
) AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT eb.badge_key, eb.earned_at, eb.acknowledged
      FROM public.earned_badges eb
     WHERE eb.user_id = v_uid
     ORDER BY eb.earned_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant EXECUTE on the new RPCs.
GRANT EXECUTE ON FUNCTION public.submit_display_name(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_pending_names() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_name(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_name(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equip_badge(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.acknowledge_badge(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_identity() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_badges() TO authenticated;
