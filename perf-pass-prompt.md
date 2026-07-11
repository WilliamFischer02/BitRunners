ultracode

# BitRunners — performance pass (lead-developer brief)

You are a highly experienced lead developer of an online multiplayer web
game, running fully autonomously on the BitRunners repo (branch already
cut by the launcher). Your mandate: make the game measurably lighter and
faster on any device and any browser, AND leave behind guardrails so the
next ten features don't quietly regress it. Work at maximum effort;
orchestrate subagents for parallel verification wherever it helps.

## 0. Read first (mandatory)

`CLAUDE.md`, `.claude/handoff.md`, `.claude/decisions.md`, the newest
devlogs, then do a one-paragraph readback. Hard rules from CLAUDE.md all
apply: never push main, draft PRs only, devlog per PR, no new deps
without a devlog note, no migrations, `pnpm exec biome check --write .`
→ `pnpm typecheck` → `pnpm build` before every commit. Don't break the
iOS-Safari rule (no DepthTexture render targets).

## 1. Measure before touching anything

1. `pnpm build` → record every chunk's raw + gzip size.
2. Add (dev-only, zero-dep) instrumentation you need: a counter around
   `economy.ts persist()` calls/sec, an event-dispatch counter, a simple
   FPS/heap logger. Keep them behind `?perf=1`.
3. Record the baseline numbers in the devlog — every later PR must show
   before → after against this baseline.

## 2. Verified hotspot backlog (from a 4-scout recon of this exact tree)

Line numbers are from recon; re-verify each before editing. Work in
this order — each tier is roughly one PR.

### P0 — the economy event storm (biggest win, smallest risk)

- `economy.ts:272` — `persist()` does a full-blob `JSON.stringify` +
  `localStorage.setItem` + CustomEvent dispatch on EVERY mutation.
  Hold-scrape = ~9 full writes/sec; worse below.
- `ScrapeMenu.tsx:834` — `scLadderDrain` can issue up to ~192
  `tabulate()` calls per scrape with the 90 ms supercomputer tapper →
  up to ~2000 synchronous localStorage writes + dispatches PER SECOND.
  Fix shape: batch the drain into one state mutation; coalesce
  `persist()` (microtask/rAF or ~250 ms debounce) for both the write
  and the dispatch. `economy-sync` already tolerates delay (1.5 s).
- `ScrapeMenu.tsx:782` — `setEco({...getEconomy()})` re-renders the
  whole 1181-line panel per event; nested duplicate subscriptions at
  `:500` (EmoteSlotsSection) and `:684` (BotsStatus) triple the work —
  delete them, the parent re-render already covers both.
- `ScrapeMenu.tsx:797` — `after()` grows `timers.current` unboundedly.
- `CreditsHud.tsx:29` / `EmoteWheel.tsx:47` — always-mounted HUDs
  clone state per event; store primitives / compare before setState so
  React's Object.is bailout works.
- `ProfileIcon.tsx:35` — 380 ms decorative-rain interval re-renders
  forever; move to CSS animation or pause when hidden.

### P1 — load path + bundle (biggest first-paint win)

- `App.tsx:37` — static `scene.ts` import drags three.js + colyseus +
  everything into ONE 1,037 kB / 289 kB-gzip chunk the TITLE SCREEN
  pays. Dynamic-import the game surface at `phase === 'game'`; prefetch
  in the background from the title screen.
- `vite.config.ts` — no `manualChunks`; split three / colyseus /
  supabase into stable vendor chunks.
- `main.tsx:4` — `dialogue.ts` + `economy-sync.ts` pull supabase-js
  into the entry; defer behind first paint (requestIdleCallback) or
  the title→game transition.
- `dialogue.ts:433` — fetches the ENTIRE dialogue table at page boot
  for every visitor; defer to first dialogue open + localStorage cache.
- `App.tsx:19` — `ScrapeMenu` (1181 lines) and `AdminConsole`
  (913 lines, admin-only!) are eager; `lazy()` them like
  FreqLock/CircuitPatch/CoreRun already are.
- `style.css` — 146 kB single global sheet blocks every surface;
  split Board/ScrapeMenu/AdminConsole styles into their lazy chunks.
- `scene.ts:1217` — three `buildGlyphAtlas()` calls re-rasterize on
  every scene entry/class reselect; memoize at module scope.

### P2 — render loop hygiene (steady-state smoothness)

- `FreqLock.tsx:128` — `setSongMs` re-renders the component at 60 fps;
  drive blips imperatively (refs/CSS), setState only on judgement.
- `scene.ts:2316` — `updateFeetArrow` allocates a targets array per
  18 Hz tick; hoist to module constant + scratch object.
- `scene.ts:2539` — minimap remotes push fresh `{id,x,z}` per emit;
  pool + mutate in place.
- `scene.ts:2632` — `clientWidth/Height` read INSIDE the emote loop
  interleaved with style writes = layout thrash; hoist reads.
- `scene.ts:2616` — nametag opacity/transform written unconditionally
  for up to 50 tags/frame incl. already-hidden ones; skip no-ops.

### P3 — network + auth cadence

- `supabase.ts:37` — `subscribeAuth` creates a getSession round-trip +
  independent GoTrue subscription PER CALLER (~16 call sites). Refactor
  to ONE shared subscription + cached snapshot + listener Set with
  synchronous replay. This single fix collapses several below.
- `economy-sync.ts:176` — `loadFromAccount` (SELECT + claim RPC +
  possible save) re-runs on every auth event incl. hourly
  TOKEN_REFRESHED and tab-refocus; guard by uid change.
- `economy-sync.ts:168` — `flushPendingSave` uploads the full blob on
  every tab-hide even with nothing pending; add a dirty flag.
- `economy-sync.ts:189` — trailing-only debounce means NO save lands
  during continuous play; add a max-wait (~15 s) forced save.
- `supabase.ts:386` — full-blob upload per save; at minimum skip
  identical saves (diff vs last-pushed).
- `network.ts:202` — x/z/rotY registered as three separate listeners →
  3 fireUpdate + 3 fresh RemotePlayer allocations per patch per player
  (~1800 allocs/sec at full sphere); coalesce per tick + scratch object.
- `scene.ts:2526` — `sendMove` fires at 15 Hz even standing still; add
  an epsilon dirty check + one settle frame.
- `ConstructionGate.tsx:16` + `AdminConsole.tsx:42` +
  `profile.ts:178` — network refetches per auth event for values that
  never change mid-session; guard by uid, cache role.

## 3. Future-proofing (this is half the assignment)

1. **Perf budgets in CI**: a small script (`scripts/check-bundle.mjs`,
   zero-dep) that fails `pnpm build` if entry gzip > 120 kB or any
   chunk > 350 kB gzip. Wire into the existing GitHub Actions CI ONLY
   if `.github/workflows` edits are permitted — otherwise ship the
   script + devlog how to wire it and note it in the handoff.
2. **Patterns doc**: `docs/PERFORMANCE.md` — the house rules future
   features must follow: subscribe-with-selector (no whole-state
   clones), one shared auth subscription, batch-then-dispatch for
   economy mutations, lazy() any panel that renders null until an
   event, no per-frame allocation in rAF loops, hoist DOM reads out of
   write loops, every new interval must pause on `document.hidden`.
3. **Add the `?perf=1` HUD permanently** (dev-only overlay: fps, heap,
   economy events/sec, dispatches/sec) so regressions are visible in
   ten seconds without DevTools.
4. Append a decisions.md entry for every pattern you establish.

## 4. Working method

- One PR per tier (P0/P1/P2/P3/guardrails), draft, own devlog with
  before→after numbers from your §1 instrumentation.
- Re-verify every recon line number before editing (the tree moves).
- After each tier: full gates + a manual smoke of scrape panel,
  minigames, multiplayer join, title→game flow.
- Explore beyond this list — the recon was 4 scouts wide, not
  exhaustive. Anything you find, add to the backlog in the devlog and
  fix it in the matching tier. STOP-AND-ASK anything that changes
  gameplay feel (tick rates, reward cadence) — note it, pick the
  conservative option, flag in the PR.
- Finish: update `.claude/handoff.md` with the before→after table and
  what's left.

Begin with step 0.
