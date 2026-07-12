# 0151 — data_base: cartridge + local voxel editor (P7 Stage A)

The flagship lands in stages. Stage A is the whole editing loop,
client-local: a new `data_base` cartridge teleports you to your own
24×16×24 voxel plot, editable in a creative orbit viewport (RegEdit) or
walkable with the normal rig (Corporeal). No persistence yet (Stage B)
and no sky-grid/multiplayer (Stage C) — the plot lives for the session.

## Pieces

- **`voxel-core.ts`** — pure data model + codec (zero deps): flat
  `Uint8Array` grid (index `x + z*W + y*W*D`), 5-block launch palette
  (`concrete`, `neon_panel` emissive cyan, `wood_frame`, `metal_frame`,
  `asphalt`), safe accessors, palette-indexed RLE runs + a versioned
  envelope (`{v,w,h,d,runs}`) that Stage B persists. Decoders return
  `null` on any malformation — 27 vitest cases (round-trips incl.
  worst-case alternating grid + JSON survival, 15 malformed-input
  rejections).
- **`voxel-scene.ts`** — three.js arena, `maze-scene.ts`'s sibling:
  - ONE `InstancedMesh` per block type at full 9216 capacity (never
    reallocates; `count` set per rebuild; `frustumCulled=false`).
    Rebuilds are `markDirty()` → at most one rebuild per frame from
    the tick (`update()`), so burst edits cost one remesh.
  - Pad slab + cell grid + volume wireframe + a recolorable cursor
    cell (mint = place, ember = erase).
  - `pickVoxel` — Amanatides–Woo 3D DDA along the pointer ray;
    **depth slider = which air→solid surface crossing** along the ray
    (0 = nearest; a contiguous solid column is ONE surface;
    over-reaching clamps to the deepest; empty ray falls back to the
    pad plane). 10 vitest cases pin the semantics.
  - `slideMoveVoxel` — axis-separated circle-vs-grid slide + plot AABB
    clamp for Corporeal (2 body layers collide; blocks above head
    height don't).
- **scene.ts plot mode** — maze/void pattern verbatim: `plotActive`
  flag, world tiles + skybox hidden, rig teleported, saved/restored on
  exit. RegEdit hides the rig and swaps the follow camera for a
  spherical orbit (drag orbit · shift/right-drag or two-finger pan ·
  wheel/pinch radius zoom); a tap (<6 px) places/erases. Corporeal
  walks with voxel collision. Outbound moves freeze like the maze
  (Stage C unfreezes them behind a `plot:<idx>` zone); remotes hide
  while inside; minimap/tag/interp gates extended; tap-lock, wheel
  zoom and pinch zoom are gated off while the editor owns the canvas.
- **`DataBase.tsx`** (lazy chunk, 1.3 kB gzip) — slim top HUD:
  RegEdit/Corporeal tabs (reuses `.scrape-tabbtn`), palette + eraser +
  depth slider, live block counter, exit. Thin driver over window
  events (`data-base-enter/-exit` in; `plot-enter/-exit/-edited` out;
  `plot-tab/-tool/-depth` config), exactly like CoreRun.tsx.
- Registry: `data_base` cartridge, glyph `⌂` (the brief's `▦` is
  visually owned by inventory), tint `br`. Starmap hides the minimap
  in-plot (same as maze/void).

## Deliberate calls (STOP-AND-ASK defaults)

- **Plot floor = the pad, not a prefilled slab.** A filled y=0 layer
  would be geometry the Corporeal body collides with; empty grid +
  walkable pad is the clean base. (Slab-seeding a template is a
  Stage B option.)
- Voxel size 1.0 u (2-block wall > runner height); orbit sensitivities
  / radius clamp [8, 60] / depth max 7 — all constants in the scene
  plot block, tune freely.
- Launching core_run from inside the plot exits the plot first so the
  maze restores cloud coords.

## Perf notes

Editor picking runs on pointer events only, never per frame; the tick
adds one boolean branch when the plot is closed. Entry chunk unmoved;
`check-bundle` green (Game chunk 66.9 kB gzip). Gates: biome ·
typecheck 8/8 · test 85/85 · build 5/5.

## Owner verify

1. Protocols → insert `data_base` → you're on a dark pad, world gone,
   HUD up, editor viewport active.
2. Tap cells → concrete appears (counter climbs); switch palette
   blocks; neon_panel visibly glows through the ASCII pass; eraser +
   tap removes.
3. Drag to orbit, wheel/pinch to zoom, shift-drag/two-finger to pan.
   Build a stack; set depth 1 and confirm taps select the surface
   BEHIND the front one when aiming through a gap.
4. Corporeal tab → rig appears at the pad edge; walk; your build
   blocks you; plot edge clamps.
5. [ exit ] (or Esc) → back where you stood in the cloud; minimap
   returns. Re-insert the cartridge — the build is still there
   (session memory; reload loses it until Stage B).
6. Phone (393×852): HUD fits one column; palette taps ≥44 px.
