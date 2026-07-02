# 0121 — Minigame + data-scrape leaderboards (mega-batch 2, owner-requested)

**⚠️ Owner action required: apply migration `0017_minigame_leaderboards.sql`**
(via your Supabase agent / SQL editor). Until then the client degrades
gracefully — boards show a friendly "leaderboards go live once enabled" empty
state and score submits are silent no-ops. No client redeploy is needed after
the migration lands.

## What

Leaderboards on every minigame, per the owner's live request:

- **End-of-run games** (`freq_lock`, `circuit_patch`, `core_run`) submit a
  score when a run ends and show a top-10 board **inline on the end screen**
  (the "automatic popup" — it's part of the win/done/fail overlay), with a
  "you · N" readout.
- **data_scrape** (no discrete end) gets a `[ leaderboards ]` button in the
  scrape panel that opens a tabbed modal ranking all registered accounts by
  **total passcodes** and by **credits**.

## Why a migration (authored, not applied by me)

Cross-account ranking can't ride the device-local economy blob — own-row RLS
forbids the client from reading other players' rows. So it needs SECURITY
DEFINER RPCs, i.e. a migration. The owner explicitly authorised authoring
migrations for this; I authored the file in-repo but did **not** apply it to
prod (that's the Supabase agent's job — consistent with the project's
owner-applies-migrations rule).

### `0017_minigame_leaderboards.sql`

- `minigame_scores(user_id, game_key, best_score, completions, updated_at)`,
  RLS: authenticated SELECT (public in-game); no direct writes.
- `submit_minigame_score(p_game, p_score)` — SECURITY DEFINER, validates the
  game key, **server-clamps** the score (freq_lock ≤ 6000, circuit_patch ≤ 300,
  core_run ≤ 100), monotonic upsert (`best_score = GREATEST(...)`,
  `completions += 1`). EXECUTE granted to authenticated only.
- `get_leaderboard(p_game, p_limit)` — top-N joined to approved
  `profiles.display_name`.
- `get_economy_leaderboard(p_metric, p_limit)` — top-N by a `player_economy`
  blob metric (`lifetimePasscodes` / `credits`), SECURITY DEFINER so it can
  read across rows. Approved names only.

## Score semantics (higher = better, so all sort by `best_score DESC`)

- `freq_lock` → raw points.
- `circuit_patch` → **seconds under a 300 s par** (faster solve → higher). A
  solve timer was added to the component for this.
- `core_run` → **seconds remaining** at the core (0–100).

## Client

- `leaderboard-api.ts` — thin RPC wrappers, all graceful (null / no-op on
  signed-out / unconfigured / RPC-missing). Named `-api` (not `leaderboard.ts`)
  to avoid a case-collision with `Leaderboard.tsx` on case-insensitive
  filesystems (the `Samm.tsx`/`samm.ts` class of bug — see handoff 2026-06-16).
- `Leaderboard.tsx` — `LeaderboardList` (inline end-screen board) +
  `LeaderboardModal` (tabbed data-scrape board).
- Wired into `FreqLock`, `CircuitPatch`, `CoreRun`, and `ScrapeMenu`.

## STOP-AND-ASK / tuning

- Score clamps + the circuit_patch "par" (300 s) are first-pass defaults —
  tune in `0017` + `CircuitPatch.tsx`.
- The board shows top-10 with approved display names; guests appear as their
  auto-assigned `runner_xxxxxx` name once signed in.

## Verify (owner)

1. Apply `0017`. 2. Sign in, play each minigame → the end screen shows the
board with your entry; play again to climb. 3. In data_scrape →
`[ leaderboards ]` → the passcodes / credits tabs rank accounts. Before the
migration is applied, every board shows the empty-state note (no errors).
