# Handoff — 2026-05-28, Phase 2 (class identity + pets) DONE

## The plan (7 phases, owner-approved + expanded)

Phased draft PRs, one per workstream, off latest `main`:

| # | Phase | Status |
|---|---|---|
| 1 | Render polish (fog, ordered dither, CRT) | **MERGED — PR #54** |
| 2 | **Class identity + pet behaviours + clothing** | **DONE — this PR** |
| 3 | 2× world + obstacle collision + AI dwellers (render `npc:*`) | queued (next) |
| 4 | Tutorial highlighting + account CTA | queued |
| 5 | Tap-to-lock camera + glow | queued |
| 6 | Emoticron compose → review → library + wheel editor | queued |
| 7 | Optimisation sweep (geometry/material sharing, LOD, draw-call merge, quality flag) | queued |

Owner decisions locked: render = tasteful/in-budget; emoticrons = compose→review→
library; extra wheel slots = earned via play; delivery = phased PRs. New since
Phase 1: per-class visual identity grounded in `docs/lore/003-classes-origins.md`,
per-pet movement behaviours, optimisation as both cross-cutting and a dedicated
final phase.

## Phase 2 — what I did (devlog 0056)

- **`apps/web/src/class-rigs.ts`** (new): six per-class builders + shared limb
  geometries + `ClassRig`/`SkinTarget`/`ClassId` types + `buildClassRig()` router
  + `isValidClass()`. All six share the identical skeleton so the existing tick
  animation drives them all unchanged.
- **`apps/web/src/pets.ts`** (new): `petGeometryFor()` migrated; new
  `applyPetBehaviour()` with six distinct motion patterns + a safe default.
- **`apps/web/src/scene.ts`**: imports the new modules; removes the migrated
  code; adds a `REMOTE_LOOKS` table → `buildRemoteAvatar(className)` swaps the
  remote palette per class; `?class=NAME` debug override; aberration `0.4 → 0.13`
  (owner feedback on PR #54).
- Clothing reads different per class **for free** — distinct per-class base
  armour materials → palette overlays naturally inherit different undertones.

### Class visual signatures (canon-grounded)

- **bit_spekter** — heavy plate, crosshair visor, white/grey *(baseline)*
- **server_speaker** — tall slim, comm-ring head, robe-skirt, bluish-white + gold
- **data_miner** — hunched stocky, backpack, orange jumpsuit tag + ankle bands, drab green/grey
- **terminal_runner** — octahedral head, orbiting cube shards, purple/teal with strong emissive
- **hash_kicker** — industrial single-strip visor, Company-orange brand stripe, chrome
- **web_puller** — flat halo, cape panel, dark purple/black with gold accents

## State of the build

- **prod `main`** at `f94aec9` (PR #54 merged). Migration **0006 still pending**
  (the SQL was handed to the owner — closes the privilege-escalation hole).
- **This branch** `claude/class-identity-and-pets` is off latest `main`.
- **CI/gates:** green — `pnpm lint` clean (54 files), `pnpm typecheck` 8/8,
  `pnpm build` 5/5.

## What's blocking / not verified

- **Not verifiable headless.** Each class's silhouette + each pet's motion
  needs a browser. Use `?class=server_speaker` / `?class=data_miner` /
  `?class=terminal_runner` / `?class=hash_kicker` / `?class=web_puller` (and
  default for `bit_spekter`). Pets need an equipped pet (SAMM prize or shop).
- **Migration 0006** still pending (owner action).

## What I would do next, in priority order

1. **Owner:** review Phase 2 PR — eyeball each class via `?class=…`. Tune palettes
   if needed (per-class palette constants in `class-rigs.ts` are the dial).
2. **Owner:** run migration 0006 (still pending).
3. **Phase 3** — 2× world + obstacle collision + render `npc:*` dwellers as
   robot/husk/spirit. Separate branch off latest `main`.

## Do NOT do these things

- Don't push to `main` — prod branch; deploys Pages + Fly.
- Don't merge any PR — owner-gated.
- Don't re-allocate the shared limb `BoxGeometry`s in `class-rigs.ts` per-call —
  the optimisation depends on the module-level singletons.
- Don't add a client-side `profiles` UPDATE of `role`/`tier` — re-opens the
  escalation hole fixed in migration 0006.
- Don't reach for `DepthTexture`/MRT/float targets in the ASCII pipeline (iOS
  Safari, devlog 0008).
- Don't surface `docs/lore/_sealed/` content anywhere player-facing.
- Don't unilaterally write emoticron lore (the ~100-word DB) — Q&A first in
  Phase 6.
- Don't deploy to Fly from shell. Don't hand-edit `pnpm-lock.yaml`.

## Open questions for the owner

- Each class look right on desktop? Palettes/proportions to tune?
- Pet behaviours feel right, or any specific ones too hyperactive / sluggish?
- Phase 7 optimisation: ready to budget a focused session for it after Phase 6,
  or fold a sub-set into each remaining phase opportunistically?
- Migration 0006? (Strongly yes.)
