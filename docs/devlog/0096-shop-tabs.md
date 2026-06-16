# 0096 — Shop redesign: tabbed menu (mega-batch 4.8)

**Date:** 2026-06-16
**Branch:** `claude/mega-batch-2026-06-16`
**Type:** P2 visual redesign · client-only (Pages-only deploy)

## Change

`ShopView` went from a flat clothing/pets list to a tabbed hub with the
four sections the brief specified:

- **`// outfits`** — the existing clothing + pets catalog + the
  credits→tokens exchange (extracted into `OutfitsTab`).
- **`// emotes`** — placeholder for now; the premium emote pack lands here
  in task 4.12, which also wires the equip-slot loadout.
- **`// themes`** — embeds the existing `ThemeView` (ASCII palette shop).
- **`// upgrades`** — embeds the existing `TreeView` (passcode skill tree).

The selected tab persists to `sessionStorage` (`bitrunners.shop.tab`), so
re-opening the shop returns to the same section. Tab buttons reuse the
existing `.scrape-tabbtn` styling; new `.shop-tabs` flex/wrap container.

This consolidates themes + upgrades under the shop (they remain reachable
from the data-scrape panel's top-level nav too — no entry point removed).

## Verify (owner)

Open the shop. Switch tabs; close and re-open → it lands on the last tab.
`// themes` and `// upgrades` show the palette shop and skill tree
respectively. `// emotes` shows the placeholder until 4.12.

## Files

- `apps/web/src/ScrapeMenu.tsx`
- `apps/web/src/style.css`
