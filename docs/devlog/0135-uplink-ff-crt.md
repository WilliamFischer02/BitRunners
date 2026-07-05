# 0135 — UPLINK button, real fast-forward, global CRT overlay

## Three owner asks

1. **Title button** `[ LINK ]` → `[ UPLINK ]`. Copy only.
2. **Boot scroll fast-forward.** Hold-anywhere already existed
   (mouse / touch / any key set `heldRef`) but per-char updates at a
   "1 ms" timeout still crawled — browsers clamp setTimeout to ~4 ms,
   so long lines took ~their length × 4 ms. Held now completes the
   WHOLE line in one paint and hops lines at 12 ms, which reads as a
   true fast-forward. A subtle `hold anywhere to fast-forward ≫` hint
   shows during the scroll (hidden once done) so players discover it.
3. **CRT / VHS effect across the entire game.** Yes — feasible and
   cheap. The 3D scene already has a WebGL CRT pass, but menus /
   panels / title / board are DOM, so the game-wide treatment is a
   single fixed, click-through overlay above everything
   (`.crt-overlay`, z-index 9999, pointer-events none):
   - fine 4 px-period scanlines (multiply blend, 0.55 opacity —
     subtle by design),
   - a slow VHS roll band drifting down every ~9 s,
   - `prefers-reduced-motion` removes the roll, keeps static
     scanlines.
   One div, no JS, composited — effectively free on every surface
   including future menus.

## Tuning knobs

Scanline darkness (`rgba(0,0,0,0.14)`), overlay opacity (0.55), roll
period (9 s) and band brightness are all in the `.crt-overlay` block —
flag if prod feels too heavy/light.
