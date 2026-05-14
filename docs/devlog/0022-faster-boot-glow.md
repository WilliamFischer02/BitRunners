# 0022 — Faster boot scroll + glow polish

**Date:** 2026-05-14

Owner liked the boot/select flow but asked for it to play faster and for a glow effect throughout. Multiplayer still not showing other players — covered in the deployment-status section below since it requires owner-side action.

## Boot timing — roughly 2× faster

`apps/web/src/Boot.tsx`:

| | Before | After |
|---|---|---|
| `CHAR_DELAY_MS` (per character) | 14 | **7** |
| `LINE_DELAY_MS` (after each line) | 80 | **35** |
| Final pause before select | 520 | **260** |
| Initial pre-boot pause | 280 | **140** |
| Per-line "dramatic" pauses | 180–820 | **90–480** |

Total boot scroll time roughly halves (≈ 5 s → ≈ 2.5 s) without losing the "no user_id detected" dramatic beat.

## Glow — three layered effects

`apps/web/src/style.css`:

### 1. Background gradient + scanline overlay

The boot screen's background is now a radial gradient from deep indigo to near-black instead of flat `#050608`. A `::before` pseudo-element overlays animated horizontal scanlines (2-pixel period, slowly drifting via `boot-scan` keyframes) — gives the cmd-panel CRT feel. A `::after` adds a soft halo of mixed green+purple emanating from upper-middle, breathing on a 3.6 s cycle (`boot-halo`).

### 2. Glowing text

Every boot text element gets a layered `text-shadow`:

- `.boot-banner` — purple glow (12 px + 22 px), pulses every 2.8 s
- `.boot-line` (all typed lines) — phosphor-green glow (8 px + 18 px)
- `.boot-line--cue` (the `> select stack ▌` prompt) — purple glow
- `.boot-caret` — strongest green glow (8 px + 18 px), blinks 0.9 s

Result: text reads as actively luminous, not flat painted.

### 3. Character-tile glow

`.boot-tile--active` (only bit_spekter is `--active`):

- Triple-layered `box-shadow`: inner ring at 0.2 alpha, outer soft 24-px glow at 0.25, inset bloom
- `tile-breathe` keyframe pulses the box-shadow between two strengths on a 2.4 s cycle
- Hover state amps everything further (30 px outer glow, 0.45 alpha)
- The tile name gets a small text glow when active

`.boot-tile--locked` got a slight desaturate (`filter: grayscale(0.4)`) so the contrast between the available bit_spekter and the locked tiles is clearer at a glance.

## Multiplayer — why you still don't see other players

Three suspects. Need you to verify each:

1. **Server probably isn't deployed.** Check `https://bitrunners.fly.dev/health` from your phone. If you get a JSON response with `"ok": true`, the server's up. If you get an error or no response, the deploy hasn't succeeded yet.

2. **`VITE_SERVER_URL` is probably still wrong in Cloudflare.** Your screenshots showed it as `wss://bitrunners-server.fly.dev/`. The actual hostname per the same screenshots is `https://bitrunners.fly.dev` — so the WebSocket URL should be **`wss://bitrunners.fly.dev/`** (no `-server`). Update it in Cloudflare Pages → Settings → Environment variables, then trigger a Pages redeploy (any commit or "Retry deployment" on the latest).

3. **`FLYIO_ACCESS_KEY` needs to live in GitHub Secrets, not Cloudflare.** Otherwise the `deploy-server` workflow can't deploy. Move it: Cloudflare delete → GitHub repo → Settings → Secrets and variables → Actions → New repository secret named `FLYIO_ACCESS_KEY`.

Once all three are correct, GitHub Actions tab → "Deploy server" → "Run workflow" on `main`. After it succeeds, two devices on `bitrunners.app` should see each other.

(I can't deploy from here — my proxy blocks outbound HTTP, and the Fly token only authenticates from your account.)

## Build

- 38 files lint-clean
- Build green
- Bundle unchanged (CSS-only + small TS constants)

## Files changed

- `apps/web/src/Boot.tsx` — timing constants
- `apps/web/src/style.css` — glow, scanline, halo, tile breathing, hover amp

## What's next

After the server is deployed:

1. Stage B v0.2 default-on once mobile is verified
2. Lucia magic-link auth + Neon Postgres for accounts (Profile panel wires to real session)
3. Aether-on-disconnect via Upstash Redis
