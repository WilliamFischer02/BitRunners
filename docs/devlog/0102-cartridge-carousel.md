# 0102 — Nintendo-DS cartridge carousel (mega-batch 4.14)

**Date:** 2026-06-16
**Branch:** `claude/mega-batch-2026-06-16`
**Type:** P3 redesign · client-only (Pages-only deploy)

All three stages shipped in one PR (the brief permits bundling; Stage 3 is a
**CSS faux-3D** drop rather than a literal three.js ground plane, which keeps
it bounded).

## Stage 1 — drag-scroll rail

`Protocols.tsx` rewritten from discrete arrow/swipe stepping to a
drag-scrollable carousel:

- Pointer + touch drag (unified via Pointer Events) on the rail; the track
  translates with the drag and **snaps to the nearest cartridge on release**
  (`Math.round(delta / CART_W)`, clamped — no wrap).
- The centred cartridge is scaled **1.1×** and lifted **8 px**
  (`.is-focused`); off-centre cartridges shrink to 0.86× / 0.72 opacity.
- Keyboard ←/→/Enter/Esc retained. A near-zero-movement drag on the centre
  cartridge counts as a tap → insert.

## Stage 2 — worn-tape cartridge art

Pure CSS, no external assets:

- Moulded-plastic shell via layered gradients (sheen + dark body) with an
  inset highlight.
- A **procedurally-generated `feTurbulence` SVG noise** overlay
  (inline data-URI, CC0 — generated, so no attribution) at low opacity /
  `mix-blend: overlay` for the worn look.
- A colour **band** = a peeling title-label sticker (with a CSS peeled
  corner) carrying a **3-letter code** derived from the protocol label
  (`SCR`, `OBJ`, `SHO`, `TET`, `FRE`). Band colour tracks the protocol tint
  (neutral amber / br violet / corp orange).

## Stage 3 — drop into slot

Selecting a cartridge plays an eased descent into a dark slot (a radial-
gradient ellipse at the rail's base), then a stepped "click-in", then
launches:

- `cart-drop` 600 ms `cubic-bezier(0.5,0,0.7,1)` (scale 1.1→0.9, translateY
  −8→52 px) **then** `cart-click` 80 ms `steps(4,end)` brightness flicker.
- After `DROP_MS` (700 ms) the protocol's `launch()` fires and the carousel
  closes.
- `prefers-reduced-motion: reduce` → animation skipped, launches
  immediately.

## STOP-AND-ASK (feel)

Per §2, the descent curve / click duration / slot shading are a chosen
default, tunable via the constants at the top of `Protocols.tsx`
(`CART_W`, `DROP_MS`) and the `cart-drop` / `cart-click` keyframes. Flagging
for owner sign-off on feel.

## Verify (owner)

Open the protocols launcher → drag the rail left/right; it snaps to the
nearest cartridge, which reads as a worn DS cartridge with a coloured label
band + 3-letter code. Tap the centred cartridge → it drops into the slot
with a click and the protocol opens. (No headless screenshot — no
browser-automation dep; correct by inspection + clean build.)

## Files

- `apps/web/src/Protocols.tsx`
- `apps/web/src/style.css`
