# 0134 — Auth card: make the logged-in state actually visible

## Field report

A logged-in user reported not seeing the "logged in · progress saved"
card. Investigation:

- **No admin gating exists** — the card is wired to `subscribeAuth`
  for every player. Not the cause.
- The "top-left stack" placement block in style.css is NOT inside a
  media query — it applies at every viewport. So placement was already
  universal (top-left under NET on phone AND desktop). Also not the
  cause, though it means the older bottom-center base rules are dead
  cascade weight.
- **Actual cause: legibility.** The ok-state was styled as a "quiet
  confirmation": dim moss `#6a8a78` at 9px in the stack block. Next to
  the loud red warning it read as invisible, especially on desktop
  pixel densities.

## Fix

- ok-state now uses the same palette as `net: ok` (`#a8f0c0`, border
  `#3a6850`, soft green glow) at 11px.
- Stack-block font sizes bumped: head 10→11px, sub 8→9px, line 9→11px.

Warning state untouched — it was already loud.
