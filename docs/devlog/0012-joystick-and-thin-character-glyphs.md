# 0012 — Virtual analog joystick + thin glyph atlas for the character

**Date:** 2026-05-09

Owner asked for two changes on the live build:

1. Replace the 4-button D-pad with **a virtual analog joystick** for mobile.
2. The character looks too "boxy / Roblox-y / unintelligible" because it shares the same heavy block ramp as the world. Use **thinner / lighter glyphs** for the character only, keep the heavy blocks for everything else.

Both shipped in this commit.

## Virtual joystick

`apps/web/src/input.ts` and `style.css` swapped the D-pad for a circular analog stick.

### UI

A 148 px circular base with a 60 px draggable thumb centered on it, anchored bottom-left. CSS:

- Base: low-opacity dark fill, thin stroke in the dim tint color
- Thumb: opaque green pill, transitions back to center with a 110 ms ease-out spring on release (no transition during drag for snappy follow)
- `touch-action: none` everywhere to suppress mobile scroll/pinch
- Hover-capable + fine-pointer media query gives desktop a slightly more transparent base

### Logic

Tracks a single active touch identifier or the mouse. On press:

- Reads the base's bounding rect (`updateGeometry()`) to get center + radius (subtracts a small padding for the thumb)
- Computes thumb offset `(rawX, rawY)` relative to base center, clamped to the radius

On move: same. On release/cancel/touchcancel: reset to (0, 0) with the spring transition.

### Output

`intent()` now blends keyboard and joystick:

```ts
const jLen = sqrt(jx * jx + jy * jy);
if (jLen > DEAD_ZONE) {
  return { x: jx, y: jy };  // analog priority
}
// fall through to keyboard (with √2 normalization for diagonals)
```

`DEAD_ZONE = 0.08` so a thumb resting near the center reads as zero. Joystick is **analog** — half-deflection gives half-speed movement (the existing scene tick scales `MoveIntent.x/y` by `MOVE_SPEED * dt`, so amplitude carries through naturally).

### Mobile-compat

- `passive: false` on touch handlers so `e.preventDefault()` blocks page-scroll while touching the stick
- `ResizeObserver` on the stick element so geometry updates if layout changes
- `mousemove`/`mouseup` bound to `window` (not the element) so dragging outside the base still tracks
- Keyboard handlers preserved — desktop still works without touch

## Thin character glyph atlas

The visual fidelity gain.

### Two atlases, one shader

`packages/ascii` previously took a single `atlas: GlyphAtlas`. Now `createAsciiPass` accepts an optional `characterAtlas: GlyphAtlas` (must match `cellSize` and `glyphCount`). The shader binds both as samplers (`tGlyphs` and `tGlyphsCharacter`) and picks between them per cell using the existing character mask:

```glsl
float bgGlyph = texture2D(tGlyphs, glyphUv).r;
float chGlyph = texture2D(tGlyphsCharacter, glyphUv).r;
float glyphMask = mix(bgGlyph, chGlyph, maskWeight);
```

`maskWeight` is the same `smoothstep`'d 0..1 derived from the character render-target alpha that drives the dim. So the atlas swap and the dim share the same mask — no second sampling cost.

### Ramps

Both 14 glyphs, both `cellSize: 6`:

| Atlas | Ramp | Look |
|---|---|---|
| **World** (`tGlyphs`) | `' .·-:;=+*░#▒▓█'` | Heavy: includes the four shade blocks `░ ▒ ▓ █` rendered as procedural fills |
| **Character** (`tGlyphsCharacter`) | `" '.,:;-+=*#%&@"` | Thin: pure ASCII letterforms only, sparse strokes |

The thin ramp goes from empty → 0.05 (`'`) → ... → mid (`*`) → high-density letterforms (`# % & @`). No solid fills. The character now reads as a pen-stroked figure rather than a stack of solid voxels — the silhouette stays clear because of the existing depth-edge solid-block override at silhouettes (which uses the WORLD atlas `█`, so the outline still pops).

### Edge override now respects character cells

A small refinement: silhouette emphasis (`glyphIdx = uGlyphCount - 1`) now skips cells where `maskWeight >= 0.5`. Before this, the inside of the character could occasionally hit a luminance-edge case and get a solid block, defeating the thin-glyph effect. Now silhouette emphasis only applies to non-character cells, which is its intended use — the *outline* of the character against the world.

### Shape sampling preserves silhouette

The rig is the same primitive-built figure as before. What changes:

- **Inside the silhouette**: thin glyphs (`*  #  &  @` etc.) instead of `▓ ▒ █` — character body reads with stroke detail rather than as filled volumes
- **At the silhouette edge**: still the bright `█` outline from luminance-edge detection (sampled from the world atlas, since maskWeight at the edge is < 0.5)
- **Outside**: unchanged heavy blocks for the floor and props

Net: the bit_spekter looks more like a pen-shaded figure, less like Lego.

## Build

- 28 files lint clean
- Build green
- Bundle: 635.18 → 636.85 kB (+1.7 kB for second atlas wiring + joystick)

## What's next

Per roadmap remaining for Phase 1 polish:

1. Stage B v0.2 — directional glyphs (half-blocks following surface normal direction). The layered-render pattern is twice-proven now (character mask, prop layer would be next). I'd gate behind a `?normals=on` URL flag for owner-side mobile testing before defaulting on.
2. Lift the rig + render plumbing out of `scene.ts` into `packages/game-core` so it's reusable when Phase 2 networking lands.
3. Class-select login screen (terminal-style) — the lead-in for Phase 2.
