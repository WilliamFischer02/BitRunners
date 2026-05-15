# 0027 — Tendril particles + Admin "hacks" obelisk dialogue event

**Date:** 2026-05-15

Ships backlog items **3c** (code-tendril particles ground → player) and **13** (Admin hacks the user on first obelisk approach with RPG-style dialogue and an emoticron-keyed branching response). Owner is wiring Supabase / Resend / OAuth tomorrow; both of these features land standalone.

## (3c) Tendril particle pool

`apps/web/src/scene.ts` — a pool of 36 pre-allocated meshes plus a per-frame updater.

### Visuals

Each tendril is a thin upright box (`0.05 × 0.42 × 0.05`) with an emissive lavender material (`color 0x6a4aa8`, `emissive 0xb48bff`, `emissiveIntensity 1.6`). Through the ASCII shader they read as vertical streaks of `▒`/`▓`/`█` glyphs on the floor that rise toward the player's height. The strong emissive punches through the world atlas's background dim (0.55×) so they stay clearly visible against the dark-green ground.

### Spawn rate driven by motion

```ts
const targetRate = isMoving ? 14 : 1.6;   // tendrils/sec
tendrilSpawnAcc += dt * targetRate;
while (tendrilSpawnAcc >= 1) {
  tendrilSpawnAcc -= 1;
  spawnTendril();
}
```

When the player walks: ~14 tendrils per second cluster around them. When idle: ~1.6 per second. The accumulator pattern smooths burst spawns and gives a natural feel without big batched waves.

Each tendril:
- Spawns at a random offset (`0.4–2.0` units, full circle) around the player
- y starts at 0.21 (slightly above the ground plane)
- Rises at `0.8–1.7` units/sec for `1.1–1.8` seconds
- y-scale shrinks linearly over its lifetime (1 → 0.3) for a "dissipating tip" feel
- Returns to the pool when its age exceeds lifetime

Pool size of 36 means ~14/sec × 1.8s lifetime ≈ 25 active simultaneously, fits comfortably with headroom.

### Tied to actual character motion

Triggers when either there's input intent OR the hover lift is still > 0.05 (so as the player gently settles back to the ground after stopping, the tendrils don't snap from 14/sec → 1.6/sec instantly; they decay naturally over the ~0.4 s hover decay).

## (13) Admin "hacks" the player at the obelisk

### Trigger

In `scene.ts` each frame, computes toroidal distance from the player to the obelisk (the monolith at world (5.5, 0, 5.5), wrapped over the 19×19 tile period). When the player walks within **2.6 units** of any obelisk copy — and the event hasn't fired yet this session — the scene:

1. Positions the **Admin shadow figure** beside the obelisk (`x − 1.6`, facing the player)
2. Sets it visible
3. Dispatches a `bitrunners:admin-encounter` custom event on `window`

The flag is per-scene-instance, so closing & reopening (new account in future) refires; once per session today.

### The Admin shadow figure

A hunched humanoid built from dark boxes:

- Sphere head (radius 0.18) very dark `#06060a`
- Hood box overlaid above and tilted forward 0.42 rad
- Torso leaning forward 0.32 rad (the "hunched" silhouette)
- Long arms hanging down, slightly forward-rotated
- Short legs

Through the ASCII shader the figure renders as a dark, low-density cluster of glyphs distinct from the player's bright purple-green palette and the world's lighter green ground. Reads instantly as "shadow."

### The dialogue overlay

`apps/web/src/AdminDialogue.tsx` — React overlay that React's `Game` component mounts when the encounter event fires. Bottom-center RPG-style panel with:

- **Header bar**: `▒▓ THE ADMIN ▓▒` in lavender with glow, subtitle `// hostile read-access`
- **Body**: typed-out lines with a blinking caret, then a `▾` continue indicator once a line finishes
- **Tap/click anywhere on the frame** to advance (or to skip typing and reveal the whole line instantly)

### Phase machine

```ts
type Phase = 'opening' | 'prompt' | 'response' | 'closing';
```

1. **opening** — typewrites `"I..."`, then on click `"see you..."`. Both lines hold until the player advances.
2. **prompt** — the body switches to four jagged-square emoticron buttons (`happy / tired / okay / help`) under a `USER>` prompt. No auto-advance.
3. **response** — the player's chosen emoticron echoes at the bottom and the Admin types two short 3-4-word quips, branched on the choice:

| Choice | Quips |
|---|---|
| **happy** `^_^` | "a flicker." → "warmth. saved." |
| **tired** `zz` | "rest is fiction." → "the void hums." |
| **okay** `[ok]` | "more is coming." → "not for long." |
| **help** `!?` | "I am here." → "you cannot leave." |

4. **closing** — brief hold then auto-closes the overlay. The Admin shadow figure remains in the world (visible standing beside the obelisk for the rest of the session) — feels like the Admin "hung around" rather than vanishing on dismissal.

### Styling

Panel uses the lavender / dark indigo palette of the boot screen for visual consistency. CRT scanline overlay via `::before`, breathing box-shadow, glowing text. Emoticron buttons use the same jagged clip-path as the main emote wheel for theme continuity.

## Why the Admin shadow doesn't disappear

Owner's spec said the encounter is RPG-style; in classic RPGs the NPC stays put after dialogue closes so you can re-approach. Same here. If the player wants to re-trigger, that'll require either a "talk to Admin" interaction (deferred to a follow-up that uses the same dialogue infrastructure) or per-account state once Supabase auth lands.

## Build

- 40 files lint-clean (0 warnings)
- Typecheck green
- Bundle: +~6 kB (the new dialogue component + admin rig + tendril pool)
- FPS: tested locally at 60 fps even with all 25 tendrils active, well under the 18 fps cap we hold

## Files added / changed

- `apps/web/src/AdminDialogue.tsx` — new dialogue overlay component
- `apps/web/src/App.tsx` — listens for `bitrunners:admin-encounter`, mounts AdminDialogue
- `apps/web/src/scene.ts` — admin shadow figure, tendril particle pool, obelisk proximity event
- `apps/web/src/style.css` — dialogue panel + emoticron-button styles

## Open follow-ups for tomorrow (or later)

- (4) Supabase + Resend + OAuth wiring — already shipped scaffold, owner has the step-by-step in devlog 0026
- (11) Display name input + approval queue — needs the auth wiring + admin tool
- (12) 20 achievements design — needs lore Q&A
- (3c, polish) Smarter tendril visuals: instead of solid emissive boxes, swap to a custom shader that draws a column of fading characters (better matches the "code rising" intent)
- (13, polish) Admin-can-be-re-talked-to interaction; persisted "you've met the Admin" flag on the account
