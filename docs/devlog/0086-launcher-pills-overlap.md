# 0086 — launcher pills: 80 % scale + overlap (round 4)

## What happened

PR #91 (devlog 0084) merged at commit 38cfb00 with the original stair-
step at `protocols.top: 184`, which leaves an 8 px **gap** between
profile bottom (138 + 38 = 176) and protocols top (184). The two
round-3 follow-ups I pushed to the branch after merge — round 2 at
top:164 (12 px overlap) and round 3 at top:150 (26 px overlap) — never
made it onto main. Owner only saw the gap version on `bitrunners.app`.

## What ships

Mobile (≤ 540 px) re-layout of `.profile` + `.protocols-launch`:

### Scale-down ~80 %

| | live (0084) | 0086 |
|---|---|---|
| Height | 38 px | 30 px |
| Min-width | 96 px | 80 px |
| Max-width | 168 px | 136 px |
| Cap font | 11 px | 9 px |
| Glyph font | 14 px | 11 px |
| Border-radius | 19 px | 15 px |
| Internal padding | 0 12 px | 0 10 px |
| Flex gap | 6 px | 5 px |

### Real overlap

| | live (0084) | 0086 |
|---|---|---|
| profile `right` / `top` | 32 / 138 | 28 / 138 |
| protocols `right` / `top` | 8 / 184 | 8 / 148 |
| Vertical relationship | 8 px gap | **20 px overlap** |
| Horizontal offset | 24 px | 20 px |

profile spans y 138–168; protocols spans y 148–178. They share the
band 148–168 (20 px ≈ 67 % of the new pill height). Both pills are
still partially visible — profile shows its top 10 px clean,
protocols shows its bottom 10 px clean, the middle 20 px is the
overlap.

### Tap-target note

30 px is below Apple's 44 pt HIG floor for tap targets. Trusting the
owner's "scale ~80 %" call here; if tap reliability suffers we can
add a transparent halo via `padding` outside the visible pill.

## Verification

- `pnpm --filter @bitrunners/web build` ✓
- [ ] Owner: confirm on iPhone 15 Pro Firefox that the two pills
      visibly overlap now.

`apps/web/src/style.css` only. No new deps. No schema change.
