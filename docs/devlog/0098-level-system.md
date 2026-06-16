# 0098 — Level system (badges → level) (mega-batch 4.10)

**Date:** 2026-06-16
**Branch:** `claude/mega-batch-2026-06-16`
**Type:** P3 feature · **server change → Fly redeploy on merge**

## Formula (STOP-AND-ASK default)

`level = number of owned badges`, capped at **20**. 1 badge → `Lv 1`,
20+ badges → `Lv 20`, 0 badges → no chip. Implemented as a single pure
function (`levelFromBadgeCount` / shared `clampLevel`) so a future curve is
a one-line swap — flagged here as the owner's call to revisit.

## Implementation

- **`level.ts` (new, client)** — tracks the local runner's level from the
  earned-badges count: reads `fetchMyBadges().length` on sign-in and re-reads
  on `BADGE_EARNED_EVENT` (the existing realtime monitor). `getLevel` /
  `subscribeLevel`. Started from `App.tsx`.
- **`@bitrunners/shared`** — `LEVEL_CAP = 20` + `clampLevel()` so client and
  server cap identically.
- **Server** — `PlayerState.level` (appended number field; no protocol
  bump). The `identity` handler + `onJoin` accept `level` and `clampLevel`
  it (defends against a tampered client claiming Lv 9999).
- **Client wire** — `network.ts` threads `level` through
  `JoinOptions` / `RemotePlayer` / `IdentityUpdate` / snapshot / `listen`
  (join opts map now allows numbers).
- **`scene.ts`** — a `Lv N` chip rendered after the badge glyph on **every**
  player's nametag (local + remote), gold-tinted. The local level is sent on
  join and re-sent whenever it changes; remotes render the wired value.

## Verify (owner)

Earn a badge (e.g. complete a mission to cross a Samaritan tier) → your
nametag shows `Lv 1` after the badge glyph, and other players in the sphere
see it too. Level 0 shows no chip.

## Files

- `apps/web/src/level.ts` (new)
- `apps/web/src/App.tsx`, `scene.ts`, `network.ts`
- `apps/server/src/state.ts`, `sphere-room.ts`
- `packages/shared/src/index.ts`
- `apps/web/src/style.css`
