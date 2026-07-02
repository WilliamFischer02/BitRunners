# 0114 — Launcher pill reads "Menu" (mega-batch 2 · 4.1)

## What

The HUD launcher pill (`.profile`, `apps/web/src/ProfileIcon.tsx`) used to
render the player's class name (e.g. `bit_spekter`) as its bold line. That
reads as information, not as a button — nothing told a new player the pill
opened the main menu. Relabelled the pill so it reads as the affordance.

## Change

`ProfileIcon.tsx` only (no CSS, no logic):

- Bold line (`.profile-class`) now shows the literal `Menu` instead of the
  class name.
- Eyebrow (`.profile-label`) changed `// profile` → `// menu`.
- Button gains `aria-label="open menu"` and `title="open menu"` (was
  `title="open profile"`).

The class name is **not** lost from the HUD: it still shows in the opened
panel's `$ identity → class` row (unchanged) and in the in-game `.hint`
line (`{className} · arrows / wasd / stick`, `App.tsx`). `className` is
still passed to `ProfilePanel`, so nothing downstream changes.

## Why no CSS change / no layout risk

`Menu` (4 chars) is shorter than every class name the pill used to hold, so
it can't overflow the pill at any breakpoint. The pill's width is driven by
`min-width` / `max-width` (170px desktop; 116–156px ≤540px; 100px ≤380px) —
the shorter label sits comfortably inside all three. Verified by reading the
`.profile` rules at `style.css:934`, `:2533`, `:2575`, `:2659`.

## Verify (owner)

- Load the game: the top-right pill reads `// menu` / `Menu` / `// <handle>`.
- Open it: the panel's `$ identity` still shows the class.
- Resize to ≤540px and ≤380px: no clipped/overflowing pill text.
- Screen reader / hover: the button announces "open menu".
