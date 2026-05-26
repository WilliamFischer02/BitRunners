# 0050 — Accessibility: modal dialog semantics + ARIA live regions

**Date:** 2026-05-26
**Branch:** `claude/peaceful-thompson-BkYUL`

Autonomous run. Mandatory security pass (clean), then an accessibility polish
pass covering all four modal panels and the tutorial overlay.

## Security scan

Full pass per the autonomous-task brief. No new findings:

| Category | Result |
|---|---|
| Client-trusted privileged actions | PASS — all admin actions server-enforced via RLS |
| `dangerouslySetInnerHTML` | PASS — not used anywhere |
| `innerHTML` | PASS — fixed in devlog 0049; confirmed absent |
| Injection (SQL/XSS/command) | PASS — no raw SQL; all user-facing text from fixed catalogs |
| Hardcoded secrets | PASS — only `VITE_` env vars |
| Free-text player input | PASS — emotes + class names use allowlists |
| RLS policy gaps | PASS — all 10 tables have correct policies |

## What changed

### Modal panels → native `<dialog open>`

All four modal panels (SAMM, Admin console, Profile, Data Scrape) were
`<div role="dialog" aria-modal aria-labelledby>`. Biome 1.9.4 correctly flags
this: prefer the native `<dialog>` element, which carries `role="dialog"`
implicitly. Changed all four to `<dialog open>` (non-modal semantics; `.showModal()`
with focus-trap is a future upgrade noted below). `aria-modal="true"` and
`aria-labelledby` are retained and still valid on the native element.

A CSS reset was added immediately before the existing `.panel` rule:

```css
dialog.panel { padding: 0; border: none; margin: 0; }
```

This resets the browser-default `padding: 1em`, `border: solid`, and `margin: auto`
that `<dialog>` carries, so `.panel` continues to control all visual styling.
No layout change visible to sighted users.

### SAMM panel — `aria-live` result region

`<div className="samm-quip">` now carries `aria-live="polite" aria-atomic="true"`.
This element holds SAMM's text messages (greeting, "PROCESSING YOUR CONTRIBUTION…",
post-spin quip). Screen readers will now announce the outcome after each pull —
the most immediately useful AT improvement in this pass.

Bet tier buttons gained `aria-label` ("bet N credits") and `aria-pressed` to
signal the selected tier. The pull button gained `aria-label` that describes
the action and current bet amount, updated dynamically.

### Tutorial overlay → native `<section>`

Both tutorial card divs (`tutorial-card` and `tutorial-card--reward`) were
`<div role="region">`. Changed to `<section aria-label>`, which is the native
equivalent and satisfies Biome's `useSemanticElements` rule cleanly. No CSS
change needed; `.tutorial-card` works on `<section>` identically to `<div>`.

### ScrapeMenu nav buttons — `aria-pressed` + `aria-label`

The four view-switcher buttons (scrape / tree / shop / inv) gained:
- `aria-pressed={view === target}` — signals which view is active
- `aria-label={VIEW_LABELS[target]}` — expands "inv" → "inventory"

### Profile panel

Added `aria-labelledby="profile-dialog-title"` and converted to `<dialog open>`,
consistent with the other panels.

## Known upgrade path

`<dialog open>` is a non-modal dialog — the browser does not trap focus. A future
pass should call `.showModal()` via a `useEffect` ref, which gives native focus
trapping and lets us remove the custom Escape handlers (the browser fires a
`cancel` event instead). That's a larger refactor (CSS backdrop pseudo-element
interacts with our `.panel-backdrop` div) and intentionally deferred.

## Honest status

- Gates green: `pnpm lint` clean (52 files), `pnpm typecheck` 8/8, `pnpm build` 5/5.
- **Not verifiable headless** — the `<dialog open>` change has CSS implications
  that need a live eyeball. To verify: open each panel (SAMM, Admin, Profile,
  Data Scrape) and confirm it still renders centered and styled correctly. If
  any panel looks wrong (extra padding, misaligned), the `dialog.panel` CSS
  reset in `style.css` is where to tune.
- **SAMM quip** — screen-reader testing needed to confirm the `aria-live`
  announcement fires correctly after each pull.
- Client-only changes (no server/packages touches). **Pages-only deploy, no Fly.**

## Files

`apps/web/src/Samm.tsx` (→ `<dialog open>`, `aria-live` quip, bet button labels),
`apps/web/src/AdminConsole.tsx` (→ `<dialog open>`),
`apps/web/src/ProfileIcon.tsx` (→ `<dialog open>`, `aria-labelledby`),
`apps/web/src/ScrapeMenu.tsx` (→ `<dialog open>`, nav `aria-pressed`+`aria-label`),
`apps/web/src/Tutorial.tsx` (→ `<section aria-label>`),
`apps/web/src/style.css` (`dialog.panel` reset),
this devlog, `.claude/handoff.md`.
