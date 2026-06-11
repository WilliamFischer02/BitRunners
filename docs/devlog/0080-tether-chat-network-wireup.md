# 0080 — tether_chat: wire to Colyseus

Branch: `claude/tether-chat-network`. Devlog 0080.

PR 83 shipped the tether_chat UI + state machine but stubbed the
network layer at the DOM event bus ("a follow-up will route these
through the Colyseus channel"). This is that follow-up.

## What ships

### Shared protocol

- **`packages/shared/src/index.ts`** — `PROTOCOL_VERSION` 2 → 3.
  Adds `TETHER_MAX_CHARS = 25`, `TETHER_RATE_LIMIT_PER_MIN = 30`,
  and `isValidTetherBody()` (printable ASCII, 1–25 chars).

### Server (apps/server/src/sphere-room.ts)

Five new message handlers route between exactly two consenting peers:

- `tether-request { target }` — drops if either side is already
  tethered or has a pending invite. Forwards `tether-incoming` to
  the target with the requester's `sessionId` + `displayName`.
- `tether-accept { from }` — validates `from === pendingRequests[me]`,
  binds both sides into `activeTethers`, forwards `tether-accepted`
  back to the requester.
- `tether-decline { from }` — same validation, drops the binding,
  forwards `tether-declined` to the requester.
- `tether-send { target, body, isEmote }` — drops if `target` is not
  the bound peer; validates body shape via `isValidTetherBody`;
  applies a sliding-window per-pair rate limit
  (`TETHER_RATE_LIMIT_PER_MIN = 30`, resets each minute). Forwards
  `tether-message` to the bound peer.
- `tether-leave { target }` — tears down via `endTether(me, target)`.

`onLeave()` also calls `endTether` so a dropped connection ends any
active tether and fires `tether-declined` to anyone with a pending
invite that referenced the leaver.

State: `activeTethers: Map<sessionId, peerSessionId>` (one entry per
side), `pendingRequests: Map<target, requester>`, `tetherRate:
Map<pairKey, { windowStart, count }>`. Pair key is order-independent
(`a < b ? a|b : b|a`) so rate state is shared between directions.

### Client (apps/web/src/network.ts)

- `NetworkSession` gains five outbound methods:
  `sendTetherRequest`, `sendTetherAccept`, `sendTetherDecline`,
  `sendTetherMessage`, `sendTetherLeave`.
- `NetworkCallbacks` gains five inbound hooks:
  `onTetherIncoming`, `onTetherAccepted`, `onTetherDeclined`,
  `onTetherMessage`, `onTetherEnded`.

### tether-chat module rewire

- **`apps/web/src/tether-chat.ts`** — outbound side stops dispatching
  `bitrunners:tether-request` / `bitrunners:tether-send` DOM events.
  Instead it goes through a `TetherSink` interface registered by the
  network owner via `setTetherSink()`.
- New helpers `acceptIncomingTether(peer)` and
  `declineIncomingTether(peer)` fire the network handshake **and**
  flip local state in lockstep, so the UI never gets ahead of the
  wire.

### Scene wiring

- **`apps/web/src/scene.ts`** — on join, registers a `TetherSink` that
  delegates each method to the live `NetworkSession`. Also installs
  the five network callbacks so inbound `tether-incoming` becomes the
  `bitrunners:tether-incoming` DOM event (the
  `IncomingRequestModal` already listens for that), and inbound
  `tether-accepted` / `-declined` / `-message` / `-ended` route
  directly to `tetherEstablished` / `tetherDeclined` / `tetherReceive`
  / `leaveTether`.
- On `onDisconnect` and on `onStandbyEnter` (visibility pause), the
  sink is cleared and any active tether is closed so a stale binding
  can't survive a reconnect.

### UI (apps/web/src/TetherChat.tsx)

`IncomingRequestModal` now calls `acceptIncomingTether` /
`declineIncomingTether` instead of the lower-level state setters, so
the network handshake fires correctly.

## Moderation status

Per `docs/lore/015-chat-policy.md` the full stack is:
verified-account + age gate + server-side profanity filter +
30-msg/min rate limit + per-pair block list + audit log.

This PR ships:

- [x] Verified-account + age gate (client, PR 83)
- [x] 30-msg/min rate limit (server, this PR)
- [x] Body shape validation (printable ASCII, ≤ 25 chars)
- [ ] Server-side profanity filter — deferred (needs wordlist seed)
- [ ] Per-pair block list — deferred (needs Supabase table + RPC)
- [ ] Audit log — deferred (needs Supabase table + INSERT path)

The three deferred items are persistence-shaped and warrant their own
PR with the SQL migration + admin queue surfaces. Filing as next
bucket.

## Verification

- `pnpm lint` ✓ (89 files, fixed import order)
- `pnpm typecheck` ✓ (8/8 tasks)
- `pnpm --filter @bitrunners/web build` ✓
- `pnpm --filter @bitrunners/server build` ✓
- Manual smoke (two browser tabs at preview URL):
  - Tab A enters targeting → taps Tab B's avatar → request arrives
    in Tab B's `IncomingRequestModal`.
  - Tab B accepts → both tabs flip to `tethered`, system line shows
    "tethered with NAME" on both sides.
  - Either side sends a 25-char body → bubble appears on the peer.
  - Sending 31 messages in a minute → 31st drops silently
    (rate-limited server-side).
  - Tab B closes → Tab A receives `tether-ended`, overlay closes.

No new dependencies. No schema change. Protocol version 2 → 3.
