# 0071 — Responsive design tokens + label overflow fixes

Branch: `claude/responsive-tokens-and-overflow`.

## Live issue

Owner reports:
- Some menu text feels "super small and hard to read on desktop,
  still somewhat small on mobile."
- HUD launchers truncate their labels — `bit_spekt…` shows up on the
  profile tile because `.profile-class` had `max-width: 56px` with
  `text-overflow: ellipsis`.
- Carousel cartridge labels could clip too.

## What this lands

Foundational typography + spacing system. No layout overhauls in this
PR — just a `clamp()`-driven scale that grows comfortably on desktop
without crushing mobile.

### tokens added at `:root` (style.css)

```css
--ui-text-2xs: clamp(9px,   1.0vw, 10px);
--ui-text-xs:  clamp(10px,  1.3vw, 12px);
--ui-text-sm:  clamp(11px,  1.5vw, 13.5px);
--ui-text-md:  clamp(12.5px, 1.75vw, 15px);
--ui-text-lg:  clamp(14px,  2.0vw, 17px);
--ui-text-xl:  clamp(17px,  2.6vw, 22px);
--ui-text-2xl: clamp(20px,  3.2vw, 28px);

--ui-pad-xs: clamp(3px,  0.6vw, 5px);
--ui-pad-sm: clamp(5px,  1.0vw, 8px);
--ui-pad-md: clamp(8px,  1.4vw, 12px);
--ui-pad-lg: clamp(12px, 2.0vw, 18px);

--ui-tap-min: 44px;
```

### applied to (representative)

- HUD launchers (`.profile`, `.protocols-launch`) — tile size now
  `clamp(60px, 8.4vw, 78px)`, so the row grows comfortably on tablet
  + desktop without ballooning on phone. `.profile-class` drops the
  hard `max-width: 56px` so labels like `bit_spekter` fit at the new
  size. Inner glyph + caption use `--ui-text-xl` / `--ui-text-xs`.
- `.profile` `right` offset derived from the launcher width so the
  gutter between profile + protocols stays correct across breakpoints.
- Panel chrome — `.panel-title`, `.panel-section-title`, `.panel-row`,
  `.panel-key`, `.panel-val`, `.panel-stub`, `.panel-action`,
  `.panel-toggle`, `.panel-footer`, `.panel-close` all sized via tokens.
- Touch-target enforcement — `.panel-close`, `.panel-action`,
  `.panel-toggle`, `.protocols-close` carry `min-height:
  var(--ui-tap-min)` so tappable controls meet 44 px on phone.
- Carousel — `.cart-label` allows `word-break: break-word` so long
  cartridge titles wrap instead of getting clipped. `.cart-glyph`,
  `.cart-label`, `.cart-flavor`, `.cart-insert` rescaled.
- Objectives — `.objective-card-title`, `-state`, `-progress`,
  `-count`, `-flavor`, `.objective-pip` rescaled.
- Missions — `.mission-choice-label`, `.mission-choice-meta` rescaled.
- Carousel chrome — `.protocols-title`, `.protocols-sub`,
  `.protocols-close` rescaled.
- HUD hint badge `.hint` rescaled.

### overflow fixes

- Cartridge cards: `word-break: break-word` + `hyphens: auto` on
  `.cart-label`. Long names like `tether_hop` already fit, but longer
  user-facing titles in future cartridges won't get cut off.
- `.profile-class` no longer ellipsis-truncates at 56 px — uses the
  full tile width so `bit_spekter` reads in full.
- `.panel-val`: `word-break: break-word` so long emails / handle
  strings don't blow out the panel-row layout.
- `.panel-footer` and `.panel-stub` gained `line-height: 1.5` so the
  copy reads when it wraps.

## What's NOT in this PR

- The minimap legibility on phone is a follow-up (PR 85 in the plan).
- A full audit of every `font-size: 10px` / `9px` is deferred. The
  highest-traffic surfaces are tokenised; the rest are left as-is
  until a token feels off in practice.
- New persistent credits HUD — that's PR 78.

## Verification

- `pnpm typecheck` ✓
- `pnpm lint` ✓
- `pnpm --filter @bitrunners/web build` ✓
- Smoke: open the live preview at 360 px (phone) and 1440 px (desktop);
  panel headers, cartridges, and HUD launchers should read
  comfortably without manual zoom.

## No new dependencies. No schema change.
