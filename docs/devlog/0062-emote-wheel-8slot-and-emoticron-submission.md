# 0062 — Sub-Phase D: 8-slot emote wheel + emoticron submission queue

**Branch:** `claude/peaceful-thompson-01b2W`. Draft PR.

## What this lands

Sub-Phase D of the Phase 3.5 roadmap: expands the emoticron wheel from 4 to 8
slots and adds the full 2-word combo submission → review → approve/reject flow.

## Changes

### `packages/shared/src/index.ts`

`EmoteId` expanded from 4 to 8 values:

| ID | Glyph | Position |
|----|-------|----------|
| `wave`  | `\o/` | NW |
| `happy` | `^_^` | N  |
| `think` | `(?)` | NE |
| `tired` | `zz`  | W  |
| *(inv)* | `▦`   | center |
| `okay`  | `[ok]`| E  |
| `good`  | `[+]` | SW |
| `help`  | `!?`  | S  |
| `bad`   | `[x]` | SE |

`EMOTE_GLYPHS` updated to match. `isValidEmote()` picks up all 8 values
automatically (derived from `EMOTE_GLYPHS` values set).

### `apps/web/src/EmoteWheel.tsx`

Rewrote with a `SLOTS` constant array and a 3×3 CSS grid layout. The inventory
button occupies the center grid cell (2/2). Four existing emotes stay at
cardinal positions (N/W/E/S); four new ones fill the diagonals (NW/NE/SW/SE).
No PROTOCOL_VERSION bump — the wire still sends the glyph text validated against
`EMOTE_GLYPHS`.

### `apps/web/src/style.css`

New section at the end of the file (non-destructive — overrides earlier absolute
positioning with a CSS grid):

- `.emote` becomes `display:grid; repeat(3, 1fr); gap:6px`. Container size
  stays 150px desktop / 126px mobile, so touch targets are unchanged.
- `.emote-btn` overridden to `position:relative; width:100%; height:100%`
  (was `position:absolute; 46px×46px`). Grid tracks handle sizing.
- New grid-area classes: `.emote-nw`, `.emote-n`, `.emote-ne`, `.emote-w`,
  `.emote-center`, `.emote-e`, `.emote-sw`, `.emote-s`, `.emote-se`.
- Old absolute-position classes (`.emote-up`, `.emote-left`, etc.) become dead
  rules; no elements use them now.
- Flicker animation extended to `nth-child(5)–(9)` with staggered offsets.
- New `.emotic-*` classes for the submission panel.

### `supabase/migrations/0010_emoticron_submissions.sql`

New table `emoticron_submissions` (one row per user, upserted):

| column | type | notes |
|--------|------|-------|
| `id` | UUID PK | gen_random_uuid |
| `user_id` | UUID FK → auth.users | CASCADE |
| `word1` / `word2` | TEXT | validated against dictionary |
| `status` | TEXT | pending / approved / rejected |
| `note` | TEXT | reviewer note surfaced on rejection |
| `submitted_at`, `reviewed_at` | TIMESTAMPTZ | audit trail |
| UNIQUE(user_id) | — | one active record per account |

RLS: users can read their own row; admins see all; no direct client writes.

Five SECURITY DEFINER RPCs:

| function | caller | purpose |
|---|---|---|
| `submit_emoticron(word1, word2)` | `authenticated` | upsert; validates both words in dictionary |
| `get_my_emoticron_submission()` | `authenticated` | read own status |
| `admin_list_pending_emoticrons()` | `authenticated` (is_admin guard) | queue for review |
| `admin_approve_emoticron(user_id)` | `authenticated` (is_admin guard) | mark approved |
| `admin_reject_emoticron(user_id, note)` | `authenticated` (is_admin guard) | mark rejected |

### `apps/web/src/supabase.ts`

New exports: `EmoticonStatus`, `MyEmoticonSubmission`, `PendingEmoticon`,
`submitEmoticon`, `fetchMyEmoticonSubmission`, `adminListPendingEmoticons`,
`adminApproveEmoticon`, `adminRejectEmoticon`.

### `apps/web/src/EmoticonSubmission.tsx` (new)

Player-facing submission panel. Loads the 100-word `emoticron_dictionary` into
two `<select>` dropdowns (word1 + word2). Shows combo preview. On submit calls
the RPC. Shows pending/approved/rejected status + rejection note. Guest users
see a sign-in CTA. No free-text input — words come from the dictionary selects.

### `apps/web/src/ScrapeMenu.tsx`

Added `'emoticons'` to `View` type. New `emote` tab in the nav. Title entry
and view render branch added.

### `apps/web/src/AdminConsole.tsx`

New `EmoticonQueue` component rendered after `UsernameQueue`. Loads pending
submissions, shows `word1 word2` + submitter email, approve `[ok]` / reject
`[no]` buttons. Reject prompts for a note (same pattern as `UsernameQueue`).

## Architecture notes

- **No PROTOCOL_VERSION bump.** The wire format (`sendEmote(text)`) is
  unchanged. New emotes are just more entries in `EMOTE_GLYPHS` — the server
  validates against the set of values, and the new glyphs are valid values.
- **Custom-emote equipping is deferred.** Approved combinations have no wire
  representation yet (the server validates against the static `EMOTE_GLYPHS`
  record). The `approved` state is stored and surfaced; the "equip to wheel"
  step is a future sub-phase once the server can validate per-user approved sets.
- **No free-text.** Both word pickers are `<select>` from the server-side
  `emoticron_dictionary` — the canon moderation rule is preserved.
- **`admin_approve_emoticron`** leaves the combo in the `emoticron_submissions`
  table; it does not write to the global glyph catalog (which would require a
  server redeploy). That promotion step is the future "equip" phase.

## Owner actions before merging

1. Apply migration `0007` (Sub-Phase B prerequisite — creates `emoticron_dictionary`).
2. Apply migration `0010` (this PR).
3. **Visual eyeball needed:** the 3×3 emote grid layout is correct by CSS
   inspection but not verifiable headless (no browser in this session).
4. No server change — Pages-only deploy, no Fly redeploy needed.

## Verification

- `pnpm lint` ✓ (64 files, no fixes)
- `pnpm typecheck` ✓ (8/8 packages)
- `pnpm build` ✓ (gzip 250 kB main bundle — +0 kB vs baseline)
- Layout + interactive verification needs a live browser.

## What's deferred (F…)

- Sub-Phase F: Starmap HUD minimap (SAMM + Admin + Company NPC + active checkpoint).
- Custom emote equipping to the wheel (needs server-side per-user approved set
  validation — deferred after the trading epic or a targeted server patch).
