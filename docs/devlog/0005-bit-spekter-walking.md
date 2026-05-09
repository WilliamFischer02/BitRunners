# 0005 — bit_spekter walks; first deploy

**Date:** 2026-05-06

## Pivot: bit_spekter is the first kit

Owner provided a character design for **bit_spekter** (helmeted, plated, blocky silhouette with a cross-mark visor) along with a hand-rendered ASCII portrait that sets the visual fidelity bar. The roadmap previously had **terminal_runner** shipping first; that swaps to **bit_spekter**, which gives Phase 1 a concrete visual identity to drive the shader work.

Lore implication: bit_spekter "has no valid token wallet" until a future "proxy wallet" unlock. In Phase 1 there is no economy, so this restriction does not surface yet — we'll handle it visibly when tokens land in Phase 3.

Updated:

- `CLAUDE.md` — bit_spekter ships first
- `docs/lore/003-classes-origins.md` — moved the *(ships first)* tag and added an art-direction note pointing future shader work at extended Unicode block characters

## What's playable

- A humanoid bit_spekter (head + visor + chest plate + arms/legs/boots, all primitive geometry) walks on a 19×19 platform
- Camera follows from a fixed ¾-iso offset (7, 9, 7) at 38° FOV
- A "port" prop sits in the corner — visual stub for the future depot/Server-Space portal
- Subtle floor grid lines for spatial reference

Glyph atlas defaults updated to a Unicode shading ramp: `' ·.:-=+*#░▒▓█'`. Cell size shrunk from 8 → 7 px to push more glyphs onto the character. Tint shifted from phosphor green to a cooler warm-grey to match the reference.

## Input

`apps/web/src/input.ts` exposes a unified `MoveIntent { x, y }`:

- **Keyboard**: arrow keys + WASD
- **Touch / mouse**: an on-screen D-pad (4 buttons, ▲▼◀▶) overlaid bottom-left; works for mobile and desktop click-and-drag testing
- Diagonal inputs normalized to unit length

Movement is **camera-relative**: pressing UP moves the character "into the screen" regardless of where the world axes happen to point. Computed each frame by projecting `camera→player` onto the XZ plane (forward) and crossing with world up (right).

D-pad CSS:
- 168 px square, opacity 0.55 on touch / 0.3 on desktop
- `dvh` units used for height so iOS Safari URL bar doesn't clip the canvas
- `touch-action: none` everywhere to suppress scroll/pinch on the canvas

## Build status

- 28 files checked, 0 lint errors
- Typecheck green across all 5 workspaces
- `apps/web/dist`: 629.62 kB JS / 169.41 kB gzipped (cube was 624.60 kB; +5 kB for input + character primitives)

## Deploy: Cloudflare Pages on `main` → `bitrunners.app`

Owner is wiring the GitHub → Cloudflare Pages integration with `main` as the production branch. **At the end of this devlog's commit, we merge `claude/ascii-overhead-game-14dir` → `main` to trigger the first deploy.**

### Cloudflare Pages settings

| Setting | Value |
|---|---|
| Framework preset | None |
| Build command | `pnpm install --frozen-lockfile && pnpm --filter @bitrunners/web build` |
| Build output directory | `apps/web/dist` |
| Root directory | `/` |
| Production branch | `main` |
| Environment variables | `NODE_VERSION=22`, `PNPM_VERSION=10.33.0` |

### SPA fallback

Added `apps/web/public/_redirects` with `/*  /index.html  200` so client-side routes (when we add them) don't 404 on Pages.

### Why no Fly yet

Phase 1 is single-player. No server runtime needed until Phase 2. Fly.io's earlier failed deploy is still expected and harmless.

## Service connections — what's needed now vs. later

Owner asked for step-by-step on connecting MCP / API access. Status:

| Service | Phase 1 need? | Action now | When needed |
|---|---|---|---|
| **GitHub** | Indirect | None — I have GitHub MCP access scoped to `WilliamFischer02/bitrunners` | Already wired |
| **Cloudflare Pages** | ✅ | Owner: configure Pages in dashboard with the table above. No MCP path for this — Pages config is dashboard-only. | Now |
| **Cloudflare DNS** | ✅ | Pages will offer to add `bitrunners.app` as a custom domain — accept; CF will handle the apex CNAME-flattening | Now |
| **Cloudflare R2** | ❌ | I have MCP tools (`r2_bucket_*`); we'll create the profile-pic bucket in Phase 3 | Phase 3 |
| **Neon Postgres** | ❌ | No MCP. When Phase 2 starts, owner copies the connection string from the Neon dashboard → Fly secret | Phase 2 |
| **Upstash Redis** | ❌ | No MCP. Same pattern: REST URL + token → Fly secret | Phase 2 |
| **Fly.io** | ❌ | No MCP. Owner provides API token when we have a real server to deploy | Phase 2 |
| **Anthropic API** | ❌ | No MCP. Owner provides API key as a Fly secret | Phase 3 |

For Phase 1, the only thing the owner needs to wire is **Cloudflare Pages**. I'll handle the rest as MCP tool calls when those services come online.

## Visual quality vs. reference image

The reference ASCII portrait the owner attached is far denser than what Stage A produces — the reference uses ~600+ glyphs vertically across the figure, with edge-aware character selection (block elements for fills, half-blocks for edges, box-drawing for outlines). Stage A samples scene luminance per cell only, so it lacks edge awareness and uses a simple density ramp.

**Plan:** Stage A's job is "shippable visual identity." Stage B (next devlog) introduces depth + normal sampling, which lets us pick *directional* glyphs (half-blocks, box-drawing) at silhouettes. That's where the Unicode block characters earn their keep.

For now, Stage A bit_spekter is recognizable as a blocky armored humanoid with a helmet — which is the goal of this iteration. Visual fidelity climbs in Stage B and Stage C.

## What's next (Phase 1 continued)

After owner confirms `bitrunners.app` is live and the character moves correctly:

1. **Stage B shader**: depth + normal aware glyph density and edge characters
2. **Glyph atlas v2**: full extended-Unicode ramp keyed by depth/normal, not just luminance
3. **Mobile FPS probe**: real-device test with the kill criterion from `0004`
4. **Visual tuning round**: side-by-side with the owner's reference ASCII portrait

Open question for owner once the page loads: at the chosen camera distance, does the character render at the right scale? If too small, push camera in (decrease offset magnitude); if too large, pull back. Easy knob to twist.
