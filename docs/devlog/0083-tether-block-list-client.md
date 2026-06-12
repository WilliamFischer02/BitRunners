# 0083 — tether block list (client-side)

PR 88 deferred the per-pair block list because server-side
enforcement requires Supabase integration the server does not yet
have. The full server-side block list still owes that PR, but the
client-side UX is independently useful and can ship now.

## What ships

### Block-list store

- **`apps/web/src/block-list.ts`** — new module. localStorage-backed
  versioned blob (`bitrunners.tether-blocks.v1`). Entry shape:
  `{ id: sessionId, name: displayName, ts: epochMs }`.
- Exports `getBlocks()`, `isBlocked(id)`, `addBlock(id, name)`,
  `removeBlock(id)`, `subscribeBlocks(cb)`. Subscribe fires on every
  add/remove via a `bitrunners:tether-blocks-changed` DOM event.

### Wiring into tether-chat

- **`apps/web/src/tether-chat.ts`** — imports `isBlocked` /
  `addBlock` from the store.
  - `sendTetherRequest(peer)` now refuses if the target is on the
    block list (defense-in-depth — the cartridge also filters).
  - New `blockCurrentPeer()` adds the active tether's peer to the
    block list and ends the tether.
- **`apps/web/src/scene.ts`** — `onTetherIncoming` silently drops if
  the sender is blocked. Outgoing requests get the same filter via
  the state-machine guard above.

### UI

- **`apps/web/src/TetherChat.tsx`** — new `BlockedListPanel`
  component mounted by `TetherChat`. Opens via a
  `bitrunners:open-block-list` DOM event; lists current blocks with
  per-row `[ unblock ]`. The cartridge gains a `$ block list` section
  with `[ open ]` that fires the event.
- The chat overlay header gains a `⊘` button between the peer name
  and the `✕` end button. Calls `blockCurrentPeer()`.
- **`apps/web/src/style.css`** — `.tether-overlay-block` shares
  styling with `.tether-overlay-end`; hover tint is red instead of
  amber so the action reads as harder than "end".

## Known V1 gap

Block lists are keyed by Colyseus `sessionId`, which churns per join.
A blocked runner who quits and rejoins gets a fresh `sessionId` and
can request a tether again. Closing that gap needs the server to
persist blocks by user uuid and enforce server-side; that ships when
the server picks up Supabase auth integration.

## Verification

- `pnpm lint` ✓ (92 files)
- `pnpm typecheck` ✓ (8/8)
- `pnpm --filter @bitrunners/web build` ✓
- Manual smoke:
  - Two tabs, tether, ⊘ in chat overlay → tether ends + peer in block
    list.
  - Peer sends fresh tether request → silently dropped on this side.
  - Cartridge → `block list` → `[ open ]` → entry visible, unblock
    works.

No new dependencies. No schema change. No server change.
