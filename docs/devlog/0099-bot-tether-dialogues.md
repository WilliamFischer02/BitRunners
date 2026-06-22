# 0099 — Bot tether dialogues (mega-batch 4.11)

**Date:** 2026-06-16
**Branch:** `claude/mega-batch-2026-06-16`
**Type:** P3 feature · **server change → Fly redeploy on merge**

## Goal

Let the 4 dweller NPCs in every sphere be tether-chatted so the tether
system (and downstream UX like the cartridge menu) can be smoke-tested
without a second human.

## Server (`sphere-room.ts`)

- `tether-request` targeting an `npc:*` id no longer dead-ends (NPCs have no
  `Client` to notify). The server schedules an **auto-accept** after a
  randomized 1.5–3 s delay, re-checks the handshake is still valid
  (requester may have cancelled / left), binds the tether, and sends
  `tether-accepted` to the requester.
- Once tethered, the NPC emits one line every **8–15 s** (jittered) from a
  per-archetype pool, validated against `isValidTetherBody` (ASCII,
  ≤ `TETHER_MAX_CHARS`). Voices: `dweller.robot` = clipped/system-y,
  `dweller.husk` = corroded/fragmentary, `dweller.spirit` =
  drifting/cryptic (the 4th NPC reuses the robot pool — only 3 archetypes
  exist). Lines are lore-safe and server-authored (curated, not free text).
- Cleanup: a single `botTimers` map (one timer per NPC) is cleared on tether
  end, on requester disconnect, on a cancelled pending request, and in a new
  `onDispose`. So walking away / closing the tether stops the chatter.

## Client (`scene.ts`)

The tap-in-targeting-mode → `sendTetherRequest` wiring was **missing** —
`tether-chat.ts` exposed `isTargeting()` (with a comment saying the scene's
click handler should use it) but `onCanvasClick` only ever locked the
camera, so no tether could be initiated from the UI at all. Added the
wiring: while in tether targeting mode, tapping a remote runner or dweller
fires a tether request to it. This makes both human and NPC tethering
reachable (and is the bug fix that actually lets 4.11 be exercised).

## Verify (owner)

Sign in + verify a handle → open `// tether_chat` → "enter tether mode" →
tap a dweller NPC. After ~1.5–3 s the tether connects; the NPC sends a line
every ~8–15 s in its archetype's voice. Walk away or close the tether → the
lines stop.

## Files

- `apps/server/src/sphere-room.ts`
- `apps/web/src/scene.ts`
