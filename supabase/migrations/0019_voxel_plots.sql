-- 0019 — data_base voxel plots (mega-batch 3 · P7 Stage B).
--
-- ⚠️ NOT AUTO-APPLIED. Owner runs this in the Supabase SQL editor. Idempotent.
--
-- One row per account holding the palette-indexed RLE envelope produced by
-- apps/web/src/voxel-core.ts ({v, w, h, d, runs}). Content is block ids only
-- (no free text anywhere in the format), client-trusted like the economy
-- blob, and size-capped server-side. Sizing note: JSONB stores each runs
-- number at ~12 bytes, so the absolute worst case (full 24×16×24
-- checkerboard = 18,432 numbers) is ~221 KB — the 256 KB cap below admits
-- EVERY legal grid while still bounding a hostile payload. (The economy
-- blob's cap is 128 KB for comparison; a typical build here is < 25 KB.)
--
-- get_voxel_plot(p_user) deliberately reads ANY user's plot (authenticated
-- callers only): Stage C plot visits render the HOST's plot on the guest's
-- client. Table-level RLS stays own-row; the cross-user read surface is this
-- one STABLE SECURITY DEFINER function.

CREATE TABLE IF NOT EXISTS public.voxel_plots (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  blob JSONB NOT NULL DEFAULT '{}'::JSONB,
  version INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.voxel_plots ENABLE ROW LEVEL SECURITY;

-- Own-row SELECT in the 0015 initplan form; no direct client writes at all —
-- save_voxel_plot() owns the write path.
DROP POLICY IF EXISTS voxel_select_own ON public.voxel_plots;
CREATE POLICY voxel_select_own ON public.voxel_plots
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
REVOKE INSERT, UPDATE, DELETE ON public.voxel_plots FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.save_voxel_plot(p_blob JSONB, p_version INT DEFAULT 1)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_blob IS NULL OR jsonb_typeof(p_blob) <> 'object' THEN
    RAISE EXCEPTION 'invalid blob';
  END IF;
  -- 256 KB: admits the RLE worst case of a legal grid (~221 KB as JSONB —
  -- see header) with margin; anything larger is not a real plot.
  IF pg_column_size(p_blob) > 262144 THEN
    RAISE EXCEPTION 'blob too large';
  END IF;
  INSERT INTO public.voxel_plots (user_id, blob, version, updated_at)
  VALUES (auth.uid(), p_blob, GREATEST(1, COALESCE(p_version, 1)), NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET blob = EXCLUDED.blob,
        version = EXCLUDED.version,
        updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_voxel_plot(p_user UUID)
RETURNS TABLE (blob JSONB, version INT, updated_at TIMESTAMPTZ)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT v.blob, v.version, v.updated_at
  FROM public.voxel_plots v
  WHERE v.user_id = p_user
    AND auth.uid() IS NOT NULL;
$$;

-- ── lockdown (0013/0014 pattern: PUBLIC revoke is mandatory) ────────────────
REVOKE EXECUTE ON FUNCTION public.save_voxel_plot(JSONB, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_voxel_plot(JSONB, INT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_voxel_plot(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_voxel_plot(UUID) TO authenticated;
