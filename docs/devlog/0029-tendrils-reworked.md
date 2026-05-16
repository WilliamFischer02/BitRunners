# 0029 — Tendrils reworked: ground dashes, sparse, fade in place

**Date:** 2026-05-16

Owner feedback on the tendril particles from devlog 0027: they were too many, too block-y, rose toward the player, and spread too wide. Wanted: closer to the character, thin dashes/lines instead of blocks, spawn only under the runner, stay where they spawn and fade in place, far fewer, near-invisible when idle.

Full rework of the tendril section in `apps/web/src/scene.ts`.

## Changes

| Aspect | Before (0027) | After |
|---|---|---|
| Geometry | `0.05 × 0.42 × 0.05` tall box (reads as `█` column) | `0.26 × 0.014 × 0.045` flat dash (reads as `-`/`:`/`'` sliver) |
| Spawn radius | 0.4–2.0 units (wide ring) | 0.12–0.54 units (directly under the character) |
| Motion | rose upward at 0.8–1.7 u/s | **stationary** — stays exactly where it spawned |
| Fade | y-scale shrank | `emissiveIntensity` + `opacity` fade on an ease-out `1 − t²` curve, in place |
| Spawn rate (moving) | 14/sec | **4/sec** |
| Spawn rate (idle) | 1.6/sec | **0.35/sec** (≈ one every 3 s — almost invisible) |
| Pool size | 36 | 24 |
| Material | one shared | per-particle (so each fades independently) |
| Orientation | random Y | random Y, plus random length scale 0.7–1.4 for varied dashes |
| Lifetime | 1.1–1.8 s | 1.4–2.5 s (slower, gentler fade since they no longer travel) |

## Why per-particle materials

Fading `emissiveIntensity`/`opacity` independently per dash requires each mesh to own its material. 24 `MeshStandardMaterial` instances is negligible memory and lets each dash fade on its own clock from where it was dropped. The shared geometry is still shared (one `BoxGeometry`), and both the geometry and the 24 materials are disposed on scene teardown.

## Visual result

The runner now leaves a faint, sparse trail of thin glowing dashes on the ground beneath itself as it glides — like exhaust or a dropped data-wake — that linger briefly and dim out in place rather than streaming upward. Standing still produces almost nothing (a dash every ~3 seconds), so an idle player on the platform is clean.

Pairs naturally with the levitate-trail body animation from 0028: the figure leans and its limbs sweep back while a thin wake of dashes scatters under it, then everything settles when it stops.

## Build

- 40 files lint-clean
- Typecheck + build green
- Bundle unchanged (logic-only)

## Files changed

- `apps/web/src/scene.ts` — tendril geometry, spawn confinement, stationary + in-place fade, lower rates, per-particle materials, disposal

## Still queued (owner-pending: Supabase/Resend/OAuth)

- Display-name input + approval queue
- Persisted "met The Admin" + inventory/achievements/samaritan
- 20 achievements design (needs the faction-reward Q&A)
- Steam OpenID worker
