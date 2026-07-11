# 0141 — Perf P3: network + auth cadence

Tier P3 of the performance pass (baseline 0137 · P0 0138 · P1 0139 ·
P2 0140). Redundant network chatter: duplicated auth subscriptions,
saves of unchanged data, and multiplied per-patch callbacks.

## What changed

- **`supabase.ts` — one shared auth subscription.** `subscribeAuth` used
  to create a fresh `getSession()` promise + `onAuthStateChange` listener
  per caller — ~16 mounted at once in-game. Worse, each listener ran
  `logSignIn` on SIGNED_IN, so one sign-in inserted ~16 duplicate
  `session_events` rows (inflating DAU stats). The GoTrue client is now
  wired once; subscribers live in a Set, the latest snapshot is cached
  and replayed to late subscribers immediately, and `logSignIn` fires
  once per sign-in. Guest fallback for unconfigured builds unchanged.
- **`economy-sync.ts`:**
  - `loadFromAccount` is guarded by uid — TOKEN_REFRESHED / focus
    re-auth events (same user) no longer re-run the whole
    load-merge-grants round trip. Resets on sign-out.
  - `saveNow` skips the RPC when the blob (with `updatedAt` zeroed) is
    byte-identical to the last accepted save — no more writes that only
    bump a timestamp. The key is refreshed on adopt-remote paths so an
    import can't wedge the skip.
  - `flushPendingSave` only fires when a debounced save is actually
    pending — previously every visibilitychange→hidden (each tab switch
    / phone lock) ran a full save with nothing dirty.
  - **15 s max-wait**: continuous activity (scraping faster than the
    1.5 s debounce) restarted the timer forever; a dirty window older
    than 15 s now forces a save.
- **`network.ts` — coalesced field listeners.** A movement patch touches
  `x`, `z` and `rotY` — three `listen()` callbacks in one synchronous
  decode, each running `snapshot(player)` + `onUpdate`. Now coalesced to
  one snapshot/callback per patch via a microtask flag; identity
  (6 fields) likewise. Emote handling untouched (seq-gated already).
- **`scene.ts` — outbound move dirty check.** `sendMove` fired at 15 Hz
  regardless of movement — a stationary player streamed identical
  coordinates forever. Now skipped when position/rotY are within 1e-4 of
  the last send, **with a 10 s keepalive**: the server's idle sweep
  (`IDLE_TIMEOUT_MS` = 120 s) refreshes `lastSeen` only on inbound
  messages, so a fully silent stationary client would be kicked — the
  keepalive preserves today's "idle tab stays connected" behavior. The
  last-sent cache resets on (re)connect so the first send always fires
  (server scatters spawn coords; remotes must see the correction).
- **Refetch guards** (`ConstructionGate`, `AdminConsole`, `AdminGate`
  in Game.tsx): `getMyRole` / `fetchUnderConstruction` refetch only when
  the uid actually changes, not on every same-user auth event.

## Before → after

| metric | before | after |
| --- | --- | --- |
| GoTrue listeners / getSession calls | ~16 (one per subscriber) | 1 shared |
| `session_events` inserts per sign-in | ~16 duplicates | 1 |
| account loads per token refresh | 1 full load-merge-grants | 0 (uid-guarded) |
| economy saves of unchanged state | every debounce flush + every tab-hide | 0 (blob-key skip + pending-only flush) |
| max unsaved-dirty window while scraping | unbounded | ≤ ~15 s |
| onUpdate calls per movement patch | up to 3 (+3 snapshots) | 1 |
| outbound move msgs while stationary | 15/s | 1 per 10 s (keepalive) |
| entry / Game chunks (gzip kB) | 12.43 / 62.09 | 12.50 / 62.18 |

## Behavior notes (conservative calls)

- `profile.ts` deliberately left refetching identity on every auth
  callback — its comment marks the "light refresh" as intentional (rep
  chips), and the shared subscription already removed the duplicate
  event storms feeding it.
- The move keepalive (10 s) is well inside the server's 120 s idle
  window; AFK-tab semantics are unchanged. Server tick/interp is
  unaffected — the server holds last position between messages.
- Skip-identical-save still dispatches `economy-synced` so the account
  UI's continuity check behaves as before.
- The shared auth subscription is never unsubscribed (module lifetime)
  — same net effect as before, where App-lifetime subscribers held
  theirs forever anyway.

Gates: biome ✓ · typecheck 8/8 ✓ · test 46/46 ✓ · build 5/5 ✓.
