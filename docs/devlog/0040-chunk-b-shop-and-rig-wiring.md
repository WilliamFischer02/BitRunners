# 0040 — Chunk B: shop expansion + 3D rig wiring

**Date:** 2026-05-21
**Branch:** `claude/bitrunners-collaboration-EcqBv`

Second sprint chunk (roadmap in devlog 0039). Equipped cosmetics now render on
the bit_spekter rig — the first deliberate crossing of the mini-game isolation
boundary, done through the `appearance.ts` seam exactly as designed.

## Rig wiring (the boundary crossing)

`scene.ts` now imports **only** `appearance.ts` (`getEquippedAppearance` +
`subscribeAppearance`). No economy/shop internals leak into render — the
one-way data flow is economy → appearance → scene. The mini-game modules still
import nothing from scene/network/server, so multiplayer/Phase-2 still can't be
regressed by clicker code.

- `buildBitSpekter` now exposes `skin: {head,chest,legs}` (each = the armour
  `MeshStandardMaterial` + a snapshot of its factory color/emissive) and a
  `petAnchor` Group.
- `applyAppearance()` (subscribed to `APPEARANCE_EVENT`) recolours head/chest/
  legs from the equipped item's `palette`; **rare** (has `effect`) adds a
  palette-coloured glow, **ultra** (has `texture`) glows hardest. A pet
  descriptor spawns a small primitive that orbits + bobs at `petAnchor`;
  unequipping removes and disposes it.
- **Zero regression guarantee:** with nothing equipped, `applySkin(null)`
  restores the exact factory color/emissive/intensity, so a fresh rig is
  byte-identical to before. Cosmetic visuals only appear once the player
  equips something.
- Palette map (`slate/viridian/aurora/ember` + default) lives in `scene.ts`
  (render concern). Dynamically-created pet mesh is set to `CHARACTER_LAYER`
  so the ASCII character pass renders it.
- **Scope:** affects the LOCAL player's own rig only — appearance is
  device-local. Remote players don't see each other's gear yet (needs equipped-
  state network sync; a later chunk).

## Shop content + aesthetic

- **3 starter pets** (entry-priced 120/180/280 cr): `byte pup`, `glint drone`,
  `null kitten`. Plus 3 more clothing items (head/chest/legs) across rarities.
  Placeholder names/palettes — real content + lore is still the open Q&A.
- Shop aesthetic: hover state, rarity left-accent stripe on item rows
  (`.shop-item.rar-rare`/`.rar-ultra`), group-title underline.

## Honest status

- Gates green: `pnpm lint` clean (45 files), `pnpm typecheck` 8/8,
  `pnpm build` 5/5.
- **NOT visually verified (headless).** Needs an eyeball on the Pages preview:
  equip head/chest/legs → rig recolours; equip a pet → primitive orbits the
  body; unequip → reverts cleanly; recolour reads sensibly through the ASCII
  post-process. The recolor is a deliberate **primitive** first pass (owner
  decision) — no commissioned meshes.
- Pet is a single box primitive for now; per-pet distinct shapes are a polish
  follow-up.

## Files

`apps/web/src/scene.ts` (appearance wiring), `apps/web/src/shop.ts` (catalog),
`apps/web/src/ScrapeMenu.tsx` (rarity class on shop rows),
`apps/web/src/style.css` (shop aesthetic), this devlog, `.claude/handoff.md`.
