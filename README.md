# BitRunners

Open-world multiplayer ASCII social MMO. Web-first, mobile-friendly, controller-compatible.

In the universe of BitRunners, players are digital consciousnesses ("runners") manifested into the cloud-env.central — temporary code-bodies that explore, socialize, and trade. When you log off, your runner dissolves into the ambient aether that powers the world for everyone still online.

## Status

Pre-alpha. Architecture and prototyping phase. See `docs/devlog/` for progress.

## Stack

- **Client**: TypeScript, Vite, React, three.js, custom ASCII shader pipeline, bitecs
- **Server**: Node 22, Colyseus (rooms = "spheres"), Fastify (REST)
- **Auth**: Lucia
- **Data**: PostgreSQL (Neon, scale-to-zero), Redis (Upstash, per-request)
- **Storage**: Cloudflare R2 (no egress fees)
- **Hosting**: Cloudflare Pages (client), Fly.io (game servers, auto-stop when empty)

## Repo layout

```
.claude/             Claude Code config (allowlist)
docs/
  devlog/            Public dev log; one entry per significant change
  references/        Visual reference images
  lore/              Lore Q&A notebook
  assets/            Asset credits + sourcing notes
apps/                (scaffolded later) web client + game server
packages/            (scaffolded later) shared types, ascii pipeline, game-core
```

## Branch

All work on `claude/ascii-overhead-game-14dir`.
