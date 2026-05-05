# 0004 — Revised roadmap (Phase 0 → public alpha)

**Date:** 2026-05-05

The original 4-phase outline in `0001-kickoff.md` was sketched before lore round 1, before services were provisioned, and before any code existed. With Phase 0 complete (commit `75c8f73`), lore round 1 in the books, and services live, this entry replaces it with an executable roadmap.

Owner decisions captured in this round (ahead of writing the plan):

- **Mobile is a first-class test target from Phase 1.**
- **First public deploy at end of Phase 1.** Cube-on-the-internet is unnecessary; walkable scene is the right reveal moment.
- **Owner edits a kit draft I propose for terminal_runner.** Not co-design Q&A.
- **LLM NPC dialogue ships in Phase 3 behind a feature flag**, not Phase 4.

## Strategic principles

1. **Stage A is the visual MVP fallback.** Stages B and C are upgrades. If either stalls, ship A and keep gameplay velocity.
2. **Every phase ends in a demo someone can play.** No phase produces only infrastructure.
3. **Mobile is tested every phase from Phase 1.** A failing mobile probe is a release blocker.
4. **Deploy early, scale-to-zero.** First public deploy at end of Phase 1, before there are users — so we hit Pages/Fly cold-start gotchas while the surface is small.
5. **Schema reservations beat schema migrations.** Phase 2's persistence model accommodates Phase 3+ additions (samaritan meters, faction shifts, aether TTL) without breaking changes.
6. **Lore drives names, not features.** Add a feature when gameplay needs it; reach for the lore book to name and dress it.
7. **LLM NPCs are a feature, not a foundation.** Behind a flag from day one, instrumented for cost, killable.

## Risk register

| # | Risk | Likelihood | Impact | Validated by |
|---|---|---|---|---|
| R1 | ASCII shader at <30 fps on mid-tier Android | Med | High (gates mobile-first MVP) | Phase 1 mobile probe |
| R2 | Colyseus on Fly cold-start UX is bad (>5 s to enter sphere) | Med | High (first impression) | Phase 1 deploy of empty Fly app; Phase 2 with real room |
| R3 | LLM NPC dialogue cost or latency unworkable at 500-DAU | Med | Med (feature-killable) | Phase 3 flagged rollout, instrument tokens/$ |
| R4 | Custom 2-word emoticron review queue overwhelms manual reviewers | Low (early), Med (later) | Med | Phase 3 admin tool; metrics in Phase 4 |
| R5 | Visual coherence breaks across Stage A → B → C composition | Med | High (rework) | Hold Stage A look as ground truth; A/B against reference image 02 every stage |
| R6 | Auth/persistence schema needs breaking change in Phase 3 | Med | Med | Phase 2 schema review; reserve faction/samaritan/aether columns up front |
| R7 | Bundle size on mobile network (currently 624 KB) | Low | Low–Med | Code-split three.js + lazy-load class kits in Phase 4 |
| R8 | Domain / email deliverability for magic-link auth | Low | Med | Phase 2: configure SPF/DKIM on `bitrunners.app` |

## Workstream taxonomy

Five tracks progressing in parallel through the phases. Each item below is tagged with its track.

- **VIS** — visual pipeline (shader stages, glyph atlas, camera)
- **SIM** — gameplay simulation (movement, world, tokens, quests, classes)
- **NET** — networking (Colyseus rooms, prediction, auth, persistence)
- **UX** — UI surfaces (terminal menus, emoticron wheel, depots, mobile input)
- **OPS** — services, deploy, observability, cost guardrails

---

## Phase 1 — The walkable cloud (single-player) · ~2–3 weeks

**Goal:** A hero you can walk around an isometric scene styled like the references. Mobile-playable. Live at `bitrunners.app`.

**End-of-phase demo:** Visit `https://bitrunners.app` on a phone or desktop. See an isometric platform with a port prop in the corner. Walk a hero around with WASD / virtual joystick / gamepad. Watch glyph density shift with depth and lighting.

### Workstreams

**VIS — Stage B shader + scene composition**
- Replace cube with iso platform geometry + hero capsule (`apps/web/src/scene.ts`)
- Hero ~10–15 % of vertical screen; ¾ iso camera with follow + deadzone
- Stage B: depth + normal aware glyph density (denser in shadow, sparser in highlight). Extend `packages/ascii/src/ascii-pass.ts` with depth + normal sampling.
- Glyph atlas v2: numerals + symbols ramp matching reference image `02-ascii-dither-three`, curated density ordering
- Hold Stage A as fallback render path behind `?stage=a` for A/B and emergency rollback

**SIM — minimal world + controls**
- `packages/game-core`: input abstraction (keyboard, touch, gamepad → unified `MoveIntent`)
- Movement system (deterministic; will move to server in Phase 2)
- Static world: one platform, one port prop (visual only)
- One asset sourced CC0 (Kenney isometric); credited in `docs/assets/CREDITS.md`

**UX — input layer**
- Virtual joystick + radial slot for future emoticron wheel (placeholder)
- Keyboard help overlay (`?` toggles)
- Loading state: glitch ASCII over black, references image `01-ascii-glitch-face`

**OPS — first public deploy**
- `apps/web` → Cloudflare Pages, custom domain `bitrunners.app`
- `apps/server` minimal Fastify health-check + `Dockerfile` + `fly.toml` (no Colyseus yet, just `/health` returning 200) — deploy-pipeline rehearsal, scale-to-zero verified
- GitHub Actions: deploy step on push to `main` (manual promotion from claude branch via PR)
- Mobile probe script: open `bitrunners.app` on a real Android, capture FPS via Performance API for 30 s, log to console; record device + result in devlog. **Kill criterion: <20 fps median.**

### Service activations

| Service | New status |
|---|---|
| Cloudflare Pages | wired to repo, `bitrunners.app` resolves |
| Cloudflare DNS | A/CNAME for apex + www |
| Fly.io | empty health-check Node app, scale-to-zero verified |

### Exit criteria

- [ ] `pnpm build` green; bundle reported in devlog
- [ ] `bitrunners.app` loads on desktop Chrome and a real Android in <3 s on warm cache
- [ ] Mobile probe ≥30 fps median (target) or ≥20 fps (acceptable; plan B: lower default cell size)
- [ ] Stage A reachable at `?stage=a`; default route runs Stage B
- [ ] Devlog `0005` (or whatever the next number is) written with screenshots + mobile probe numbers

---

## Phase 2 — Hello, network · ~2–3 weeks

**Goal:** Two strangers in the same sphere, walking, gesturing, leaving aether when they log off.

**End-of-phase demo:** Owner opens `bitrunners.app` on laptop, friend opens it on a phone. Both sign in with email magic link. Both arrive in the same sphere; see each other walk. Each sends a fixed emoticron that the other sees floating above their hero. Friend closes tab; their hero dissolves into a drifting aether visible to the owner for the configured TTL.

### Workstreams

**NET — Colyseus + auth + persistence**
- `apps/server` real deps: `colyseus@0.16`, `fastify@5`, `@fastify/static`, `@upstash/redis`, `kysely` + `pg` for Neon, `lucia@4` for auth
- One sphere room, capacity 40 + 10, 15 Hz tick (per `CLAUDE.md`)
- Player state schema: position, rotation, class, outfit slots, current emoticron. **Reserve fields**: `samaritanCorporate`, `samaritanBitRunner`, `factionState` (web_puller cataclysm), `wallet`
- Client prediction + server reconciliation (lenient — no combat)
- Lucia email magic-link auth → Neon (users, sessions tables)
- SPF/DKIM on `bitrunners.app` for transactional email
- Aether-on-disconnect: snapshot to Upstash with TTL (default 10 min, configurable). Aether NPC entity rendered on other clients during TTL.

**SIM — basic interactions**
- Fixed 8-emoticron palette (no custom unlock yet) — words from a hard-coded ~50-word seed list
- Server-authoritative movement; client predicts

**UX — multiplayer surfaces**
- Login flow: email entry → magic link → sphere
- Other-runner name labels (terminal-style chip above hero)
- Emoticron ping (8-button radial menu, floating-above-hero animation)

**OPS — costs + observability**
- Fly autoscaler: min 0, max 1 (single sphere capacity)
- Upstash + Neon connection strings as Fly secrets
- Per-request cost dashboard: Neon CU-h, Upstash command count, Fly machine-hours. Logged weekly.

### Service activations

| Service | New status |
|---|---|
| Neon (Postgres) | users + sessions schema deployed |
| Upstash (Redis) | aether TTL store live |
| Fly.io | runs Colyseus, scale-to-zero between sessions |
| Email (Resend or Postmark — decided in next devlog) | magic-link delivery |

### Exit criteria

- [ ] Two distinct accounts in the same sphere
- [ ] Disconnect spawns aether visible to other clients for the configured TTL
- [ ] Magic-link auth reaches inbox in <10 s; SPF/DKIM aligned
- [ ] Cold-start: `bitrunners.app` cold to in-sphere ≤8 s on Fly auto-wake (target ≤5 s; acceptable ≤10 s)
- [ ] Cost log: idle 24-h costs <$0.20

---

## Phase 3 — Currency and conversation · ~3 weeks

**Goal:** A complete play loop. Earn tokens, trade at a depot, run quests for The Admin and The Company, unlock a custom emoticron. terminal_runner kit playable. The Admin holds flagged LLM conversation.

**End-of-phase demo:** Log in as terminal_runner. Walk to a port; harvest a stray token. Talk to The Admin (LLM-on); receive a quest like "deliver this packet to the monolith". Complete it; gain BitRunner Samaritan rep. Open emoticron menu; submit a 2-word combo for review; refresh later and it's in your unlocked list.

### Workstreams

**SIM — economy + classes + quests**
- Token entities spawn on Cloud surface (server-driven, light density)
- Wallet on player; depot trade UI accepts/dispenses tokens for outfit pieces
- terminal_runner kit (drafted in Appendix A; owner to redline)
- Class select on login: terminal_runner only available; other 5 greyed with lore tooltip from `003-classes-origins.md`
- Web Puller class state field set up but unselectable
- The Company NPC (3 starter quests, scripted text)
- The Admin menu NPC (always-available from any view)
- Samaritan Status meters (two tracks; scripted award on quest completion)

**UX — terminal menus + emoticron pipeline**
- Caves-of-Qud-style terminal menu skin (reference `03-caves-of-qud-menu`)
- Inventory tab; quest log tab (Company / Admin sub-tabs)
- Custom 2-word emoticron submission: pick word A, word B from the ~100-word DB; submit for review
- Admin moderation tool at `/admin`, gated to a hard-coded operator-email allowlist initially: queue of pending combos, approve/reject/comment
- Profile page: name, class history, samaritan meters. Profile pic upload **disabled by default**; age-and-consent gate to enable viewing others'.

**NET — LLM Admin (feature-flagged)**
- Anthropic SDK on the server. Model: `claude-haiku-4-5-20251001`
- Prompt-cached system prompt defining The Admin's voice (terse, technical, dangerous-yet-benevolent) and game-state context
- Per-player rate limit (e.g. 20 messages/hour) + global cost circuit breaker that kills the flag if daily $ exceeds a threshold
- ⚠️ Admin's system prompt **must not reference `_sealed/`**. CI lint that fails if any prompt template contains the string `web_puller` outside an allowlist.

**OPS — content + cost**
- Anthropic API key in Fly secrets
- R2 bucket for profile picture storage; signed URLs only
- NSFW classifier (defense-in-depth, server-side on upload — open-source model; deferable to Phase 4 if it bites)
- Cost dashboard adds Anthropic spend; weekly devlog

### Service activations

| Service | New status |
|---|---|
| Anthropic API | Claude Haiku 4.5, flag-gated, prompt-cached |
| Cloudflare R2 | profile-pic bucket; CORS configured |
| Email | also handles emoticron-approved notifications |

### Exit criteria

- [ ] One full loop completable: login → harvest → quest → reward → trade → unlock
- [ ] LLM Admin flag works in both states (on = real responses; off = scripted fallback identical UX)
- [ ] LLM cost circuit breaker test passes (artificially set threshold low; verify auto-disable + alert)
- [ ] Emoticron review queue tooling works end-to-end with at least one real submission
- [ ] CI prompt-leak lint passes (no sealed lore in prompt templates)

---

## Phase 4 — The full cosmology · ~3 weeks

**Goal:** Open alpha-ready. All 6 classes selectable (kits at varying maturity). Depot interaction variety. Stage C visual polish. Mobile + gamepad polished. Observability complete.

**End-of-phase demo:** Polished alpha. Pick any of 6 classes on login. Encounter all 4 depot variants (kiosk, monolith, terminal, vending) with at least one functional interaction each. CRT/diode shader on. Audio. Gamepad fully mapped. Public alpha link shareable.

### Workstreams

**SIM — class breadth + depot variety**
- Other 5 class kits at MVP fidelity (1 signature ability each)
- bit_spekter trade restriction in UI with lore tooltip; "proxy wallet" stub (locked) shown
- 4 depot interaction types (kiosk = trade, monolith = quest pickup, terminal = social, vending = consumables)
- Aether interactability: other players can leave a "decoration" mark on an aether (no harvesting; lore-vague)

**VIS — Stage C + audio**
- Stage C CRT/diode pass: scanlines, slot mask, light barrel distortion, soft bloom. Toggleable.
- Audio: ambient cloud hum (loop), UI pings, emoticron stings, footstep loop. Web Audio API. CC0, credited.

**UX — polish**
- Gamepad full mapping (movement, emoticron radial, menu navigation)
- Mobile haptics on emoticron send + token harvest
- Profile picture upload + age/consent gate functional with NSFW classifier
- Onboarding: first-login walks through controls + lore intro (gentle — see ethics note in `006`)

**OPS — observability + readiness**
- Structured logs shipped to a sink (Cloudflare Logpush or Fly's built-in)
- Error reporting (Sentry free tier or simple Worker aggregator)
- Status page (static, hand-updated to start)
- Public alpha announcement copy drafted
- Backup/restore drill: take Neon snapshot, restore to a branch, verify

### Exit criteria

- [ ] All 6 classes selectable; ≥1 ability each
- [ ] Stage C togglable; default on for desktop, off for low-end mobile (decided by FPS probe)
- [ ] Mobile + gamepad: full control parity with keyboard
- [ ] Ops: 24-h soak with synthetic load shows costs in budget and no crash
- [ ] Public alpha link goes out to invitees

---

## Service activation timeline (consolidated)

| Phase | Services going live |
|---|---|
| 0 ✅ | (none — local dev) |
| 1 | Cloudflare Pages, Cloudflare DNS apex, Fly.io (empty health-check) |
| 2 | Neon, Upstash, Fly.io (real Colyseus), Email (magic links) |
| 3 | Anthropic API (flagged), Cloudflare R2 |
| 4 | Logging sink, error reporting, status page |

## Parallelizable work (any phase)

These have no critical-path dependency:

- **Lore Q&A rounds** (next: round 2 questions in `0002`)
- **Asset sourcing** (CC0 from Kenney / Quaternius for hero, port props, depot variants)
- **Reference-image-driven shader tuning** (compare every stage's output to `02-ascii-dither-three`)
- **Devlog hygiene** (one entry per significant change)

## Open design questions (deferred — not blocking)

Carried from `0002`'s round-2 list, plus new ones surfaced here:

1. The Admin: avatar form, mind-upload UI mechanic, single-vs-many instances
2. Inventory: per-account or per-class loadout slots
3. bit_spekter: proxy-wallet unlock condition
4. Samaritan tracks: rivalrous at high tiers or independent forever
5. Depot keepers: NPC or silent
6. Aether: TTL value; can other players interact
7. Reentry spawn: aether-position vs fixed point
8. **NEW**: terminal_runner kit specifics (drafted below; owner to redline in Phase 3)
9. **NEW**: emoticron word DB content (to draft when Phase 3 starts)
10. **NEW**: pricing for token-pack / subscription tiers
11. **NEW**: which email provider (Resend vs Postmark) — decide before Phase 2 starts

---

## Appendix A — terminal_runner kit (draft, owner to redline in Phase 3)

> *Lore reminder: terminal_runners are personified clusters of data — semi-sentient strands that finished their own sentience construction. Origin: same substrate as tokens, just larger.*

**Theme:** the runner *is* the substrate. Their advantage is fluency with the medium itself — they pull, fork, and stream where others walk and grab.

**Stat baseline:** standard move speed, standard token harvest rate. No class-specific damage stat (no combat in MVP).

**Signature abilities (Phase 3 MVP — pick 2):**

1. **Stream-fork** *(active, ~3 s cooldown)* — short blink/dash 3 m in input direction; leaves a fading glyph trail at origin for 1 s. Movement utility + visual signature.
2. **Chunk-pull** *(active, ~2 s cooldown)* — interact with a token from up to 2 m away rather than touching. Quality-of-life + lore-flavored.
3. **Stream-stitch** *(passive)* — tokens in a terminal_runner's wallet age 50 % slower *if* a token-decay system exists. (Decay system is itself open; stitch is nice-to-have.)

**Aesthetic:**
- 20 % higher glyph density than baseline runners (in Stage B)
- Faint scanline halo in Stage C
- Default outfit: simple dark capsule with a numeric-glyph chest emblem

**Restrictions / interactions:**
- No special token-earning bonus (lore: terminal_runners aren't *more* compatible with tokens, they're just better at handling them)
- Standard Samaritan-track access

**Ship in Phase 3 with:** Stream-fork + Chunk-pull + the visual treatment. Stream-stitch deferred until decay system is real.
