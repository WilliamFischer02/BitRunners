# 0120 — Landmarks: glitch switch + pressure-plate vault → void (mega-batch 2 · 4.6, part 2)

Builds on the doubled map (devlog 0119). Two interactable landmarks placed in
the freed-up interior. Client-only — **no server change, no Fly redeploy** for
this part (the doubling in part 1 is what triggers the redeploy).

## Landmark 1 — the glitch switch

A wall segment + emissive lever at `(-22, 24)` (collider, so it blocks
passage). Walk-up proximity (`GLITCH_TRIGGER = 2.4`, same pattern as SAMM) fires
`bitrunners:glitch-switch-range`; `Landmarks.tsx` shows a `flip glitch switch
[ E ]` prompt. Flipping (tap or `E`) plays a ~2 s full-screen glitch burst
(cosmetic, `pointer-events: none` so play continues), then a 10 s cooldown
(`switch recharging…`). Reduced-motion hides the burst.

## Landmark 2 — the pressure-plate vault → void

- A roofless enclosure at `(26, -18)`: 4 walls (colliders) with a **door gap**
  on the south wall (x ∈ [VAULT.x−1, VAULT.x+1]); interior visible from the
  overhead camera. Inside are 4 pressure plates, each marked with 1–4 pip
  cubes.
- Step the plates **in order 1→2→3→4** (a wrong plate resets the sequence with
  a brief screen flicker via `bitrunners:vault-reset`; a correct step lights
  the plate). Completing the sequence teleports the runner to **the void**.
- **The void** is a scene mode (like `core_run`'s maze, reusing the same
  world-hide / parked-avatar / minimap-hide machinery): a small dark featureless
  area with a single free-standing, faintly-lit **doorframe**. Walking through
  the door (`bitrunners:void-exit`) teleports the runner back to just outside
  the vault door and restores the world + minimap. Per-session, no persistence.

## Scene integration (isolation preserved)

The void reuses the maze-mode scaffolding: a second bounded mode gated behind
`voidActive`. The tick swaps in empty colliders + a clamp and skips all world /
network / minimap work behind `!mazeActive && !voidActive`, so the normal
multiplayer/render hot path is unchanged. Vault walls + the glitch-switch wall
are static `COLLIDERS` entries (derived from the shared landmark coords) with
matching meshes in `worldTile` (so they appear in all 3×3 wrap clones); the
plate materials are shared across clones, so lighting a plate lights it
everywhere consistently. Multiplayer: while in the void the avatar stays parked
in the shared world (outbound moves frozen) — same v1 default as the maze.

## STOP-AND-ASK — flavour / lore

The brief flagged the void-room and glitch-switch **flavour text as a
STOP-AND-ASK** if canon doesn't specify it. It doesn't, so the in-game copy is
deliberately neutral/mechanical (`flip glitch switch`, a bare doorframe, no
named lore) rather than invented. Owner: name + dress these (what the switch
"does" in canon, what the void *is*) and I'll wire the copy through
`dialogue.ts` / a lore file. No lore was fabricated.

## Verify (owner)

- Walk to the lever wall in the NW interior → prompt appears → flip → ~2 s
  glitch burst → 10 s cooldown. You keep moving during the burst.
- Enter the vault through the south door gap; step plates 1→2→3→4 in order →
  you drop into the dark void with a glowing doorframe. Walk through it → back
  outside the vault; the minimap returns. Step a wrong plate mid-sequence → the
  lit plates reset + a brief flicker.
