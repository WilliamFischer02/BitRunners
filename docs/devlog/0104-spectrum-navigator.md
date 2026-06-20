# 0104 — Spectrum Navigator (formerly Starmap): undistorted + bottom card

## TL;DR

- Renamed the expanded minimap from `// starmap` to `// spectrum_navigator`
  in UI text and aria-labels. Component / file names unchanged.
- Map canvas now always renders as an undistorted square at the largest
  size that fits the viewport in either orientation.
- Header (name + close `✕`) moved to a **floating card pinned to the
  bottom of the viewport**, z-stacked above the canvas so it always
  reads correctly. Footer hint text dropped.

## Why

The old expanded layout used a column-flex modal with `width: min(420, 92vw)`,
`max-height: 92vh`, and a canvas with `width: 100%; max-width: min(92vw, 62vh);
aspect-ratio: 1/1`. On portrait phones this produced two bugs:

1. **Distortion.** The canvas's CSS `aspect-ratio: 1/1` plus `width: 100%`
   computed a square at the container's content width, but the container's
   `max-height: 92vh` clamped the box and the rendered canvas often came
   out non-square once the header + footer also fought for vertical
   budget. The user saw a clearly elongated map.
2. **Card buried under the map.** The header and footer were siblings
   of the canvas inside the same flex container. With the canvas tall
   enough to push them past their flex anchors, they ended up visually
   mid-screen, looking like they were *behind* the map instead of
   framing it.

## What I did

`apps/web/src/style.css`:

- `.starmap-expanded-back` is now a pure backdrop (no flex centering,
  no padding).
- `.starmap-expanded` is a full-viewport positioning container that
  centers a single child (the canvas) and reserves 132 px at the bottom.
- `.starmap-expanded-canvas` is sized via
  `width: min(calc(100vw - 32px), calc(100vh - 164px))` with
  `aspect-ratio: 1/1`. The `min()` guarantees square regardless of
  orientation: portrait clamps to width, landscape clamps to height.
- `.starmap-expanded-head` is `position: fixed; bottom: 16px; left: 50%;
  transform: translateX(-50%); z-index: 70`. Always pinned to the
  bottom, always above the canvas (canvas has no explicit z-index but
  is inside a sibling container).
- `.starmap-expanded-foot` removed (footer text dropped — the ✕ is
  self-explanatory and the hint added clutter to a small mobile card).

`apps/web/src/Starmap.tsx`:

- Restructured the JSX: canvas inside `.starmap-expanded`, header
  pulled out as a sibling so it can position-fix to the viewport.
- UI text `// starmap` → `// spectrum_navigator`.
- aria-labels updated: `"sphere minimap — tap to expand"` →
  `"spectrum navigator — tap to expand"`; `"close starmap"` →
  `"close spectrum navigator"`.

## Notes for follow-ups

- File and component names (`Starmap.tsx`, `function Starmap`,
  `.starmap*` CSS classes) intentionally unchanged. Renaming those
  would touch import sites across the app for no functional gain;
  the user-visible rename was the ask.
- The 132 px bottom reserve is a fixed pixel value to keep the card
  size predictable on mobile keyboards / safe-area insets. If we add
  more chips to the bottom card later (mission summary, search, etc.)
  bump the reserve to match.
