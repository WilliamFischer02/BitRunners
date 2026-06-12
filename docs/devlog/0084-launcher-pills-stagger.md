# 0084 — launcher pills: stair-step, content-sized

Owner reported that 0082's 156×46 pills still felt oversized, with
the protocols pill especially showing visible empty space, and that
both pills extended too far into the center of the screen on
mobile. Asked for a tighter cluster with bigger vertical stagger and
a slight horizontal offset between the two — "one slightly left and
one slightly right for visual clarity" — instead of the near-row
layout 0082 shipped.

## What ships

Mobile (≤ 540 px) re-layout of `.profile` + `.protocols-launch` in
`apps/web/src/style.css` only:

### Pill geometry

| | 0082 | 0084 |
|---|---|---|
| Width | 156 px (fixed) | `auto`, min 96 / max 168 |
| Height | 46 px | 38 px |
| Border-radius | 22 px | 19 px |
| Cap font | 12 px | 11 px |
| Glyph font | 16 px | 14 px |
| Internal padding | 0 10 px | 0 12 px |

Going to `width: auto` (content-sized) drops `protocols`'s empty
inner space — the pill now hugs the 9-char label.

### Positioning

| | 0082 | 0084 |
|---|---|---|
| profile `right` | 154 px | 32 px |
| profile `top` | 144 px | 138 px |
| protocols `right` | 8 px | 8 px |
| protocols `top` | 152 px | 184 px |
| Y stagger | 8 px | 46 px (≈ one pill height) |
| Cluster footprint from right edge | 310 px | 128 px (worst case at max-width) |

The two pills no longer share a row. profile sits higher and nudged
in 24 px from protocols's right edge; protocols sits 46 px lower and
flush right. The pair reads as a stair-step.

### iPhone 15 Pro budget (393 px viewport)

- Cluster right-edge footprint: 128 px worst-case.
- Left clearance from the top-left HUD stack: 265 px.
- 0082 left only 83 px of clearance — 0084 nearly triples it.

## Verification

- `pnpm lint` ✓
- `pnpm typecheck` ✓ (8/8)
- `pnpm --filter @bitrunners/web build` ✓
- [ ] Owner: confirm on iPhone 15 Pro Firefox that the cluster no
      longer extends into the center.
- [ ] Owner: confirm the stair-step reads cleanly with `bit_spekter`
      + `protocols`.

No new dependencies. No schema change.
