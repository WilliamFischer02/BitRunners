# 0093 — Minimap: touch-sized exit + distortion-proof canvas (mega-batch 4.5)

**Date:** 2026-06-16
**Branch:** `claude/mega-batch-2026-06-16`
**Type:** P1 broken UX · CSS-only (Pages-only deploy)

## Symptom (as reported)

Opening the minimap stretches to portrait and looks distorted on mobile,
with no visible exit — only ESC works, a softlock on touch.

## State found

`Starmap.tsx`'s expanded view already had a ✕ button, tap-outside-to-close,
ESC, and `aspect-ratio: 1/1` on the canvas (the deployed build the report
was against was likely older than `main`). Two real gaps remained against
the acceptance criteria:

1. The ✕ close button was `padding: 4px 8px; font-size: 14px` — about
   ~22×26px, **well under the 44×44 touch minimum**, so it read as "no
   usable exit" on a phone.
2. The canvas used `width: 100%; height: auto; aspect-ratio: 1/1` with no
   height bound, so on a short viewport (landscape, or a small portrait
   with the header/footer) the square could exceed the modal and clip.

## Fix (CSS only)

- **`.starmap-expanded-close`** → a 44×44 inline-flex button with a visible
  border + focus-visible state. ESC and tap-outside remain as fallbacks, so
  there are now three independent exits.
- **`.starmap-expanded-canvas`** → `max-width: min(92vw, 62vh)` with
  `aspect-ratio: 1/1` and `margin: 0 auto`. The canvas is always a square
  sized to the *smaller* available axis, so it never distorts or clips and
  letterboxes (auto side margins) when one axis is tighter — correct in both
  portrait and landscape. The JS buffer is already square (sized from
  `clientWidth`), so it matches the square box exactly — no distortion.

## Verify (owner)

On a 393×852 portrait phone (and rotated to 852×393 landscape): tap the
minimap → it opens centered and square, undistorted; the ✕ in the header is
an easy thumb target; tapping it, tapping outside, or pressing ESC all
close it. (No headless mobile screenshot — no browser-automation dep
installed; behaviour reasoned from the CSS box model above.)

## Files

- `apps/web/src/style.css`
