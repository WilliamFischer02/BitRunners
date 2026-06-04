-- 0008 — Theme RPCs (Sub-Phase E: purchase_theme, equip_theme, get_my_themes)
--
-- Background: migration 0007 already added owned_themes + profiles.equipped_theme.
-- This migration adds the three SECURITY DEFINER RPCs that gate writes to those
-- surfaces so a client can never self-modify equipped_theme via a raw UPDATE.
--
-- Balance verification is intentionally CLIENT-SIDE for now: the economy is a
-- device-local JSONB blob (player_economy, migration 0002) and not server-
-- authoritative. The RPC only verifies the faction gate (samaritan scores from
-- profiles) and the allowed-key list. When the P2P trading epic lands a
-- server-authoritative economy, purchase_theme can be upgraded to verify balance
-- there.
--
-- Owner: run this in the Supabase SQL editor AFTER 0007 is applied.

-- ── RPC: purchase_theme ──────────────────────────────────────────────────────
-- Idempotent (re-purchasing an owned theme is a no-op).
-- Verifies faction gate for void_purple and corp_orange.
-- Balance deduction is handled client-side before this call.
CREATE OR REPLACE FUNCTION public.purchase_theme(p_key TEXT)
RETURNS VOID AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_val  INT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_key NOT IN (
    'terminal_green', 'amber_crt', 'paper_white',
    'void_purple', 'corp_orange', 'null_blue',
    'signal_red', 'aether_drift'
  ) THEN
    RAISE EXCEPTION 'unknown theme key: %', p_key;
  END IF;

  -- Faction gate: void_purple requires BitRunner Samaritan >= 30
  IF p_key = 'void_purple' THEN
    SELECT samaritan_bitrunner INTO v_val
      FROM public.profiles WHERE id = v_uid;
    IF COALESCE(v_val, 0) < 30 THEN
      RAISE EXCEPTION 'requires BitRunner Samaritan >= 30 (have %)', COALESCE(v_val, 0);
    END IF;
  END IF;

  -- Faction gate: corp_orange requires Corporate Samaritan >= 30
  IF p_key = 'corp_orange' THEN
    SELECT samaritan_corporate INTO v_val
      FROM public.profiles WHERE id = v_uid;
    IF COALESCE(v_val, 0) < 30 THEN
      RAISE EXCEPTION 'requires Corporate Samaritan >= 30 (have %)', COALESCE(v_val, 0);
    END IF;
  END IF;

  INSERT INTO public.owned_themes (user_id, theme_key)
    VALUES (v_uid, p_key)
    ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── RPC: equip_theme ─────────────────────────────────────────────────────────
-- Verifies the user owns the theme (terminal_green is always allowed as the free
-- default). Pass NULL or '' to unequip (reverts to terminal_green rendering).
CREATE OR REPLACE FUNCTION public.equip_theme(p_key TEXT)
RETURNS VOID AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- terminal_green is always equippable (free default, no owned_themes row needed)
  IF p_key IS NOT NULL AND p_key != '' AND p_key != 'terminal_green' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.owned_themes
       WHERE user_id = v_uid AND theme_key = p_key
    ) THEN
      RAISE EXCEPTION 'theme not owned: %', p_key;
    END IF;
  END IF;

  UPDATE public.profiles
     SET equipped_theme = NULLIF(p_key, ''),
         updated_at     = NOW()
   WHERE id = v_uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── RPC: get_my_themes ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_themes()
RETURNS TABLE (
  theme_key   TEXT,
  acquired_at TIMESTAMPTZ
) AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT ot.theme_key, ot.acquired_at
      FROM public.owned_themes ot
     WHERE ot.user_id = v_uid
     ORDER BY ot.acquired_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.purchase_theme(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equip_theme(TEXT)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_themes()      TO authenticated;
