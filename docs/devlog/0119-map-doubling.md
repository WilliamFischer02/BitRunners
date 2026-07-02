# 0119 — Double the base map (mega-batch 2 · 4.6, part 1)

**⚠️ Merging this triggers a Fly redeploy** — `packages/shared` changed and the
server bundle derives its wrap / spawn / dweller-wander bounds from it.

## What

Doubled the playable area to open up the interior for the new landmarks (part 2).

- **`packages/shared/src/index.ts`** — `PLATFORM_HALF` 19 → **38**
  (`PLATFORM_SIZE` 76). Client and server both import this, so the change
  retunes both sides on the next coordinated deploy. **No `PROTOCOL_VERSION`
  bump** — the wire shape is unchanged (positions are plain floats; the version
  only appears in the `/health` payload and isn't gated on the client).
- **`apps/web/src/Starmap.tsx`** — removed its hardcoded `PLATFORM_HALF = 19`
  (the last duplicate) and now imports `PLATFORM_HALF`/`PLATFORM_SIZE` from
  `@bitrunners/shared`, so the minimap can't drift from the world size again.
  `MAP_RANGE` 22 → **34** to keep the minimap density readable at the new scale
  (taste — flagged).
- **`apps/web/src/scene.ts`** — added 8 obstacles (≈2× the Phase-3 set) spread
  through the doubled interior, all off the seam (`|coord| ≤ 30 < 34`), each
  with a matching `COLLIDERS` entry + mesh. The existing traces/tufts already
  scatter across `PLATFORM_SIZE`, so they fill the larger tile automatically.
  Skybox cylinder radius 45 → **90** so the backdrop still encloses the
  visible near-field (it follows the player each frame). Fog derives from the
  platform constants, so it retunes automatically — no change needed.

## Anchors kept fixed

SAMM `(6, -5.5)`, obelisk `(5.5, 5.5)`, port `(-6.5, -6.5)`, terminal
`(-5.5, 6.5)` are unchanged, so existing missions, minimap anchors, and lore
stay valid — they now sit nearer the center of a bigger world.

## Server

No server *file* change — `sphere-room.ts` already imports `PLATFORM_HALF`
/`PLATFORM_SIZE` for `wrapAxis`, `randCoord` (dweller spawn), and the spawn
ring, so the doubling flows through on rebuild. The `[1.5, 4.0]` newcomer spawn
ring stays near origin (still clear of the center decor).

## Verify (owner)

- Walk to a seam: the world still wraps seamlessly, now at ±38.
- The interior feels populated (more obstacles further out), not empty.
- Minimap shows the wider area at a sensible density.
- Two clients still see each other correctly across the (larger) seam **after
  both load the redeployed build** (coordinated Pages + Fly deploy).

## Follow-up

Part 2 (devlog 0120) adds the two landmarks in the freed-up interior: the
glitch switch and the pressure-plate vault → void room.
