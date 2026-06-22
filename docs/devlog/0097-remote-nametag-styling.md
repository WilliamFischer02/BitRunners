# 0097 — Nametag styling visible to other players (mega-batch 4.9)

**Date:** 2026-06-16
**Branch:** `claude/mega-batch-2026-06-16`
**Type:** P3 feature · **server change → Fly redeploy on merge**

## State found

`equipped_badge` is already on `PlayerState` and `applyTag` already renders
a remote runner's badge glyph next to their name (`onJoin` / `onIdentity`
pass `p.equippedBadge`). So **badges were already visible to other
players** — that half of the symptom was stale.

The genuinely local-only part was **name styling** (weight + tint from
`name-style.ts`): `applyLocalNameStyle` painted only the local tag and the
choice was never sent over the wire.

## Fix

Propagate name styling the same way display name / badge / theme already
propagate:

- **`@bitrunners/shared`** — `NAME_WEIGHTS`, `NAME_TINTS` +
  `isValidNameWeight` / `isValidNameTint` shape gates (the server can't
  import the web catalog).
- **Server** — `PlayerState` gains `nameWeight` / `nameTint` (appended, so
  the schema stays backward-compatible — no `PROTOCOL_VERSION` bump). The
  `identity` handler and `onJoin` accept + shape-validate them.
- **Client** — `network.ts` threads the two fields through
  `JoinOptions` / `RemotePlayer` / `IdentityUpdate` / snapshot / the
  per-field `listen()` so a remote's live style change re-fires
  `onIdentity`. `scene.ts` broadcasts the local style on change (account-
  only — guests don't transmit), sends it on join, and paints remote name
  spans via `remoteNameClass()` (reuses `nameStyleClass`; the global
  `.name--*` CSS already styles any tag).

## Verify (owner)

Two signed-in accounts in the same sphere: set a bold/tinted name on one →
the other sees the styled name + badge glyph (not just the local player).
Guests show a plain name.

## Files

- `packages/shared/src/index.ts`
- `apps/server/src/state.ts`, `sphere-room.ts`
- `apps/web/src/network.ts`, `scene.ts`
