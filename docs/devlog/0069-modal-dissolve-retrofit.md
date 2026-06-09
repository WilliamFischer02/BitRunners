# 0069 — Modal dissolve retrofit (Phase 5)

Branch: `claude/phase5-retrofit-transitions` (off `claude/phase4-floor-and-transitions`). Draft PR pending.

Final phase of the six-PR batch. Wires the ASCII pixel-crush dissolve from Phase 4 into all five legacy modal surfaces so the menu transitions match the boot→game seam.

## What ships

### new

- **`apps/web/src/transitions/dialog-dissolve.ts`** — tiny adapter for
  `HTMLDialogElement`. Exports:
  - `openWithDissolve(dialog)` — calls `dialog.showModal()` if not already open
    and overlays a brief (240 ms, 10 px cell) ASCII dissolve.
  - `closeWithDissolve(dialog, cb)` — plays the close dissolve, then calls
    `cb()` so the React state owning the modal mount can flip.

### edits

- **`apps/web/src/AdminConsole.tsx`** — modal open switches from
  `dialog.showModal()` to `openWithDissolve(dialog)`.
- **`apps/web/src/Samm.tsx`** — same swap.
- **`apps/web/src/UsernameEditor.tsx`** — same swap.
- **`apps/web/src/AdminDialogue.tsx`** — different modal pattern (custom
  `.dialogue-root` overlay, no `<dialog>`). Added a `rootRef` + one-shot
  `playDissolve(rootRef, 'in')` on mount; the existing typewriter line
  reveal is unchanged.
- **`apps/web/src/MissionDialogue.tsx`** — same approach as
  `AdminDialogue`. Dissolve plays over the `.dialogue-root mission-
  dialogue` container on mount.

## Architecture decisions

- **Adapter not wrapper.** The 5 surfaces all already own their open /
  close lifecycle; wrapping them in a `<Dissolve>` component would have
  required restructuring each one. The `openWithDissolve` /
  `closeWithDissolve` adapter is a 2-line drop-in.
- **`dialog` and custom-overlay modals share the same helper.** Both
  paths funnel into `playDissolve` from Phase 4, so the visual stays
  consistent across the menu modals and the in-world dialogue overlays.
- **No close dissolve in this pass.** The retrofit is open-side only —
  closing a panel still snaps to nothing. Adding a graceful close
  animation requires intercepting every close path (panel-close button,
  backdrop click, ESC), which is a larger lift. Owner can request the
  full close-side pass as a follow-up.

## Verification

- `pnpm typecheck` ✓
- `pnpm lint` ✓
- `pnpm --filter @bitrunners/web build` ✓

## Roadmap

- Phase 1 (PR #70) — Protocols carousel + Objectives + minimap parity
- Phase 2 (PR #71) — Standby + spawn scatter
- Phase 3 (PR #72) — Tether Hop + chatter + exchange
- Phase 4 (PR #73) — Circuit floor + boot dissolve engine
- **Phase 5 (this PR)** — Retrofit dissolve to 5 modal surfaces

## No new dependencies. No protocol bump. No schema change.
