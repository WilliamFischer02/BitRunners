# 0124 — Admin dialogue skip button

## What

Added a `skip ▸` button to The Admin's encounter dialogue
(`apps/web/src/AdminDialogue.tsx`) so a player can dismiss the whole dialogue
immediately instead of clicking through every line/branch.

## Details

- Sits in the dialogue header (`dialogue-head`, a flex `space-between` row), so
  it's in the top-right corner and reachable in every phase (opening, emote
  prompt, response, closing) since the header renders unconditionally.
- Reuses the existing `panel-close` class → ≥44 px touch target
  (`--ui-tap-min`), terminal aesthetic, no new CSS (`style.css` untouched).
- `onClick` does `stopPropagation()` (so it doesn't hit the frame's advance
  handler) then the component's existing `doClose()` — same path the dialogue
  uses at the end of the closing phase (plays the dissolve-out, then `onClose`).
- `aria-label="skip dialogue"`.

Implemented by a `fable` subagent (isolated single-file change); typecheck +
biome verified clean.

## Verify (owner)

Approach the obelisk to trigger The Admin encounter → a `skip ▸` button shows in
the dialogue's top-right → tapping it closes the whole dialogue at any point.
