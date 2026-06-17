# 0095 — Inventory icons + clothing saturation bump (mega-batch 4.7)

**Date:** 2026-06-16
**Branch:** `claude/mega-batch-2026-06-16`
**Type:** P2 visual redesign · client-only (Pages-only deploy)

## Two changes

### 1. Item icons in the inventory (and shop)

The inventory listed item NAMES only. Added a low-fi ASCII glyph per item
(`glyphFor` in `shop.ts`), keyed by equip slot with a kind fallback — no
sprite assets exist yet so these are monospace-safe glyphs:

| slot | glyph |
|---|---|
| head | ▲ |
| chest | ■ |
| legs | ▮ |
| pet | ✦ |

Rendered in: inventory grid slots (glyph stacked over the truncated name),
the equipped-slot rows, and the shop rows (for consistency). Glyph tint
tracks rarity (normal teal / rare aqua / ultra violet) via the existing
`rar-*` classes.

### 2. Clothing/pet colour reads washed in-world → +20% saturation

Audited the clothing colour path: `scene.ts` `PALETTE` maps the four
palette names (slate / viridian / aurora / ember) to genuinely distinct
hues — the palette is *not* flat. The washed-out look comes from the
grayscale ASCII post-process + per-theme tint compressing chroma. Per the
brief's "palette is varied → push saturation ~20% at the material level":

- Added `setSaturated()` — boosts a colour's HSL saturation ×1.2 (clamped,
  lightness preserved) and applies it wherever clothing/pet colour or
  emissive is set in `applySkin` / the pet material.
- Did **not** add emissive to normal-rarity items — the rarity ladder
  (normal = recolour only, rare = glow, ultra = glow+texture) is a locked
  design decision; only chroma was raised, not glow.
- The equipped-outfit schema is untouched — this is render-only.

## Verify (owner)

Open `// inventory`: each owned item shows a glyph + name; equipped rows and
shop rows show the glyph too. In-world, equip a viridian/ember item — the
hue should read more clearly against the grayscale scene than before. (No
headless 3D screenshot — GLSL/scene isn't verifiable without WebGL; correct
by inspection + clean build.)

## Files

- `apps/web/src/shop.ts` (`glyphFor`)
- `apps/web/src/ScrapeMenu.tsx`
- `apps/web/src/scene.ts` (`setSaturated`)
- `apps/web/src/style.css`
