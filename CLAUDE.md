# BitRunners — context for Claude

## What this is

Web-first multiplayer ASCII social MMO. See `README.md` and the latest entry in `docs/devlog/` for current state. **Active roadmap: `docs/devlog/0004-roadmap-revised.md`** — this supersedes the original outline in `0001`.

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

⚠️ `docs/lore/_sealed/` contains future-event plot beats. Do **not** surface them in UI, NPC dialogue, marketing, or LLM-NPC system prompts.

## Working agreement

- All work on branch `claude/ascii-overhead-game-14dir`.
- Public devlog at `docs/devlog/NNNN-title.md` — append a new entry per significant change or decision.
- Before adding any new dependency, mention it in the next devlog entry (name, version, why).
- Never provision paid resources without explicit confirmation.
- Lore is developed via Q&A with the project owner. Don't invent unilaterally — ask, then record the answer in `docs/lore/`.
- Asset sourcing: prefer CC0 (Kenney.nl, Quaternius, CC0 Sketchfab). Always document in `docs/assets/CREDITS.md`.

## Visual identity

- Underlying 3D scene: low-poly isometric, grayscale geometry. See `docs/references/05-lowpoly-iso-mockup.*`.
- Render pipeline: three.js scene → offscreen low-res framebuffer → ASCII post-process shader → CRT/diode shader.
- Glyph atlas reference: numerals + symbols on dark, dithered. See `docs/references/02-ascii-dither-three.*`.
- UI: terminal-style menus (Caves of Qud feel). See `docs/references/03-caves-of-qud-menu.*`.
- Loading / aether transitions: glitch ASCII over black. See `docs/references/01-ascii-glitch-face.*`.
- Character scale/camera: ¾ isometric, hero ~10–15% of vertical screen. See `docs/references/04-stone-story-iso.*`.

## Architecture

Monorepo (pnpm + Turborepo). Not scaffolded yet (waiting on user to install pnpm and provision services).

- `apps/web` — Vite + React + three.js client
- `apps/server` — Colyseus + Fastify (single Node process)
- `packages/shared` — types, game constants, Colyseus state schemas
- `packages/ascii` — shader pipeline + glyph atlas builder
- `packages/game-core` — ECS systems and deterministic sim helpers

## Networking

1 Colyseus room = 1 "sphere". Capacity: **40 humans + 10 NPCs**. Tick **15 Hz**. Matchmaker fills existing rooms to ~80% before opening new ones (avoids empty servers).

Player-state delta sync only. Movement uses client prediction + server reconciliation (lenient — no combat).

Offline-as-aether: on disconnect, server snapshots last outfit + position and spawns a passive drifting "aether" entity that decorates the world. Stored in Redis with TTL.

## Classes

server_speaker, data_miner, terminal_runner, hash_kicker, web_puller, bit_spekter. **bit_spekter ships first** (kit + character design driving Phase 1 visual identity); other 5 gated. Class is selected at each login and persists for that session only.

Origin stories and trade-restriction lore in `docs/lore/003-classes-origins.md`. Note: bit_spekter cannot earn tokens (no valid wallet); a "proxy wallet" unlock is planned.

See `docs/devlog/` for current class kit specs.

## Moderation

- Custom 2-word emoticrons draw from a fixed ~100-word DB. Combinations are reviewed manually before unlock. No free-text input anywhere in the game.
- Profile images are gated behind an age/consent gate. Default-hidden until consent given. NSFW classifier runs as defense-in-depth.

## Cost posture

Every layer is scale-to-zero or per-request. Idle target: <$5/mo. 500-DAU target: $30–60/mo.

## What NOT to do

- Don't scaffold the monorepo or run `pnpm install` until the user confirms pnpm is installed locally.
- Don't deploy anything until the user confirms each service signup is done.
- Don't write lore unilaterally.
- Don't add features beyond what the current phase calls for.
