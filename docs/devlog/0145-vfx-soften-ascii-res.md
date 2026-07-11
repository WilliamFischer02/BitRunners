# 0145 — VFX softening + finer ASCII grid (P1)

Player feedback: post-process effects too strong; ASCII "pixels" too
big to read the world through.

## CRT grade softened (scene.ts)

| uniform | was | now |
| --- | --- | --- |
| scanline | 0.10 | 0.06 |
| vignette | 0.26 | 0.20 |
| aberration | 0.05 | 0.02 |

Escape hatches: `?crt=off` unchanged (pass skipped entirely);
**new `?crt=strong`** restores the old values for A/B comparison.

## ASCII grid: cellSize 4 → 3 (NOT 2) — STOP-AND-ASK default

The brief asked to try cellSize 2 first. Rejected by construction, not
by eyeball:

- The glyph atlas canvas is `cellSize` px tall and `cellSize` px per
  cell wide (`glyph-atlas.ts`). A 6 px monospace glyph is ~3.6 px wide.
  In a 2 px cell that is **hard atlas corruption** — ~0.8 px of every
  letterform bleeds into the neighbouring glyph's cell and two thirds
  of the glyph height is cropped. Unreadable blobs, guaranteed.
- cellSize 2 also 4×es ascii-pass texel work; on the throttled-mobile
  budget that's the risky end of the range.

cellSize 3 is the shipped compromise: 1.78× finer grid area (16→9 px
per cell), glyphs keep ~90% of their width in-cell (~0.3 px bleed per
side, invisible at nearest-filter scale), and texel cost rises 1.78×
instead of 4×. fontSize stays 6 (dominant width fits; vertical crop of
ascenders is the same tradeoff the 4 px atlas already made).

**Owner verify (can't be done headless):**
1. `?perf=1` on a throttled mobile profile — if fps drops >15% vs
   `main`, the revert is one constant (`cellSize: 3 → 4` in
   `getGlyphAtlases`, scene.ts).
2. Eyeball glyph legibility at cellSize 3; if the owner wants to try 2
   anyway, bump `fontSize` down proportionally won't help — the atlas
   cell itself is the limit (see above).
3. `?crt=strong` vs default vs `?crt=off` side-by-side.

No API changes: `uCellSize` derives from `atlas.cellSize`, resolution
plumbing untouched. No per-frame cost added — atlases still build once
per page load (perf pass 0139 pattern).
