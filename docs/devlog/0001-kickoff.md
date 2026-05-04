# 0001 — Project kickoff

**Date:** 2026-05-04

## Decisions locked

- **Stack**: TypeScript monorepo (pnpm + Turborepo). Vite + React + three.js client. Colyseus + Fastify server. Lucia auth. Neon Postgres. Upstash Redis. Cloudflare Pages + R2. Fly.io game servers.
- **Sphere = Colyseus room**. Capacity 40 humans + 10 NPCs. 15 Hz tick. Matchmaker fills before opening new rooms.
- **Visual pipeline**: 3D scene → ASCII post-process → CRT/diode pass. Three-stage prototyping plan (Stage A: single-pass ASCII; Stage B: depth layers; Stage C: CRT/diode effect).
- **6 classes**: terminal_runner ships first, others gated.
- **Custom emoticron words**: ~100-word fixed dictionary. 8 base emoticrons + unlockables. Combinations manually reviewed. No free-text input.
- **Profile images**: age/consent gate before viewing other users'. NSFW classifier as defense-in-depth.
- **Mobile + desktop**: both first-class at MVP. Touch (virtual joystick + radial wheel), keyboard, gamepad.
- **LLM NPCs**: interface stubbed Phase 2, wired to Claude Haiku 4.5 in Phase 4.
- **Cost posture**: scale-to-zero throughout. Idle <$5/mo, 500-DAU $30–60/mo.
- **Account model**: no guest accounts. Email required.
- **Monetization**: token packs + monthly subscription. Outfit purchases later.

## Pending user actions

- Install Node 22 LTS + pnpm locally
- Sign up: Cloudflare (already), Neon, Upstash, Fly.io
- Register domain via Cloudflare
- Commit reference images to `docs/references/`
- Answer lore Q&A round 1 (see this devlog entry's "Lore questions" section, or the next devlog if moved)

## Roadmap summary

| Phase | Weeks | Deliverable |
|---|---|---|
| 0 | 1 | Monorepo, CI, Stage A ASCII shader on a hello cube |
| 1 | 2–3 | Single-player walkable sphere, depth layers, emoticron wheel UI, basic outfits |
| 2 | 4–5 | Multiplayer, accounts, profiles, NPC fillers |
| 3 | 6–7 | Tokens, inventory, words, quests, custom 2-word emoticrons, terminal_runner full |
| 4 | 8–10 | Other 5 classes, trade depots, offline-aether, CRT shader, audio, mobile polish |

## Repo state at end of entry

- `.claude/settings.json` — allowlist for routine commands
- `.gitignore`, `README.md`, `CLAUDE.md`
- `docs/devlog/`, `docs/references/`, `docs/lore/`, `docs/assets/` directories with READMEs

No code dependencies installed yet.
