# 0087 — tether-request rate limit + double-accept guard

Closes the two minor tether-server findings flagged in the
`2026-06-13` handoff (F1 + F2). Both are non-critical, no
auth-bypass or currency exploit, but the fix is small and
contained.

## F1 — per-sender flood gate on `tether-request`

Before: a single runner could fire `tether-request` at every peer
in the sphere with no throttle. Worst case in a 40-player sphere
was 39 outgoing requests in a tight loop, each spawning a
`tether-incoming` notification on the target.

After: per-sender sliding window. Max
`TETHER_REQUEST_RATE_LIMIT_PER_MIN = 6` new requests per minute
per runner. Window resets on the minute boundary so a runner can't
burst-flood between checks (same shape as the existing
`tether-send` gate, just tighter — 6 instead of 30 since legitimate
new-conversation rate is much lower than in-conversation send rate).

The constant lives in `packages/shared/src/index.ts`.

## F2 — double-accept race in the handshake

Before: a runner could fire concurrent `tether-request` messages
to multiple targets. If two targets accepted before the first
write to `activeTethers` registered, the second write overwrote
the first. End result: one runner thinks they're tethered to peer
A; the other side actually got peer B.

After: a `pendingFrom: Map<sessionId, target>` records the target
each outgoing request is waiting on. A second outgoing request
from the same sender is dropped silently while the first is in
flight. The map is cleared on accept, decline, tether-leave, and
disconnect.

## Verification

- `pnpm typecheck` ✓ (8/8)
- `pnpm --filter @bitrunners/server build` ✓ (`dist/index.js` 2.1 MB)
- Manual: with two browser tabs, queuing a second tether-request
  before the first resolves now drops on the server (no
  `tether-incoming` on the second target) instead of racing.

No new dependencies. No schema change. Server-only — Pages deploy
not required, Fly will pick up on next `main` push that touches
server paths.
