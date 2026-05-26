-- 0002 — account-synced player economy (devlog 0046)
--
-- Saves the full device-local economy blob (bits/strings/serials/passcodes,
-- credits, lockedTokens, owned, upgrades, inventory, equipped, unlocks,
-- tutorialDone, etc. — the EconomyState shape) to the player's account so
-- progress persists across sessions/devices. One JSONB blob, mirroring the
-- client's single-blob model + the exportProgress()/importProgress() seam.
--
-- Dedicated table (not a profiles column) on purpose: the profiles UPDATE
-- policy's WITH CHECK is tied to display_name_status, which would intermittently
-- block economy writes. This table has its own clean own-row RLS.
--
-- NOTE: this is account SYNC, not yet server-AUTHORITATIVE. The client writes
-- its own blob (own-row RLS), which is fine for saving a player's own progress.
-- Trading requires stricter server-side validation (see p2p-trading-epic.md P1).

CREATE TABLE IF NOT EXISTS public.player_economy (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  blob JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.player_economy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "economy_select_own" ON public.player_economy;
CREATE POLICY "economy_select_own" ON public.player_economy
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "economy_insert_own" ON public.player_economy;
CREATE POLICY "economy_insert_own" ON public.player_economy
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "economy_update_own" ON public.player_economy;
CREATE POLICY "economy_update_own" ON public.player_economy
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
