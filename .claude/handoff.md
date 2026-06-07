# Handoff — 2026-06-07, Sub-Phase D (emote wheel + emoticron submission) IN DRAFT

## What just shipped (this branch)

`claude/peaceful-thompson-01b2W`, draft PR pending. Devlog: `docs/devlog/0062-emote-wheel-8slot-and-emoticron-submission.md`.

### Sub-Phase D — 8-slot emote wheel + emoticron submission + admin queue

- **`packages/shared/src/index.ts`** — `EmoteId` expanded 4→8 (`wave`, `think`, `good`, `bad` added). `EMOTE_GLYPHS` updated. No protocol change.
- **`apps/web/src/EmoteWheel.tsx`** — Rewritten: `SLOTS` constant array, 3×3 CSS grid layout (NW/N/NE/W/center/E/SW/S/SE), center = inventory button.
- **`supabase/migrations/0010_emoticron_submissions.sql`** — `emoticron_submissions` table + 5 SECURITY DEFINER RPCs (`submit_emoticron`, `get_my_emoticron_submission`, `admin_list_pending_emoticrons`, `admin_approve_emoticron`, `admin_reject_emoticron`).
- **`apps/web/src/supabase.ts`** — 6 new exports: emoticron status types + API wrappers.
- **`apps/web/src/EmoticonSubmission.tsx`** — New component: word1+word2 selectors from dictionary, preview, submit, pending/approved/rejected status display. No free-text.
- **`apps/web/src/ScrapeMenu.tsx`** — `'emoticons'` view added (6th tab `emote`).
- **`apps/web/src/AdminConsole.tsx`** — `EmoticonQueue` panel added after `UsernameQueue`.
- **`apps/web/src/style.css`** — CSS grid override for `.emote` (3×3, `1fr` tracks, same container size), flicker animation extended to 9 children, `.emotic-*` classes for submission panel.

### Sub-Phase E (merged from previous branch)
Theme color shop + ASCII tint hot-swap. Already in `main` as of PR #63.

## Roadmap reference

Full plan: `/root/.claude/plans/nested-tickling-reddy.md`. Sequence:

```
A (DONE) → B (DONE) → (C ∥ D ∥ E ∥ F) → G → H → I → J
```

| Sub-phase | Topic | Status |
|-----------|-------|--------|
| A | Lore + schema reservations | **DONE** |
| B | Username overhead label + protocol bump | **DONE** |
| C | Badge earn loop (Samaritan-threshold trigger + UI integration) | in PR #64 (not merged) |
| D | 8-slot emote wheel + emoticron submission + admin queue | **DONE** (this branch) |
| E | Theme color shop + ASCII tint hot-swap | **DONE** |
| F | Starmap HUD minimap (SAMM + Admin + Company NPC + active checkpoint) | **next** |
| G | Physical missions ("Recover an aether's last data" first) | queued |
| H | Hack QTE + 30s minigame lockout | queued |
| I | Free-text proximity DM with moderation stack | queued |
| J | Second minigame + Scrape skill-tree expansion | queued |

## Before merging this PR — required owner actions

1. **Apply migration `0007`** (Sub-Phase B prerequisite — adds `emoticron_dictionary`, `owned_themes`, `profiles.equipped_theme`, badge tables).
2. **Apply migration `0010`** (`emoticron_submissions` table + RPCs).
3. **Visual check:** 3×3 emote wheel layout, emote tab in ScrapeMenu, emoticron queue in AdminConsole.
4. No server change — Pages-only deploy, no Fly redeploy.

## Prior constraint: migrations 0007–0009 not yet applied

Sub-Phase B (PR #61) merged but migrations 0007–0009 haven't been applied yet.
- 0007: identity/badge/theme/emoticron_dictionary tables
- 0008: theme RPCs
- 0009: badge RPCs (from PR #64)
- 0010: emoticron submission RPCs (this PR)

Until applied, the word-picker will show empty dropdowns and submit calls will
error silently (Supabase returns an error → auth-not-configured path). Client
handles gracefully.

## Custom emote equipping — deferred

Approved combinations are stored (`status='approved'`) but cannot yet be sent
over the wire, because the server validates against the static `EMOTE_GLYPHS`
record in `@bitrunners/shared`. To equip a custom emote to the wheel, the
server would need to validate per-user approved sets. Options when the time
comes:

1. **Server PR**: extend `isValidEmote()` to also check a Supabase RPC at runtime
   (one extra DB call on the emote message).
2. **Schema promotion**: when admin approves, also add the glyph to a
   `canonical_emotes` table; server hydrates on startup.
3. **8th static slot**: expand `EMOTE_GLYPHS` with the combo text, but this
   violates the "no free-text emotes" rule globally.

Option 1 is cleanest and a small server-only change. Flag for a future session.

## Verification done

- `pnpm lint` ✓
- `pnpm typecheck` ✓ (8/8 packages)
- `pnpm build` ✓ (gzip 250 kB main bundle — +0 kB vs baseline)
- Browser / 3×3 layout + interactivity — NOT YET DONE (headless only).

## Next suggested sub-phase

**Sub-Phase F: Starmap HUD minimap** — shows the player's position relative
to SAMM, the Admin monolith, Company terminal, and the active checkpoint.
Buildable without infra. Client-only change (scene.ts + new React component).
No server change needed.

## What was NOT done (deliberate scope cut)

- Custom emote equipping to the wheel (needs server extension — see above).
- Sub-Phase F (Starmap HUD minimap).
- Sub-Phases G–J.
