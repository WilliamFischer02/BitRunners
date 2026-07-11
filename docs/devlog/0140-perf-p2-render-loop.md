# 0140 — Perf P2: render-loop hygiene

Tier P2 of the performance pass (baseline 0137 · P0 0138 · P1 0139).
Steady-state per-frame work in the scene tick and the freq_lock minigame.

## What changed

- **FreqLock**: the rAF loop called `setSongMs(now)` every frame —
  a full React re-render of the entire panel (header, overlays, beams,
  targets, blips) at 60 fps for the whole 60-second song. The travelling
  waveform blips are now DOM nodes owned by the rAF loop inside a
  dedicated `blipLayerRef` layer (created/positioned/removed
  imperatively; same classes, same geometry, same math), and the
  countdown chip writes `textContent` only when the second flips. React
  now re-renders only on real events: taps, misses, phase changes.
  Gameplay untouched — hit windows, scoring, chart generation, tap
  handling are byte-identical.
- **scene.ts tick loop**:
  - `host.clientWidth/clientHeight` were read up to 4× per frame for tag
    and emote projection — a potential forced synchronous layout. The
    host size is now cached in `hostW/hostH`, refreshed by the existing
    ResizeObserver.
  - `updateFeetArrow()` allocated a fresh 4-element array of object
    literals every tick; the landmark targets are hoisted and the active
    mission checkpoint is pushed by reference (`activeCheckpointXZ` no
    longer clones it).
  - Remote name tags: opacity + transform were written unconditionally
    per avatar per frame. Writes are now skipped when the projected
    result is unchanged (stationary remote + stationary camera). The
    self tag keeps its per-frame transform (the hover bob is meant to
    ride it) but only writes opacity on visibility flips.
  - Minimap remotes: the scratch array was already reused, but each
    ~67 ms emit allocated a fresh `{id, x, z}` per remote (~600 objs/s
    at a full 40-runner sphere). Entries now come from a mutate-in-place
    pool. minimap-state consumers read latest-on-demand, so in-place
    mutation is semantics-preserving.

## Before → after

| metric | before | after |
| --- | --- | --- |
| FreqLock React renders during play | ~60/s × 60 s | event-driven only (~taps + misses) |
| tick-loop `clientWidth/Height` reads | ≤4/frame (~240/s) | 0 (cached, resize-driven) |
| feet-arrow allocations | ~5 objects + 1 array per tick | 0 |
| remote-tag style writes (idle scene) | 2 × N remotes per frame | 0 until something moves |
| minimap remote allocations | ~N objs / 67 ms | 0 (pooled) |
| FreqLock chunk | 5.43 / 2.21 gzip kB | 6.10 / 2.51 gzip kB (+0.3 — imperative layer) |
| entry / Game chunks | 12.43 / 61.96 gzip kB | 12.43 / 62.09 gzip kB |

## Behavior notes (conservative calls)

- freq_lock feel is unchanged: same TRAVEL_MS/HIT_WINDOW/PERFECT_WINDOW,
  same scoring, same blip visuals (identical class names + style math).
  A tapped blip now disappears on the next frame (≤16 ms) instead of the
  same React commit — imperceptible.
- Remote tags still track instantly when anything moves; the skip only
  fires when the computed style strings are identical.
- Self tag transform intentionally still writes per frame — the hover
  bob animates the projected Y every frame, so caching would never hit.

Gates: biome ✓ · typecheck 8/8 ✓ · test 46/46 ✓ · build 5/5 ✓.
