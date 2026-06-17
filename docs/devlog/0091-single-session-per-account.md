# 0091 — One live session per account (AFK self-ghost fix) (mega-batch 4.3)

**Date:** 2026-06-16
**Branch:** `claude/mega-batch-2026-06-16`
**Type:** P0 bug · **server change → triggers a Fly redeploy on merge**

## Symptom

Opening a new tab while another was still open left the old session's
avatar in the sphere as an AFK ghost the player would then walk into.

## Fix

A user now has **at most one live Colyseus connection** — even across
spheres. When a newer connection for the same account joins, the older one
is superseded (kicked) instead of lingering.

### Server

- `session-registry.ts` (new) — a process-global `Map<userId,
  LiveSession>`. The server is a single Node process (one Fly machine), so
  a module-level map covers all rooms. `registerSession` makes the new
  connection live and returns the previous one (if a different session) to
  supersede; `unregisterSession` only frees the slot if the leaving
  session is still the live one (a superseded session closing later must
  not evict the newer one).
- `sphere-room.ts` — `onJoin` reads `options.userId` (validated as a UUID
  via `isValidUserId`), registers it, and supersedes any prior session.
  `supersedeClient` sends a `session-superseded` message then closes with
  WS code `WS_CLOSE_SESSION_SUPERSEDED` (4001). `onLeave` releases the
  slot. The `supersede` closure binds the correct room + client, so the
  kick lands in whatever sphere the stale tab is in.
- `@bitrunners/shared` — `isValidUserId`, `WS_CLOSE_SESSION_SUPERSEDED`.
  No `PROTOCOL_VERSION` bump: `userId` is an optional join option, not a
  state-schema field, and the new server→client message is additive.

### Client

- `network.ts` — join payload carries `userId`; a `session-superseded`
  message (and the 4001 close code as a fallback) routes to a new
  `onSuperseded` callback instead of the reconnect path.
- `scene.ts` — fetches the auth uid (`getCurrentUserId`) before join.
  `onSuperseded` tears down quietly, disables reconnect, and shows a
  persistent **"// session moved to another tab"** overlay with a
  "reconnect here" button (reload). The stale tab stops spamming
  reconnects.
- `supabase.ts` — `getCurrentUserId()`.

Guests (no uid) are unaffected — multiple guest tabs are still allowed
(there's no account to collide on).

## Test

`apps/server/src/session-registry.test.ts` (vitest, 6 cases): first
session not superseded; second tab supersedes the first and becomes live;
supersede kicks exactly the old connection; users don't interfere; a
superseded session leaving later doesn't evict the newer one; the live
session leaving clears the entry.

A full Colyseus integration "connect-twice" test needs `@colyseus/testing`
(not installed — would add a dependency). Deferred; the registry unit test
plus the manual repro below cover the logic.

### Manual repro (owner)

1. Sign in. Open the game in tab A.
2. Open the game in tab B (same account). → Tab A shows the
   "session moved to another tab" overlay and its avatar disappears from
   the sphere for everyone. Tab B plays normally.
3. Click "reconnect here" in tab A → it reloads and becomes the live
   session, kicking tab B in turn.

## Files

- `apps/server/src/session-registry.ts` (new) + test
- `apps/server/src/sphere-room.ts`
- `packages/shared/src/index.ts`
- `apps/web/src/network.ts`, `scene.ts`, `supabase.ts`, `style.css`
