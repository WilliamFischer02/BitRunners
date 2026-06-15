# 0088 — ASCII dissolve on native `<dialog>` modals

Completes the Phase 5 dissolve retrofit begun in devlog 0085.
Previously: `Samm`, `AdminConsole`, and `UsernameEditor` used
`showModal()` and could not receive the wipe animation because the
CSS top layer places native dialogs above `position: fixed` canvas
overlays mounted in `document.body`.

## What changed

### `packages/ascii` / `apps/web/src/transitions/dissolve.ts`

Added `mountTarget?: HTMLElement` to `DissolveOptions`. When set,
the overlay canvas is appended there instead of `document.body`.
Only change to the function body:

```ts
(opts.mountTarget ?? document.body).appendChild(canvas);
```

Positioning stays `position: fixed` (viewport-relative even inside
the top layer), so existing callers (AdminDialogue, MissionDialogue)
are unaffected — they still omit `mountTarget`.

### `apps/web/src/Samm.tsx`

`SammPanel` now:
- Plays a dissolve-in wipe on mount (canvas mounted inside the
  dialog via `mountTarget: dialog`).
- Tracks a `closing` boolean; all close triggers (`onClose` prop,
  cancel event, backdrop click, ✕ button) set it to `true`.
- Plays a dissolve-out wipe when `closing` flips, calling
  `dialog.close()` then `onClose()` after the 280 ms wipe.

### `apps/web/src/AdminConsole.tsx`

`AdminPanel` receives the same treatment: dissolve-in on showModal,
dissolve-out through a `closing` state before unmounting.

### `apps/web/src/UsernameEditor.tsx`

`EditorPanel` receives the same treatment.

## Pattern summary

All three components follow the exact pattern used in `AdminDialogue`
and `MissionDialogue`, with one addition: `mountTarget: dialog` is
passed to `playDissolve` so the canvas lives inside the top-layer
dialog, rendering correctly above its content.

`DISSOLVE_OPTS` is consistent across all five callers:
`{ durationMs: 280, cell: 8, color: '#c0ffd6' }`.

## Verification

- `pnpm lint` ✓
- `pnpm typecheck` 8/8 ✓
- `pnpm build` 5/5 ✓
- Visual: owner should open each modal and confirm the ASCII glyph
  wipe plays on both entry and close. No headless WebGL context
  available to verify the animation frames directly.
- Reduced-motion: `prefersReducedMotion()` inside `playDissolve`
  snaps to end-state immediately — no regression.

## No server change

Pages-only. Fly redeploy not required.
