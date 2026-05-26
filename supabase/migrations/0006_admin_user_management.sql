-- 0006 — admin user management: tier, currency grants, user listing (devlog 0053)
--
-- Admin phase 3 (admin-panel-epic.md §b). Owner-only user table + the ability to
-- set a user's account tier / permissions role and grant credits/tokens.
--
-- SECURITY (non-negotiable, see admin-panel-epic.md):
--   * Every privileged action is a SECURITY DEFINER function that RE-CHECKS
--     is_admin(auth.uid()) server-side. The client UI is a convenience window;
--     it is NOT the enforcement boundary.
--   * auth.users.email is exposed ONLY through admin_list_users(), which returns
--     zero rows to non-admins (the is_admin gate is in the WHERE clause).
--   * Currency grants do NOT write another user's economy blob directly (that
--     would race with — and be clobbered by — the recipient's own client sync,
--     migration 0002). Instead they append to an immutable economy_grants ledger
--     that the recipient claims exactly-once on next load (claim_economy_grants).
--     This keeps grants robust + audited WITHOUT a full server-authoritative
--     economy (that still belongs to the trading epic, p2p-trading-epic.md P1).
--   * Clients can SELECT only their own grant rows; they can NOT insert/alter
--     amounts (no write policy — only the SECURITY DEFINER functions mutate).

-- ── account tier (free | elevated) ──────────────────────────────────────────
-- "elevated" = premium / season pass (admin-panel-epic.md note). Settable only
-- via admin_set_tier (a SECURITY DEFINER function); the client cannot write it
-- (see the column-grant lockdown below).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'free'
  CHECK (tier IN ('free', 'elevated'));

-- ── SECURITY FIX (pre-existing privilege escalation) ─────────────────────────
-- RLS is ROW-level, not column-level. The profiles_update_own policy (0001)
-- lets a user UPDATE their OWN row, and Supabase's default column grants let
-- that update touch ANY column — so an authenticated user could
--   PATCH /profiles?id=eq.<self>  {"role":"admin"}
-- and self-escalate (the 0003 "no client UPDATE policy grants it" note was
-- mistaken — 0001 already grants the row update). Lock it at the column level:
-- revoke table-wide UPDATE, then re-grant ONLY the display-name columns the
-- self-service flow legitimately needs. role/tier are now writable solely via
-- the SECURITY DEFINER admin_set_* functions; service_role still bypasses this.
REVOKE UPDATE ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT UPDATE (display_name, display_name_status, display_name_note)
  ON public.profiles TO authenticated;

-- ── economy grant ledger (append-only) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.economy_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credits BIGINT NOT NULL DEFAULT 0,
  tokens BIGINT NOT NULL DEFAULT 0,
  reason TEXT,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at TIMESTAMPTZ
);
-- Partial index: the hot path is "my unclaimed grants" on each load.
CREATE INDEX IF NOT EXISTS economy_grants_user_unclaimed_idx
  ON public.economy_grants (user_id) WHERE claimed_at IS NULL;

ALTER TABLE public.economy_grants ENABLE ROW LEVEL SECURITY;

-- Recipients may READ their own grants (to surface "you received N"); they may
-- NOT insert or modify rows — all writes go through the functions below.
DROP POLICY IF EXISTS "grants_select_own" ON public.economy_grants;
CREATE POLICY "grants_select_own" ON public.economy_grants
  FOR SELECT USING (auth.uid() = user_id);

-- ── admin: list users (email + balances + pending grants) ────────────────────
-- SECURITY DEFINER so it can read auth.users / others' rows, but the is_admin
-- gate in WHERE means non-admins get zero rows. balances are read from the
-- synced economy blob (best-effort mirror); pending_* are unclaimed grant sums.
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
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

-- ── admin: grant credits/tokens (queues a ledger row) ────────────────────────
CREATE OR REPLACE FUNCTION public.admin_grant_economy(
  target UUID,
  p_credits BIGINT,
  p_tokens BIGINT,
  p_reason TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF p_credits < 0 OR p_tokens < 0 THEN
    RAISE EXCEPTION 'amounts must be non-negative';
  END IF;
  IF p_credits = 0 AND p_tokens = 0 THEN
    RAISE EXCEPTION 'nothing to grant';
  END IF;
  -- Sane caps to stop a fat-finger from minting an absurd balance.
  IF p_credits > 10000000 OR p_tokens > 1000000 THEN
    RAISE EXCEPTION 'amount exceeds cap';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target) THEN
    RAISE EXCEPTION 'no such user';
  END IF;
  INSERT INTO public.economy_grants (user_id, credits, tokens, reason, granted_by)
  VALUES (target, p_credits, p_tokens, LEFT(COALESCE(p_reason, ''), 200), auth.uid());
END;
$$;

-- ── admin: set account tier ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_tier(target UUID, p_tier TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF p_tier NOT IN ('free', 'elevated') THEN
    RAISE EXCEPTION 'invalid tier';
  END IF;
  UPDATE public.profiles SET tier = p_tier WHERE id = target;
END;
$$;

-- ── admin: set permissions role ──────────────────────────────────────────────
-- Self-change is blocked: the owner bootstraps their own admin via SQL (0003),
-- and this prevents the foot-gun of demoting yourself out of the console.
CREATE OR REPLACE FUNCTION public.admin_set_role(target UUID, p_role TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF p_role NOT IN ('user', 'dev', 'admin') THEN
    RAISE EXCEPTION 'invalid role';
  END IF;
  IF target = auth.uid() THEN
    RAISE EXCEPTION 'cannot change your own role';
  END IF;
  UPDATE public.profiles SET role = p_role WHERE id = target;
END;
$$;

-- ── recipient: claim own pending grants (exactly-once, atomic) ───────────────
-- Marks all unclaimed grants for the caller as claimed and returns their sums in
-- a single transaction, so a grant is applied to the client's balance exactly
-- once. Non-admin / anon callers operate only on their own auth.uid() rows.
CREATE OR REPLACE FUNCTION public.claim_economy_grants()
RETURNS TABLE (credits BIGINT, tokens BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN QUERY SELECT 0::BIGINT, 0::BIGINT;
    RETURN;
  END IF;
  RETURN QUERY
  WITH claimed AS (
    UPDATE public.economy_grants g
    SET claimed_at = NOW()
    WHERE g.user_id = uid AND g.claimed_at IS NULL
    RETURNING g.credits, g.tokens
  )
  SELECT COALESCE(SUM(c.credits), 0)::BIGINT, COALESCE(SUM(c.tokens), 0)::BIGINT
  FROM claimed c;
END;
$$;
