# 0089 — Persistent objective progress (mega-batch 4.1)

**Date:** 2026-06-16
**Branch:** `claude/mega-batch-2026-06-16`
**Type:** P0 bug / data integrity

## Symptom

- Closing the tab or signing back in reset the runner to the first
  objective.
- Starting a NEW objective made the previously-completed one grey out as
  if uncompleted — `0/3 checkpoints`, `· locked`.

## Root cause

Two independent gaps:

1. **`Objectives.tsx` only knew about the single active mission.** It
   derived every card's state from the in-memory active snapshot, so any
   mission that wasn't the active one rendered as `· locked` / `0/3` —
   including completed ones. It never read the persistent `completed`
   list.
2. **The server RPCs were defined but never called.** `supabase.ts` had
   `startMission` / `advanceCheckpoint` / `completeMissionRpc` /
   `fetchMissionProgress` wrappers (migration 0011), and completion *was*
   wired through `completeMissionRpc`. But:
   - `start_mission` and `advance_checkpoint` were never invoked, so the
     server's `last_checkpoint` stayed 0.
   - Nothing ever **read** server progress on sign-in — bootstrap only
     consulted device-local `localStorage`. So a fresh device (or cleared
     storage) reset to `MISSIONS[0]`, and a second device never saw prior
     progress.

## Fix

Server (`mission_progress` + 0011 RPCs) is now the source of truth: read
on auth, write on every checkpoint advance + completion.

- **`mission-server-load.ts` (new)** — on each distinct signed-in user,
  reads every chain mission's row (`fetchMissionProgress` ×N in parallel)
  and rebuilds the local store + active-mission singleton via the pure
  `reconcileServerProgress(chain, rows)`. Guarded by `lastUid` so token
  refreshes don't reset a mid-session position. A mission left in `final`
  re-dispatches `bitrunners:mission-final` so its dialogue reopens.
- **`mission-sync.ts`** — now also mirrors transitions to the server:
  `start_mission` on a newly-active mission, `advance_checkpoint(idx,
  final)` on every checkpoint crossing. Both idempotent server-side
  (`ON CONFLICT DO NOTHING` / `GREATEST`). Fire-and-forget; guests and
  unconfigured Supabase no-op cleanly.
- **`mission-progress-local.ts`** — added a `factions` map (additive,
  older v1 blobs default to `{}`) so completed cards can show which
  faction was chosen; `reconcileFromServer()` overwrites the blob from
  server truth; `markCompleted(key, faction?)` records the choice.
- **`Objectives.tsx`** — subscribes to the progress store and renders
  completed missions as `✓ complete` with full pips regardless of which
  mission is currently active. **No more grey-out / re-lock.**

The client's `nextIdx` maps 1:1 onto the server's `last_checkpoint`
(advance is called with the new index on each crossing), so the reconcile
is a direct read with no translation.

## Test

`apps/web/src/mission-server-load.test.ts` (vitest, 6 cases) covers the
pure reconcile: fresh user, mid-mission resume, completed-stays-complete,
no-relock-on-new-mission, `final` preservation, chain-cleared. A second
load with the same rows is asserted identical to the first (the
persistence guarantee). `pnpm test` green.

Playwright is **not** installed, so the double-page-load smoke is the
vitest reconcile test plus the manual repro below rather than a real
browser run.

### Manual repro (owner, needs a configured Supabase + signed-in account)

1. Sign in. Walk the first objective to checkpoint 2 of 3.
2. Hard-reload the tab. → You resume at checkpoint 2 (not 0).
3. Finish the objective, pick a faction. Start the next one.
4. Open `// objectives`. → The finished objective still reads
   `✓ complete` (not greyed/locked); the new one is `· active`.
5. Sign in on a second device/browser. → Same completed + active state.

## Owner action

Migration `0011_physical_missions.sql` must be applied in Supabase for
server persistence to engage (it likely already is). Without it, the
client silently falls back to the device-local store (prior behaviour),
so this change is safe either way.

## Files

- `apps/web/src/mission-server-load.ts` (new)
- `apps/web/src/mission-server-load.test.ts` (new)
- `apps/web/src/mission-sync.ts`
- `apps/web/src/mission-progress-local.ts`
- `apps/web/src/missions.ts` (export `MissionFaction`)
- `apps/web/src/Objectives.tsx`
- `apps/web/src/App.tsx` (`startMissionServerLoad()`)
