# Handoff — 2026-06-03, Phase 3.5 sub-phases A + B (identity + reservations) IN DRAFT

## What just shipped (this branch)

`claude/bitrunners-collaboration-EcqBv`, draft PR pending. Devlog: `docs/devlog/0060-phase3.5-identity-and-reservations.md`.

### Sub-Phase A — lore + schema
- **7 new lore docs (010–016)**: badges, missions, hack-QTE, themes, dictionary, chat policy reversal, Company NPC.
- **Migration `0007_phase3_5_reservations.sql`**: reserves every column needed through Sub-Phase I (badges, themes, mission progress, DMs, hack-QTE) + 8 new SECURITY DEFINER RPCs. **Owner must apply before any deploy.**
- **CLAUDE.md** moderation paragraph amended — free-text DM is now permitted, cross-linked to `docs/lore/015`.

### Sub-Phase B — username + protocol bump
- **`PROTOCOL_VERSION → 2`** (single bump for the whole roadmap).
- **`PlayerState`** gains `displayName`, `equippedBadge`, `equippedTheme`.
- **Identity message** + `sendIdentity()` plumbed end-to-end.
- **Local floating tag** reads from `profile.ts`. Tap → opens `UsernameEditor`. Badge glyph + `!` dot on label.
- **Remote tags**: every other runner's name + badge floats above their head. NPCs labelled by archetype.
- **UsernameEditor**: curated 1–2 word composer (from `emoticron_dictionary`, `category='name'`), badge ladders (Corp / BR), equip/unequip, guest gate.
- **AdminConsole.UsernameQueue**: pending-name approval UI.

## Roadmap reference

Full plan: `/root/.claude/plans/nested-tickling-reddy.md`. Sequence:

```
A (DONE) → B (DONE) → (C ∥ D ∥ E ∥ F) → G → H → I → J
```

| Sub-phase | Topic | Status |
|-----------|-------|--------|
| A | Lore + schema reservations | **DONE** |
| B | Username overhead label + protocol bump | **DONE** |
| C | Badge earn loop (Samaritan-threshold trigger + UI integration) | next |
| D | 8-slot emote wheel + emoticron submission + admin queue | next |
| E | Theme color shop + ASCII tint hot-swap | next |
| F | Starmap HUD minimap (SAMM + Admin + Company NPC + active checkpoint) | next |
| G | Physical missions ("Recover an aether's last data" first) | queued |
| H | Hack QTE + 30s minigame lockout | queued |
| I | Free-text proximity DM with moderation stack | queued |
| J | Second minigame + Scrape skill-tree expansion | queued |

## Before merging this PR — required owner actions

1. **Review lore drafts 010–016.** Anything marked "owner: review" is best-guess; rewrite freely.
2. **Apply migration `0007` in Supabase SQL editor.** Without it the client RPCs error out and the UI lands in a permanent "loading…" / "could not load" state for the new surfaces.
3. **Decide on a deploy window** for the `PROTOCOL_VERSION` bump. Server + client should ship together; old clients soft-warn but still connect.

## Verification done

- `pnpm lint` ✓
- `pnpm typecheck` ✓
- `pnpm --filter @bitrunners/web build` ✓ (gzip 248 kB main bundle)
- `pnpm --filter @bitrunners/server build` ✓
- Two-browser test + iOS Safari pass — **not yet done**; needs the live preview deploy (gated on owner action above).

## Constraints honored

- No `DepthTexture`, no `OutlinePass`, no MRT — mobile-safe rendering preserved (badge glyphs and `!` dot are pure DOM, no shader work).
- All sensitive writes via SECURITY DEFINER RPCs; column-grant lockdown extends 0006.
- No new dependencies introduced.
- No `main` push.
- Schema reservations cover Sub-Phases C–I so no further `PROTOCOL_VERSION` bumps are planned in this roadmap.

## What WAS NOT done (deliberate scope cut)

- Badge auto-award on Samaritan threshold — moved to Sub-Phase C. Today badges only appear in `earned_badges` via direct DB insert; the equip path works as soon as a row exists.
- The dictionary table is owner-editable from the admin console — Sub-Phase D scope.
- The username `!` micro-dot reads `unacknowledged > 0` globally, not per-badge — refinement deferred.
- Theme application — Sub-Phase E.
- No HUD minimap, no missions, no QTE, no DM yet — sub-phases F→I.

## Prior context (Phase 5, tap-to-lock + glow)

PR #60 merged to `main` (commit `ff529cf`). The lock/glow surfaces are live; we tap-locked in Sub-Phase B to derive the per-remote-avatar tag positions (no `pickSelf` was needed yet — the local tag has its own DOM click handler because it's a `<button>`).
