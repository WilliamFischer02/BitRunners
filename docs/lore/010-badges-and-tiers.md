# 010 — Badges and tiers

## Question

How are Samaritan badges structured? What tiers exist, how are they earned, how are they shown?

## Answer (canon — owner Q&A 2026-06-03)

### Two parallel ladders

Badges are earned on **two parallel ladders**, one per faction:

- **Corporate ladder** — earned via *Corporate Samaritan Status* (working with The Company). Orange palette family.
- **BitRunner ladder** — earned via *BitRunner Samaritan Status* (working with The Admin). Purple palette family.

A runner can climb both ladders. Only **one badge is equipped at a time** — the runner picks which faction to fly.

### Ten tiers per ladder

Each ladder has 10 tiers, granted every +10 Samaritan in that faction. Cap: +100 Samaritan = top tier.

| Tier | Name | Threshold | Glyph |
|------|------|-----------|-------|
| 1 | wood | +10 | `□` |
| 2 | stone | +20 | `▣` |
| 3 | bronze | +30 | `◆` |
| 4 | steel | +40 | `▰` |
| 5 | silver | +50 | `▲` |
| 6 | gold | +60 | `★` |
| 7 | platinum | +70 | `✦` |
| 8 | diamond | +80 | `♦` |
| 9 | obsidian | +90 | `◆` (darker render) |
| 10 | aether | +100 | `✺` |

The top tier — **aether** — is a deliberate nod to the offline-runner lore (`006-runner-lifecycle.md`). Runners who reach +100 Samaritan with a faction wear the badge of a drifting echo. Tonally: aether is unsettling for Corporate (a corporate runner so deep in the company they've half-dissolved) and triumphant for BitRunner (a runner who has become legend in the Cloud).

### Keys

Badge keys are `corp:<tier>` and `br:<tier>`:

```
corp:wood, corp:stone, corp:bronze, corp:steel, corp:silver,
corp:gold, corp:platinum, corp:diamond, corp:obsidian, corp:aether
br:wood,   br:stone,   br:bronze,   br:steel,   br:silver,
br:gold,   br:platinum, br:diamond,  br:obsidian,  br:aether
```

### Display

- Badge glyph renders **beside the username** floating over the player's head (anchored by the `playerTagEl` projection in `scene.ts`).
- Tint is per-faction: Corporate → orange (`#ff9450`), BitRunner → purple (`#b07cff`).
- When a runner has **earned but not equipped** a new badge, the floating label gains a small `!` micro-dot to draw their attention. Tapping the label opens the editor with the unacknowledged badge highlighted.
- Tapping a badge in the side-list equips it. Unequipping leaves the slot empty (no badge shown).

## In-game implications

- New `profiles.equipped_badge TEXT` column (one of the 20 keys above, or NULL).
- New `earned_badges` table tracking which tiers each user has unlocked + an `acknowledged` flag for the `!` dot.
- New SECURITY DEFINER RPC `equip_badge(p_key)` verifies ownership in `earned_badges` before writing `profiles.equipped_badge`.
- New SECURITY DEFINER RPC `award_pending_badges()` evaluates `samaritan_corporate` and `samaritan_bitrunner` columns and inserts unmatched tier rows.
- Server-authoritative on `PlayerState.equippedBadge` — the Colyseus room is the source of truth for remote-player badge display.

## Open questions

- Do **higher tiers (gold+)** show any animation or pulse on the glyph? Owner inclination = static for now; can be revisited in polish phase.
- Should equipping the **aether tier** trigger any in-world special effect (e.g. faint particle drift around the runner)? Deferred until aether-as-mechanic ships.
- Do badges show in the **emote bubble** or anywhere else besides the head label? V1 = head label only.
