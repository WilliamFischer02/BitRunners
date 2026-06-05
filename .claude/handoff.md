# Handoff — 2026-06-05, Phase 3.5 Sub-Phases A + B + C in draft

## What just shipped (this branch)

`claude/peaceful-thompson-AXsL9`, draft PR pending. Devlog: `docs/devlog/0061-phase3.5-subphase-c-badge-earn-loop.md`.

### Sub-Phase C — Badge earn loop

- **Migration `0009`**: `award_pending_badges()` internal helper + `admin_grant_samaritan()` admin RPC + Realtime publication for `earned_badges`. Owner must apply before the badge notification push will fire.
- **`badge-notifications.ts`**: Supabase Realtime monitor. Signs in → creates channel; signs out → tears it down. On badge INSERT: increments unacknowledged counter, dispatches `'bitrunners:badge-earned'`.
- **`BadgeToast.tsx`**: Right-side stacking toast. Shows badge glyph (faction-tinted), tier, faction, "badge unlocked" label. 4 s auto-dismiss. `prefers-reduced-motion` safe.
- **`profile.ts`**: Added `incrementUnacknowledged()` (counterpart to `decrementUnacknowledged()`).
- **`supabase.ts`**: Added `adminGrantSamaritan()` wrapper.
- **`AdminConsole.tsx`**: Added `SamaritanGrant` inside `UserEditor` — faction selector + amount + `[ samaritan ]` button. Shows new score + newly-awarded badge keys. Test path until missions/NPC interactions exist.
- **`style.css`**: Badge toast stack styles.

### Previously drafted (other open PRs)
- **PR #63** (`claude/peaceful-thompson-0RFkw`): Sub-Phase E — theme color shop + ASCII tint hot-swap. Pending owner's migration 0007 + 0008.
- **PR #61** (merged as `cc1d397`): Sub-Phases A + B — identity, badges, lore.

## Roadmap reference

Full plan: `/root/.claude/plans/nested-tickling-reddy.md`. Current status:

| Sub-phase | Topic | Status |
|-----------|-------|--------|
| A | Lore + schema reservations | **DONE (merged)** |
| B | Username overhead label + protocol bump | **DONE (merged)** |
| C | Badge earn loop (Samaritan-threshold trigger + UI) | **DONE — draft PR** |
| D | 8-slot emote wheel + emoticron submission + admin queue | next |
| E | Theme color shop + ASCII tint hot-swap | **DONE — draft PR #63** |
| F | Starmap HUD minimap (SAMM + Admin + Company NPC + checkpoint) | queued |
| G | Physical missions ("Recover an aether's last data" first) | queued |
| H | Hack QTE + 30s minigame lockout | queued |
| I | Free-text proximity DM with moderation stack | queued |
| J | Second minigame + Scrape skill-tree expansion | queued |

## Before merging this PR — required owner actions

1. **Apply migration `0007`** (Sub-Phase B prereq — badges, owned_themes, display_name RPCs).
2. **Apply migration `0009`** (this PR — `award_pending_badges`, `admin_grant_samaritan`, Realtime publication for `earned_badges`).
3. **Test the badge earn loop**: go to Admin Console → pick a user → expand editor → use `SamaritanGrant` to grant, e.g., `corp +10`. Expect: `score → 10 · new: corp:wood ✓`. Badge toast should appear in the target user's game session.
4. Note: Sub-Phase E (PR #63) also requires migration `0008` and shares the `0007` prereq.

## Verification done

- `pnpm lint` ✓
- `pnpm typecheck` ✓
- `pnpm build` ✓ (web gzip 248.92 kB, server 2.1 MB)
- Live badge earn / toast display — NOT verified headless; needs migrations + admin account.

## Constraints honored

- No new dependencies.
- No `main` push.
- No DepthTexture, no OutlinePass — badge toast is pure DOM/CSS.
- All privileged writes go through SECURITY DEFINER RPCs.
- `award_pending_badges` NOT granted to `authenticated` (internal helper only).
- Samaritan source-of-truth path (missions, NPCs) is deliberately NOT implemented yet — that's Sub-Phases F/G. Admin grant is the test path.

## What's next

**Sub-Phase D** — 8-slot emote wheel + emoticron submission + admin queue:
- Expand `EmoteWheel` from 4 to 8 slots (with earned/locked state).
- Emoticron submission UI: user proposes a 2-word combo from `emoticron_dictionary`; goes into admin review queue.
- Admin Console: new `EmoticonQueue` section to approve/reject submissions.
- Migration `0010`: `unlocked_emoticrons` table + `submit_emoticron` / `admin_approve_emoticron` / `admin_reject_emoticron` RPCs.

**Open questions / blockers (none blocking D)**
- Sub-Phases E (PR #63) and C (this PR) need owner to apply migrations before testing.
- The `PROTOCOL_VERSION = 2` bump (Sub-Phase B) requires a coordinated server + client deploy window — flag when merging.
