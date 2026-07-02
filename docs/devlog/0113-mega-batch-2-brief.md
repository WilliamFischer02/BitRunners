# 0113 — Mega-batch 2: goals list + autonomous launch brief

## TL;DR

- Six owner-requested features added to the active goals list and
  written into `launch-prompt.md` (the file `start-claude-auto.ps1`
  feeds to the autonomous session) as mega-batch 2.
- **No Supabase migrations required for this batch.** All rewards and
  unlocks ride the existing `player_economy.blob` additive-field
  pattern, now hardened by migration 0016's server-side clobber guard.
- One OPTIONAL migration is sketched below for the owner's dedicated
  Supabase agent, if/when leaderboards are wanted. The batch does not
  depend on it.

## The batch (priority order as written in launch-prompt.md)

| # | Feature | Size | Notes |
| --- | --- | --- | --- |
| 4.1 | Launcher pill relabelled `Menu` (was the class name) | XS | `ProfileIcon.tsx` |
| 4.2 | "Character Select" heading + animated glow on class cards | S | `Boot.tsx`, accent colour, reduced-motion fallback |
| 4.3 | Account-needed nudge modal for guests | M | fires once/session per trigger; routes to existing account panel |
| 4.4 | `// circuit_patch` minigame — route POWER (thick) + DATA (thin) across a 4×4 board with straight / elbow / cross-bridge pieces; both paths must complete simultaneously | L | one designed level v1; solvability unit-tested; lazy chunk |
| 4.5 | `// core_run` minigame — procedural 21×21 maze to the center, 90 s timer, outer rings dissolve into raw-data glyphs every 8 s after the first 30 s | L | difficulty-normalized generation (BFS path-length band), unit-tested |
| 4.6 | Double the platform (PLATFORM_HALF 19 → 38) + glitch-switch wall + pressure-plate vault → void room with free-standing exit door | XL | touches `packages/shared` + server → **Fly redeploy on merge** |

Full acceptance criteria live in `launch-prompt.md` — that file is the
canonical task spec for the batch.

## Persistence / migrations position

Decision (consistent with `.claude/decisions.md` 2026-06-16, emote
loadout): minigame progress fields (`circuitFirstClear`, any maze best
time, nudge-shown flags if persisted at all) are **additive, defaulted
fields on the economy blob**. Old blobs normalize clean; migration 0016's
`lifetimeScrapes`-keyed merge + server guard applies unchanged.

### Optional (NOT built in this batch): `minigame_scores` leaderboard

If the owner later wants cross-player leaderboards for freq_lock /
circuit_patch / core_run, the Supabase agent should author:

- **Table `minigame_scores`**: `user_id UUID references auth.users`,
  `game_key TEXT` (allowlist: `freq_lock`, `circuit_patch`, `core_run`),
  `best_score INT`, `completions INT`, `updated_at TIMESTAMPTZ`.
  Primary key `(user_id, game_key)`.
- **RLS**: SELECT open to `authenticated` (leaderboards are public
  in-game), INSERT/UPDATE own-row only — or better, no direct writes at
  all.
- **RPC `submit_minigame_score(p_game TEXT, p_score INT)`**:
  `SECURITY DEFINER`, validates the game key against the allowlist,
  clamps score to a per-game server-side max (freq_lock ≤ 6000,
  circuit_patch ≤ 1, core_run ≤ 100 — tune to actual scoring),
  monotonic upsert (`best_score = GREATEST(...)`,
  `completions = completions + 1`). Grant EXECUTE to `authenticated`
  only; revoke from `anon` + PUBLIC per the migration-0013/0014
  lockdown pattern.
- **RPC `get_leaderboard(p_game TEXT, p_limit INT DEFAULT 10)`**:
  top-N by `best_score` joined to `profiles.display_name` (approved
  names only).

## Launcher change

`start-claude-auto.ps1` now sets `MAX_THINKING_TOKENS` before invoking
Claude Code so the autonomous session runs with maximum extended-
thinking budget, and the prompt opens with the `ultrathink` keyword.
Bypass-permissions mode was already in place.
