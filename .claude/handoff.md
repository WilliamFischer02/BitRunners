# Handoff — 2026-07-01, Autonomous mega-batch 2 (6 brief tasks + 2 owner-added)

## What this session was

Fully-autonomous run against `launch-prompt.md` mega-batch 2 (tasks 4.1–4.6),
plus **two features the owner added mid-session** (leaderboards + two named
NPCs) and told me to complete. All work is on **`claude/mega-batch-2026-07-01`**
(committed, not pushed by me). Nine clean atomic commits, one per task
(4.6 is two commits), each with its own devlog (0114–0122).

### ⚠️ PRs were NOT auto-opened — `gh` is not authenticated

Same as the 2026-06-16 batch: this environment has no `gh` auth and no token to
supply. So I could not open draft PRs. To review, open one PR for the whole
batch:
`https://github.com/WilliamFischer02/BitRunners/compare/main...claude/mega-batch-2026-07-01`
(or cherry-pick per task — each task = one commit, SHAs below).

All gates green at session end: `pnpm typecheck` (8/8), `pnpm build` (5/5),
`pnpm test` (**34/34** — baseline was 12; +16 circuit-core, +6 maze-core).
Biome is clean on every file this batch authored (verified per-file). The
repo-wide `biome check .` reports ~70 "formatter" errors, but they are the
known Windows autocrlf line-ending artifact on files this batch never touched
(`package.json`, `dist/*.js`, pre-existing docs, etc.) — git stores LF and CI
runs on LF. Same behaviour documented in the 2026-06-16 handoff.

## Per-task status

| # | Task | Commit | Notes |
|---|---|---|---|
| 4.1 | Launcher pill → "Menu" | `bcb59de` | devlog 0114. `ProfileIcon.tsx` only; class still in panel + `.hint`. |
| 4.2 | Character Select heading + glowing cards | `1894187` | devlog 0115. Purple `#b07cff` heading; locked cards get a dim pulse; reduced-motion static. |
| 4.3 | Account-needed nudge | `6e3761c` | devlog 0116. `account-nudge.ts` + `AccountNudge.tsx`; triggers: minigame credits / shop / mission / emote (badge inert — account-only). |
| 4.4 | `circuit_patch` minigame | `c84ce98` | devlog 0117. Pure `circuit-core.ts` + 16 vitest; lazy `CircuitPatch.tsx`. Reward 100/20 via additive `circuitFirstClear`. |
| 4.5 | `core_run` shrinking maze | `0427b2a` | devlog 0118. Pure `maze-core.ts` + 6 vitest; `maze-scene.ts` arena; scene "maze mode" behind `mazeActive`; lazy `CoreRun.tsx`. |
| 4.6a | Double map (PLATFORM_HALF 19→38) | `8857f43` | devlog 0119. **Server redeploy on merge.** Starmap imports shared const; +8 obstacles; skybox 45→90. |
| 4.6b | Glitch switch + pressure-plate vault → void | `369bc9a` | devlog 0120. Client-only; void reuses maze-mode scaffolding behind `voidActive`. |
| (a) | Minigame + data-scrape leaderboards | `9be91a2` | devlog 0121. **Owner-added.** Authored migration `0017` (NOT applied). `leaderboard-api.ts` + `Leaderboard.tsx`; wired into all 3 minigames + a scrape-panel button. |
| (b) | NPCs 4V4 + JJJJ | `61446ca` | devlog 0122 + lore 017. **Owner-added. Server redeploy on merge.** Tether replies (JJJJ alternates). |

## Owner actions required

1. **Open the PR** from the compare URL above (`gh` wasn't authed).
2. **Apply migration `0017_minigame_leaderboards.sql`** via your Supabase agent
   / SQL editor (see "## proposed migrations" below). Until then leaderboards
   show a friendly empty state (client degrades gracefully — no errors).
3. **Server redeploys (Fly)** — **4.6a (map doubling)** and **(b) NPCs** touch
   `apps/server` / `packages/shared`. Merging triggers a Fly redeploy (owner-
   gated). Web+server deploy together from `main`; **no `PROTOCOL_VERSION`
   bump** (wire shape unchanged — positions are plain floats), so old/new
   interop during the deploy window is the usual coordinated-deploy case.
4. **Verify visually** — anything 3D/CSS/mobile is owner-side (no browser
   automation dep). Each devlog lists concrete manual verify steps. Especially:
   the doubled world seam wrap; the maze dissolve + fail; the vault→void door;
   the glitch burst; NPC tether replies.

## proposed migrations

**`supabase/migrations/0017_minigame_leaderboards.sql` — AUTHORED IN-REPO this
session, NOT applied to prod.** The owner explicitly authorised authoring
migrations for the leaderboard feature; I wrote the file but left applying it to
the owner's Supabase agent (consistent with the owner-applies-migrations rule).
Contents: `minigame_scores` table (RLS: authenticated SELECT, no direct writes)
+ `submit_minigame_score` (SECURITY DEFINER, server-clamped monotonic upsert) +
`get_leaderboard` + `get_economy_leaderboard` (ranks `player_economy` blobs by
`lifetimePasscodes` / `credits`). Follows the 0013/0014 EXECUTE-lockdown
pattern. Idempotent-ish (`CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE`).
**No other migrations needed** — every reward/flag in the brief rides the
additive `player_economy.blob` pattern (only new blob field: `circuitFirstClear`).

## STOP-AND-ASK items (defaults shipped — flag to change)

- **4.4 circuit reward** — 100 first / 20 repeat (constants in `CircuitPatch.tsx`).
- **4.5 maze difficulty band** — `[30,70]` room-edges (NOT the brief's `[55,85]`,
  which assumed a different metric — see `decisions.md` 2026-07-01). Reward
  40 + 1/sec, cap 100. Tune in `maze-core.ts` / `CoreRun.tsx`.
- **4.6 landmark flavour/lore** — deliberately neutral (no invented canon). Owner
  to name/dress the glitch switch's effect + what the void *is*; I'll wire copy
  through `dialogue.ts` once specified.
- **(a) leaderboard score semantics + clamps** — freq_lock points / circuit_patch
  seconds-under-300s-par / core_run seconds-left; clamps in `0017`. Tune together.
- **(b) 4V4 / JJJJ role** — ambient tether flavour only; open follow-ups in lore 017.

## Known gaps / notes for next session

- **Multiplayer while in maze / void**: the avatar is parked in the shared world
  (outbound moves frozen) — intentional v1 default; documented in 0118/0120.
- **Case-collision caution** (bit me again): `leaderboard.ts` + `Leaderboard.tsx`
  differ only by case → broke `tsc` on Windows. Renamed the module to
  `leaderboard-api.ts`. Do NOT create two `src` files differing only in case
  (same class as the old `Samm.tsx`/`samm.ts` bug).
- **`noUncheckedIndexedAccess` is on** — all the new 2D-grid code (circuit/maze)
  uses safe accessors (`cellAt`/`setCell`, `at()`, tuple direction tables). New
  array-indexing code must do the same.
- **Full Colyseus integration tests** for the NPC tether replies would need
  `@colyseus/testing` (a new dep) — covered by inspection + the documented
  manual repro instead.
