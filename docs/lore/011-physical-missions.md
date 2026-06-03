# 011 — Physical missions

## Question

What does a physical (in-world) mission look like? How do checkpoints, routes, and final dialogue play out?

## Answer (canon — owner Q&A 2026-06-03)

### Shape of a physical mission

A physical mission is a **route the runner walks in-world**, marked by glowing checkpoint markers. Each mission has:

- **3 checkpoints** (sequential — must hit them in order).
- **A glowing route line** between checkpoints, drawn on the ground, fading toward the next waypoint.
- **A final-checkpoint dialogue** with **exactly two choices** that award Samaritan Status to one of the two factions (The Admin or The Company).

Missions are single-player resolved client-side; RPC writes are server-authoritative for the Samaritan increments.

### First mission — "Recover an aether's last data"

The first physical mission delivers the player a downed aether (a drifting offline-runner remnant — see `006-runner-lifecycle.md`). The data it carries is valuable to both factions.

**Mission key:** `aether_recovery_01`

**Checkpoints (rough placement; coordinates owner-tunable):**

| # | Location | Visual cue |
|---|----------|-----------|
| 1 | Near the spawn ring, off the cardinal axis | Glowing cylinder, pulsing white |
| 2 | Midfield, beyond the depot cluster | Glowing cylinder, pulsing white |
| 3 | The aether itself — flickering humanoid silhouette | Glowing cylinder + aether NPC (drifting, dim emote bubble) |

**Route rendering:** A `THREE.Line` with vertex colors fading from full-bright at the next checkpoint to 0.3-alpha at the previous one. The line repaints when the player crosses a checkpoint.

### Final dialogue — "Aether's last data"

Approaching the aether at checkpoint 3 triggers a dialogue overlay (same component shape as `AdminDialogue.tsx`, swapping the emote-grid for two text-button choices).

**Opening line (aether, glitchy):**

> ":// signal fragments here. somebody should care."
> ":// my last token-cache. take it."

**Two choices:**

- **"send the scraps to The Admin"** → `faction_choice = 'bitrunner'`, awards **+5 BitRunner Samaritan**.
  - Closing line: *"the Cloud thanks you, runner. // route logged."*
- **"sell the scraps to The Company"** → `faction_choice = 'corporate'`, awards **+5 Corporate Samaritan**.
  - Closing line: *"transaction filed. // Company acknowledges your contribution."*

After the choice, the route markers despawn and the mission is marked complete in `mission_progress`. The aether NPC fades out over ~2 seconds.

### Cooldown / replay

V1: each mission can be completed **once per account**. Future versions may add weekly-resettable mission cycles.

## In-game implications

- New `mission_progress` table keyed on `(user_id, mission_key)` storing `state` (`'active' | 'final' | 'complete'`), `last_checkpoint INT`, and `faction_choice TEXT`.
- New SECURITY DEFINER RPC `complete_mission(p_key TEXT, p_choice TEXT)` writes the row, increments `samaritan_corporate` or `samaritan_bitrunner` on `profiles`, and triggers `award_pending_badges()` from doc 010.
- New `apps/web/src/missions.ts` registry. Each mission: `{key, checkpoints: Vector3[], finalDialogueKey, rewardAmount: 5, faction: 'either'}`.
- Checkpoint markers reuse the `monolithGlow` emissive-pulse pattern in `scene.ts` (`MeshStandardMaterial.emissiveIntensity` mutated each tick). **No `OutlinePass`, no `DepthTexture`** — mobile-safe per devlog 0008.
- Active checkpoint surfaces on the starmap minimap (doc TBD — handled in Sub-Phase F coupling).

## Open questions

- Should the route line have **chase animation** (a bright dot sweeping forward) or stay static? Static for v1; chase animation is a polish add.
- Do other players in the sphere **see the route lines** of your active mission? V1: no — markers are local-only to the active player. Multi-witness mode is reserved (`mission_witnesses` table) but not wired.
- After the first mission, how many follow-up missions should ship as v1 content? Suggest 2 more (one per faction-arc) drafted later, owner to approve.
