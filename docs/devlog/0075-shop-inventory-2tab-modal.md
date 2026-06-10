# 0075 — Shop + Inventory unified 2-tab modal

Branch: `claude/shop-inventory-tabs`. Draft PR pending.

This is PR 80 in the polish push (see
`/root/.claude/plans/nested-tickling-reddy.md`). Covers bucket **C4**:
one launcher for cosmetics + inventory, two tabs at the top, owned
items first.

## What ships

### New modal

- **`apps/web/src/ShopInventoryModal.tsx`** (new) — 2-tab dialog with
  `inventory` first, `shop` second. Opens on
  `'bitrunners:open-shop-inventory'`. `openShopInventory(tab?)` helper
  for callers. Title hot-swaps with the selected tab so the runner
  always sees the surface they're on.

### Re-export views from the data-scrape panel

- **`apps/web/src/ScrapeMenu.tsx`** —
  - `ShopView` and `InventoryView` are now named exports so the new
    modal can render them directly. Same source of truth for the row
    markup, equip toggles, and currency math.
  - Tab nav inside ScrapeMenu loses the `shop` and `inv` buttons —
    those surfaces are reached only through the new modal. ScrapeMenu
    now reads `scrape · tree · theme · emote` (data-scraping tooling
    only).

### Launchers + wiring

- **`apps/web/src/App.tsx`** — mount `<ShopInventoryModal />` next to
  `<ScrapeMenu />`. The Emote Wheel's inventory button now calls
  `openShopInventory('inventory')` instead of `openScrape('inventory')`.
- **`apps/web/src/protocols-registry.ts`** — third cartridge in the
  protocols carousel, `shop`, glyph `⌶`, corp tint, launches the new
  modal at the shop tab. Tapping the cartridge while the modal is
  closed opens it; reopening the cartridge while open is a no-op
  (the modal is a singleton with its own `open` state).

### Styling

- **`apps/web/src/style.css`** — `.shopinv-tabs` + `.shopinv-tab`
  styles, hover affordance, selected state inset. Tabs respect the
  `--ui-tap-min` minimum from PR 77, so they stay tappable on mobile.

## Architecture decisions

- **Re-export, don't duplicate.** ShopView + InventoryView each
  embed real logic: economy subscriptions, equip mutators, owned/
  locked badges, "buy tokens" exchange row. Duplicating them into
  the new modal would mean keeping two copies in sync. Exporting
  from `ScrapeMenu.tsx` keeps one source of truth and adds only
  two `export` keywords.
- **Drop shop/inv tabs from the scrape menu.** Two surfaces for the
  same view is exactly what we're trying to avoid (the user noted
  "in fewer taps, through more aesthetic page/game elements"). The
  data-scrape panel keeps the gameplay-relevant inner tools (scrape,
  tree, themes, emoticron); shop+inv leave entirely.
- **`openShopInventory(tab)` default is `'inventory'`.** Reflects the
  user-stated tab order. Callers that explicitly want the shop pass
  `'shop'` — only the new protocol cartridge does that today.
- **No new schema.** Shop catalog, currency math, equip slot table,
  inventory grid storage all stay where they were. This PR is purely
  a UI re-org.

## Verification

- `pnpm lint` ✓ (80 files, 1 file auto-fixed by biome — import order)
- `pnpm typecheck` ✓ (8/8 tasks)
- `pnpm --filter @bitrunners/web build` ✓ (5.18 s)
- Manual:
  - Cartridge "shop" appears as the third tile in the Protocols
    carousel; tapping it opens the modal on the Shop tab.
  - Emote-wheel inventory button opens the modal on the Inventory tab.
  - Tab switch persists for the lifetime of the dialog; closing and
    reopening resets to the launcher's initial tab.

## Owner-tunable values

| What | v1 default | Where |
|---|---|---|
| Tab order | inventory → shop | `ShopInventoryModal.tsx` `ShopInvTab` |
| Cartridge tint | corp orange | `protocols-registry.ts` `tint: 'corp'` |
| Cartridge glyph | `⌶` | `protocols-registry.ts` `glyph` |
| Cartridge flavor | "cosmetics + credits" | `protocols-registry.ts` `flavor` |

## Roadmap

- PR 76 (merged) — Auth verify, password reset, signup grant
- PR 77 (merged) — Responsive design tokens
- PR 78 (merged) — Persistent credits HUD
- PR 81 (merged) — 10-mission chain + lore + complete-state hydration
- PR 79 (open) — Badges modal + name styling
- **PR 80 (this PR)** — Shop + Inventory 2-tab modal
- PR 82 — Bit scraper depth
- PR 83 — Tether chat protocol
- PR 84 — Custom name + emote approval debugging
- PR 85 — Minimap detail / legibility on phone

## No new dependencies. No protocol bump. No schema change.
