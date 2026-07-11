# 0138 — Perf P0: kill the economy event storm

Tier P0 of the performance pass (baseline: devlog 0137). Biggest win,
smallest risk: the economy write/dispatch/re-render pipeline.

## What changed

- **`economy.ts` persist coalescing.** Mutations no longer stringify +
  `localStorage.setItem` + dispatch synchronously each call. In-memory
  state stays immediate; the CustomEvent dispatch coalesces onto a
  microtask (a synchronous burst = ONE event); the localStorage write
  debounces 250 ms and force-flushes on `pagehide` + tab-hide
  (`visibilitychange`, the reliable signal on iOS Safari). economy-sync
  already tolerates seconds of delay (1.5 s debounce downstream).
- **`economy.drainLadder()`** — new batched Supercomputer ladder drain:
  up to 64 conversions per enabled rung in ONE mutation + ONE persist.
  Replaces `ScrapeMenu.scLadderDrain`'s per-step `tabulate()` loops
  (up to 192 persists per scrape tap). Rungs run in ladder order so
  fresh units feed the next rung — identical results to the old loops.
  The locked 8× STEP ratio is untouched; per-bot switches still gate
  each rung.
- **ScrapeMenu**: deleted the duplicate economy subscriptions in
  `EmoteSlotsSection` and `BotsStatus` (both hosts re-render them on
  every economy event already); `after()` now removes fired timer ids
  (was an unbounded array for the panel's lifetime).
- **CreditsHud**: stores credits/tokens/chatter as primitive state
  instead of cloning the blob per event → React's Object.is bailout
  skips re-renders when nothing it shows changed.
- **EmoteWheel**: keeps the previous loadout array when unchanged →
  same bailout for the always-mounted wheel.
- **ProfileIcon**: the 380 ms decorative rain now writes `textContent`
  via a ref (no React reconciliation forever) and pauses while
  `document.hidden`.

## Before → after (vs devlog 0137 baseline)

| metric | before | after |
| --- | --- | --- |
| Supercomputer tap (90 ms): localStorage writes | ~193/tap ≈ 2,100/s | ≤4/s (debounced) |
| Supercomputer tap: economy CustomEvents | ~193/tap ≈ 2,100/s | 1/tap ≈ 11/s |
| Hold-scrape (110 ms): writes + dispatches | ~9 + 9/s | ≤4 writes + ~9 events/s |
| ScrapePanel re-renders per economy event | ×3 (nested dup subs) | ×1 |
| CreditsHud/EmoteWheel re-renders on unrelated events | every event | 0 (Object.is bailout) |
| ProfileIcon re-renders | ~2.6/s forever | 0 (direct DOM; paused when hidden) |
| entry chunk | 289.09 kB gzip | 289.81 kB gzip (+0.7 — perf.ts + drainLadder; recovered in P1) |

Verify live with `?perf=1` (eco.mutate / eco.write / dispatch rates).

## Behavior notes (conservative calls)

- No gameplay cadence changed: tap intervals, BOT_TICK_MS, rewards and
  the 8× ladder are untouched. `drainLadder` output equals the old
  per-step loops for the same inputs.
- Subscribers now receive the economy event a microtask later than the
  mutation (was synchronous). All in-repo subscribers read state via
  `getEconomy()` at event time, so none observe a difference.
- A hard crash (not close/navigate/tab-hide) can lose ≤250 ms of
  progress — accepted trade for ~500× fewer synchronous writes.

Gates: biome ✓ · typecheck 8/8 ✓ · test 46/46 ✓ · build 5/5 ✓.
