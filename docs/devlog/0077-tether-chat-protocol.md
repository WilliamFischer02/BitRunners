# 0077 — Tether chat protocol (UI + state machine)

Branch: `claude/tether-chat-protocol`. Draft PR pending.

This is PR 83 in the polish push (see
`/root/.claude/plans/nested-tickling-reddy.md`). Covers bucket **G**:
verified-account chat behind a ToS gate, tap-to-tether targeting from
the protocols carousel, 25-character free-text input + emote bubbles.

The actual peer message routing is stubbed at the DOM event-bus layer
in this PR; the Colyseus wire-up is a follow-up so the UI + state
machine can land cleanly first.

## What ships

### State machine

- **`apps/web/src/tether-chat.ts`** (new) — single-module store of
  tether state. Public surface:
  - `TetherStatus = 'idle' | 'targeting' | 'pending' | 'tethered'`
  - `enterTargeting()`, `leaveTether()`, `sendTetherRequest(peer)`,
    `tetherEstablished(peer)`, `tetherDeclined(reason)`,
    `tetherSend(body)`, `tetherSendEmote(glyph)`, `tetherReceive(body, isEmote)`
  - `subscribeTether(cb)` / `getTetherState()` / `isTargeting()`
- ToS gating lives here too: `hasAcceptedTetherTos()` reads the
  versioned localStorage blob, `acceptTetherTos()` writes it.
- Message buffer capped at `TETHER_HISTORY_CAP = 40`; per-message
  body capped at `TETHER_MAX_CHARS = 25`.

### React surface

- **`apps/web/src/TetherChat.tsx`** (new) — root component with three
  sub-pieces:
  - `TetherCartridge` — modal opened from the carousel. Renders one
    of: "sign in" / "handle pending" / "ready" / "in targeting" /
    "pending" / "tethered" depending on state.
  - `TosGate` — first-time acceptance: age checkbox (13+) + rules
    checkbox. Both required.
  - `ChatOverlay` — sticky bottom-right chat panel. Shown only while
    `status === 'tethered'`. 25-char `maxLength` input + emote-bubble
    rendering for `isEmote: true` messages.
  - `IncomingRequestModal` — listens for the
    `bitrunners:tether-incoming` event a future peer-side network
    layer dispatches. Accept routes to `tetherEstablished`, decline
    routes to `tetherDeclined`.

### Carousel cartridge

- **`apps/web/src/protocols-registry.ts`** — adds `tether_chat`
  (glyph `⌥`, br tint, "tap a runner · talk"). Cartridge launch
  dispatches `'bitrunners:open-tether-chat'` which the React panel
  listens for.

### Wiring + style

- **`apps/web/src/App.tsx`** — mounts `<TetherChat />` next to
  `<UsernameEditor />`.
- **`apps/web/src/style.css`** — `.tether-overlay`, `.tether-msg`,
  message-author tint variants, ToS checkbox row, incoming-request
  iris glow.

## Architecture decisions

- **State machine in plain TS, not React state.** The same state
  needs to be readable from `scene.ts` (for the tap-to-tether
  remote-avatar click handler) and the React panel. Pure module
  with subscribe avoids prop drilling and keeps the React
  components thin.
- **ToS = client-side gate, not a Supabase row.** A migration could
  add `profiles.tether_tos_accepted_at`, but keeping it local for
  v1 avoids a schema change while we tune copy + flow. The seam is
  trivial to lift to the server later.
- **Eligibility = signedIn + approved handle.** Per the chat-policy
  doc the verified-account requirement is "approved display name",
  not just "session active". A pending or rejected handle gates the
  cartridge.
- **25 chars enforced at three layers.** Input `maxLength`, runtime
  `slice` in the state-machine setter, and a `slice` in
  `tetherReceive` for inbound paranoia.
- **DOM events as the network seam.** `tether-send` outbound + a
  `tether-incoming` event the network layer can dispatch. The
  Colyseus room handler in `apps/server/src/room.ts` will pick this
  up in a follow-up PR. Today the UI handles state changes correctly
  even with no network handler attached.

## Verification

- `pnpm lint` ✓ (81 files, 2 files auto-fixed by biome — import order)
- `pnpm typecheck` ✓ (8/8 tasks)
- `pnpm --filter @bitrunners/web build` ✓ (6.72 s)
- Manual:
  - Cartridge opens; "sign in" branch renders for guests.
  - Signed-in + approved → "review terms" → both ToS checkboxes
    must be checked → "accept + open" enters targeting mode.
  - Dispatching `bitrunners:tether-incoming` with `{ peer: { id, name } }`
    from devtools renders the IncomingRequestModal.
  - After accept, ChatOverlay appears; 25-char input enforced;
    "end" exits cleanly.

## Owner-tunable values

| What | v1 default | Where |
|---|---|---|
| Char limit per message | 25 | `tether-chat.ts` `TETHER_MAX_CHARS` |
| History cap | 40 messages | `tether-chat.ts` `TETHER_HISTORY_CAP` |
| Min age | 13 | `TetherChat.tsx` `TosGate` |
| Overlay anchor | bottom-right | `style.css` `.tether-overlay` |
| Cartridge tint | br iris | `protocols-registry.ts` |
| ToS storage key | `bitrunners.tether-tos.v1` | `tether-chat.ts` |

## Deferred

- Colyseus wire-up — bind `tether-send` → room message; dispatch
  `tether-incoming` on peer message. Room-side rate limit + profanity
  filter (already specced in `docs/lore/015-chat-policy.md`).
- Scene-side tap-to-tether — `scene.ts` reads `isTargeting()` and
  fires `sendTetherRequest` on remote-avatar tap. Stubbed for now;
  the cartridge already enters/leaves targeting state correctly.
- Per-pair block list UI — server side exists per migration 0007
  (`dm_blocked` array). A "block this runner" affordance on the
  chat overlay is the natural place.

## Roadmap

- PR 76 (merged) — Auth verify, password reset, signup grant
- PR 77 (merged) — Responsive design tokens
- PR 78 (merged) — Persistent credits HUD
- PR 81 (merged) — 10-mission chain + lore + complete-state hydration
- PR 79 (open) — Badges modal + name styling
- PR 80 (open) — Shop + Inventory 2-tab modal
- PR 82 (open) — Bit scraper depth
- **PR 83 (this PR)** — Tether chat protocol (UI + state machine)
- PR 84 — Custom name + emote approval debugging
- PR 85 — Minimap detail / legibility on phone

## No new dependencies. No protocol bump. No schema change.
