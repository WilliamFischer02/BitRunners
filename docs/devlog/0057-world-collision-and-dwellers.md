# 0057 — 2x world + obstacle collision + dweller archetypes

**Date:** 2026-05-31
**Branch:** `claude/world-collision-and-dwellers`

Phase 3 of the six-part feature push. Three threads:

1. **The world is now 4x its previous area** (`PLATFORM_HALF 9.5 → 19`).
2. **Solid obstacles you slide against** — the four original decoration props
   (port, vending, monolith, terminal) now block movement, plus six new
   scattered obstacles in the doubled interior.
3. **Server NPCs render as dweller archetypes** (`robot | husk | spirit`).
   They were already broadcast as `PlayerState` rows — the previous client
   just shaded them as default bit_spekter remotes. The server now tags each
   NPC's `className` with a `dweller.*` value; the client routes `npc:*` ids
   to a new `buildDweller()`.

## World scale (`packages/shared/src/index.ts`)

`PLATFORM_HALF` + `PLATFORM_SIZE` moved into `@bitrunners/shared` and **doubled
to 19 / 38**. Both `apps/server/src/sphere-room.ts` and `apps/web/src/scene.ts`
now import the canonical values — defining them in two places previously
courted client/server desync. Decorations (port/vending/monolith/terminal)
stay at their original interior positions (still <±7 from centre), so they're
the same prop placement in a much larger world. Fog near/far derive from
`PLATFORM_*` so the depth cue auto-retunes; trace + tuft scatter and the 3×3
tile clone offsets all use the constants and scale up automatically.

## Obstacle collision (`apps/web/src/colliders.ts`, new)

- **Circle vs AABB**, **wrap-aware** (`wrapDelta` so an obstacle near the seam
  still blocks across the wrap), **axis-separated slide**: try the X step,
  reject it on overlap; then try Z against the resolved X. This is the
  classic cheap "slide along walls" that doesn't need a physics engine.
- **Allocation-free** — `slideMoveInto(pos, nextX, nextZ, r, cs)` mutates the
  passed Vector3 in place; no per-frame Vec3/object churn in the tick.
- **PLAYER_RADIUS = 0.35**, tuned to the bit_spekter torso footprint.
- **COLLIDERS** is a 10-entry `readonly BoxCollider[]` in `scene.ts`; collision
  is O(n) per axis × 2 axes ≈ 20 cheap math ops per moving tick. Trivial.
- The four original decoration colliders are present (port/vending/monolith/
  terminal) — **behaviour change:** these used to be walk-through, now they
  block. Reads as "real props".
- Six new obstacles scattered through the doubled interior (rust pillar,
  debris stack, broken column, crate cluster, wall slab, standing slab) with
  visual meshes inside `worldTile` (so they appear in all nine wrap clones)
  and matching collider entries (collision is wrap-aware so canonical
  colliders cover the visual clones).

### Behaviour-change note

Previously you could walk through the port / vending / monolith / terminal.
Now you slide against them. If owner wants any of them to remain walk-through
for an interaction reason, comment out that entry in `COLLIDERS` — the visual
mesh is unaffected.

## Dweller archetypes

### Server — tag NPC className with the archetype

`apps/server/src/sphere-room.ts`: `spawnNpcs()` now cycles `className` over
`DWELLER_ARCHETYPES` (`dweller.robot | dweller.husk | dweller.spirit`). With
`NPC_COUNT=4`, four spawn = robot/husk/spirit/robot (still mixed).
**No PROTOCOL_VERSION bump** — `className` is an existing string field and the
server payload shape is unchanged.

### Client — dispatch `npc:*` ids to `buildDweller()`

`apps/web/src/scene.ts` `onJoin`: if `p.id.startsWith('npc:')`, route to
`buildDweller(p.className)`; otherwise the existing per-class
`buildRemoteAvatar()` path. Old clients (pre-merge) will see the `dweller.*`
className fall through `REMOTE_LOOKS` to the bit_spekter default — they still
render, just with no archetype. **No protocol break.**

### `apps/web/src/dweller-rigs.ts` (new)

| Archetype | Silhouette | Palette | Distinct details |
|---|---|---|---|
| **robot** | Boxy industrial, single visor strip, small antenna | cool blue | cyan emissive visor + central stripe |
| **husk** | Hunched dark hollow, slumped forward (root.rotation.x = 0.14) | charcoal | sunken ember eye sockets, tattered cloth hangs |
| **spirit** | Translucent, cone body, halo above | purple/teal w/ strong emissive | flat halo torus, two trailing wisp orbs, transparent materials |

NPCs are non-animated on the client (the server already drives position +
rotation via PlayerState); these are cheap 7-10 mesh shells, sized for the
archetype. No `walk` animation, by design.

## Files changed
- `packages/shared/src/index.ts` — new `PLATFORM_HALF`, `PLATFORM_SIZE`,
  `DWELLER_ARCHETYPES`, `DwellerArchetype`.
- `apps/server/src/sphere-room.ts` — import shared platform consts; cycle
  `className` over `DWELLER_ARCHETYPES` in `spawnNpcs`.
- `apps/web/src/colliders.ts` — new (`BoxCollider`, wrap-aware `slideMoveInto`).
- `apps/web/src/dweller-rigs.ts` — new (three archetype builders + router).
- `apps/web/src/scene.ts` — import shared platform consts + new modules; drop
  the local platform consts; add `COLLIDERS` registry + six new obstacle
  meshes inside `worldTile`; movement integration uses `slideMoveInto`;
  `onJoin` routes `npc:*` to `buildDweller`.
- `docs/devlog/0057-world-collision-and-dwellers.md` — this file.
- `.claude/handoff.md` — updated.

## Honest status
- Gates green: `pnpm lint` clean (58 files), `pnpm typecheck` 8/8,
  `pnpm build` 5/5.
- **Not verifiable headless.** Need a browser + a running server to confirm
  dwellers spawn with distinct archetypes, the player slides against
  obstacles, and the doubled world feels right (camera/perf).
- No new dependencies. No protocol bump.

## Optimisation discipline baked in
- Module-level shared materials for the two new obstacle styles
  (`obstacleRustMat`, `obstacleStoneMat`) — every Phase 3 obstacle reuses one
  of two materials.
- `slideMoveInto` is allocation-free; collision is O(n) over a 10-entry list.
- Dweller rigs are non-animated shells; the existing remote-avatar tick path
  (exponential smoothing of x/z/rotY) drives them with no extra branching.

## Next (Phase 4)
Tutorial highlighting (the existing 6-step `Tutorial.tsx` doesn't actually
*point at* the elements it talks about) + the "Make Account to Save Progress"
CTA after the tutorial reward phase. Separate branch off latest `main`.
