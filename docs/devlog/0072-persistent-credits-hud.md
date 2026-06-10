# 0072 — Persistent credits HUD

Branch: `claude/persistent-credits-hud`.

## Live request

Owner: *"When in ANY menu I want to implement a persistent
container/miniature tooltip/display at the top of the page that shows
the users current owned credits and tokens — it was hard to keep track
of my money while inside certain menus."*

## What ships

- `apps/web/src/CreditsHud.tsx` — pill-shaped currency display anchored
  to the top-center of the canvas host. Lists credits, tokens, and (if
  the Tether Hop chatter field is on the build) chatter. Subscribes to
  `subscribeEconomy` so it updates instantly on any economy change.
  Auto-formats large numbers (`1.2k`, `3M`).
- `apps/web/src/App.tsx` — mounts `<CreditsHud />` next to the hint badge.
- `apps/web/src/style.css` — `.credits-hud` pill with the design tokens
  from PR 77 (clamp fonts, scaled padding). Sits at `z-index: 8` so
  dialogs / modals overlay it but it always renders above the world
  canvas. Narrow-phone tweak at ≤380 px tightens the pill.

## Defensive chatter read

The `EconomyState.chatter` field is added by Phase 3 (Tether Hop, PR
#72). Until that lands on `main`, the HUD reads chatter through a
type-narrowing helper that no-ops the third cell — so this PR ships
without depending on the Tether Hop merge order.

## Verification

- `pnpm typecheck` ✓
- `pnpm lint` ✓
- `pnpm --filter @bitrunners/web build` ✓

## No new dependencies. No schema change.
