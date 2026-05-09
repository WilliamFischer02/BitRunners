# 0015 — True seamless wrap via 3×3 tile rendering

**Date:** 2026-05-09

Owner said "continue with your development plan." Picking up the deferred item from devlog 0014: making the plane wrap genuinely seamless instead of the visible 1-frame snap.

## Approach

All world content (platform, grid lines, port + inside, vending machine + screen + slot, monolith + glow seam, terminal + screen, 36 grass tuft clusters) was previously added directly to `scene`. This commit collects all of it into a single `worldTile: Group`, then **clones it into a 3×3 grid** centered on the origin:

```ts
for (let dx = -1; dx <= 1; dx++) {
  for (let dz = -1; dz <= 1; dz++) {
    if (dx === 0 && dz === 0) {
      scene.add(worldTile);
    } else {
      const tile = worldTile.clone();
      tile.position.set(dx * PLATFORM_SIZE, 0, dz * PLATFORM_SIZE);
      scene.add(tile);
    }
  }
}
```

`Object3D.clone(recursive=true)` clones the meshes but **shares geometry and material references** — so when `portInsideMaterial.emissiveIntensity` is updated each frame for the pulse, all 9 port copies pulse in sync. Memory cost is just the additional `Mesh` and `Group` wrapper objects, ~9× of what `worldTile` was. Geometries/materials are deduplicated by reference.

## Why this makes the wrap seamless

The player still wraps modularly within `[-PLATFORM_HALF, +PLATFORM_HALF]`. Before the wrap, the player at `+9.5` looks at world content from approximately `-2.5` to `+21.5` on X. With the new tiled rendering, content exists at `-PLATFORM_SIZE`, `0`, and `+PLATFORM_SIZE`, so the camera's view always overlaps with at least two tiles' worth of content. After the wrap to `-9.5`, the visible range becomes approximately `-21.5` to `+2.5`, which lands on the tiles centered at `-PLATFORM_SIZE` and `0`.

Because each tile is an exact clone of every other tile, the **visible content distribution is identical before and after the wrap**: same props at the same screen-relative positions, same grass at the same screen-relative positions, same shadows. The wrap moves the player but the visible world looks unchanged.

## Toroidal port-proximity

The port pulse previously used Euclidean distance to the single port instance. With 9 port copies that doesn't make sense — the closest port is in whichever tile contains the player. Computed via toroidal distance:

```ts
const portRelX = rig.root.position.x - port.position.x;
const wrappedDx = ((((portRelX + PLATFORM_HALF) % PLATFORM_SIZE) + PLATFORM_SIZE) % PLATFORM_SIZE) - PLATFORM_HALF;
// same for Z
const portDist = Math.sqrt(wrappedDx * wrappedDx + wrappedDz * wrappedDz);
```

This always returns the distance to the **nearest** port copy across all 9 tiles. The pulse then drives all 9 ports together (since they share the material), but the proximity boost reflects the player being close to **a** port rather than specifically to the central one.

## What didn't change

- Plane wrap: same modular `position.x/z` adjustment as in 0014
- Player position math: still in `[-PLATFORM_HALF, +PLATFORM_HALF]`
- Skybox: still follows the player, unchanged
- Character render path, glow gradient, edge silhouettes, vertical tint blend: all unchanged
- Lighting: HemisphereLight, sun, and fill all `layers.enableAll()` so tiles are lit identically

## Performance

Mesh count went up ~9× for the world content. Counts:

- Pre-tile: ~50 meshes (platform + grid + 4 props + 36 tufts × ~4 blades)
- Post-tile: ~450 meshes

Three.js' frustum-cull and instancing-free pipeline handles this fine at 60 fps on the test machine. If owner's iPhone reports a drop, easy fall-back is to skip cloning the grass tufts (the heaviest mesh count contributor) — they'd appear only in the central tile, and the wrap would still be seamless for the platform/grid/props.

## Build

- 28 files lint-clean, build green
- Bundle: 642.93 → 643.27 kB (+340 B for the tile-clone loop and toroidal distance calc)

## Action

If the wrap now feels truly seamless (no visible snap when crossing edges), Phase 1 visual work is closed and we're clear to move to Phase 2 networking — `apps/server` real Colyseus + Fastify + Lucia auth + Neon connection. If the wrap still feels jarring, the most likely remaining cause is camera position interpolation; can add a 3-frame lerp on `camera.position` to smooth the transition.

## What's next

1. Stage B v0.2 normal-direction glyphs (still queued, lower priority now)
2. **Phase 2 networking** — once owner signs off on visuals
3. Class-select login screen as the lead-in to multiplayer
