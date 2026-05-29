# 0055 — showModal() migration: ScrapePanel + ProfilePanel

**Date:** 2026-05-29
**Branch:** `claude/peaceful-thompson-7k3R6`
**Files:** `apps/web/src/ScrapeMenu.tsx`, `apps/web/src/ProfileIcon.tsx`

## What changed

Completed the `showModal()` migration for the two remaining panels that were
blocked on PR #51 merging (ScrapeMenu/ProfileIcon were in PR #51's file
footprint). All four panels now use the native HTML modal API — no more
`<dialog open>` + `.panel-backdrop` + manual `window` keydown listeners.

### Before (ScrapePanel + ProfilePanel)

```html
<div class="panel-backdrop">  <!-- fake backdrop -->
  <dialog open aria-modal="true">  <!-- non-modal; no browser focus trap -->
```

With `window.addEventListener('keydown', e => { if (e.key === 'Escape') ... })`.

### After

```tsx
const dialogRef = useRef<HTMLDialogElement>(null);

useEffect(() => {
  const dialog = dialogRef.current;
  const trigger = document.activeElement as HTMLElement | null;
  dialog.showModal();                          // → top layer, native focus trap
  dialog.addEventListener('cancel', onCancel); // Escape → our handler
  return () => {
    dialog.removeEventListener('cancel', onCancel);
    trigger?.focus();                          // return focus on dismiss
  };
}, []);
```

```html
<dialog ref={dialogRef} onClick={backdrop-detect}>  <!-- no open attr -->
```

Backdrop click: `onClick={(e) => e.target === e.currentTarget && close()}`.

### ScrapePanel specifics

ScrapePanel has a close animation (`scrape-panel--out` class + 240 ms delay).
The `cancel` listener calls `e.preventDefault()` before invoking `requestClose()`
so the browser's native dismiss doesn't race the animation:

```tsx
const onCancel = (e: Event): void => {
  e.preventDefault(); // let the out-animation run before unmount
  closeRef.current();
};
```

The `closeRef` latest-closure pattern (already present for the scrape button)
is reused here — no new pattern introduced.

### ProfilePanel specifics

No close animation; the `cancel` listener calls `onClose()` directly. Simpler
than ScrapePanel.

Added `useRef` to ProfileIcon.tsx imports (`useEffect, useRef, useState`).

## Security scan (this run)

- No `dangerouslySetInnerHTML` / `innerHTML` in `apps/web/src/`
- No service-role key in client code
- No `eval` / `new Function` in `apps/`
- Window keydown listeners in TSX: only `Boot.tsx` (boot-screen nav — expected)
- All four panels now on `showModal()` — confirmed by grep: zero remaining
  `panel-backdrop` or `<dialog open>` patterns in `apps/web/src/*.tsx`
- Admin privilege checks remain server-enforced (RLS / SECURITY DEFINER)
- `profiles.role` column-grant lockdown (migration 0006) still pending — no
  change here; owner action

## Why this matters

- `showModal()` enforces a browser-level focus trap — keyboard users can no
  longer Tab out of any open panel into the game canvas behind it
- All four panels now have consistent Escape handling (native `cancel` event,
  not a race-prone window listener)
- Focus returns to the trigger element on dismiss for all four panels
- The `.panel-backdrop` CSS class is now unused by any component — it can be
  removed in a future CSS cleanup pass (kept for now; it's harmless)

## Honest status

- Gates green: `pnpm lint` clean (52 files), `pnpm typecheck` 8/8,
  `pnpm build` 5/5.
- **Not verifiable headless** — needs a running browser. Key checks:
  1. Open data scrape panel → Tab stays within panel; Escape triggers close
     animation, focus returns to the scrape-launch button
  2. Open shop (via $ shop button) → same focus-trap; Escape closes
  3. Open profile → Tab stays within panel; Escape closes, focus returns to
     profile button
  4. Click backdrop (outside panel content) → panel closes (all three panels)
  5. `prefers-reduced-motion`: ScrapePanel skips animation; backdrop still visible

## Next

- Owner: run migration 0006 (profiles privilege-escalation fix)
- Trading backend (p2p-trading-epic P1) — next focused session once auth is live
- `.panel-backdrop` CSS rule is now dead code — safe to remove in a cleanup pass
