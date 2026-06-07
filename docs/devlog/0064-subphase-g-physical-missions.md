# 0064 — Sub-Phase G: physical missions (aether recovery)

Branch: `claude/subphase-g-physical-missions`. Draft PR pending.

First mission: **Recover an aether's last data** (`aether_recovery_01`). Three glowing checkpoints + a cyan route line. The final checkpoint opens a two-choice dialogue: BitRunner Samaritan (send to The Admin) or Corporate Samaritan (sell to The Company). Both award `+5` Samaritan to the chosen faction; the server applies tier crossings via `award_pending_badges` (migration 0009), so the BadgeToast (Sub-Phase C) fires for free.

## Files

### new

- `apps/web/src/missions.ts` — mission registry + active-state singleton (next checkpoint index, state machine, event emitter). Idempotent setters; `getActiveCheckpointAnchor()` exposed for the Starmap.
- `apps/web/src/MissionDialogue.tsx` — final dialogue. Mirrors `AdminDialogue` typing/advance pattern; swaps the emote grid for two faction-tinted text buttons. Optimistically flips local state once the server RPC succeeds; surfaces RPC errors inline.
- `supabase/migrations/0011_physical_missions.sql` — four SECURITY DEFINER RPCs:
  - `start_mission(p_key)` — idempotent insert of `mission_progress` row.
  - `advance_checkpoint(p_key, p_n, p_is_final)` — server-side audit trail, never moves backward.
  - `complete_mission(p_key, p_choice, p_reward)` — atomic: marks complete, increments `samaritan_*`, materialises any newly-crossed badge tiers in `earned_badges`. Idempotent on `(user_id, mission_key)` via `FOR UPDATE` lock so a double-tap doesn't double-award. Returns `score` + `new_badges TEXT[]`.
  - `get_mission_progress(p_key)` — read-only convenience.
  - `_validate_mission_key` internal helper shape-checks `[a-z0-9_]{1..64}` so callers can't smuggle garbage into the table.

### edits

- `apps/web/src/scene.ts` —
  - `missionGroup: Group` added to the scene after the 3×3 worldTile clone loop (so the markers aren't duplicated to wrap tiles).
  - `buildMissionMarkers()` rebuilds the group on every mission state change. Each checkpoint = emissive cyan cylinder (`MeshStandardMaterial.emissiveIntensity`, pulsed in the tick) plus a flat halo disc. Active checkpoint pulses brighter; visited/upcoming render dim.
  - `BufferGeometry` + `BufferAttribute` route line with per-vertex colors so segments leading to the next checkpoint glow brighter — runner reads the direction without a mini-tutorial.
  - `checkMissionApproach()` runs in the existing prox-check block alongside SAMM + Obelisk. Wrap-aware distance; on cross of `triggerDist` (1.6 units) calls `advanceActiveCheckpoint()`. Final checkpoint dispatches `bitrunners:mission-final`.
  - `dispose` paths clean up materials/geometries.
  - Auto-seeds the first mission for any client that has no active mission. Guests see the markers without a Supabase row; the RPC chain no-ops gracefully without auth.
- `apps/web/src/Starmap.tsx` — reads `getActiveCheckpointAnchor()` and draws a cyan diamond + "OBJ" label. Edge-clamped when off-map, same pattern as SAMM/Admin pins. Mission subscription marks dirty so the pin redraws when the checkpoint advances.
- `apps/web/src/App.tsx` — mounts `<MissionDialogue />` next to `<BadgeToast />`. No props.
- `apps/web/src/dialogue.ts` — five new editable entries: `mission.aether01.opening`, `.choice_br`, `.choice_corp`, `.closing_br`, `.closing_corp`. Owner can override in the admin Dialogue Editor.
- `apps/web/src/supabase.ts` — wrappers: `fetchMissionProgress`, `startMission`, `advanceCheckpoint`, `completeMissionRpc`.
- `apps/web/src/style.css` — `.mission-choice-grid` 2-column grid, faction-tinted choice buttons (purple for BitRunner, orange for Corporate), mobile fallback to single-column. `.dialogue-err` for inline RPC errors.

## Architecture decisions

- **Server-authoritative on completion, client-authoritative on progression.** `complete_mission` is the only call that mutates `samaritan_*` and `earned_badges`. Checkpoint walk-through fires `advance_checkpoint` for audit but doesn't gate the local UI on the round-trip — the player keeps moving without latency.
- **Markers live in the center world-tile only**, not the 3×3 wrap clones. They're added after the clone loop, so dynamic state changes mutate the live group directly without touching clones. The player almost always sees the canonical position; mission radii are small enough that wrap-rendering for markers isn't worth the complexity.
- **Mobile-safe rendering preserved.** No `OutlinePass`, no `DepthTexture`. Checkpoint glow = emissive material + pulsed `emissiveIntensity`. Route line = plain `LineBasicMaterial` with vertex colors. Identical mobile constraints to the obelisk pattern (devlog 0008).
- **Idempotent completion.** `complete_mission` does `FOR UPDATE` on `mission_progress` and returns the existing score + empty badge array if already complete. Two clients spamming the dialogue can't double-award.

## What's deferred to later sub-phases

- Multi-mission progression. The registry supports it; the auto-start logic just picks `MISSIONS[0]`. Sub-Phase G v2 will add a mission-select UI + sequence semantics.
- The aether NPC at the final checkpoint. V1 ships the markers + dialogue; a drifting humanoid silhouette to dispel on completion is a polish add.
- Multi-witness missions (`mission_witnesses` reserved in migration 0007). Other players in the sphere don't see your route line yet.

## Verification

- `pnpm typecheck` ✓
- `pnpm lint` ✓
- `pnpm --filter @bitrunners/web build` ✓ (gzip 254 kB main bundle)
- Headless Chromium: boot → class select → scene renders with all three checkpoint pillars and the cyan route line; minimap shows the cyan "OBJ" diamond. Screenshot confirms.

## Owner action before merging

1. Apply migration `0011` after the pending 0007–0010 catch-up (PR #67 unblocks the queue).
2. Pick a real account, walk through the three checkpoints, and confirm:
   - Server `mission_progress` row appears after the first checkpoint.
   - Final dialogue opens at checkpoint 3.
   - Picking BitRunner increments `samaritan_bitrunner`; picking Corporate increments `samaritan_corporate`.
   - Badge toast fires at +10 / +20 / etc.
   - `OBJ` pin on the minimap clears after completion.

## No new dependencies. No protocol bump. No CLAUDE.md change.
