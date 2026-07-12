# 0152 — data_base: plot persistence (P7 Stage B)

Stage A's session-only plot now survives. Two tiers, no hard dependency
on owner action: guests persist to localStorage; accounts additionally
sync through a new `voxel_plots` table — and until migration 0019 is
applied, the RPC path fails silently and the client stays local-only.

## Migration (AUTHORED, NOT APPLIED — owner action)

`supabase/migrations/0019_voxel_plots.sql`:

- `voxel_plots` — `user_id` PK → `auth.users` (cascade), `blob JSONB`
  (the voxel-core RLE envelope `{v,w,h,d,runs}`), `version INT`,
  `updated_at`.
- RLS: own-row SELECT in the 0015 initplan form; **no direct client
  writes** (INSERT/UPDATE/DELETE revoked) — `save_voxel_plot()` owns
  the write path.
- `save_voxel_plot(p_blob, p_version)` — SECURITY DEFINER, auth gate,
  jsonb-object shape check, **64 KB `pg_column_size` cap** (brief
  default; a legit envelope is <2 KB — only a deliberate near-
  checkerboard build can exceed it, and the client just keeps its
  local copy), upsert on `user_id`.
- `get_voxel_plot(p_user)` — STABLE SECURITY DEFINER; deliberately
  reads ANY user's plot (authenticated callers only) because Stage C
  visits render the HOST's build on the guest's client. Content is
  block ids only — no free text can transit this surface.
- 0013/0014 lockdown pair on both functions (PUBLIC + anon revoked).

## Client

- **`voxel-plot-store.ts`** — owns THE grid identity (one
  `Uint8Array` for the whole app; the arena holds a reference).
  - localStorage `bitrunners.voxelplot.v1` (versioned envelope; a
    corrupt value decodes to null → fresh pad, never a crash).
  - Save: 3 s debounce behind the last edit + flush on plot exit, tab
    hide, unload, and scene dispose. Signed-in saves also fire the
    RPC (best-effort, offline/unapplied-migration tolerant).
  - Sign-in merge: **denser build wins** (`countBlocks`), tie →
    remote. Adoption copies INTO the same buffer and fires
    `bitrunners:plot-reloaded`; the scene just remeshes.
  - Guests: `nudgeAccount('plot')` on the first edit (new nudge
    reason + copy line), once per session, exactly like the minigame
    nudge.
- scene.ts: `enterPlot` pulls the store grid; every successful edit
  calls `notePlotEdited()`; exit + dispose flush.
- Codec unit tests shipped with Stage A (devlog 0151) already cover
  the round-trip + malformed-input surface this migration stores.

## Owner actions

1. Apply `0019_voxel_plots.sql` via the Supabase SQL editor / agent.
   Until then: everything works, account sync silently no-ops.
2. Verify: build something as guest → reload → build persists. Sign
   in → build again → reload signed-in on another browser → the
   denser build appears.

Gates: biome · typecheck 8/8 · test 85/85 · build 5/5 · bundle OK.
