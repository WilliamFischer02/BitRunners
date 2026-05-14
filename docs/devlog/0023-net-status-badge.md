# 0023 — Visible net status badge for live multiplayer diagnostics

**Date:** 2026-05-14

Owner: `VITE_SERVER_URL` is now correctly `wss://bitrunners.fly.dev/` in Cloudflare (confirmed via screenshot), but still seeing one character on two devices. We're flying blind on what the client is actually doing — adding a visible status badge so the failure mode is self-evident on the live site.

## What this commit does

### Visible network status badge

`apps/web/src/scene.ts` now creates a small DOM badge bottom-center that updates as the network state changes:

| State | Text | Color | Meaning |
|---|---|---|---|
| no URL set | `net: offline · VITE_SERVER_URL unset` | grey | Pages bundle was built before env var was set; needs redeploy |
| connecting | `net: connecting · wss://...` | purple | Trying to reach the server |
| connected | `net: connected · session abc123` | green | Joined the sphere room |
| connected with others | `net: connected · N other(s)` | green | N remote players in the same sphere |
| error | `net: error · <message>` | red | Connection threw — message includes the WebSocket error |

Also logs to the browser console at boot: `[bitrunners] VITE_SERVER_URL = <value or (unset)>`. Open Safari devtools → Console to see it on an iPhone.

### Why this matters right now

When you reload `bitrunners.app` after this commit deploys, the badge will tell you exactly which of these three things is wrong:

1. **`net: offline · VITE_SERVER_URL unset`** → the JS bundle Cloudflare is serving doesn't have the env var baked in. Solution: Cloudflare Pages → Deployments → "Retry deployment" on the latest, OR push any commit to trigger a fresh build. (This commit IS that fresh build.)
2. **`net: connecting · wss://bitrunners.fly.dev/`** stuck for >5 s, then **`net: error · ...`** → server isn't reachable. Either Fly hasn't been deployed (check Actions → Deploy server logs) or the URL doesn't resolve. Visit `https://bitrunners.fly.dev/health` directly in a browser — should return JSON if up.
3. **`net: connected · ...`** but no remote players → both devices ARE connected but landing in different rooms (shouldn't happen with our setup; we have one named room). Open devtools on both, check console — they should log the same `joined sphere as <sessionId>` pattern.

### Forced Pages redeploy

This commit's existence triggers Cloudflare Pages to redeploy `main`, which rebuilds the bundle with the current `VITE_SERVER_URL` value. After it finishes, refresh `bitrunners.app` and the badge will tell us what's happening.

## On deploying main

Confirming the routing as you asked:

- **Cloudflare Pages** production branch is `main` — every merge to main triggers a Pages deploy of `apps/web`. Confirmed by every "Cloudflare Pages" check on each PR.
- **GitHub Actions `Deploy server` workflow** triggers on pushes to `main` that touch server paths. Reads `FLYIO_ACCESS_KEY` from GitHub Secrets. Deploys to Fly app `bitrunners` via `flyctl deploy --remote-only --strategy immediate`.

Both wire from `main` already. The only operator step left is verifying `FLYIO_ACCESS_KEY` actually exists in GitHub Secrets (not Cloudflare).

## Build

- 38 files lint-clean
- Build green
- Bundle unchanged

## Files changed

- `apps/web/src/scene.ts` — net status DOM element + state setter, console.info of the server URL, hooked into connect / join / leave / error paths
- `apps/web/src/style.css` — `.net-status` styles with `data-kind` variants

## Step-by-step diagnostic

After this commit's Pages deploy finishes (1–2 min), reload `bitrunners.app` and tell me which state appears at the bottom of the screen:

- **"VITE_SERVER_URL unset"** → tell me; I'll add a server-side echo for diagnostics
- **"connecting" → "error: ..."** → paste the error text, I'll fix the deploy
- **"connected" but only one character** → open devtools on both phones, share the `joined sphere as` lines

If you see **"connected · N others"** on one phone but the other phone shows **"connected · 0 others"**, that's a Colyseus matchmaker issue (different rooms) and I'll fix server-side.
