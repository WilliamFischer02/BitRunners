# 0020 — Fly deploy workflow + scene wired to multiplayer

**Date:** 2026-05-14

Owner generated a Fly access token (named `FLYIO_ACCESS_KEY`) and added it to Cloudflare Pages plus `VITE_SERVER_URL = wss://bitrunners-server.fly.dev/` to the Pages env. Cloudflare is the wrong place for the Fly token — Pages only builds the static client. Asked owner to move it to GitHub Actions Secrets so the workflow shipped below can read it.

## `.github/workflows/deploy-server.yml`

Triggers on pushes to `main` that touch server-relevant paths (or via `workflow_dispatch`). Path-filtered so a web-only change doesn't re-deploy the server.

```yaml
env:
  FLY_API_TOKEN: ${{ secrets.FLYIO_ACCESS_KEY }}
steps:
  - uses: actions/checkout@v4
  - uses: superfly/flyctl-actions/setup-flyctl@master
  - run: flyctl apps create bitrunners-server --org personal || echo "app already exists"
  - run: flyctl deploy --remote-only --config fly.toml --app bitrunners-server
```

- `apps create … || echo …` makes the first run idempotent — creates the app if missing, swallows the "already exists" error on subsequent runs
- `--remote-only` builds on Fly's builders, so the GitHub runner doesn't need Docker
- `concurrency: deploy-server` serializes deploys; never run two at once

Once the owner moves the secret into GitHub, the next push to `main` that touches `apps/server/**` (or any of the watched paths) deploys the server. They can also trigger it manually via the Actions tab.

## Scene → network wiring

`apps/web/src/scene.ts` now connects to the Colyseus sphere when `VITE_SERVER_URL` is set at build time. Single-player when unset.

### Connect

On `startScene()`:

```ts
const serverUrl = getServerUrl();
if (serverUrl) {
  void (async () => {
    try {
      netSession = await joinSphere(serverUrl, 'bit_spekter', { onJoin, onLeave, onUpdate });
    } catch (err) {
      console.warn('[bitrunners] multiplayer disabled — connect failed:', err);
    }
  })();
}
```

If the server is unreachable (Fly app not yet deployed, network failure, schema mismatch), the `.catch` logs and the rest of the scene continues. **Single-player keeps working** — no black screen, no crash. This matters because the owner has already wired `VITE_SERVER_URL` in Cloudflare and is about to push the first deploy that activates the network path; if the Fly server isn't up yet, the live site has to keep working anyway.

### Remote players

New `buildRemoteAvatar()` — a lightweight humanoid (head, visor, torso, belt, legs as a single block, boots). No walk animation, no chest/hip rig. Renders through the world atlas (heavy blocks) since remote avatars stay on the default scene layer — the character-mask layer is reserved for the **local** player, so remote players visually distinguish themselves from the protagonist.

Map keyed by `sessionId`:

- `onJoin(p)` → build avatar, add to scene, store in map
- `onUpdate(p)` → set position and rotY (no interpolation in v0.1; visible at the server's 15 Hz cadence)
- `onLeave(id)` → remove from scene and map

### Send-throttle

Local player position sent at 15 Hz (matches the server's `setSimulationInterval` cadence):

```ts
if (netSession && now - lastNetSend >= NET_SEND_MS) {
  netSession.sendMove(rig.root.position.x, rig.root.position.z, facing);
  lastNetSend = now;
}
```

At 60 fps render and 15 Hz send, ~one of every four frames pushes a move message. Easy on bandwidth and on the server's per-client message rate.

### Dispose

On scene tear-down, `netSession.dispose()` leaves the room cleanly and all remote avatars are removed from the scene. Prevents leaks if React StrictMode re-mounts in dev.

## What will happen end-to-end once the Fly token lands

1. Owner moves `FLYIO_ACCESS_KEY` to GitHub Actions Secrets (instructions in the chat reply)
2. Next push to `main` that touches server paths runs `deploy-server.yml`
3. Workflow: install flyctl → create app if needed → `flyctl deploy --remote-only` → app on Fly at `bitrunners-server.fly.dev`, scale-to-zero, 256 MB / 1 shared CPU
4. The client at `bitrunners.app` already has `VITE_SERVER_URL` baked in from a Cloudflare deploy → on next load, `joinSphere(...)` tries `wss://bitrunners-server.fly.dev/`
5. Server wakes (cold start ≤ 5 s typical for Fly small machines), accepts the WebSocket, creates a sphere room
6. Owner walks; their position updates at 15 Hz to the server
7. A second device opens `bitrunners.app` → same sphere, sees the owner's bit_spekter as a ghost avatar, owner sees theirs

If anything in steps 2–4 fails, the client logs and falls back to single-player. The user-visible site stays alive.

## Build

- 33 files lint-clean
- Typecheck green across all 5 workspaces
- Web bundle: 645 kB main + 441 kB lazy Board chunk (Colyseus client ~50 kB rolled into main)
- Server build: `apps/server/dist/index.js` + the new sphere room

## Files added / changed

- `.github/workflows/deploy-server.yml` (new)
- `apps/web/src/scene.ts` — `getServerUrl`, `joinSphere`, remote avatar lifecycle, throttled send, dispose

## What's next

If the Fly deploy completes successfully:

1. Verify `bitrunners-server.fly.dev/health` returns 200
2. Open `bitrunners.app` on two devices, confirm both see each other walking
3. **Lucia magic-link auth + Neon Postgres** for accounts (Phase 2 next milestone)
4. **Aether-on-disconnect** via Upstash Redis (server snapshots position + class on `onLeave`, spawns aether NPC with TTL)
5. Stage B v0.2 normals default-on after owner confirms iPhone behavior

If the deploy fails, share the workflow run log — I'll diagnose and patch.
