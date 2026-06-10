# 0074 — Badges modal split-out + account-only name styling

Branch: `claude/badges-modal-and-name-styling`. Draft PR pending.

This is PR 79 in the polish push (see
`/root/.claude/plans/nested-tickling-reddy.md`). It covers buckets **C1
+ C2** (badge surface in its own modal, tap-to-open from the name tag's
badge slot) and the **F4 styling** portion (verified-account name
flair: weight + tint).

## What ships

### Badges modal

- **`apps/web/src/BadgesModal.tsx`** (new) — extract `BadgeStrip` +
  `BadgeLadder` from the old `UsernameEditor` into a standalone dialog.
  Opens on the `'bitrunners:open-badges'` event. Re-uses
  `fetchMyBadges`, `equipBadge`, `acknowledgeBadge`, and the optimistic
  `setEquippedBadgeLocal` shortcut so equip flips feel instant.
- **`apps/web/src/App.tsx`** — mount `<BadgesModal />` next to
  `<UsernameEditor />`.
- **`apps/web/src/UsernameEditor.tsx`** — drop the `BadgeStrip`
  section; the editor is now name-only + name-styling. Adds a
  two-tab handle picker (`dictionary` / `custom (review)`) so the
  custom-handle flow gets a UI surface instead of waiting on the
  admin console.

### Two-slot player tag

- **`apps/web/src/scene.ts`** — the floating name tag is no longer a
  single `<button>`. It is now a container with two child buttons:
  one wraps the badge glyph and dispatches `'bitrunners:open-badges'`
  on tap, the other wraps the name + sub label and dispatches
  `'bitrunners:edit-identity'` on tap. Lets the player jump straight
  to the surface they meant.
- **`apps/web/src/style.css`** — `.player-tag-slot` styling for the
  two new tap regions; no layout regression vs. the old single
  button.

### Account-only name styling

- **`apps/web/src/name-style.ts`** (new) — versioned localStorage
  blob (`v: 1`, same shape pattern as `economy.ts` /
  `mission-progress-local.ts`). Two axes:
  - `weight`: `'regular' | 'bold'`
  - `tint`: `'none' | 'solid_mint' | 'solid_ember' | 'solid_iris' | 'gradient' | 'glow'`
  - Public surface: `getNameStyle`, `setNameStyle`,
    `subscribeNameStyle`, `nameStyleClass`. The `nameStyleClass`
    helper returns an empty string when `signedIn === false`, so the
    style stays curated to accounts even if a guest tampers with
    localStorage.
- **`apps/web/src/UsernameEditor.tsx`** — adds a `$ name styling`
  section visible only when signed in. Pills for weight + tint preset,
  with each tint pill rendering itself in the corresponding style so
  the picker is its own preview.
- **`apps/web/src/scene.ts`** — subscribes to `subscribeNameStyle`
  and reapplies the class on the floating name span. Also reapplies
  on signed-in flip so guests revert to the default look.
- **`apps/web/src/style.css`** — `.name--bold`, `.name--solid_mint`,
  `.name--solid_ember`, `.name--solid_iris`, `.name--gradient`,
  `.name--glow` classes. The gradient uses `background-clip: text`
  (Safari-prefixed) over a 3-stop mint→iris→ember ramp.

## Architecture decisions

- **Open-on-event, not lifted-state. ** Both modals follow the same
  pattern as the old `UsernameEditor`: each component owns its own
  open/closed boolean and listens for a custom DOM event. The scene
  doesn't have to know the modal exists — it just fires the event.
  Keeps the React tree shallow.
- **localStorage gate for name style, not a server column.** The
  styling has zero gameplay impact and zero moderation risk (preset
  names, not arbitrary colors). Keeping it client-side avoids a
  migration and is a no-op for the server / RLS surface. If we ever
  need cross-device sync we can lift it into `profile_appearance` next
  to `equippedBadge`.
- **`nameStyleClass(style, signedIn)` returns empty for guests.**
  The signed-in check happens at *render* time, not at write time.
  Lets the runner pick a style while signed in, sign out without
  losing the choice, and have it re-apply when they sign back in.
- **Custom-handle UI surfaced now, server-side approval flow
  unchanged.** PR 84 will debug the server-side custom name approval
  path. The UI tab was missing — adding it doesn't change the
  `submitDisplayName` RPC, only how the runner reaches it.

## Verification

- `pnpm lint` ✓ (81 files, 1 file auto-fixed by biome)
- `pnpm typecheck` ✓ (8/8 tasks)
- `pnpm --filter @bitrunners/web build` ✓ (365 modules, 5.21s)
- Manual:
  - With localStorage `bitrunners.name-style.v1 =
    {"v":1,"weight":"bold","tint":"glow"}` and signed in, the floating
    tag renders bold + glow. Signing out reverts to mint regular.
  - Tap on the badge slot of the name tag → BadgesModal opens, picks
    re-equip, the floating glyph updates within the same frame.
  - Tap on the name area of the same tag → identity editor opens
    with both handle-picker tabs.

## Owner-tunable values

| What | v1 default | Where |
|---|---|---|
| Tint preset list | mint / ember / iris / gradient / glow | `name-style.ts` `NAME_TINT_OPTIONS` |
| Tint stylesheet | text-shadow + color | `style.css` `.name--*` |
| Gradient ramp | 3-stop mint→iris→ember | `style.css` `.name--gradient` |
| Custom handle char allow-list | `[a-zA-Z0-9_-]` 3–24 chars | `UsernameEditor.tsx` `setCustom` |

## Roadmap

- PR 76 (merged) — Auth verify, password reset, signup grant
- PR 77 (merged) — Responsive design tokens
- PR 78 (merged) — Persistent credits HUD
- PR 81 (merged) — 10-mission chain + lore + complete-state hydration
- **PR 79 (this PR)** — Badges modal split + verified name styling
- PR 80 — Shop + Inventory unified 2-tab modal
- PR 82 — Bit scraper depth
- PR 83 — Tether chat protocol
- PR 84 — Custom name + emote approval debugging
- PR 85 — Minimap detail / legibility on phone

## No new dependencies. No protocol bump. No schema change.
