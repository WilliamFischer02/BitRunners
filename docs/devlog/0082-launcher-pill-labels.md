# 0082 — launcher pills: full-name labels

Owner reported the round-2 mobile launcher fix (devlog 0079 + PR 86)
still truncated the labels: `bit_spekter` (class) showed as `ver_spea`
and `protocols` showed as `rotocol`. The 54×54 square tiles had ~30 px
of horizontal label budget after icon + padding, nowhere near enough
for 13-char class names.

## What ships

Mobile (≤ 540 px) re-layout of `.profile` + `.protocols-launch`:

- Square → **pill**. 156 × 46 px, border-radius 22 px.
- Internal flex flips column → row: icon on the left edge (16 px),
  label fills the remaining ~114 px.
- Label font-size stays at 12 px monospace, letter-spacing tightened
  from 0.04 em → 0.02 em. `terminal_runner` (15 chars, the longest
  current class) ≈ 108 px — fits inside the 114 px budget with 6 px
  headroom. Ellipsis kept as defense in depth.
- Inside corners overlap by 10 px (`.protocols-launch right:8 width:156`
  → left edge at 164 from right; `.profile right:154 width:156` → right
  edge at 154 from right, so 10 px crosses into the protocols pill).
  Vertical stagger of 8 px so the corners interlock instead of
  appearing as one squashed shape — owner's sketch "tag-stack" feel.
- Total horizontal footprint from right edge: 310 px. On iPhone 15 Pro
  (393 px) that leaves an 83 px clearance to the top-left HUD stack.
  Stays positive down to 320 px viewports.

Files: `apps/web/src/style.css` only — purely a CSS change inside the
existing media query.

## Verification

- `pnpm lint` ✓ (91 files)
- `pnpm typecheck` ✓ (8/8)
- `pnpm --filter @bitrunners/web build` ✓
- [ ] Owner: confirm on iPhone 15 Pro Firefox that
  `bit_spekter` shows in full, and `protocols` shows in full.
- [ ] Owner: confirm the overlapping corners read as intended (not as
  a stacking artifact).

No new dependencies. No schema change.
