# 0146 — The Admin "transmission" face (P2)

Overlay card in the style of `docs/references/01-ascii-glitch-face.*`:
a dissolving pointillist ASCII face that "speaks" while the Admin
dialogue types, over a `// transmission` terminal header.

## Pieces

- `transmission-face.ts` — 5 hand-authored frames (44×24, chars from
  `█▓▒░▄▀·:╳*+` + tiny hex/error fragments `0xC4`/`ERR3F`/`0x1B`/
  `0xF3`). Right side of the face solid, left dissolving into scatter.
  Only the 3 mouth rows differ per frame (F0 rest → F4 wide). Also
  exports the rove sequence (0→1→2→3→4→3→1), frame cadence (170 ms —
  deliberately low-framerate, bad-uplink feel), glitch cadence (1.2 s)
  and `glitchFrame()` (single-row horizontal displacement, pure).
- `TransmissionFace.tsx` — mounts ONLY while AdminDialogue is mounted
  (Game.tsx, same `adminDialogueOpen` flag). Fully imperative: frames
  swap by writing `textContent` on a `<pre>` ref inside a
  `setInterval` — **zero React re-renders per frame** (perf house
  rule). Reduced-motion: static F0, no interval at all.
- Decoupling: AdminDialogue dispatches
  `bitrunners:admin-typing` `{ detail: { typing } }` — true only while
  characters are printing in the opening/response phases and not
  closing. The face knows nothing about dialogue internals; it starts
  the rove on `typing: true` and settles to F0 on `typing: false`
  (prompt phase, line complete, closing).
- CSS `.transmission-face`: fixed, upper-left (`top: 52px; left: 8vw`,
  10 px inset on ≤640 px), `z-index: 39` — one below `.dialogue-root`
  (40), `pointer-events: none`, `font-size: min(9px, 1.9vw)` so 44
  columns ≈ 200 px on a 393 px phone → never covers the bottom-anchored
  dialogue box.

## Art call (STOP-AND-ASK noted)

The face is authored by me per the brief ("AUTHOR the ASCII art
yourself"). If the owner wants a different vibe (more scatter, other
fragments, bigger mouth travel) it's all in `FACE_FRAMES` — pure
string data, no code change needed.

## Owner verify

Walk to the obelisk → dialogue opens → face card fades in top-left,
mouth roves while text types, freezes between lines and on the emote
prompt, single-row tear ~1/s. Test 393×852: face must not overlap the
dialogue. `prefers-reduced-motion`: static calm face.
