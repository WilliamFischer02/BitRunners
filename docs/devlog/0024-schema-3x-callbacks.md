# 0024 — Fix Schema 3.x callback API on the client

**Date:** 2026-05-14

Owner reported: `NET: ERROR CAN'T ACCESS PROPERTY: "ONADD", L IS UNDEFINED` when opening the page.

This is **good news**:

- ✅ Cloudflare Pages rebuilt with the corrected `VITE_SERVER_URL`
- ✅ Fly server is deployed and accepting connections
- ✅ The client successfully joined a Colyseus room
- ❌ My client-side callback wiring used the old (Schema < 3.x) API

The room joins, then the client crashes trying to attach a callback to `room.state.players.onAdd` directly — that property doesn't exist on Schema 3.x maps.

## The fix — getStateCallbacks

`@colyseus/schema` v3 + `colyseus.js` v0.16 require routing schema callbacks through a helper for tree-shaking compatibility:

```ts
import { getStateCallbacks } from 'colyseus.js';

const $ = getStateCallbacks(room);
$(room.state).players.onAdd((player, sessionId) => { ... });
$(room.state).players.onRemove((player, sessionId) => { ... });
$(player).onChange(() => { ... });
```

The `$` proxy wraps the schema instance and exposes `.onAdd`/`.onRemove`/`.onChange`/`.listen(field, cb)` methods. The actual schema instance still has its data fields (`x`, `y`, `z`, etc.) accessed normally.

## What I rewrote in `apps/web/src/network.ts`

- Imported `getStateCallbacks` from `colyseus.js`
- Wait for the first `room.onStateChange.once(...)` to fire so `room.state` is populated before subscribing (the state arrives asynchronously after `joinOrCreate` resolves — accessing `.players` immediately could return undefined, which was the underlying cause of the "L is undefined" error)
- Use `$(room.state).players.onAdd` and `.onRemove` instead of direct mutation on the schema map
- For per-player updates, use `$(player).onChange(...)` instead of `player.onChange(...)`

The TypeScript types for `getStateCallbacks` require knowing the room's state class, which the client doesn't import (we don't share schema types between server and client yet). Cast through `any` with a Biome ignore comment until we wire shared schema types — a Phase 2 polish item.

## Build

- 38 files lint-clean
- Typecheck green
- Build green

## What you should see now

After the Pages deploy of this commit (~2 min):

1. Boot scroll → character select → game (same as before)
2. Bottom-center badge: `net: connecting · wss://bitrunners.fly.dev/`
3. Within ~2 s: **`net: connected · session XXXXXX`** in green
4. When the second device joins: badge updates to **`net: connected · 1 other(s)`** on both phones
5. The other player appears as a darker, simpler bit_spekter avatar in the world

If you see green "connected" but no second character, that's a render-side issue and I'll fix `buildRemoteAvatar` next. If you see another error message, paste it.

## Files changed

- `apps/web/src/network.ts` — proper Schema 3.x callbacks via `getStateCallbacks`
