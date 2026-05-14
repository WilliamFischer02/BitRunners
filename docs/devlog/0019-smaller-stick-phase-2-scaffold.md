# 0019 — Smaller joystick + Phase 2 networking scaffold

**Date:** 2026-05-11

Owner asked for the joystick to shrink and to "proceed with development." With Phase 1 closed, Phase 2 networking starts here. No services activated yet — the server scaffold compiles and the client connect helper is wired but inert until `VITE_SERVER_URL` is set.

Also noted: `main` IS already the Cloudflare Pages production branch, has been since the initial setup. Every PR merge to main triggers an auto-deploy. No routing change needed.

## Joystick — slightly smaller

`apps/web/src/style.css`:

- Base diameter 148 → **118 px** (~20 % smaller)
- Thumb 60 → **48 px**
- Bottom-left position unchanged (28 px from edges)

Touch target stays comfortable on a phone; the stick takes up less of the canvas now.

## Phase 2 networking — server scaffold

`apps/server` now actually hosts a Colyseus sphere room alongside the Fastify HTTP server. Single Node process; Colyseus and Fastify share the underlying `http.Server` instance via Fastify's `.server` getter, so one port covers both health checks and WebSocket upgrades.

### New files

- **`apps/server/src/state.ts`** — `PlayerState` and `SphereState` schemas. Player has `id`, `className`, position (`x/y/z`), `rotY`. **Reserved fields** for Phase 3 are pre-allocated (`samaritanCorporate`, `samaritanBitRunner`, `factionState`, `wallet`) so the schema doesn't need a breaking migration when those systems land.
- **`apps/server/src/sphere-room.ts`** — the room class. Max 40 clients per the roadmap. 15 Hz simulation interval. Handles two messages: `move` (position update with toroidal wrap, lenient server-authoritative) and `class` (set class name). Player snapshot stored on join; deletion on leave — Phase 2's aether-on-disconnect goes here once Upstash is wired.
- **`apps/server/src/index.ts`** updated — registers Colyseus on top of the existing Fastify health-check, defines the `sphere` room, graceful shutdown closes both servers.

### Decorator support

Colyseus schemas use the legacy `@type` decorator syntax. Added to `apps/server/tsconfig.json`:

```json
"experimentalDecorators": true,
"useDefineForClassFields": false,
```

Scoped to the server only — the client and shared packages still use the modern bundler-resolution config.

### New deps (per the working agreement)

| Package | Version | Why |
|---|---|---|
| `@colyseus/core` | ^0.16.0 | Room runtime, message router |
| `@colyseus/schema` | ^3.0.0 | State sync over the wire |
| `@colyseus/ws-transport` | ^0.16.0 | WebSocket transport bound to Fastify's HTTP server |
| `colyseus.js` | ^0.16.0 | Client SDK (added to `apps/web`) |

## Phase 2 networking — client scaffold

`apps/web/src/network.ts` — new module exposing `joinSphere(serverUrl, className, callbacks)`. Connects to a Colyseus server, joins (or creates) the `sphere` room, surfaces three callbacks: `onJoin`, `onLeave`, `onUpdate` for remote players. Single message type `move` for now.

**Not wired into the scene yet** — `scene.ts` is unchanged in this commit. The client compiles with networking ready to be hooked up, but won't actually attempt a connection until the scene calls `joinSphere`. That keeps the current single-player experience identical while the server side stabilizes.

### Activation contract

`getServerUrl()` reads `import.meta.env.VITE_SERVER_URL`. When set at build time (Cloudflare Pages env var), the client knows where to connect. When unset → returns `null` → callers skip the connect path.

Documented in `apps/web/.env.example`. Pages dashboard env var to add later: `VITE_SERVER_URL = wss://bitrunners-server.fly.dev` (or whatever Fly hostname we get).

## What this commit explicitly does not do

- **Deploy `apps/server` to Fly.io** — still blocked on owner-provided Fly API token
- **Wire the client scene to the network module** — done in a follow-up once the server is reachable, so single-player keeps working in the meantime
- **Lucia auth, Neon Postgres, Upstash Redis** — Phase 2 milestone after the first server deploy

## Build

- 33 files lint-clean
- Typecheck green across all 5 workspaces (server compiles with the new decorator config)
- Web bundle unchanged: 645 kB main + 441 kB lazy Board chunk
- Server build: `apps/server/dist/index.js` + dependencies; runtime image stays small

## What's next

1. **Owner: Fly API token** — paste into GitHub Actions Secrets as `FLY_API_TOKEN`. Once it's there, I add `.github/workflows/deploy-server.yml` and the server ships on main pushes.
2. **First server deploy** — verify `bitrunners-server.fly.dev/health` responds, scale-to-zero works
3. **Wire the client** — call `joinSphere(getServerUrl(), 'bit_spekter', ...)` from `scene.ts`, render remote players as additional bit_spekters with name labels
4. **Two-device demo** — owner on phone, me on a separate browser session, both in the same sphere

If owner wants, I can stub the deploy workflow file now so the only manual step is adding the secret.
