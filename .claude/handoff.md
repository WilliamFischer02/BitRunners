# Handoff — 2026-06-13, Phase 5 dissolve retrofit (AdminDialogue + MissionDialogue)

## What just shipped (this branch)

`claude/peaceful-thompson-44jtkh`, draft PR pending. Devlog: `docs/devlog/0085-phase5-dissolve-modals.md`.

### Phase 5 — ASCII pixel-crush dissolve on div-based dialogue modals

- **`apps/web/src/AdminDialogue.tsx`** — `playDissolve` wired in. Frame
  dissolves 'in' on mount, 'out' on close (280 ms, 8 px cell). `closing`
  state + `doClose` replace direct `onClose()` calls so unmount is
  deferred until the animation finishes.
- **`apps/web/src/MissionDialogue.tsx`** — Same treatment. Outer component
  gains `mounted` boolean to keep Panel alive during the out dissolve;
  `onExited` clears `mounted` + `local` after the animation. Panel gains
  `frameRef` + `closing` state + same dissolve effects.

No server change. Pages-only deploy; no Fly redeploy needed.

## Owner visual check required

- Open the Admin encounter (approach the obelisk) — confirm the dialogue
  frame wipes in with ASCII glyphs, then wipes out on close.
- Walk through a mission and reach the final checkpoint — same wipe-in
  and wipe-out on the mission dialogue.
- 280 ms per wipe; reduced-motion users get snap-to-end-state (via
  `prefersReducedMotion()` check inside `playDissolve`).

## What was NOT done (and why)

**Samm, AdminConsole, UsernameEditor** all use native `<dialog>` with
`showModal()`. The browser's CSS top layer puts dialogs above
`position: fixed` content at any `z-index`, so the canvas overlay can't
render over them. Two paths forward:

1. Pass `mountTarget = dialog` to a new `opts.mountTarget` param in
   `playDissolve` — append canvas inside the dialog and verify
   `position: fixed` behavior in the top layer.
2. Replace `showModal()` with a manual focus-trap + `role="dialog"` so
   the element lives in normal flow.

Option 1 is the smallest change; flag for a future session.

## Security findings (from this session)

Scanned tether-chat server code. Two minor, non-critical findings:

**F1 — No per-sender rate limit on `tether-request`.** A client can
flood all 40 peers with incoming-tether notifications. Fix: add a
per-sender rate gate on `tether-request` in `sphere-room.ts`.

**F2 — Double-accept race in tether handshake.** A client can send
requests to multiple targets concurrently; if two targets accept before
the first is registered in `activeTethers`, the map gets overwritten.
Fix: track `pendingFrom: Map<sessionId, target>` to reject a second
outgoing request while one is in flight.

Both are low-severity (no auth bypass or currency exploit). Worth fixing
in a future server-side session.

## Roadmap reference

Sub-phases A–I are done. Sub-phase J (second minigame + Scrape skill-tree
expansion) is the next roadmap item. "Tether Hop" (Phase 3 of the
render-polish batch, `docs/devlog/0065`) is ALSO outstanding — it was
skipped after Phase 2 (standby+spawn, PR #71) and Phase 4 (circuit
floor, PR #73).

The `CreditsHud` has a defensive `chatter` field read already coded for
when Tether Hop lands. Phase 3 is entirely unspecified in the codebase —
owner Q&A needed before implementing. Do NOT invent Tether Hop mechanics.

## Next suggested work (priority order)

1. **Owner Q&A on Tether Hop** — what does the minigame do? (earns
   "chatter" resource, but mechanics are undefined)
2. **tether-request rate limit** (small server fix, devlog F1 above)
3. **Dialog dissolve** — add `mountTarget` to `playDissolve` so Samm /
   AdminConsole / UsernameEditor can use the same wipe
4. **Sub-phase J** — second minigame + Scrape skill-tree (owner input
   needed on what the second minigame is)
