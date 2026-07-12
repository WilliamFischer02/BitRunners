# 0156 — UI polish batch: button morph rack, Data Base rail + RegEdit nav rework, jump, tap-to-tether

One owner batch, seven items, all client-side (`apps/web` only — no server,
no migrations, no new dependencies, no `PROTOCOL_VERSION` change). Gates
green: biome · typecheck 8/8 · build 5/5 · test **85/85** (voxel picking
tests updated for the depth-slider removal, below).

## 1 · MAIN MENU + PROTOCOLS at 2/3 width

The attached 0138 button column shrank to two-thirds: **88px** mobile (was
132), **clamp(93px, 10.6vw, 117px)** desktop (was clamp(140,16vw,176)).
Still attached (mobile tops 138/168 with the same 30px pill height), still
worn-analogue. Legibility guards: the "(Minigames)" banner drops to 8px with
0.04em tracking, and the mobile row caps (`.protocols-launch-cap`,
`.profile-class`) drop to 8px so "PROTOCOLS" / "MAIN MENU" never ellipsize
inside the narrower column.

## 2 · PROTOCOLS morphs in place — no more separate carousel window

Tapping PROTOCOLS no longer opens a floating carousel. The **same element**
grows (CSS `width`/`height` transition, 250ms ease) into a tall panel
anchored at the button's spot; the cap text + banner fade out (160ms) and
the games render inside as a **vertical cartridge rack** — compact rows
(tint band + 3-letter code + label + flavor) fit the narrow column far
better than the old 150px horizontal cards. Internals reused from the old
carousel: the registry map, the 3-letter `code()`, focus/locked/insert
handling, esc/enter/arrow keys (now ↑/↓). Drag nav: native pan-y scrolling
on touch plus mouse drag-to-scroll (deliberately **no** pointer capture —
capturing on the list retargets the click away from the row and kills mouse
insertion). Header tap, ✕, or ESC contracts back to button form (reverse
animation). `prefers-reduced-motion`: no transitions, panel snaps, insert
launches immediately.

Geometry: the panel stays top+right anchored **below the minimap**, so it
only ever extends down/left — verified against `.starmap` (mobile bottom
≈140 < rack top 168; desktop bottom ≈168 < rack top ≈250), and the
fullscreen navigator sits at z 60/70 over the rack's z 30. Mobile height is
capped (`min(380px, calc(100vh - 330px))`, floor 200px) to clear the
joystick corner on common portrait sizes.

DOM note: the root is now a `<div>`; while collapsed a transparent overlay
`<button.protocols-launch-hit>` provides the click/keyboard/ARIA surface
(nesting real buttons inside a button is invalid HTML, and swapping the
element type on expand would kill the CSS transition). The old
`.protocols-launch[aria-expanded="true"]` style rides `.is-expanded` now.
The scene's new space-to-jump listener ignores keys the rack already
`preventDefault()`ed (rack listens in capture phase).

## 3 · data_base cartridge → left-rail "DATA BASE" chip

`data_base` left the registry. A terminal chip labeled **DATA BASE**
(admin-purple family) now sits at the **bottom of the top-left indicator
stack** — admin-launch (12) → fps (44) → net (66) → auth (90, warn card
≈31px tall) → chip at `calc(max(44px, safe-top) + 80px)`, same
`max(10px, safe-left)` offset as the rest of the stack. It dispatches the
exact event the cartridge used (`bitrunners:open-data-base`, via the new
`openDataBase()` export), so Game.tsx / scene wiring is untouched.

## 4 · tether_chat cartridge → tap-to-tether

`tether_chat` also left the registry. Tapping **any un-blocked remote
avatar** (runner or dweller NPC — the bots auto-accept server-side, so this
stays testable solo) now initiates the tether flow directly; the old
"targeting mode" arm step is gone (`enterTargeting`/`isTargeting`/
`sendTetherRequest` removed; new `requestTether()` fires idle→pending
straight away). Gates intact:

- **ToS gate** — first tap from an eligible account opens the panel on the
  ToS; accepting fires the request to the runner you tapped.
- **Account gates** — guests / unapproved handles get the explanatory panel.
- **Block list** — blocked ids get neither a tether offer nor a camera lock
  (scene drops them; `requestTether` re-checks, defense-in-depth).
- While a request is **pending / tethered**, avatar taps fall back to the
  existing camera tap-lock (so you can follow your chat partner); the
  pending panel (with cancel + block-list management) opens automatically
  when a tap fires a request.

## 5 · cartridge tint variety

`ProtocolEntry.tint` widened to `ProtocolTint` = legacy `br|neutral|corp` +
`cyan|amber|magenta|lime|violet|orange`. Tints are now CSS custom props on
`.cart-tint--*` (`--cart-hi`/`--cart-lo`) consumed by `.cart-band`, so any
banded element picks them up. Assignments: data_scrape **amber**,
objectives **cyan**, shop **orange**, freq_lock **magenta**, circuit_patch
**lime**, core_run **violet**. Dead carousel-window CSS (~170 lines: rail,
track, cartridge shell, drop keyframes) removed; the shared chrome
(head/close/band/foot) stayed.

## 6 · jump

- Physics in the scene tick: `vy = 5.2` on jump, `g = -14`, land at ground
  (≈0.97u apex, ≈0.74s air). **No double-jump.** `rig.root.y = modeBase +
  jumpH`, where modeBase is the sky-grid plot origin inside data_base and 0
  everywhere else — so the arc works in the world, maze, void and Corporeal
  plot, and mode transitions land clean. XZ collision/wrap untouched
  (collision is XZ-only), and netcode is untouched: **the `move` payload
  carries `{x, z, rotY}` — no y field** (the brief assumed y was already in
  the payload; verified it is not, so nothing streams).
- Trigger 1: **Space** keydown — ignored while typing (INPUT/TEXTAREA/
  SELECT/contenteditable), on interactive targets (BUTTON/A), inside open
  dialogs, and for events something already `preventDefault()`ed.
- Trigger 2: an on-screen **spacebar keycap** (`.jump-btn`), center-bottom
  on both mobile and desktop — wide rounded rect in the 0138 worn-analogue
  style, label "jump", visually depresses on press (pointerdown class +
  `:active`). Wired for touch + mouse (pointer events) + keyboard
  activation. Hidden in RegEdit (viewport mode, no body).

## 7 · Data Base RegEdit nav rework

- **(a) Joystick pans the camera.** Previously movement input was simply
  ignored in RegEdit (verified: `moving` was gated off; the stick did
  nothing). Now stick/WASD slides the orbit **focus** in the ground plane,
  screen-relative (up = away from camera), speed scaled by orbit radius.
  Same right/forward math as the existing two-finger `plotPan` (drag stays
  grab-the-world; stick moves the viewport).
- **(b) Height slider, left rail.** Vertical range input (rotated 90° —
  hit-testing follows the transform, works across engines) pinned to the
  screen's left edge, vertically centered (clear of the top HUD and the
  bottom-left joystick). Drives `bitrunners:plot-height` → the orbit
  focus altitude, clamped 0..PLOT_HEIGHT (16). Viewport state (focus x/z +
  height) resets on plot entry so it always matches the HUD default (3).
- **(c) Depth slider + ghost cursor removed.** `pickVoxel` lost its `depth`
  param — the nearest air→solid crossing wins; place lands on the face hit,
  erase removes the hit block, empty-pad fallback unchanged. The
  translucent cursor/hover meshes (`showCursor`/`hideCursor` + desktop
  hover preview) are gone. Tests updated: depth-index cases replaced with
  nearest-surface assertions (10 voxel-scene tests, all green).
- **(d) Block visuals.** Palette recolored in voxel-core (encoding/ids/
  labels untouched): concrete beige-gray `0xb3a894`, neon_panel neon-green
  emissive `0x3aff6e` on `0x0a2412`, wood_frame light brown `0xb98f5f`,
  metal_frame pale blue `0xaac6de`, asphalt near-black `0x141517`.
  **Edge shading choice:** a 64px procedural canvas texture with a ~3px
  dark frame, applied as `map` (and `emissiveMap` on emissive blocks so the
  frame reads through the glow) on every block material — semi-bold border
  on every face at typical zoom, **zero** extra draw calls. The alternative
  (per-block inset `EdgesGeometry`/`LineSegments`) was rejected:
  InstancedMesh can't batch line segments, so edges would have cost a
  rebuild + draw call per block. wood_frame gets its own map: vertical
  grayscale grain stripes under the same frame (grayscale so the brown base
  hue holds). Textures are module-lifetime singletons (glyph-atlas
  convention), guarded for canvas-less test envs. Corporeal mode untouched
  apart from inheriting the jump (shared tick path).

## Collateral copy

Tutorial step 3 rewritten (rack + six cartridges + tap-to-chat hint), step
9 "carousel" → "protocols rack"; the desktop hint line gains
"space = jump".

## Not verifiable headless — owner eyes needed

Everything logic-gated is covered by typecheck/tests, but this batch is
mostly look-and-feel; no browser automation in this environment, so please
verify visually:

1. Morph feel (250ms grow/contract, cap fade, reduced-motion snap) on
   phone + desktop; rack never covering the minimap; joystick clearance on
   your smallest phone.
2. Shrunken button pair: attachment, banner legibility.
3. Jump arc feel (5.2/-14 is the STOP-AND-ASK default — tune in scene.ts),
   keycap look, Space not scrolling the page, no jump while typing in the
   tether input.
4. Tap-to-tether on the live sphere with NPCs: gate panel for guests, ToS
   on first eligible tap, pending panel + cancel, block-list still
   reachable from the panel.
5. RegEdit: stick panning direction, height slider feel, no ghost cursor,
   raycast placement on block faces, new block colors + wood grain + edge
   separation through the ASCII pass (border strength is the
   `FACE_FRAME_PX`/alpha pair in voxel-scene.ts if it reads too bold/faint).
6. DATA BASE chip position when the admin-launch button is present
   (admins) and on notched phones.
