# Handoff — 2026-05-31, Phase 3 (world + collision + dwellers) DONE

## The plan (7 phases)

| # | Phase | Status |
|---|---|---|
| 1 | Render polish (fog, ordered dither, CRT) | **MERGED — PR #54** |
| 2 | Class identity + pet behaviours + clothing | **MERGED — PR #57** |
| 3 | **2× world + obstacle collision + AI dwellers (`npc:*` render)** | **DONE — this PR** |
| 4 | Tutorial highlighting + account CTA | queued (next) |
| 5 | Tap-to-lock camera + glow | queued |
| 6 | Emoticron compose → review → library + wheel editor | queued |
| 7 | Optimisation sweep | queued |

## Phase 3 — what I did (devlog 0057)

- **`packages/shared/src/index.ts`** — `PLATFORM_HALF`/`PLATFORM_SIZE` moved
  here (doubled to 19/38) so server + client can't drift. Plus
  `DWELLER_ARCHETYPES` const + `DwellerArchetype` type.
- **`apps/server/src/sphere-room.ts`** — imports the shared platform consts;
  `spawnNpcs()` cycles `p.className` over the dweller archetypes so each NPC
  has a server-side label.
- **`apps/web/src/colliders.ts`** (new) — wrap-aware circle-vs-AABB,
  axis-separated `slideMoveInto()`. Allocation-free; mutates a Vector3 in
  place.
- **`apps/web/src/dweller-rigs.ts`** (new) — three archetype builders
  (`robot`/`husk`/`spirit`) routed by `buildDweller(kind)`. Cheap shells,
  no animation (server drives position/rotation).
- **`apps/web/src/scene.ts`** — drops the local platform consts; adds
  `COLLIDERS` registry (10 entries: 4 existing decorations + 6 new
  obstacles) + 6 new obstacle meshes inside `worldTile`; movement integration
  uses `slideMoveInto`; `onJoin` routes `npc:*` ids to `buildDweller`.

### Behaviour change to flag
The four original decoration props (port, vending, monolith, terminal) used to
be **walk-through**. They now **block movement**. If any need to stay
walk-through for an interaction reason, comment out the corresponding entry in
`COLLIDERS`.

## State of the build

- **prod `main`** at `c4d9dc1` (PR #57 merged). Migration **0006 still
  pending**.
- **This branch** `claude/world-collision-and-dwellers` is off latest `main`.
- **CI/gates:** green — `pnpm lint` clean (58 files), `pnpm typecheck` 8/8,
  `pnpm build` 5/5.

## What's blocking / not verified

- **Not verifiable headless.** Need a browser + a running server to confirm
  the doubled world reads right (camera/perf), the dwellers spawn with
  distinct archetypes, obstacle collision feels right (sliding, no hitches),
  and there are no perf regressions from the additional meshes.
- **Migration 0006** still pending (owner action).

## What I would do next, in priority order

1. **Owner:** review Phase 3 PR — verify dwellers, obstacles, world scale, no
   regressions in routing/movement/multiplayer.
2. **Owner:** run migration 0006 (still pending).
3. **Phase 4** — tutorial step highlighting + post-tutorial account CTA. Same
   branching pattern.

## Do NOT do these things

- Don't push to `main` — prod branch; deploys Pages + Fly.
- Don't merge any PR — owner-gated.
- Don't re-add local `PLATFORM_HALF` consts in client/server — they live in
  `@bitrunners/shared` now and changing them in one place desyncs the wrap.
- Don't allocate inside `slideMoveInto` — the per-frame budget depends on its
  allocation-free contract.
- Don't add a client-side `profiles` UPDATE of `role`/`tier` — re-opens the
  escalation hole fixed in migration 0006.
- Don't reach for `DepthTexture`/MRT/float targets in the ASCII pipeline (iOS,
  devlog 0008).
- Don't unilaterally write emoticron lore (Phase 6 needs Q&A).

## Open questions for the owner

- World scale feels right doubled, or should we go further?
- Each dweller archetype reads as intended — robot/husk/spirit silhouettes
  clear enough at this density?
- Obstacle collision feel: any obstacles you'd want walk-through, or any
  that need a wider/tighter footprint?
- Migration 0006? (Strongly yes.)
