# 0066 — Page-Visibility standby + random spawn scatter (Phase 2)

Branch: `claude/phase2-standby-and-spawn`. Draft PR pending.

Phase 2 of the six-PR batch. Fixes two related live bugs reported in the
HUD screenshot:

1. **Ghost avatars stacked at spawn.** Every player's `PlayerState`
   defaults `x = 0, z = 0`; the server never scattered on join, so any
   tab the user ever opened sits as a ghost at origin (often blocking the
   real player's view of their own spawn). The client's RAF loop is
   throttled in backgrounded tabs but the WebSocket stays open until TCP
   keepalive (~120 s+), so the existing idle-sweep doesn't help.
2. **No standby detection.** No part of `apps/web` listens for the Page
   Visibility API, so a tab in the background keeps its server seat
   indefinitely.

## What ships

### new

- **`apps/web/src/visibility.ts`** — `startVisibilityWatcher()` listens to
  `visibilitychange` + `pagehide` + `beforeunload` and dispatches
  `bitrunners:standby-enter` / `bitrunners:standby-exit`. Idempotent
  (`started` flag); booted once at module load in `App.tsx`. Exports
  the event-name constants for typed listeners.

### edits

- **`apps/server/src/sphere-room.ts`** —
  - New `randomSpawn()` helper picks a random angle + radius in
    `[1.5, 4.0]` units. The existing center decor (obelisk, SAMM,
    terminal, port) all live ≥ 5 units from origin, so a 1.5–4.0 ring
    cannot collide with them.
  - `onJoin` now writes `p.x` / `p.z` from `randomSpawn()` so newcomers
    scatter around the spawn ring instead of stacking at (0, 0).
- **`apps/web/src/scene.ts`** —
  - Local rig position seeded with the same `[1.5, 4.0]` ring so the
    LOCAL view of the player matches the server's chosen spawn shape.
    Both ends pick independently; once the local rig sends its first
    `move` the server's pos converges on the client's choice.
  - Standby handlers installed *outside* the `if/else (serverUrl)` block
    so the ribbon also appears in offline / single-player mode. On
    `STANDBY_ENTER_EVENT`: if a `netSession` exists, call
    `session.dispose()` (intentional leave — `intentionalLeave` flag
    suppresses the disconnect callback so the RECONNECT_DELAYS path
    doesn't fire); add `.is-standby` to the canvas host. On
    `STANDBY_EXIT_EVENT`: remove the class; if running online with no
    session, dispatch `bitrunners:standby-reconnect` which the
    network-mode initializer listens for and calls `connectSphere()`.
  - All standby listeners pushed into a single `standbyCleanups: (()=>void)[]`
    array so dispose tears them down cleanly regardless of whether the
    network init block ran.
- **`apps/web/src/App.tsx`** — boots `startVisibilityWatcher()` next to
  the existing `startIdentity()` / `startBadgeMonitor()`.
- **`apps/web/src/style.css`** — `.canvas-host.is-standby::before`
  draws a faint `// standby — tab inactive` ribbon at the top of the
  canvas. No animation — the scene's RAF loop is already paused, and
  the ribbon is meant to be a quiet indicator, not a UX claim.

## Architecture decisions

- **Reuse the existing `intentionalLeave` flag** in `network.ts`. The
  visibility-driven disconnect uses the same dispose path as the
  in-game "leave room" button, so we don't accidentally trip the
  exponential-backoff reconnect.
- **No account dedup yet.** The plan locks this batch to "Visibility +
  spawn scatter" only — passing a Supabase user id into the Colyseus
  room to kick older sessions of the same account is deferred to a
  later PR that also handles emoticron and DM auth.
- **Both ends scatter independently.** A future "deterministic spawn
  from session id" or "first-state-sync snap" would converge them
  exactly, but the current approach is good enough: no one is at
  (0, 0), and the local rig's first `move` reconciles within ~67 ms.

## Verification

- `pnpm typecheck` ✓
- `pnpm lint` ✓
- `pnpm --filter @bitrunners/web build` ✓
- `pnpm --filter @bitrunners/server build` ✓
- Headless Chromium repro:
  - Scene mounts with `.is-standby` absent.
  - Override `document.visibilityState` to `hidden` and dispatch
    `visibilitychange` → `.is-standby` appears on `.canvas-host`.
  - Restore visibility → class is removed.
  - No `pageerror` / `console.error` in either transition.

## What's deferred to later phases

- Phase 3: Tether Hop minigame + chatter resource.
- Phase 4: ASCII pixel-crush transition engine + circuit-board floor.
- Phase 5: Retrofit transitions to legacy modals.
- Account dedup (Supabase id binding to Colyseus session) — a future PR.

## No new dependencies. No protocol bump. No schema change.
