# 0081 — tether moderation V1 (profanity + audit ring)

Branch: `claude/tether-moderation-v1`. Devlog 0081.

PR 87 left the moderation stack with three open items per
`docs/lore/015-chat-policy.md`: server-side profanity filter, per-pair
block list, and audit log. This PR ships the achievable subset
(filter + audit ring); the block list needs Supabase server-side
integration that does not exist today and warrants its own PR.

## What ships

### Server profanity classifier

- **`apps/server/src/profanity.ts`** — new module. Exports
  `classifyTetherBody(body, isEmote) → { moderation, match }` with
  `moderation: 'clean' | 'flagged' | 'blocked'`.
- Two small seeded wordlists:
  - **blocked** — slurs / explicit violence. Dropped silently; sender
    sees a single "// channel rejected" system line in their chat
    overlay.
  - **flagged** — common mild profanity. Forwarded to the peer and
    logged for owner review.
- Normalization: lowercase, strip non-alpha, word-boundary regex.
  Catches `F.U.C.K` but doesn't false-positive on `classic` because
  of `ass`.
- Emote glyphs short-circuit to `clean` — they're already constrained
  to the curated `EMOTE_GLYPHS` allowlist by `isValidEmote`, no path
  for user prose.

### Audit ring buffer

- **`apps/server/src/audit.ts`** — new module. In-memory ring of the
  last 200 flagged/blocked events. Cleared on process restart
  (Fly auto-stops — acceptable for V1 alpha; Supabase persistence
  follows). Clean messages are *not* logged per chat-policy V1.
- Each event captures `roomId`, both sessionIds, sender display name,
  raw body, isEmote flag, verdict, matched word.

### Fastify audit route

- **`apps/server/src/index.ts`** — `GET /audit/recent?token=…&limit=…`
  returns recent events. 404 when `AUDIT_TOKEN` env var is unset (the
  default, so a misconfigured prod doesn't leak). 401 on mismatch.

### Sphere room hook

- **`apps/server/src/sphere-room.ts`** — `tether-send` handler runs
  the classifier after the rate-limit check. Verdict routes:
  - `clean` → forward to peer (existing behavior).
  - `flagged` → forward + audit.
  - `blocked` → audit + `client.send('tether-rejected', { reason })`,
    no peer forward.

### Client rejection surface

- **`packages/shared`** — no schema change (the `tether-rejected`
  payload is server → client only and stays out of the validator
  surface).
- **`apps/web/src/network.ts`** — `NetworkCallbacks` gains
  `onTetherRejected(reason)`; the message handler dispatches it.
- **`apps/web/src/tether-chat.ts`** — new `tetherSystemNotice(body)`
  appends a `from: 'system'` line to the active tether history.
- **`apps/web/src/scene.ts`** — `onTetherRejected` callback calls
  `tetherSystemNotice('// channel rejected')`.

## Deferred (block list + Supabase persistence)

The block list and SQL-backed audit log both need server-side
Supabase integration (the server currently has zero Supabase calls).
Wiring that up touches:

- Per-room cached block list refreshed via RPC on join + identity
  change.
- Service-role Supabase client on the server with strict scope.
- `dm_messages` table + RPC for inserts.
- `profiles.dm_blocked` UUID array column.
- AdminConsole `DmReports` panel reading from `dm_messages`.

That's its own bucket. Filed as the next moderation PR.

## Verification

- `pnpm lint` ✓ (91 files)
- `pnpm typecheck` ✓ (8/8)
- `pnpm --filter @bitrunners/web build` ✓
- `pnpm --filter @bitrunners/server build` ✓ (2.1 MB bundle)
- Manual smoke:
  - Plain message → forwards as before.
  - `mild fuck word` → forwards; audit ring records `flagged`.
  - `slur word` → dropped; sender chat overlay shows
    `// channel rejected`; audit ring records `blocked`.
  - `curl localhost:8080/audit/recent` (no token in env) → 404.
  - `curl '…?token=wrong'` (token set) → 401.
  - `curl '…?token=right&limit=10'` → JSON `{ events: [...] }`.

No new dependencies. No schema change.
