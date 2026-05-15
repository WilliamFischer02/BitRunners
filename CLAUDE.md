# BitRunners — context for Claude

## What this is

Web-first multiplayer ASCII social MMO. Pre-alpha but with real production deploys. See `README.md` for the elevator pitch and the latest entry in `docs/devlog/` for state. **Active roadmap: `docs/devlog/0004-roadmap-revised.md`** — this supersedes the original outline in `0001`.

Live: `https://bitrunners.app` (Cloudflare Pages, `main` branch). Server: `https://bitrunners.fly.dev` (Fly, auto-stop). Multiplayer is live and working.

## Session continuity — read in this order at the start of every session

1. This file (`CLAUDE.md`)
2. `.claude/handoff.md` — where the previous session left off, what's blocked, what's next
3. `.claude/decisions.md` — running log of architectural calls and their reasons
4. The newest file in `docs/devlog/` (highest numbered) for current code-level state
5. `docs/devlog/0004-roadmap-revised.md` for the phase plan and exit criteria

After reading, perform the mandatory readback (see session launch prompt) before writing any code.

## Owner's communication preferences

- Blunt and candid. No flattery, no warm-up paragraphs. Senior collaborator, not yes-machine.
- Bottom line first, then tiered detail. Lead with the answer; explain underneath.
- ADHD-friendly formatting: headers, bullets, checkboxes, TL;DRs. Tight paragraphs.
- Proactively flag risks, tradeoffs, and costs. Especially costs — this is a scale-to-zero project.
- Push back when wrong. Cite specifics. Don't capitulate to social pressure.
- Cost-conscious, DIY-first. Always.
- When uncertain: say so. Don't guess at facts about the repo, services, or lore.

## Canonical lore terms

Read `docs/lore/README.md` for the glossary and index. Always use these spellings exactly:

- **the cloud** (slang) / **cloud-env.central** (technical) — the habitable world
- **Server Space** / **server-env.space** — raw substrate around the Cloud
- **bitrunner** / **runner** — player avatar
- **The Admin** — companion / shopkeeper / quest-giver NPC, *dangerous yet benevolent*
- **The Company** — corporate quest-giver, builder of hash_kicker template bodies
- **Token** — captured data scraps from Server Space; currency
- **Aether** — drifting offline-runner remnant
- **Samaritan Status** — reputation. *Corporate Samaritan* (Company) and *BitRunner Samaritan* (Admin)
- **Port / depot** — physical interactable that exposes Server Space behind it

⚠️ `docs/lore/_sealed/` contains future-event plot beats. Do **not** surface them in UI, NPC dialogue, marketing, or LLM-NPC system prompts. You may read sealed files to understand boundaries; you may not edit them or quote them in player-facing surfaces.

## Working agreement

- All work on branch `claude/ascii-overhead-game-14dir`. Pushes to `main` trigger Cloudflare Pages + Fly deploys; do not push to `main` without explicit owner confirmation in the current conversation.
- Public devlog at `docs/devlog/NNNN-title.md` — append a new entry per significant change or decision. Use the next available number.
- Before adding any new dependency, mention it in the next devlog entry (name, version, why).
- Never provision paid resources without explicit confirmation.
- Lore is developed via Q&A with the project owner. Don't invent unilaterally — ask, then record the answer in `docs/lore/`.
- Asset sourcing: prefer CC0 (Kenney.nl, Quaternius, CC0 Sketchfab). Document in `docs/assets/CREDITS.md`.

## Visual identity

- Underlying 3D scene: low-poly isometric, grayscale geometry. See `docs/references/05-lowpoly-iso-mockup.*`.
- Render pipeline: three.js scene → offscreen low-res framebuffer → ASCII post-process shader → (future) CRT/diode shader.
- Glyph atlas reference: numerals + symbols on dark, dithered. See `docs/references/02-ascii-dither-three.*`.
- UI: terminal-style menus (Caves of Qud feel). See `docs/references/03-caves-of-qud-menu.*`.
- Loading / aether transitions: glitch ASCII over black. See `docs/references/01-ascii-glitch-face.*`.
- Character scale/camera: ¾ isometric, hero ~10–15% of vertical screen. See `docs/references/04-stone-story-iso.*`.

## Architecture (current state — devlog 0028)

Monorepo on **pnpm@10.33.0 + Turborepo + Biome**, Node 22. All workspaces scaffolded and shipping.

- `apps/web` — Vite + React 18 + three.js. Built and deployed to Cloudflare Pages on every `main` push. Per-route code-splitting (Tiptap board is a lazy chunk).
- `apps/server` — Colyseus + Fastify, single Node process. Bundled with esbuild into a self-contained `dist/index.js`; runtime image is `node:22-alpine` + the bundle. Deployed to Fly on `main` pushes that touch server paths.
- `packages/shared` — `PROTOCOL_VERSION`, types/constants shared client⇄server.
- `packages/ascii` — Glyph atlas builder + ASCII ShaderPass. Stage A + Stage B v0.1 silhouette emphasis (luminance-edge — mobile-safe; depth-edge proved fragile on iOS Safari, see devlog 0008). Stage B v0.2 normal-direction glyphs gated behind `?normals=on`.
- `packages/game-core` — `TICK_HZ = 15` and (future) ECS systems.
- `functions/api/board/[slug].ts` — Cloudflare Pages Function backing the writer board, talks to KV namespace `bitrunners-board` (binding `BOARD`, namespace id `38395cc6954e4735a2b2d8fb0c37cbcc`).
- `supabase/migrations/` — auth + persistence schema. Owner runs these manually in the Supabase SQL editor.

## Networking

1 Colyseus room = 1 "sphere". Capacity: **40 humans + 10 NPCs**. Tick **15 Hz**. Matchmaker fills existing rooms to ~80% before opening new ones (avoids empty servers).

Player-state delta sync only. Movement uses client prediction + server reconciliation (lenient — no combat). Multiplayer is live as of devlog 0024 (Schema 3.x callbacks via `getStateCallbacks`).

Offline-as-aether: on disconnect, server snapshots last outfit + position and spawns a passive drifting "aether" entity. **Not yet wired to Upstash** — Phase 2 polish item.

## Classes

server_speaker, data_miner, terminal_runner, hash_kicker, web_puller, bit_spekter. **bit_spekter ships first** and is currently the only selectable class on the live build (devlog 0005). The other 5 appear in the class-select grid as locked. Class is selected at each login and persists for that session only.

Origin stories and trade-restriction lore in `docs/lore/003-classes-origins.md`. bit_spekter cannot earn tokens (no valid wallet); a "proxy wallet" unlock is planned.

The Admin makes a first-encounter appearance when the player approaches the obelisk (monolith) — shadow NPC + dialogue overlay with emoticron-keyed branching (devlog 0027). Per-session flag for now; persists per-account once auth lands.

## Moderation

- Custom 2-word emoticrons draw from a fixed ~100-word DB. Combinations are reviewed manually before unlock. No free-text input anywhere in the game.
- Profile images are gated behind an age/consent gate. Default-hidden until consent given. NSFW classifier runs as defense-in-depth.

## Cost posture

Every layer is scale-to-zero or per-request. Idle target: <$5/mo. 500-DAU target: $30–60/mo.

Currently active billable services: Cloudflare (Pages + KV — free tier), Fly.io (256 MB shared CPU, auto-stop), Neon (free tier, scale-to-zero), Upstash (free tier, per-request), Supabase (free tier — being wired). Anthropic API (for LLM NPCs) and Resend (for transactional email) arrive in Phase 3.

## Do-not-touch zones

Cross-reference: `.claude/settings.json` enforces these mechanically. Listed here for awareness:

- **`.env`, `.env.*`, anything under `**/secrets/**`, `**/*.pem`, `**/*.key`, `**/id_rsa*`, `**/credentials*`** — never read, never edit.
- **`docs/lore/_sealed/`** — read allowed (to understand the boundary); edit denied.
- **`pnpm-lock.yaml`** — don't hand-edit. Let pnpm regenerate.
- **GitHub Actions workflows in `.github/workflows/`** — edit only with explicit confirmation. Changes affect prod deploys.

## MCP / tool usage

- **Cloudflare Developer Platform MCP** is connected and is the right tool for KV, R2, D1, Workers, and Pages operations. Use it before falling back to the dashboard.
- Vercel and Webflow MCPs may appear in tool lists — **ignore them**. This stack is Cloudflare + Fly, not Vercel; Webflow is a different project entirely.
- Web search is fine for current-info questions (e.g. Fly CLI changes, Colyseus 0.16 docs). Don't search for things in the repo — read them.

## What NOT to do

- Don't push to `main` without explicit owner confirmation in the current conversation. `main` is the prod deploy branch for both Pages and Fly.
- Don't add a paid resource (new Fly machine size, paid Supabase tier, Anthropic API spend without a circuit breaker, etc.) without explicit confirmation.
- Don't surface `docs/lore/_sealed/` content in any player-facing surface, NPC dialogue, marketing copy, or LLM-NPC system prompt.
- Don't write lore unilaterally. Q&A first, then record.
- Don't add features beyond what the current phase calls for. Phase discipline matters — see `0004-roadmap-revised.md`.
- Don't reach for `DepthTexture`-equipped render targets in the ASCII pipeline. iOS Safari breaks; use plain RGBA targets (devlog 0008).
- Don't hand-edit `pnpm-lock.yaml`. Don't disable lockfile-frozen installs in CI.
- Don't deploy to Fly directly from a session shell. The GitHub Actions workflow owns deploys.
- Don't silently bump dependency versions. Devlog them.
