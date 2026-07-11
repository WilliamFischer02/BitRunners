# Handoff — 2026-07-11, Performance pass (baseline → P0–P3 → guardrails)

Fully-autonomous perf pass on **`claude/perf-pass-2026-07-11`** (branched off
`main` @ `f8d1f77`). Six atomic commits, one per tier, each with a devlog
(0137–0142). Gates green on every commit: biome (targeted) · typecheck 8/8 ·
test 46/46 · build 5/5. **No new dependencies. No migrations. No server
behavior changes** (`apps/server` untouched — the one server read was to
verify the idle-sweep before the move dirty-check). `gh` unauthed → no PR
opened (same precedent as prior batches); compare URL:
`https://github.com/WilliamFischer02/BitRunners/compare/main...claude/perf-pass-2026-07-11`

| Tier | Commit | Devlog | What |
|---|---|---|---|
| Baseline + `?perf=1` HUD | `8a24421` | 0137 | chunk-size record; zero-dep fps/heap/counter overlay (`perf.ts`) |
| P0 economy event storm | `a858af1` | 0138 | microtask-coalesced economy dispatch+persist; ScrapeMenu batching; ProfileIcon rain off React |
| P1 load path + bundle | `ae376bf` | 0139 | `Game.tsx` lazy split + prefetch; vendor manualChunks (function form!); lazy AdminConsole/AuthCallback; idle economy-sync; lazy+cached dialogue; board.css split |
| P2 render loop | `7281956` | 0140 | FreqLock imperative blip layer (no 60fps setState); scene tick: cached host size, hoisted allocs, style-write skip, pooled minimap emits |
| P3 network + auth | `0ff5578` | 0141 | ONE shared subscribeAuth; uid-guarded loads/refetches; skip-identical saves + pending-only flush + 15s max-wait; coalesced colyseus listeners; sendMove dirty-check w/ 10s keepalive |
| Guardrails | (this commit) | 0142 | `check-bundle.mjs` budget gate (+ pkg script); `docs/PERFORMANCE.md`; decisions.md pattern lock |

## Before → after (headline numbers)

| metric | before | after |
|---|---|---|
| boot path (title screen, JS+CSS gzip) | ~308 kB | ~76 kB (−75%; game streams in behind title) |
| entry chunk | 289 kB gzip | ~12 kB gzip |
| economy events per scrape burst | 1 dispatch + 1 localStorage write per unit | 1 per microtask batch |
| FreqLock React renders during a song | ~60/s × 60 s | event-driven only (taps/misses) |
| scene tick layout reads / allocations | ~240 clientWidth reads/s; per-tick allocs | 0 / 0 (cached + hoisted + pooled) |
| GoTrue subscriptions / logSignIn per sign-in | ~16 / ~16 dup session_events rows | 1 / 1 |
| economy saves of unchanged state | every flush + every tab-hide | 0 (blob-key skip; ≤15 s dirty window) |
| onUpdate per movement patch | up to 3 | 1 |
| outbound moves while stationary | 15/s | 1 per 10 s keepalive |

## Owner actions

1. **Open the PR** (compare URL above) and merge when happy — all client-side,
   Pages-only deploy.
2. **Optional CI wiring** (needs your explicit OK per the workflow rule): add
   `pnpm --filter @bitrunners/web check-bundle` after the web build step in the
   Pages workflow so the bundle budget gates deploys.
3. **Visual sanity pass** with `?perf=1`: title → class-select (no fetch stall
   — Game prefetches during title), freq_lock feel (blips identical, now
   imperative), remote name tags still track, AFK tab stays connected >2 min
   (keepalive vs the 120 s idle sweep).

## Notes / cautions for next session

- **Do not make the client fully silent** — server idle sweep is
  message-driven (details in decisions.md 2026-07-11 + PERFORMANCE.md).
- **manualChunks must stay function-form** (object form drags colyseus onto
  boot via rollup's CJS helper — devlog 0139).
- Local build sizes exclude the supabase entry import (`VITE_SUPABASE_*` unset
  locally → tree-shaken); CI/prod entry will be slightly larger. Budgets have
  10× headroom.
- `profile.ts` still refreshes identity per auth event — deliberate (see 0141
  behavior notes), don't "fix" without checking rep-chip freshness.
- Deferred (flagged, not built): shared-auth-driven refactor of TitleScreen's
  own supabase usage; ScrapeMenu stays in the Game chunk (hot always-mounted).

---

# Handoff — 2026-07-02, Round-2 owner fixes (8 items) on top of mega-batch 2

Same branch (`claude/mega-batch-2026-07-01`). 5 more atomic commits addressing
a fresh list of owner fixes; devlogs 0123–0127. Gates green: typecheck 8/8,
build 5/5, **test 46/46**. Two isolated items were delegated to `fable`
subagents (admin skip, circuit 10-levels); everything else done directly
(heavy `scene.ts` / `economy.ts` / `style.css` coupling made parallel editors
unsafe). `gh` still unauthed → no PRs opened; same compare URL as below.

| Fix | Commit | Devlog |
|---|---|---|
| Guest→account carryover on signup (merge on broad progressScore, not just lifetimeScrapes — fixes minigame-only guests being wiped) | `d54c5b2` | 0123 |
| Admin dialogue skip button (fable) | `f290414` | 0124 |
| Scraper tree overhaul: dedup auto-scrape → 4-tier autotap, Supercomputer, Corporate Greed glow, bots on/off, aura-scaled prestige | `db1cca4` | 0125 |
| circuit_patch 10 escalating levels + per-player progress + stopwatch (fable) | `260cb7e` | 0126 |
| Maze wider alleys + visible closing storm + countdown; landmark beacons + player-feet arrow + glitch-switch visibility; minimap colors/size/vault-label/fullscreen-joystick; freq_lock 3-corner tesseract + waveform blips | `3e5a850` | 0127 |
| Feet-arrow aim (was pointing back at the player) + fullscreen minimap square (was stretched) | `03b7692` | 0128 |

**⚠️ `main` has advanced:** the owner merged mega-batch 2 via **PR #122**, so
`main` now holds the round-1 work. All round-2 fixes (devlogs 0123–0128) sit on
`claude/mega-batch-2026-07-01` on top of that — open a **fresh PR** from the
branch for round-2 (GitHub shows only the new commits). The env was briefly on
`main`; switched back to the branch to continue — nothing lost.

**Owner actions (unchanged + note):** still open the PR (compare URL below);
still apply migration `0017_minigame_leaderboards.sql` (leaderboards). Round-2
added **no new migrations** and **no new server changes** (all client + additive
economy-blob fields: `prestigeBuff`, `circuitLevel`, and the `autotap`/
`supercomputer`/`greed` upgrade keys). The earlier mega-batch-2 Fly redeploys
(map doubling `packages/shared`, NPCs `apps/server`) still apply when merged.

**STOP-AND-ASK defaults shipped (tune freely):** auto-tap intervals + node
costs; Supercomputer 2000 pc; prestige buff curve `sqrt(lifetimeAuras)*0.28`
(uses *accrued* auras); maze cell 1.8 / storm colour; freq_lock lane geometry +
waveform envelope; minimap MAP_RANGE 26. Corporate Greed is cosmetic-only
(5,000,000-pc flex, no gameplay effect) per the request.

---

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
