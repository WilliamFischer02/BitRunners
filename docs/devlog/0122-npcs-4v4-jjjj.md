# 0122 — NPCs 4V4 + JJJJ with tether replies (mega-batch 2, owner-requested)

**⚠️ Touches `apps/server` → merging triggers a Fly redeploy.**

## What

Two new hand-authored dweller NPCs (owner spec, recorded in
`docs/lore/017-4v4-and-jjjj.md`):

- **4V4** — a small dwarf-robot. Tether-chat reply (only line):
  `glenderskygleen`.
- **JJJJ** — a tall, skinny humanoid. Tether-chat replies **alternate**:
  `i'm hungry` → `i'm jimmy john jone james, ya'll!` → …

## Server (`apps/server/src/sphere-room.ts`)

- `NAMED_NPCS` spawns `npc:4v4` (className `4V4`) and `npc:jjjj` (className
  `JJJJ`) alongside the 4 cycling dwellers. They wander + emote + are tetherable
  through the existing `npc:` tether path (devlog 0099) — no new wire, no
  protocol bump. Total NPCs now 6 (< the 10 cap; NPCs don't count toward
  matchmaking fullness).
- `BOT_LINES` gains `'4V4'` and `'JJJJ'` pools.
- `botSay` now advances a **per-NPC round-robin cursor** (`botLineIdx`) instead
  of picking randomly, so JJJJ strictly alternates its two lines (and single-
  line NPCs always return their one line). The cursor resets on `botAccept` so
  each fresh tether starts JJJJ at `i'm hungry`. Existing dwellers now cycle
  their lines in order rather than randomly — a benign flavour change.
- Bot lines are sent **without** the `isValidTetherBody` length gate: they're
  trusted server-authored constants, and JJJJ's second line (32 chars) exceeds
  `TETHER_MAX_CHARS` on purpose. That gate remains on the incoming client
  `tether-send` path (free-text moderation is unchanged).

## Client (`apps/web/src/dweller-rigs.ts`)

`buildDweller(className)` gains `4V4` (squat amber shell, single cyan eye,
treads) and `JJJJ` (small head on a long neck, lanky thin torso + limbs) cases.
The floating name tag reads the className, so it shows `4V4` / `JJJJ`.

## Verify (owner, after Fly redeploy)

- Two new silhouettes wander the sphere: a short amber robot and a tall skinny
  figure, tagged `4V4` and `JJJJ`.
- Tether-chat 4V4 → it replies `glenderskygleen` on a loop.
- Tether-chat JJJJ → it alternates `i'm hungry` / `i'm jimmy john jone james,
  ya'll!`, starting with `i'm hungry`.
