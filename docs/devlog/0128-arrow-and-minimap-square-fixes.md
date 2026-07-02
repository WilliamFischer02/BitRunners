# 0128 — Feet-arrow direction + fullscreen minimap square

Two follow-up fixes on the round-2 work (devlog 0127).

## Feet-arrow pointed at the player, not away (`scene.ts`)

The ground arrow's cone tip was aimed **back at the runner** instead of at the
landmark. Cause: `ConeGeometry`'s tip is +Y, and `rotation.x = -Math.PI/2` laid
it flat with the tip toward **−Z**, while the group is aimed with
`rotation.y = atan2(dx, dz)` (which points **+Z** at the target). So the tip
ended up opposite the aim. Fixed by rotating the cone `+Math.PI/2` (tip → +Z),
so the tip now points at the nearest landmark / maze core.

## Fullscreen minimap still looked vertically stretched (`Starmap.tsx`)

The joystick passthrough from 0127 worked, but the maximized map still read as
stretched. Root cause: the canvas draw buffer was set to `clientWidth ×
clientWidth` (assumed square) while the element could render non-square, so the
square buffer got CSS-stretched to fill it.

Fix: `paint()` now takes the canvas's **real width and height** and draws a
**centered square** (`size = min(w, h)`), projecting everything off the center
with a uniform scale — the map can no longer stretch regardless of the
element's aspect. Both canvas effects now set `canvas.width/height` to the
actual `clientWidth`/`clientHeight` and pass both to `paint`. On a square
element it fills it; on a non-square one it's a centered square (letterboxed) —
always square, always as large as fits.

## Note: branch state

The environment was found on `main` (owner merged mega-batch 2 via PR #122);
all round-2 work lives on `claude/mega-batch-2026-07-01`. Switched back to that
branch to continue — nothing was lost. `main` has advanced, so the round-2
commits (devlogs 0123–0128) want a fresh PR from the branch.

## Verify (owner)

- Near a landmark, the feet-arrow's point now aims **toward** it (and toward the
  core inside the maze).
- Tap the minimap to maximize → it's a large, undistorted **square** and the
  joystick still works underneath.
