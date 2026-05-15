# 0028 — Levitate trail animation + mobile viewport pass + denser ASCII

**Date:** 2026-05-15

Owner reported on the live build: multiplayer is **working** ("NET: CONNECTED · 1 OTHER(S)" — that's the screenshot proof — the bit_spekter is rendering, tendrils visible, but the walking arm/leg swing reads wrong for a "code-body floating through the cloud" character, the mobile profile widget was clipping into the hint text on iPhone, and the cells were chunky.

Three changes this commit:

## 1. Levitate trail (replaces the walk swing)

Old behavior: legs and arms swung back-and-forth on a sine of `walkPhase`, hip yawed, chest counter-twisted — a classic biped walk cycle.

New behavior: arms and legs **sweep backward and stay there** while moving, body **leans forward** into the motion. As if the bit_spekter is gliding/levitating with limbs trailing in the slipstream. When the player stops, limbs return to neutral over ~700 ms (eased via `walkActive` lerping toward 0 at rate `dt * 6`).

```ts
rig.armPivotL.rotation.x = walkActive * TRAIL_ARM;   // -0.65 rad
rig.armPivotR.rotation.x = walkActive * TRAIL_ARM;
rig.legPivotL.rotation.x = walkActive * TRAIL_LEG;   // -0.45 rad
rig.legPivotR.rotation.x = walkActive * TRAIL_LEG;
rig.chest.rotation.x     = walkActive * LEAN_CHEST;  // +0.16 rad
```

### Idle animation

When stationary (`idleAmt = 1 - walkActive`):

- **Body sway** — chest yaw oscillates at `sin(elapsed * 0.9) * 0.035 * idleAmt`
- **Hip drift** — `sin(elapsed * 0.6) * 0.022` on hip roll
- **Arm flutter** — small Z-rotation on each arm pivot: `sin(elapsed * 1.4) * 0.04`, mirrored L/R
- **Breathe** — small vertical wobble on the visual group: `sin(elapsed * 1.1) * 0.018`

Different periods on each oscillator so the figure feels organic rather than mechanically synchronized.

The hover-when-moving (raises 0.45 units off the ground) is preserved from earlier — combined with the new trail, the bit_spekter now reads as a *levitating* runner being pulled through the world by its forward motion.

### Cleanup

- Removed `walkPhase`, `WALK_RATE`, `ARM_AMP`, `LEG_AMP`, `CHEST_TWIST`, `HIP_ROLL` constants and the per-frame `walkPhase += dt * WALK_RATE` advance — no longer needed
- Removed the `Math.abs(Math.cos(walkPhase)) * 0.05 * walkActive` cosine bob — replaced by `idleBreathe`

## 2. Mobile viewport + safe-area pass

`apps/web/index.html` — viewport meta extended:

```html
<meta name="viewport"
  content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no" />
```

- `viewport-fit=cover` → page extends under iOS Dynamic Island / notch
- `maximum-scale=1, user-scalable=no` → suppresses iOS' double-tap zoom and the pinch-zoom that would interfere with the joystick

`apps/web/src/style.css` — every fixed-position UI element now uses `env(safe-area-inset-*)`:

```css
.profile {
  top: max(10px, env(safe-area-inset-top, 0px));
  right: max(10px, env(safe-area-inset-right, 0px));
}
.stick {
  bottom: max(22px, calc(env(safe-area-inset-bottom, 0px) + 22px));
  ...
}
```

So the profile no longer slides under the Dynamic Island, the joystick clears the iOS home-bar gesture area, and the net-status badge sits above the URL bar on Safari rather than getting hidden.

### Narrow-viewport media queries

`@media (max-width: 540px)` shrinks every overlay component:

| Element | Default | Mobile |
|---|---|---|
| `.profile` min-width | 130px | 116px (max 156px) |
| `.profile-class` font | 13px | 12px |
| `.stick` diameter | 118px | 96px |
| `.emote` size | 138px square | 116px square |
| `.emote-btn` | 56px | 44px |
| `.fps` | 11px font | 9px |
| `.dialogue-frame` width | 720px max | `calc(100vw - 24px)` |
| `.dialogue-line` font | 22px | 18px |

`@media (max-width: 380px)` hides the `.hint` text altogether so the profile widget has room.

The hint text now also truncates with ellipsis on mid-size phones instead of wrapping under the profile (`max-width: 56vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap`).

### Profile widget repositioning

The owner's screenshot showed the profile widget clipping into the top-left where the hint text lives. Root cause: on a narrow viewport the profile was wider than expected and overlapping. The new explicit `max-width: 200px` + media-query overrides keep it tight in the top-right corner regardless of viewport width.

## 3. Denser ASCII (cellSize 6 → 5)

All three atlases — world, character, and edge — now use `cellSize: 5, fontSize: 7`. ~44 % more glyphs per unit area, characters render closer together for a more readable picture. The skybox digital-rain spacing stays as-is.

Performance impact: more shader work per pixel, but the 18 fps cap absorbs it. Locally still steady.

## Build

- 40 files lint-clean
- Typecheck green
- Bundle unchanged

## Files changed

- `apps/web/index.html` — viewport meta
- `apps/web/src/scene.ts` — levitate trail rig animation, dropped walk constants, denser atlases
- `apps/web/src/style.css` — safe-area positioning, narrow-viewport media queries

## What's next

Tomorrow's Supabase + Resend + OAuth wiring (devlog 0026) unblocks:

- Display name input + owner approval queue
- Persisted "you've met The Admin" flag so the encounter doesn't refire every session
- Persisted inventory, achievements, samaritan status
- Real sign-in buttons replacing the `[pending env]` placeholder in the profile panel
