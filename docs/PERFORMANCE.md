# Performance — budgets, patterns, tooling

Outcome of the July 2026 performance pass (devlogs 0137–0142). This is
the reference for **keeping** the wins, not a history — history lives in
the devlogs.

## TL;DR

- Entry chunk budget: **≤ 120 kB gzip** (currently ~12). Any chunk:
  **≤ 350 kB gzip**. Enforced by `pnpm --filter @bitrunners/web check-bundle`.
- Game-only code goes in `Game.tsx` (lazy), never `App.tsx`/`main.tsx`.
- No per-frame React state. No per-frame allocation in the scene tick.
- No per-caller auth subscriptions, no saves of unchanged data.
- Debug with `?perf=1` — fps, heap, and hot-path counter rates on screen.

## Budgets (bundle)

```
pnpm --filter @bitrunners/web build
pnpm --filter @bitrunners/web check-bundle
```

`apps/web/scripts/check-bundle.mjs` gzips every `dist/assets/*.js` and
fails when the entry chunk (the script `dist/index.html` loads) exceeds
120 kB gzip or any chunk exceeds 350 kB gzip. Budgets are ~2× current
worst so they catch regressions, not growth; if a deliberate change
moves them, bump the constant **and devlog it**.

Not wired into CI yet — `.github/workflows/` edits need explicit owner
confirmation (CLAUDE.md). To wire it: add the two commands above as a
step after the web build in the Pages workflow.

Current shape (2026-07, local build without `VITE_SUPABASE_*`):

| chunk | gzip kB | loaded when |
| --- | --- | --- |
| entry `index-*` | ~12 | first paint (title) |
| `react` | ~46 | first paint (modulepreload) |
| `supabase` | ~4 | boot (auth gate) |
| `Game` | ~62 | prefetched from title, used at class-select |
| `three` / `colyseus` | ~124 / ~37 | with Game |
| `AdminConsole` | ~4 | admins only |
| `Board` | ~148 | writer portal only |

## Load-path rules

- **`App.tsx` imports only what the title screen needs** (Boot,
  ConstructionGate, TitleScreen, BootDissolve). Everything in-game lives
  in `Game.tsx`, a lazy chunk that `Shell` prefetches on mount. Adding a
  static import of a game module to App/main drags it (and its vendors)
  back onto the boot path — check-bundle will catch the size, review
  should catch the intent.
- **vite `manualChunks` must stay in function form.** Object form parked
  rollup's shared CJS-interop helper inside a vendor chunk, making the
  entry statically import all of colyseus for a one-line helper
  (devlog 0139).
- Boot-time network calls are forbidden on the title path. Data wanted
  "eventually" loads lazily on first use (`dialogue.ts`) or after first
  paint via `requestIdleCallback` (`economy-sync`).

## Render-loop rules (scene.ts + minigames)

- **No `setState` from rAF/tick loops.** Animate imperatively inside a
  ref-owned DOM layer (FreqLock blips, ProfileIcon rain) and let React
  re-render only on real events (taps, phase changes).
- **No allocation in the tick loop.** Hoist scratch arrays/objects,
  pool anything emitted repeatedly (minimap remotes), return references
  instead of clones when consumers are read-on-demand.
- **Read layout once.** `clientWidth/Height` are cached (`hostW/hostH`)
  and refreshed by the ResizeObserver — never read them per frame.
- **Skip identical style writes.** Compare against a last-value string
  (remote name tags) so an idle scene writes zero styles.

## Network/auth cadence rules

- **`subscribeAuth` is one shared GoTrue subscription** (supabase.ts).
  Subscribe freely — it's a Set add + cached-snapshot replay. Never call
  `sb.auth.onAuthStateChange` / `getSession` directly from UI code.
- **Guard refetches by uid**, not by event: TOKEN_REFRESHED / focus
  re-auths report the same user and must not refire role lookups or
  account loads (ConstructionGate, AdminGate, economy-sync pattern).
- **Never save unchanged state.** economy-sync compares the serialized
  blob (updatedAt zeroed) against the last accepted save; flush-on-hide
  only fires when a save is actually pending; a 15 s max-wait bounds
  dirty windows under continuous activity.
- **Outbound moves are dirty-checked** with a 10 s keepalive. ⚠️ The
  server idle sweep (`sphere-room.ts`, `IDLE_TIMEOUT_MS` 120 s) counts
  only inbound messages as liveness — never make the client fully silent.
- Colyseus per-field `listen()` callbacks for one logical update are
  microtask-coalesced (network.ts) — one snapshot/callback per patch.

## Event-cadence rules (economy)

- `bitrunners:economy-changed` dispatch + localStorage persist are
  coalesced per microtask (economy.ts, P0). Batch multi-step mutations;
  don't emit per unit.

## Debugging: `?perf=1`

Append `?perf=1` to any URL (works in prod). `apps/web/src/perf.ts`
mounts a plain-DOM HUD: fps, JS heap (Chrome), and per-second rates of
named counters. Add `perfCount('my.thing')` to a suspected hot path —
it's a single-branch no-op when the flag is off, so instrumentation can
stay in shipped code.

Ten-second regression check: load the game with `?perf=1`, stand still.
Expect ~60 fps, near-zero counter rates while idle, and flat heap.
