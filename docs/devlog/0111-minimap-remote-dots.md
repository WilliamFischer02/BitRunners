# 0111 — Live remote runners as dots on the Spectrum Navigator

## TL;DR

- The minimap (Spectrum Navigator) now shows every other runner in the
  sphere as a small purple dot. Same wrap-aware projection as the
  SAMM / ADMIN / OBJ pins; offscreen runners clamp to the disc edge so
  they're still discoverable.
- Wired through the existing minimap-state event channel — no new
  re-render mechanism, no per-frame allocation past a single scratch
  array shared between scene.ts and the minimap consumer.

## How it's plumbed

1. **`minimap-state.ts`** gains a `MinimapRemote` type plus
   `publishMinimapRemotes()` / `getMinimapRemotes()`. Re-uses the
   `bitrunners:minimap-tick` event for dirty signalling — the Starmap
   already repaints on tick, so no second channel is needed.
2. **`scene.ts`** publishes once per tick. After
   `publishMinimapTick(...)` (NET_SEND_HZ ≈ 15 Hz), the scene fills a
   reusable `minimapRemotesScratch: MinimapRemote[]` from the existing
   `remoteAvatars` Map (reading `ra.group.position.x/z`) and hands it
   to `publishMinimapRemotes()`. The scratch array is cleared on scene
   dispose by publishing an empty array so the dots disappear when the
   game scene unmounts.
3. **`Starmap.tsx`** reads remotes inside `paint()` and draws each as:
   - A 1.4 px halo (alpha 0.25 on-screen, 0.15 off).
   - A core dot (`#b07cff` at 1.8 px small / 2.6 px expanded).
   Drawn before the local player marker so the centre always reads as
   "you". Offscreen remotes clamp to the disc edge using the same
   `Math.atan2` heuristic as the anchors and the objective pin.

## Why purple

Existing palette: `#ffd860` (SAMM), `#b07cff` (ADMIN), `#6cf0ff` (OBJ),
`#c0ffd6` (player). Remotes share the BitRunner-purple `#b07cff` with
the Admin obelisk — they read as "another bitrunner". If we ever need
to distinguish bot runners from real ones, a second tint would slot in
naturally.

## Cost

- Per tick (~67 ms): one array clear + N pushes (N ≤ 40 per sphere
  cap). Trivial.
- Per Starmap paint: one allocation-free loop over the same array.
- No new event dispatch path; piggybacks the tick event.

## What I didn't do

- **Per-remote nametags on the map.** The full nametag (display name +
  badge + Lv) is already painted by the 3D scene. Adding name labels
  to the minimap would crowd it; the dot density already conveys
  "people are here". Easy follow-up if it's wanted.
- **Hostile / blocked / aether discrimination.** All remotes get the
  same tint. The block-list check could downgrade blocked runners to a
  greyer dot — TBD by you.
- **Dot animation on movement.** They're just position dots. A trailing
  fade would be cute but adds per-frame state.
