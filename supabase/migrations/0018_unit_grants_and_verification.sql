-- 0018 — unit grants (bits/strings/serials/passcodes) + email-verification
--        visibility for the admin console (devlog 0132)
--
-- Extends the 0006 grant ledger so the admin can remediate lost scrape
-- progress with unit grants, not just credits/tokens. Also surfaces
-- auth.users.email_confirmed_at through admin_list_users so the console can
-- show who has verified email (and offer a resend button — client-side via
-- supabase-js auth.resend, no schema needed for the resend itself).
--
-- Run from Supabase dashboard → SQL Editor → paste → Run (owner applies
-- manually per CLAUDE.md; the Supabase agent may adapt if live schema drifted).

-- ── 1. ledger columns ─────────────────────────────────────────────────────────
ALTER TABLE public.economy_grants
  ADD COLUMN IF NOT EXISTS bits      BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS strings   BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS serials   BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS passcodes BIGINT NOT NULL DEFAULT 0;

-- ── 2. admin_grant_economy — new signature with unit params ──────────────────
-- Drop the old 4-arg overload so PostgREST rpc name resolution stays
-- unambiguous (a second overload would 300 on rpc calls).
DROP FUNCTION IF EXISTS public.admin_grant_economy(UUID, BIGINT, BIGINT, TEXT);

CREATE OR REPLACE FUNCTION public.admin_grant_economy(
  target UUID,
  p_credits BIGINT,
  p_tokens BIGINT,
  p_bits BIGINT,
  p_strings BIGINT,
  p_serials BIGINT,
  p_passcodes BIGINT,
  p_reason TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF p_credits < 0 OR p_tokens < 0 OR p_bits < 0 OR p_strings < 0
     OR p_serials < 0 OR p_passcodes < 0 THEN
    RAISE EXCEPTION 'amounts must be non-negative';
  END IF;
  IF p_credits = 0 AND p_tokens = 0 AND p_bits = 0 AND p_strings = 0
     AND p_serials = 0 AND p_passcodes = 0 THEN
    RAISE EXCEPTION 'nothing to grant';
  END IF;
  -- Fat-finger caps, matching the 0006 spirit. Units cap at 1e6 each.
  IF p_credits > 10000000 OR p_tokens > 1000000
     OR p_bits > 1000000 OR p_strings > 1000000
     OR p_serials > 1000000 OR p_passcodes > 1000000 THEN
    RAISE EXCEPTION 'amount exceeds cap';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target) THEN
    RAISE EXCEPTION 'no such user';
  END IF;
  INSERT INTO public.economy_grants
    (user_id, credits, tokens, bits, strings, serials, passcodes, reason, granted_by)
  VALUES
    (target, p_credits, p_tokens, p_bits, p_strings, p_serials, p_passcodes,
     LEFT(COALESCE(p_reason, ''), 200), auth.uid());
END;
$$;

-- ── 3. claim_economy_grants — return unit sums too ───────────────────────────
-- Return-type change requires a drop first.
DROP FUNCTION IF EXISTS public.claim_economy_grants();

CREATE OR REPLACE FUNCTION public.claim_economy_grants()
RETURNS TABLE (
  credits BIGINT, tokens BIGINT,
  bits BIGINT, strings BIGINT, serials BIGINT, passcodes BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN QUERY SELECT 0::BIGINT, 0::BIGINT, 0::BIGINT, 0::BIGINT, 0::BIGINT, 0::BIGINT;
    RETURN;
  END IF;
  RETURN QUERY
  WITH claimed AS (
    UPDATE public.economy_grants g
    SET claimed_at = NOW()
    WHERE g.user_id = uid AND g.claimed_at IS NULL
    RETURNING g.credits, g.tokens, g.bits, g.strings, g.serials, g.passcodes
  )
  SELECT
    COALESCE(SUM(c.credits), 0)::BIGINT, COALESCE(SUM(c.tokens), 0)::BIGINT,
    COALESCE(SUM(c.bits), 0)::BIGINT, COALESCE(SUM(c.strings), 0)::BIGINT,
    COALESCE(SUM(c.serials), 0)::BIGINT, COALESCE(SUM(c.passcodes), 0)::BIGINT
  FROM claimed c;
END;
$$;

-- ── 4. admin_list_users — expose email verification state ────────────────────
-- Return-type change requires a drop first.
DROP FUNCTION IF EXISTS public.admin_list_users();

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  email_confirmed BOOLEAN,
  display_name TEXT,
  role TEXT,
  tier TEXT,
  created_at TIMESTAMPTZ,
  credits BIGINT,
  tokens BIGINT,
  pending_credits BIGINT,
  pending_tokens BIGINT
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT
    p.id,
    u.email::TEXT,
    (u.email_confirmed_at IS NOT NULL),
    p.display_name,
    p.role,
    p.tier,
    u.created_at,
    COALESCE((e.blob ->> 'credits')::NUMERIC, 0)::BIGINT,
    COALESCE((e.blob ->> 'tokens')::NUMERIC, 0)::BIGINT,
    COALESCE(
      (SELECT SUM(g.credits) FROM public.economy_grants g
        WHERE g.user_id = p.id AND g.claimed_at IS NULL), 0)::BIGINT,
    COALESCE(
      (SELECT SUM(g.tokens) FROM public.economy_grants g
        WHERE g.user_id = p.id AND g.claimed_at IS NULL), 0)::BIGINT
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  LEFT JOIN public.player_economy e ON e.user_id = p.id
  WHERE public.is_admin(auth.uid())
  ORDER BY u.created_at DESC
  LIMIT 500;
$$;

-- ── 5. lockdown (0013/0014 pattern) ──────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.admin_grant_economy(UUID, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_economy_grants() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_economy(UUID, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_economy_grants() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
