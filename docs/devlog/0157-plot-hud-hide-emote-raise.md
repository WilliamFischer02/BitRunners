# 0157 — Hide world HUD inside the Data Base + raise the emote wheel

## 1. Plot mode hides the world HUD

Entering the Data Base left MAIN MENU / PROTOCOLS, the DATA BASE chip,
and the emote wheel floating over the plot UI. Game.tsx now tracks
`inPlot` via the existing `bitrunners:plot-enter` / `plot-exit` events
(covers owner entry AND scene-initiated visits) and stamps
`data-plot="1"` on the canvas host; CSS hides those four HUD pieces
under it. The exit button already fires `plot-exit`, so the HUD
returns exactly when the player lands back on the main server.

## 2. Emote wheel raised

The wheel's bottom clipped offscreen on mobile browsers whose dynamic
URL bars shrink the visual viewport below 100vh. Base offset 28→46px;
the mobile override becomes `max(44px, safe-area-inset-bottom + 44px)`.
Appended as cascade-final rules so every earlier breakpoint variant is
covered.
