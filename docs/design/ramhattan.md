# Design — RAMHATTAN (cyberpunk city district)

Status: **first slice shipped** (mega-batch 3 · P8, devlog 0154) — footprint
blockout, one shopkeeper interaction, three collectable shards. Full
build-out is **next-batch** scope. This doc is the plan of record for that
batch.

## TL;DR

A dense cyberpunk district filling the doubled map's emptiest quadrant
(SW-deep). Grayscale building masses + sparse neon through the ASCII pass;
a shopkeeper NPC as the district's anchor character; wandering street-thug
NPCs for menace; collectable data shards as the exploration loop. Reuses
existing systems end to end: dweller/4V4 NPC patterns, SAMM proximity
prompts, the dialogue registry, additive economy-blob persistence, and (once
the owner drops CC0 models) the P6 asset pipeline.

## Placement (shipped)

- **Quadrant**: SW-deep — `x ∈ [-34, -14]`, `z ∈ [-34, -22]`, centered
  `(-24, -28)`. Chosen from the live collider map: nearest existing
  obstacles are the crate cluster `(-10, -12)`, outer rust pillar
  `(-24, -20)` and long wall slab `(-6, -24)`; everything else in that
  quadrant is empty floor. All geometry stays `|coord| ≤ 34` (the
  mega-batch-2 seam-safety rule).
- **Street**: one east-west spine at `z = -28` (asphalt strip, 21×3.2).
  Six building masses flank it (3 north row, 3 south row; heights
  3.2–5.6). Coordinates in `scene.ts` (`RAMHATTAN_BUILDINGS`) mirror the
  collider list one-for-one.
- **Next batch**: a north-south cross street at `x ≈ -24` (turning the
  blockout into 4 blocks), alley in-fill between building pairs, rooftop
  detail on the two tallest masses, street furniture (existing crate/pillar
  primitives), and P6 `.glb` props where the owner has dropped them
  (`docs/assets/PIPELINE.md` — register, then place).

## Landmarks (planned)

| Landmark | Where | What |
|---|---|---|
| Keeper's storefront | N row middle (`-25.5, -24.6`) | shipped: keeper + cyan marquee. Next: interior-lit doorway, shop UI |
| The Off-Ramp | district's NE approach (`-14, -22`) | broken highway stub — arrival vista, frames the neon |
| Ember stack | S row west (`-30, -31.6`) | vertical ember sign (shipped) + rooftop antenna cluster |
| The Gutter | south edge (`z ≈ -34`) | drainage cut w/ shard spawns; thugs loiter here |

## NPCs

- **Shopkeeper** (shipped as concept): static `dweller.husk` rig at the
  storefront, SAMM-pattern proximity prompt → terminal panel reading
  `ramhattan.keeper.greeting` from the dialogue registry (admin-editable).
  **Next batch**: real shop inventory (Credits-priced cosmetics per the
  shop canon — Token items stay premium), possibly a distinct bespoke rig
  (4V4/JJJJ precedent in `dweller-rigs.ts`).
- **Street thugs** (next batch): 2–3 server-side wander NPCs
  (`sphere-room.ts` `spawnNpcs` pattern — `npc:thug:N`, a new
  `dweller.thug` className with its own silhouette in `dweller-rigs.ts`),
  wander bounds clamped to the district rectangle instead of the whole
  platform. Ambient menace only — no combat system exists; tether replies
  via `BOT_LINES` give them voice. **Server change → Fly redeploy.**

## Collectables (shipped, extensible)

- `economy.ts` gained additive `ramhattanFound: string[]` (+ merge-score
  term `len × 50` in economy-sync) — the standing pattern for ALL future
  district pickups; ids are namespaced (`shard.east_alley`, …).
- `ramhattan.ts` is the scene↔economy seam (appearance.ts precedent):
  `isShardCollected` / `pickUpShard` + a toast event.
- Reward: **250 credits/shard, exactly once** (`RAMHATTAN_SHARD_CREDITS`,
  STOP-AND-ASK default). Three shards shipped; next batch adds more +
  possibly a completion bonus (badge? owner call — badges are
  server-earned).
- Known cosmetic gap: shard meshes are scene-root (so collection hides
  them everywhere) which means they don't render on wrap clones; pickup
  distance IS wrap-aware, so behavior is correct near the seam.

## Open lore Q&A (do not invent — ask the owner)

1. What IS RAMHATTAN in canon — pre-wrap ruin? Corporate development?
   Dweller enclave? (Keeper's shipped lines deliberately hedge.)
2. Keeper's name, faction lean (Corporate vs BitRunner Samaritan ties),
   and what the shop stocks.
3. What data shards ARE (Token-adjacent? scraped memories?) and whether
   collecting all of them should mean something.
4. Street-thug faction/motive; whether they interact with reputation.

## Costs / perf

Zero new services. Client geometry: 6 scaled unit boxes + street + 3 signs
+ 1 dweller rig per tile clone (~11 draw-ish additions ×9 clones, shared
materials) + 3 scene-root shards; one extra proximity check per tick in
the cloud branch. Street thugs would add 2–3 entries to the existing NPC
sim — negligible on the 256 MB Fly box.

## Sequencing (next batch)

1. Owner lore Q&A (above) → dialogue + naming pass.
2. Cross street + alleys + street furniture (client-only).
3. `dweller.thug` rig + server wander-bounds patch (Fly redeploy).
4. Shop UI on the keeper (reuse ShopInventoryModal catalog plumbing).
5. P6 asset placements as drops arrive.
