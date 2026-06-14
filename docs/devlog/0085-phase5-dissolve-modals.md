# 0085 — Phase 5: ASCII dissolve on dialogue modals

Branch: `claude/peaceful-thompson-44jtkh`. Autonomous session 2026-06-13.

Phase 5 of the six-PR render-polish batch (planned in devlog 0068). The
`playDissolve` helper from Phase 4 is now wired into the two prominent
div-based dialogue modals so they open and close with a dithered glyph
wipe instead of appearing and vanishing abruptly.

## What ships

### `apps/web/src/AdminDialogue.tsx`

- Imports `playDissolve` from `./transitions/dissolve.js`.
- `frameRef` on the `.dialogue-frame` `<button>` so the dissolve canvas
  positions exactly at the panel's rect.
- `onCloseRef` (stable ref pattern) to avoid stale closure on `onClose`.
- `closing: boolean` state: starts `false`; becomes `true` when any
  internal close path fires instead of calling `onClose` directly.
- Mount effect: plays `dissolve 'in'` (280 ms, 8 px cells, `#c0ffd6`)
  on the first paint — the frame wipes in from glyphs.
- Closing effect: plays `dissolve 'out'`; `onClose` is called only after
  the animation finishes. The parent (`App.tsx`) then unmounts.
- `doClose` replaces all internal `onClose()` call-sites (`advance()`
  closing branch; auto-close timer).

### `apps/web/src/MissionDialogue.tsx`

- Same `playDissolve` + `DISSOLVE_OPTS` constants as above.
- Outer `MissionDialogue` gains a `mounted: boolean` state so the Panel
  stays in the DOM while the out dissolve plays (prevents premature
  unmount when `open` goes false).
- `local` snapshot is now cleared in `onExited`, not on `!open`, to keep
  Panel renderable through the full dissolve duration.
- `Panel` gains `onExited` prop + `frameRef` + `closing` state.
  Same dissolve-in-on-mount / dissolve-out-before-close pattern as
  `AdminDialogue`.

## What was NOT done (and why)

The remaining three modals from the Phase 5 plan — **Samm**,
**AdminConsole**, **UsernameEditor** — all use native `<dialog>` with
`showModal()`. Native dialogs are in the browser's CSS **top layer**,
which renders above all `position: fixed` content regardless of
`z-index`. A canvas appended to `document.body` at `z-index: 1000`
cannot overlay a top-layer dialog.

Options for a future session:
1. Append the canvas INSIDE the dialog element (needs `mountTarget`
   parameter in `playDissolve`) and verify `position: fixed` behavior
   inside the top layer on each target browser.
2. Replace `showModal()` with a manual focus-trap + `role="dialog"`
   pattern so the component is rendered in normal flow and the canvas
   overlay works as usual.

Option 1 is smaller; option 2 is cleaner long-term.

## Security pass findings (this session)

Scanned tether-chat server code (`sphere-room.ts`) and recent additions.
No critical issues found. Two minor findings:

**F1 — Tether request flood (low):** `tether-request` has no per-sender
rate limit. A client can send requests to every other client in the room
without throttle, flooding them with `tether-incoming` notifications.
`TETHER_RATE_LIMIT_PER_MIN` only covers `tether-send` (chat messages).
Fix: add a per-sender pending-request count or a global
`tether-request` rate gate.

**F2 — Double-accept race (very low):** A client can send
`tether-request` to multiple targets concurrently (the server only
blocks this once `activeTethers.has(requester)`, i.e., after the first
accept arrives). If two targets accept before the first accept is
processed, `activeTethers` can be overwritten, leaving stale tether
state. In practice the window is sub-millisecond in a 40-client room.
Fix: track each client's single outgoing pending session in a
`pendingFrom: Map<sessionId, target>` map and reject new requests while
one is in flight.

Both findings are escalated to the handoff; no server changes in this PR.

## Verification

- `pnpm lint` ✓ (91 files, no fixes needed)
- `pnpm typecheck` ✓ (8/8 packages)
- `pnpm build` ✓ (web gzip ~272 kB — no bundle change)
- Headless: no regressions in the scene boot + class select flow.
- **Not verifiable headless:** the dissolve visual effect and timing.
  Owner should open the Admin encounter and a mission final checkpoint
  to confirm the 280 ms glyph-wipe opens and closes each dialogue.

## No new dependencies. No schema change. No server change.
