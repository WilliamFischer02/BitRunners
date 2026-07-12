# 0154 — RAMHATTAN: design doc + first buildable slice (P8)

The cyberpunk district gets its plan of record and its first streets.
Deliberately a SLICE — the launch brief caps P8 at the design doc plus
one buildable pass; full build-out is next batch
(`docs/design/ramhattan.md` §sequencing).

## Design doc

`docs/design/ramhattan.md`: placement rationale (SW-deep quadrant —
picked from the live collider map, everything |coord| ≤ 34 per the
seam-safety rule), street-grid plan, landmark list, shopkeeper +
street-thug NPC concepts (dweller/4V4 patterns; thugs are a
server-change item), collectables scheme, costs, and **four open lore
questions the owner must answer before the district gets named canon**
(what RAMHATTAN is, the keeper's identity/stock, what shards are,
thug faction). Shipped keeper copy deliberately hedges.

## Shipped slice

- **Blockout** (client-only, in `worldTile` → tiles across the wrap):
  6 grayscale building masses (two shared materials, one scaled unit
  box) flanking an asphalt street at z = −28, plus 3 emissive signage
  strips (cyan marquee over the keeper, ember vertical, NE marquee) —
  neon reads as glow through the ASCII pass. Building footprints +
  keeper mirrored into `COLLIDERS`.
- **Keeper** (concept-grade): static `dweller.husk` rig at the
  storefront; SAMM-pattern edge-triggered range event →
  `RamhattanKeeper.tsx` walk-up prompt (`⌂ talk to the keeper`) →
  terminal panel reading `ramhattan.keeper.greeting` from the
  dialogue registry (admin-editable, placeholder copy). No shop yet.
- **Collectables**: 3 spinning data shards in the district's gaps.
  New additive economy field `ramhattanFound: string[]` (+ merge-score
  term ×50 so shard hunts survive cross-device merges), compound
  mutator `collectRamhattanShard` granting **250 credits exactly once
  per id** (STOP-AND-ASK default, `RAMHATTAN_SHARD_CREDITS`).
  `ramhattan.ts` is the scene↔economy seam (appearance.ts precedent —
  scene.ts still never imports economy internals). Pickup fires a
  toast (`+250¢ · data shard secured · n/3`, grant-toast styling).
- Shards are scene-root, not tiled: collecting hides them outright.
  Wrap-clone visitors don't see the shard mesh but CAN still collect
  (distance check is wrap-aware) — cosmetic gap, noted in the doc.

## No server change in this slice

Street thugs (the only server-touching P8 item) are specced, not
built. This commit is Pages-only.

## Owner verify

1. Head SW (feet-arrow won't point there — not a landmark yet; follow
   the minimap to (−24, −28)). Six buildings + street + neon appear;
   buildings block movement.
2. Approach the husk at the storefront → prompt → panel shows the
   four keeper lines; edit them in the admin dialogue console to
   confirm registry wiring.
3. Grab the three shards (east alley, west gap, south gutter):
   +250¢ toast each, credits HUD climbs, reload — they stay gone.
4. Read `docs/design/ramhattan.md` and answer the §lore Q&A when
   ready — next batch builds on those answers.

Gates: biome · typecheck 8/8 · test 85/85 · build 5/5 · bundle OK.
