# 0109 — freq_lock rebuilt as a 3-track signal-disturbance game

## TL;DR

- Replaced the 4-lane DDR-style freq_lock (devlog 0101) with a **3-track
  perspective signal-disturbance game**.
- Three "audio tracks" recede toward a vanishing point. Each is normally
  a straight beam of light. Disturbances — bright glowing bulges that
  bend the beam outward — travel from the horizon toward the player.
  Tap the matching lane (J / K / L, A / S / D, arrows, or touch the
  pads at the bottom) before the disturbance passes you.
- Scoring math unchanged: 100 / 50 points per perfect / good hit,
  1 credit per 10 points, capped at 100 credits / 60s run.
- All CSS — no three.js, no audio file. Lazy chunk stays small.

## Why

The DDR-style 4-lane wasn't carrying the "audio" framing — it read as
generic falling-glyph rhythm. The owner's vision is signal analysis:
three tracks coming toward you, normal flow being a steady line of
light, the player's job being to spot a deflection and tap it.

## How it's built

- **Stage** (`.freqlock-stage`) carries the `perspective: 720px` and a
  bottom vanishing line.
- **Floor** (`.freqlock-floor`) tilts `rotateX(55deg)` so children with
  `top: 0` recede into the distance and `top: 100%` sit at the player's
  feet. Foreshortening on the rotated floor produces the size scaling
  automatically — no manual `--scale` math needed.
- **Track** (`.freqlock-track`) is one of three flex columns on the
  floor. Subtle side rails on the inner edges.
- **Beam** (`.freqlock-beam`) is a 2 px vertical column with a
  fade-from-distance gradient (transparent at the top, bright `#c0ffd6`
  at the bottom) and a soft glow.
- **Disturbance** (`.freqlock-disturb`) is the moving element. A 48×32
  radial-gradient blob that:
  - is positioned with `top: pos%` driven by the song-time progress
    (`0 → 1` from spawn to hit-line);
  - applies `rotateX(-55deg)` to cancel the floor's tilt so it stands
    up facing the camera (otherwise it would lie flat and you'd see a
    thin line);
  - has a 480 ms `freqlock-pulse` brightness animation to feel "live".
- **Hit row** (`.freqlock-hit-row`) sits flat (no perspective rotation)
  at the bottom edge, above the floor. Three buttons with the keyboard
  key and the lane label (`J L`, `K C`, `L R`).

The whole thing is one `<div>` tree — perspective + transforms handle
the visuals. `prefers-reduced-motion` disables the pulse animation; the
geometry stays.

## Mechanic deltas vs the old game

| Knob | Old (devlog 0101) | New |
| --- | --- | --- |
| Lanes | 4 | 3 |
| Keys | D F J K | J K L (+ A S D, + arrows) |
| Travel time | 1.5 s | 2.6 s (longer so deflections have time to read) |
| Hit window | 140 ms / 60 ms perfect | 220 ms / 80 ms perfect (wider — visual disturbance takes longer to perceive than a falling glyph) |
| Note gap | 460–860 ms | 720–1400 ms |
| Judgement word | `perfect` / `good` / `miss` | `locked` / `good` / `miss` |

All numbers are constants at the top of `FreqLock.tsx` — easy to retune
without touching mechanics code.

## What I kept

- Chart-builder shape (procedural, random lane assignment).
- Scoring formula and 100-credit cap.
- Start / end screens and the `again` / `done` controls.
- ESC closes.
- `addCredits()` call on finish.

## What I dropped

- The four-lane CSS grid.
- The glyph notes (`◀ ▼ ▲ ▶`). The new vocabulary is "straight line" vs
  "bulge" — no glyph required.
- The `freqlock-hit-glyph` rest-state target. The hit pads themselves
  carry the affordance now.

## STOP-AND-ASK (feel)

These defaults are my best guess; flagging for owner sign-off:

- `perspective: 720px` and `rotateX(55deg)` set the "runway" angle.
  Steeper = more dramatic depth; flatter = easier to read.
- Disturbance size `48×32` and the radial-gradient stops control how
  "bulgy" each pulse reads. Smaller = harder to spot; larger = noisier.
- `TRAVEL_MS = 2600` is the spawn-to-hit duration. Shorter = faster
  pace; longer = more reading time.
- `freqlock-pulse 480ms` brightness animation — could be slower, could
  be hue-shifting instead of brightness.

Tunables are all in the constants block at the top of `FreqLock.tsx`
plus the CSS variables in `style.css`.
