-- BitRunners — initial schema for Supabase Postgres
-- Run from Supabase dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run: every CREATE uses IF NOT EXISTS where supported.
--
-- Tables:
--   profiles                 — public-facing display name (10 chars) + approval status
--   inventory                — items the user owns
--   equipped_outfit          — currently equipped per slot
--   achievements             — unlocked achievements per faction
--   samaritan_status         — corporate / bitrunner reputation
--   emoticron_submissions    — custom 2-word combos awaiting owner approval
--   unlocked_emoticrons      — base + approved custom emoticrons available to the player
--
-- RLS is enabled. Users can only read/write their own rows via auth.uid().
-- Admin actions (approving names, approving emoticrons) use the service-role key.

-- ──────────── extensions ────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ──────────── tables ────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  display_name_status TEXT NOT NULL DEFAULT 'unset'
    CHECK (display_name_status IN ('unset', 'pending', 'approved', 'rejected')),
  display_name_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('outfit', 'consumable', 'key', 'cosmetic')),
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, item_id)
);
CREATE INDEX IF NOT EXISTS inventory_user_idx ON public.inventory (user_id);

CREATE TABLE IF NOT EXISTS public.equipped_outfit (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  slots JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  faction TEXT NOT NULL CHECK (faction IN ('admin', 'company')),
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, achievement_id)
);
CREATE INDEX IF NOT EXISTS achievements_user_idx ON public.achievements (user_id);

CREATE TABLE IF NOT EXISTS public.samaritan_status (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  corporate INTEGER NOT NULL DEFAULT 0,
  bitrunner INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.emoticron_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word_a TEXT NOT NULL,
  word_b TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_note TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS emoticron_submissions_user_idx
  ON public.emoticron_submissions (user_id);
CREATE INDEX IF NOT EXISTS emoticron_submissions_status_idx
  ON public.emoticron_submissions (status) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.unlocked_emoticrons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoticron_key TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, emoticron_key)
);
CREATE INDEX IF NOT EXISTS unlocked_emoticrons_user_idx
  ON public.unlocked_emoticrons (user_id);

-- ──────────── row level security ────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipped_outfit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.samaritan_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emoticron_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unlocked_emoticrons ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND display_name_status IN ('unset', 'pending'));

-- inventory
DROP POLICY IF EXISTS "inventory_select_own" ON public.inventory;
CREATE POLICY "inventory_select_own" ON public.inventory
  FOR SELECT USING (auth.uid() = user_id);

-- equipped_outfit
DROP POLICY IF EXISTS "outfit_select_own" ON public.equipped_outfit;
CREATE POLICY "outfit_select_own" ON public.equipped_outfit
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "outfit_update_own" ON public.equipped_outfit;
CREATE POLICY "outfit_update_own" ON public.equipped_outfit
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "outfit_insert_own" ON public.equipped_outfit;
CREATE POLICY "outfit_insert_own" ON public.equipped_outfit
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- achievements
DROP POLICY IF EXISTS "achievements_select_own" ON public.achievements;
CREATE POLICY "achievements_select_own" ON public.achievements
  FOR SELECT USING (auth.uid() = user_id);

-- samaritan_status
DROP POLICY IF EXISTS "samaritan_select_own" ON public.samaritan_status;
CREATE POLICY "samaritan_select_own" ON public.samaritan_status
  FOR SELECT USING (auth.uid() = user_id);

-- emoticron_submissions (users can read + insert their own; reviews are admin-only via service role)
DROP POLICY IF EXISTS "emoticron_subs_select_own" ON public.emoticron_submissions;
CREATE POLICY "emoticron_subs_select_own" ON public.emoticron_submissions
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "emoticron_subs_insert_own" ON public.emoticron_submissions;
CREATE POLICY "emoticron_subs_insert_own" ON public.emoticron_submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- unlocked_emoticrons (read-only for users; inserts via service role / trigger)
DROP POLICY IF EXISTS "unlocked_select_own" ON public.unlocked_emoticrons;
CREATE POLICY "unlocked_select_own" ON public.unlocked_emoticrons
  FOR SELECT USING (auth.uid() = user_id);

-- ──────────── trigger: bootstrap rows on new user signup ────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id);
  INSERT INTO public.equipped_outfit (user_id) VALUES (NEW.id);
  INSERT INTO public.samaritan_status (user_id) VALUES (NEW.id);

  -- Seed the 8 base ship-with-the-game emoticrons. These can be tuned later.
  INSERT INTO public.unlocked_emoticrons (user_id, emoticron_key) VALUES
    (NEW.id, 'wave.hello'),
    (NEW.id, 'thanks.runner'),
    (NEW.id, 'sorry.delay'),
    (NEW.id, 'help.please'),
    (NEW.id, 'good.find'),
    (NEW.id, 'over.here'),
    (NEW.id, 'see.later'),
    (NEW.id, 'cycle.complete');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ──────────── trigger: keep updated_at fresh ────────────

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_touch_updated ON public.profiles;
CREATE TRIGGER profiles_touch_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS outfit_touch_updated ON public.equipped_outfit;
CREATE TRIGGER outfit_touch_updated
  BEFORE UPDATE ON public.equipped_outfit
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS samaritan_touch_updated ON public.samaritan_status;
CREATE TRIGGER samaritan_touch_updated
  BEFORE UPDATE ON public.samaritan_status
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
