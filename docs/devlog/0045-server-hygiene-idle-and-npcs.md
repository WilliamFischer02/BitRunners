# 0045 — Server hygiene: idle disconnect + NPC liveliness

**Date:** 2026-05-21
**Branch:** `claude/bitrunners-collaboration-EcqBv`

Owner-requested server-side pair: stop empty/ghost avatars cluttering spheres,
and make spheres feel alive with wandering, emoting NPCs. Both in
`apps/server/src/sphere-room.ts` — **server change → Fly redeploy on merge.**

## Idle disconnect

The client sends `move` **every tick (~15 Hz) even when standing still**
(`scene.ts` send loop is not gated on movement). So the safe "inactive" signal
is **silence**, not stillness: a live client always sends, so a client we've
heard *nothing* from is dead/frozen/backgrounded — not someone playing the
clicker while stationary.

- Track `lastSeen` per client, updated on **every** message (move/emote/class).
- Each sim tick, collect clients silent for `> IDLE_TIMEOUT_MS` (120 s) and
  `client.leave(1000)` them (collected first, then left, so `this.clients`
  isn't mutated mid-iteration).
- Clears ghosts well before the slow TCP timeout would, without kicking active
  players. Threshold is a single tunable constant.

**Known gap:** the client doesn't auto-reconnect yet, so a player who's
backgrounded > 2 min (or otherwise dropped) stays disconnected until reload.
Auto-reconnect is the recommended follow-up.

## NPC liveliness

- `NPC_COUNT` (4) ambient NPCs spawned per room in `onCreate` as `PlayerState`
  entries (`npc:N` ids) — they ride the existing player sync, so clients render
  them through the normal remote-avatar path (no client change).
- Each sim tick they wander toward a random platform target (pick a new one on
  arrival) and **occasionally emote** (an allowlisted glyph; `emoteSeq++` so
  clients show the bubble) — imitating active players.
- NPCs are **not clients**: they don't consume the 40-human cap, don't affect
  matchmaking fullness, and don't keep an empty room alive (Colyseus
  auto-dispose is client-based).

No schema change (`state.ts` untouched) — NPCs reuse `PlayerState`.

## Honest status

- Gates green: `pnpm lint` clean (48 files), `pnpm typecheck` 8/8,
  `pnpm build` 5/5.
- **Not verified live (headless).** Needs the deployed server: confirm NPCs
  wander + emote and don't jitter; confirm idle clients drop at ~2 min while
  active ones (incl. stationary clicker users) stay. Tune `IDLE_TIMEOUT_MS` /
  `NPC_COUNT` / `NPC_SPEED` after watching it live.
- **Merging triggers a Fly deploy** (server path changed) — owner-gated.

## Files

`apps/server/src/sphere-room.ts`, this devlog, `.claude/decisions.md`,
`.claude/handoff.md`.
