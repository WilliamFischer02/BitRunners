# 017 — 4V4 and JJJJ (two dweller NPCs)

## Source

Owner directive, mega-batch 2 (2026-07-01), verbatim:

> a new npc thats a small dwarf-robot called "4V4" and a tall, skinny npc model
> thats called "JJJJ". if you tetherchat with the 4V4 npc it replies
> "glenderskygleen" and if you tether chat with the JJJJ npc it alternates
> responding with "i'm hungry" and "i'm jimmy john jone james, ya'll!"

This is owner-authored content (not invented by the session), recorded here per
the lore workflow.

## Canon

- **4V4** — a small **dwarf-robot**. Squat amber shell, one large cyan eye,
  stubby treads, a little antenna. Personality: terse to the point of nonsense.
  - Tether reply (only line): **`glenderskygleen`**
- **JJJJ** — a **tall, skinny** humanoid. Small head high on a long thin neck,
  lanky torso and limbs. Personality: hungry, over-familiar, introduces
  himself at length.
  - Tether replies, **alternating** in order:
    1. `i'm hungry`
    2. `i'm jimmy john jone james, ya'll!`

## Implementation

- Both are server-spawned dweller NPCs (`npc:4v4`, `npc:jjjj`) with
  `PlayerState.className` = `4V4` / `JJJJ` (drives the floating name tag + the
  client rig shape). They wander + are tetherable like the existing dwellers
  (devlog 0099). Server: `apps/server/src/sphere-room.ts` (`BOT_LINES`,
  `NAMED_NPCS`, round-robin `botSay`). Client shapes:
  `apps/web/src/dweller-rigs.ts` (`build4V4`, `buildJJJJ`).
- Their tether replies are **curated server-authored dialogue**, so they are
  exempt from the no-free-text rule (like Admin dialogue) and from the 25-char
  incoming-body length gate — JJJJ's second line is 32 chars on purpose.

## Open follow-ups (next Q&A round)

- Do 4V4 / JJJJ have any role beyond ambient tether flavour (quests, trades,
  faction ties)? Currently ambient only.
- Fixed spawn spots / haunts, or keep them wandering?
- Any relationship to the Company / Admin / existing dweller archetypes?
