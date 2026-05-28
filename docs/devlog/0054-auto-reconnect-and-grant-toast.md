# 0054 — Auto-reconnect after server kick + grant-received toast

**Date:** 2026-05-26
**Branch:** `claude/peaceful-thompson-TfjaS`

Two small, disjoint polish items that close gaps left open since devlog 0045
(idle disconnect) and 0053 (admin grant ledger).

## 1. Client auto-reconnect after server idle-kick

**Problem:** the server has kicked idle clients since devlog 0045, but the
client just froze on `net: error · …`. Players had to reload the page to
reconnect — a poor UX for anyone who got backgrounded.

**How it works:**

- `network.ts` — `NetworkCallbacks` gains an `onDisconnect?(code: number)`
  callback. Inside `joinSphere`, `room.onLeave` fires the callback when the
  disconnect is *not* intentional (a new `intentionalLeave` flag guards it;
  `dispose()` sets it before calling `room.leave(true)`).
- `scene.ts` — the inline async IIFE that called `joinSphere` is extracted
  into a named `connectSphere()` arrow function so it can be re-entered.
  Two new outer-scope vars: `sceneDisposed` (set in `dispose` to prevent
  reconnect after unmount) and `reconnectAttempt` (reset to 0 on each
  successful join). A `clearRemoteAvatars()` helper clears the Three.js
  scene + the emote DOM on reconnect.
- `onDisconnect` callback: clears remote avatars, then schedules
  `connectSphere()` with a `[3s, 6s, 12s]` backoff (3 attempts). After 3
  failures, it sets `net: disconnected · reload to reconnect`. On success,
  `reconnectAttempt` resets so the next disconnect starts fresh.
- Status line reads `net: reconnecting in Ns…` (purple/connecting style)
  during the countdown.

**Intentional-vs-unexpected:** `dispose()` (called when the React component
unmounts / class is swapped) sets `intentionalLeave = true` before
`room.leave(true)`, so swapping runner classes doesn't trigger the reconnect
loop. Only an unexpected close (server kick, network drop) fires
`onDisconnect`.

## 2. Grant-received toast

**Problem:** `economy-sync.ts` dispatches `bitrunners:grant-received` with
`{ credits, tokens }` after a successful admin grant claim, but nothing in
the UI consumed it — the player had no feedback that a grant landed.

**How it works:**

- `App.tsx` — `Game` component listens for `bitrunners:grant-received`.
  Non-zero values → set `grantToast` state (clearing any pending dismiss
  timer first). Auto-dismisses after 4.5 s. Uses `<output>` (semantic
  ARIA live region, Biome's preferred form over `<div role="status">`).
- `style.css` — `.grant-toast` is centered top of the viewport (below the
  "class · arrows" hint row), terminal-style with the tint green palette.
  `.grant-toast-amount` glows like the economy displays; `.grant-toast-label`
  is dim secondary text. Slide-in animation; reduced-motion safe.

## Honest status

- Gates green: `pnpm lint` clean (52 files), `pnpm typecheck` 8/8,
  `pnpm build` 5/5.
- **Not verifiable headless.** Auto-reconnect needs a live server that will
  kick a client (sit idle for 120 s, or have the owner run `client.leave()`
  from the Fly console). Toast needs a live admin grant. Both paths are
  correct by inspection.
- The reconnect fires `connectSphere()` which re-uses the same `roomCode`
  stored in `localStorage`; if that room was disposed, Colyseus falls back
  to `joinOrCreate` — same as initial connect.

## Files changed

- `apps/web/src/network.ts` — `onDisconnect` callback + `intentionalLeave` guard.
- `apps/web/src/scene.ts` — `clearRemoteAvatars`, `sceneDisposed`, `reconnectAttempt`,
  `RECONNECT_DELAYS`, `connectSphere` refactor.
- `apps/web/src/App.tsx` — `GrantDetail` type, `grantToast` state, `grantDismissRef`,
  `<output className="grant-toast">` element.
- `apps/web/src/style.css` — grant toast styles.
- `docs/devlog/0054-auto-reconnect-and-grant-toast.md` — this file.
- `.claude/handoff.md` — updated.
