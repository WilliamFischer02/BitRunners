# 0115 — Character-select heading + glowing cards (mega-batch 2 · 4.2)

## What

The class-select screen (`apps/web/src/Boot.tsx`) didn't announce itself —
it opened straight into a grid with only a small `class registry · select
stack` eyebrow. Added an obvious title and gave the option cards an animated
glow so the grid reads as a set of interactive choices.

## Changes

**`Boot.tsx`** — one element added as the first child of `.boot-select-pane`:
`<h1 class="boot-select-heading">Character Select</h1>`. Selection logic,
card order, and locked-class behaviour are untouched.

**`style.css`**:

- `.boot-select-heading` — `Character Select` in the BitRunner purple
  `#b07cff` (distinct from the green/mono palette used everywhere else on
  the boot screen), `clamp(22px, 4.4vw, 34px)` so it scales down cleanly on
  phones, with a `heading-glow` text-shadow pulse (~2.6 s).
- `.boot-tile--locked` — gains a faint purple `tile-locked-breathe` box-shadow
  pulse (~2.8 s). Previously locked cards were fully static. This is the
  dimmer glow; the dashed border + `opacity: 0.42` + grayscale keep locked
  cards clearly secondary.
- Selectable cards keep the existing brighter green `tile-breathe` pulse
  (`.boot-tile--active`), so "selectable glows brighter than locked" holds by
  construction.
- `.boot-tile--active:focus-visible` — a stronger ring for keyboard
  navigation (locked cards are `disabled` buttons and can't be focused).

**Reduced motion** — extended the existing global
`@media (prefers-reduced-motion: reduce)` block (devlog 0054): the new
`.boot-tile--locked` and `.boot-select-heading` animations are set to
`animation: none`, leaving their static glow/shadow in place. The active
tile's breathe was already frozen there.

## Why these colours

`#b07cff` is the canon BitRunner faction purple already used for the boot
banner glow, admin obelisk marker, remote-runner minimap dots, and faction
tinting — so the heading reads as "on brand" rather than a new accent, while
still contrasting hard with the green class-grid text.

## Verify (owner)

- Reach the class grid (fresh load, or in-game "change runner"): a large
  purple `Character Select` title sits above the grid and pulses gently.
- Selectable cards (bit_spekter + any earned class) glow green and brighter;
  locked cards show a dim purple pulse.
- Tab through the cards: the focused selectable card gets a bright ring.
- OS "reduce motion" on: title + cards show a static glow, no pulsing.
- Narrow the viewport to phone width: the heading shrinks, no overflow.
