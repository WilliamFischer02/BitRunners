# 0054 — showModal() focus-trap upgrade: AdminConsole + Samm panels

**Date:** 2026-05-27
**Branch:** `claude/peaceful-thompson-d3osN`
**Files:** `AdminConsole.tsx`, `Samm.tsx`, `style.css`

## What changed

Migrated the AdminConsole panel and SAMM panel from `<dialog open>` + manual
`window` Escape listener to `showModal()` — the native HTML modal API. The
two remaining panels (`ScrapeMenu`, `ProfileIcon`) are left for after PR #51
merges (disjoint file rule).

### Before

All four panels used:
```html
<div class="panel-backdrop"> <!-- fake backdrop, click-to-close -->
  <dialog open aria-modal="true"> <!-- non-modal; no focus trap -->
```

With a manual `window.addEventListener('keydown', ...)` for Escape and
`onMouseDown` stop-propagation to prevent backdrop clicks from closing the
dialog. No actual focus trap — keyboard users could Tab to elements behind
an open panel.

### After (AdminConsole + Samm)

```tsx
const dialogRef = useRef<HTMLDialogElement>(null);
useEffect(() => {
  const dialog = dialogRef.current;
  const trigger = document.activeElement as HTMLElement | null;
  dialog.showModal();                      // → top layer, native focus trap
  dialog.addEventListener('cancel', ...);  // Escape → our onClose
  return () => { trigger?.focus(); };      // return focus on dismiss
}, []);
```

```html
<dialog ref={dialogRef} onClick={backdrop-detect}> <!-- no open attr -->
```

`onClick={(e) => e.target === e.currentTarget && onClose()}` detects
`::backdrop` clicks (pointer-only; keyboard users close via Escape).

The `.panel-backdrop` wrapper div is removed for these two panels. Its
visual role (dark overlay + centering) is now handled by `dialog.panel::backdrop`
and the browser's built-in top-layer centering via `margin: auto`.

### CSS changes

```css
dialog.panel {
  padding: 0;
  border: none;
  margin: auto;                      /* was 0 — enables top-layer centering */
  max-width: calc(100vw - 32px);     /* 16 px edge gap on small viewports   */
}
dialog.panel::backdrop {
  background: rgba(2, 4, 6, 0.7);
  backdrop-filter: blur(2px);        /* matches the old .panel-backdrop look */
}
```

`max-width: calc(100vw - 32px)` uses `100vw` (not `100%`) so it doesn't
double-apply the padding for non-migrated panels still inside `.panel-backdrop`.

## Why this matters

`<dialog open>` is a **non-modal** dialog. `aria-modal="true"` is advisory
only — assistive technologies may warn but browsers do not enforce a focus
trap. A keyboard user pressing Tab with any panel open could reach elements
behind it (the game canvas, the boot screen, etc.).

`showModal()` enforces a true focus trap at the browser level. It also:
- Handles Escape natively (fires `cancel` event → our handler)
- Provides the `::backdrop` pseudo-element in the correct stacking context
- Returns focus to the trigger element (handled in cleanup)

## What is NOT yet migrated

`ScrapeMenu` and `ProfileIcon` still use `<dialog open>` + `.panel-backdrop`.
Both are touched by open PR #51; migrating them now would cause merge
conflicts. Migrate after #51 lands — same pattern, ~10 lines each.

## Security scan (this run)

No new issues found:
- No `dangerouslySetInnerHTML` / `innerHTML` anywhere in `apps/web/src/`
- No service-role key in client code
- `ConstructionGate` role check is server-enforced (`getMyRole()` → Supabase profiles RLS)
- Admin console free-text inputs (`reason`, dialogue editor textarea) are
  admin-only — exempt from no-free-text moderation rule
- Room-code input in `ProfileIcon` is a Colyseus `joinById` param — not
  stored/displayed, no injection risk
- Server source has no `eval`/`exec`/shell calls

## Honest status

- Gates green: `pnpm lint` clean (52 files), `pnpm typecheck` 8/8,
  `pnpm build` 5/5.
- **Not verifiable headless** — needs a running browser to confirm the
  focus trap, backdrop click, and focus-return behaviour. Key checks:
  1. Open admin console → Tab key stays within the panel
  2. Press Escape → panel closes, focus returns to the `⚙ admin` button
  3. Open SAMM → click outside panel area → panel closes
  4. `prefers-reduced-motion` → backdrop still appears (opacity-only; no
     `backdrop-filter` animation)
- ScrapeMenu / ProfileIcon panels are unaffected (still use old pattern);
  no regression expected.

## Next

- Migrate `ScrapeMenu` + `ProfileIcon` to `showModal()` after PR #51 merges.
- Trading backend (p2p-trading-epic P1) — the next focused session.
