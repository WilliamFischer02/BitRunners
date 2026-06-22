# 0103 — Tether chat overlay: center + raise above HUD

## TL;DR

- Tether chat overlay was opening behind other HUD in the bottom-right
  corner — invisible to the user once anything was layered on top.
- Cause: `.tether-overlay` had `z-index: 7` (everything else in the
  HUD lives between 8 and 200) and was pinned to `bottom` / `right`.
- Centered the overlay (`top/left: 50%` + `translate(-50%, -50%)`) and
  raised it to `z-index: 250` — above every other UI layer in
  `style.css`.

## Why this regressed

The original positioning was a "sticky bubble" pattern that assumed
nothing else would land in the bottom-right corner. Subsequent HUD
additions (mission overlay, scrape menu, cartridge carousel) kept
adding higher-z elements that visually buried the chat.

`z-index: 7` was always going to be fragile. Centered modal positioning
is a better fit for the actual usage pattern — tether chat is a focused
1:1 interaction, not a peripheral bubble.

## What I did NOT touch

- Width / max-height / styling — only positioning and stacking changed.
- The cartridge panel (`TetherPanel`) which uses `<dialog>` — that's
  already centered and stacked correctly via the native dialog layer.
