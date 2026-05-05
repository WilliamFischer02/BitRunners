# 0002 — Services provisioned + lore round 1

**Date:** 2026-05-05

## Services provisioned

| Service | Status | Notes |
|---|---|---|
| **Cloudflare** — domain | ✅ `bitrunners.app` acquired | DNS / Pages config to come |
| **Neon** — Postgres | ✅ project `BitRunners` created | Free tier, AWS US West 2 (Oregon). 0.25–2 CU autoscale, 0.5 GB storage, 5 GB transfer, 6 h history retention, PG 17. Connection string to be added as a Fly secret when server scaffolds. |
| **Upstash** — Redis | ✅ database `BitRunners` created | Free tier, AWS Oregon (us-west-2), Global, TLS enabled. Endpoint `holy-goldfish-115309.upstash.io:6379`. REST + TCP both available. Token to be added as a Fly secret when server scaffolds. |
| **Fly.io** | ⚠️ connected to GitHub repo, **first deploy failed (expected)** — repo has no `fly.toml` / Dockerfile / app yet. Will succeed once Phase 0 server scaffolds. |
| **Cloudflare Pages** | ⏳ not yet wired | Will configure when the web client scaffolds. |

**No secrets in this repo.** Connection strings and tokens stay in dashboards / Fly secrets / Cloudflare env until needed.

## Lore round 1 — committed

Owner answered the 8 kickoff questions. Full answers in `docs/lore/`:

- `001-the-cloud-and-server-space.md` — **two realms**: the Cloud (habitable, `cloud-env.central`) and Server Space (`server-env.space`, raw substrate). Tokens are scraps that fall from one into the other.
- `002-the-admin.md` — central NPC: **dangerous yet benevolent** code-entity, companion + shopkeeper + quest-giver, can upload itself into runner minds, covets tokens.
- `003-classes-origins.md` — origin stories for all 6 classes. **Class is selected at each login**, not locked. bit_spekter can't earn tokens (no valid wallet) — a future "proxy wallet" unlock is planned.
- `004-quests-and-samaritan-status.md` — two quest-givers (**The Company** + **The Admin**), two reputation tracks (**Corporate Samaritan** / **BitRunner Samaritan**), gradually unlocking deeper quest chains.
- `005-trade-depots-and-ports.md` — depots are **physical ports**, with a wirey Server Space backdrop visible through them. Vocabulary: pneumatic kiosks, monoliths, command terminals, vending machines. Owner referenced Wreck-It-Ralph's portals as the *concept*, not the style.
- `006-runner-lifecycle.md` — uploads create a virtual scan in Server Space; the player IRL is "plugged in" not transformed. **Logout is imposed**: the Env reclaims the runner to stay alive. The body becomes aether; logging out hurts a bit; there's a pull to return.
- `_sealed/web-pullers.md` — **future live-event plot beat**. Sealed. Not for player-facing surfaces.

### Glossary added to `CLAUDE.md`

Canonical names locked so future sessions stay consistent. See `docs/lore/README.md` for the full glossary.

### Ethics note

Lore says runners are pulled back to the Cloud when offline. Product policy: **lore color, not a retention dark pattern.** No streak-shame, no FOMO timers, no aggressive notifications. The pull is in-fiction; the actual login loop respects player time.

## References committed

All five kickoff reference images now in `docs/references/` (committed in `04e4a15` by the owner directly to the branch).

## Open questions for round 2

Bundled here for owner to skim and answer when ready:

**The Admin (`002`)**
- Visible avatar or presence-only?
- Mind-upload into runners — UI mechanic or pure flavor?
- One Admin or many instances?

**Classes (`003`)**
- Inventory carry across class swaps, or per-class loadouts?
- Class-specific quests gated to the active class on login, or persistent regardless of current class?
- bit_spekter proxy wallet unlock condition — playtime, quests, tokens spent, event?

**Quests (`004`)**
- Can a runner max both Samaritan tracks, or are they rivalrous at high tiers?
- Other quest sources beyond Company/Admin (other runners, depot keepers)?
- Endgame story-quest tying both factions together?

**Depots (`005`)**
- NPC keepers at depots, or silent interactables?
- Depot access gated by Samaritan Status with one of the factions?
- Does Server Space ever become traversable, or strictly visual?

**Lifecycle (`006`)**
- Aether TTL — does an unused runner eventually fully dissolve?
- Can other players interact with an aether (touch, harvest, decorate)?
- Reentry spawn: aether's drift position or fixed reentry point?

## What's next

Pending owner confirmations before any code:
1. **pnpm + Node 22 installed locally.** Once confirmed → I scaffold the monorepo and Stage A ASCII shader.
2. **Greenlight on tooling choices** that I'll propose as part of the scaffold devlog (Biome vs ESLint+Prettier; Vitest; GitHub Actions CI; bitecs).
3. **Lore round 2** answers when convenient — not blocking on code.
