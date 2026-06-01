# 0059 — Tap-to-lock camera + glow on tapped player/NPC

**Date:** 2026-05-31
**Branch:** `claude/tap-to-lock-and-glow`

Phase 5 of the six-part feature push. Greenfield — there was no raycaster, no
entity selection, no camera lock today. Tap a remote player or an NPC dweller:
the camera locks onto them and a pulsing halo + emissive glow draws on the
target. Tap them again, they disconnect, or they walk past
`LOCK_RELEASE_DISTANCE` (14 units) to release.

## What changed

### New module `apps/web/src/target-lock.ts`
- `createTargetRaycaster()` — `THREE.Raycaster` factory.
- `pickAvatar(raycaster, camera, ndcX, ndcY, candidates)` — iterates the
  candidates map, recursive intersect against each group, returns the closest
  hit's `{ id, group }`. Closest-distance wins so overlapping silhouettes
  pick the front one.
- `applyLock(id, group): LockedTarget` — traverses the target's group, snapshots
  every unique `MeshStandardMaterial`'s `emissiveIntensity` (so release can
  restore exactly), then adds a gold halo torus above the head as a child of
  the group.
- `releaseLock(lock)` — restores every captured emissiveIntensity; removes +
  disposes the halo mesh + material.
- `tickLock(lock, elapsed)` — pulses the captured materials' emissiveIntensity
  (1.0 → ~1.7× original) and slowly spins the halo. Per-frame.

### Wiring in `scene.ts`
- A `click` listener on `renderer.domElement` (not on `host`, so HUD-element
  clicks don't reach it) computes NDC and calls `pickAvatar`. Tapping a
  previously-locked target releases; tapping a new one releases the old and
  locks the new; tapping the background is a no-op (keeps the current lock).
- The camera-follow block in `tick` picks the follow target: if locked,
  follow the locked avatar's `group.position` (already wrap-anchored near the
  local player by the remote-interpolation block, so it stays seamless across
  the seam). Per frame: distance check vs `LOCK_RELEASE_DISTANCE` to
  auto-release; otherwise `tickLock(lock, elapsed)`.
- `onLeave`: if the disconnecting id matches the locked target, release first.
- `dispose`: remove the canvas click listener; release any active lock.

### Why no `OutlinePass`
`OutlinePass` is the obvious tool for selection glow in three.js, but its
depth-buffer requirements have historically been iOS-Safari-fragile (devlog
0008's recurring lesson). Mutating the target's existing
`MeshStandardMaterial.emissiveIntensity` + adding a small halo torus stays in
the plain-RGBA pipeline this codebase already uses, costs no extra render
pass, and reads at least as well at the ASCII resolution.

## Files changed
- `apps/web/src/target-lock.ts` — new (raycaster picker + apply/release/tick).
- `apps/web/src/scene.ts` — import the module; `LOCK_RELEASE_DISTANCE`
  constant; tap-lock state + canvas click listener (declared after
  `remoteAvatars` so the closure references a valid map); `onLeave` releases
  if the locked target left; camera follow + distance check + glow tick in
  the tick loop; `dispose` cleanup.
- `docs/devlog/0059-tap-to-lock-and-glow.md` — this file.
- `.claude/handoff.md` — updated.

## Honest status
- Gates green: `pnpm lint` clean (59 files), `pnpm typecheck` 8/8,
  `pnpm build` 5/5.
- **Not verifiable headless.** Need a browser + a running server to confirm:
  tap on a remote/NPC actually picks them (raycast hits register on the
  composite ASCII output), the camera follows smoothly across the seam, the
  pulse + halo read right at the ASCII glyph resolution, and the four release
  conditions all fire (tap-again, tap-target-from-locked-list, disconnect,
  distance).
- No new dependencies. No protocol bump.

## Optimisation discipline baked in
- One reusable `Vector2` in the module for NDC; no per-tap allocation.
- `pickAvatar` walks the candidate map once with `intersectObject(group,
  true)` per candidate — cheap at sphere-scale (dozens of entities).
- Captures emissive *intensities* (numbers), not whole materials, so the
  release restore is O(unique materials on the target).
- The halo is one `Mesh` (one `TorusGeometry`, one `MeshStandardMaterial`) —
  disposed on release.
- No new render pass. No depth-buffer reads.

## Next (Phase 6)
Emoticron compose → manual review → library + wheel editor. The biggest
remaining phase — needs the ~100-word DB lore Q&A with the owner. Separate
branch off latest `main`.
