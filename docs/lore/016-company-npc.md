# 016 — The Company NPC

## Question

What does The Company NPC look like? Where does it stand in the world? How does it dispense quests?

## Answer (canon — owner Q&A 2026-06-03)

### Form: suited humanoid that patrols

The Company NPC is a **walking suited humanoid** — a corporate front-face that patrols a small route through the cloud. Reuses the existing `hash_kicker` rig (chrome with orange branding, single visor strip, exaggerated shoulder pads, Company chest stripe — per `apps/web/src/class-rigs.ts`).

Tonally: professional, transactional, structured — matches the Company voice in `004-quests-and-samaritan-status.md`. The NPC does NOT speak unless approached. When idle on patrol, occasionally emits a corporate-flavored emote (think `[ok]` or `[+1]`).

### Placement

- Spawns **near the spawn ring**, on the **opposite side** of the world from The Admin obelisk.
- Patrols a **short ~6-unit triangular route** centered on a "corporate kiosk" prop (a small chrome-and-orange terminal mesh). The route gives runners a chance to intercept; the kiosk serves as a fixed reference for the minimap pin.
- Patrol speed: same as ambient NPCs (~2.2 units/sec). Pauses ~3s at each route vertex.

### Interaction

- Approaching within ~3 units triggers a dialogue overlay (same component shape as `AdminDialogue.tsx`, but Company-styled — orange palette, sharper typography).
- V1 dialogue is a **placeholder stub** (Sub-Phase F scope). Real quest dispatch lands in Sub-Phase G alongside the mission system.

### Stub dialogue (V1 — Sub-Phase F)

**Opening (Company NPC, polished):**

> ":// Corporate channel open. State your business, runner."

**Three placeholder choices** (none have meaningful effects in V1):

- *"// I'm just looking around."* → closes the dialogue.
- *"// Show me Company missions."* → V1 reply: *"// Mission feed not yet contracted. Check back."* (real wiring in Sub-Phase G).
- *"// I want to file a report."* → V1 reply: *"// Report channel queued. Compose via terminal."* (placeholder).

The NPC does not currently award any Samaritan in V1 — all reputation flows through the Sub-Phase G mission system.

### Minimap pin

The Company NPC's **kiosk position** (not the patrolling humanoid) anchors the minimap pin. This prevents the pin from jitter-walking around as the patrol route loops. Tint: corporate orange (`#ff9450`).

## In-game implications

- New `apps/web/src/company-npc.ts` — patrol logic + kiosk mesh placement. Reuses `class-rigs.ts` `hash_kicker` builder for the humanoid.
- `scene.ts` adds the kiosk mesh + NPC group on init, ticks the patrol in the existing animation loop.
- `apps/web/src/CompanyDialogue.tsx` — placeholder dialogue overlay, Sub-Phase F. Replaced by mission dispatch in Sub-Phase G.
- Minimap pin coords come from a constant export — `Starmap.tsx` (Sub-Phase F) reads it on each tick.

## Open questions

- **Owner: review patrol route placement.** Current spec puts it diametrically opposite the Admin obelisk. If the world layout has a more thematically appropriate spot (a depot cluster, a particular tile), owner can re-anchor.
- **Owner: review kiosk visual.** V1 stub is "small chrome-and-orange terminal" — owner may want richer (e.g. a holographic Company logo above it).
- **Should the NPC be killable / hostile?** No — Company is a quest-giver, not a combat target. World is non-combat per current canon.
- **Voice / sound design**: deferred to Phase 4 audio pass.
