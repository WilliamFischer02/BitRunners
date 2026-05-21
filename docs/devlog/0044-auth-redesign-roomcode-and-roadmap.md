# 0044 — Auth UI redesign + room-code join, and roadmap additions

**Date:** 2026-05-21
**Branch:** `claude/bitrunners-collaboration-EcqBv`

Owner queued a new batch (admin panel + two engine tasks) and asked to add them
to the timeline, then build the email/password auth redesign + room-code join.
This entry covers both the builds and the timeline additions.

## Built this pass

### Auth UI redesign (email/password only) — P0a
`ProfileIcon.tsx` `AccountSection` rewritten: the OAuth buttons are gone; one
**unified sign-in / sign-up** form with a tab toggle. Sign-up adds a
**confirm-password** field (mismatch is blocked client-side) and both modes have
a **show/hide password peek**. Not-configured + authenticated states unchanged.
`signInWithProvider` is no longer used (left in `supabase.ts`). Client-only —
works once the owner sets the Supabase env vars.

### Room-code / join-room — P0b
- `network.ts`: `joinSphere` takes an optional `roomId` → `client.joinById`
  (falls back to matchmaking if the room is gone/full). `NetworkSession.roomId`
  exposed; `getJoinedRoomId()` for the UI.
- `scene.ts`: reads `bitrunners.settings.roomCode` at connect and joins that
  room; dispatches `bitrunners:room-joined` {roomId}.
- `ProfileIcon.tsx` `RoomSection` (Settings): shows your current room code to
  share, and a "join a room code" input. **Applied on reload** (the scene reads
  the stored code at connect) — live re-join without a reload is a polish
  follow-up. **Client-only — no server change, no Fly.**

## Added to the timeline (NOT built this pass)

### Admin panel — backend epic (`docs/design/admin-panel-epic.md`)
Owner-only control panel: (a) dialogue editing, (b) user table + account status
(`free`/`elevated`=premium) + currency grants + a `permissions`/role column,
(c) daily activity stats, (d) under-construction switch with dev-bypass.
**Security is non-negotiable:** all of it must be **server-enforced** (admin
role + RLS / privileged functions) — a client-only admin or client-side currency
grant would be an instant exploit. Hard-blocked on **live auth + an admin role**
and (for grants) the **server-authoritative economy** shared with the trading
epic. Plan + phasing in the design doc. Also names the premium concept
("elevated") that the deferred auto-click gate can later key off.

### Engine tasks — "server hygiene" (server-side, buildable now, → Fly)
Queued, not yet built:
1. **Idle disconnect** — kick humans idle past a threshold (track last
   move/emote per client in `sphere-room.ts`, sweep on the sim interval) so
   empty avatars don't clutter spheres.
2. **NPC liveliness** — spawn the planned NPCs (capacity is 40 humans + 10
   NPCs) and have them wander + occasionally emote, imitating active players.
   The room tick already reserves space for this.

Both are isolated server changes; they ride a `main` push that touches
`apps/server` → a Fly redeploy (owner-gated).

## Auth setup (owner action — see chat / SERVICES.md)
The whole accounts/trading/admin track needs Supabase auth live: set
`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in Cloudflare Pages, run the SQL
migrations, enable Email auth, redeploy. Email/password-only → no OAuth provider
setup needed.

## Honest status

- Gates green: `pnpm lint` clean (48 files), `pnpm typecheck` 8/8,
  `pnpm build` 5/5.
- **Not verified live (headless).** Auth form needs env set to actually
  sign in; eyeball the unified form + peek. Room-code join needs two
  clients + a live server to confirm `joinById`; the reload-to-apply flow is
  deliberate first-pass.

## Files

`apps/web/src/ProfileIcon.tsx` (auth redesign + RoomSection),
`apps/web/src/network.ts` (joinById + roomId), `apps/web/src/scene.ts`
(room-code at connect), `apps/web/src/style.css` (auth tabs/peek),
`docs/design/admin-panel-epic.md` (new), this devlog, `.claude/decisions.md`,
`.claude/handoff.md`.
