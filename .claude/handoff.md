# Handoff — 2026-05-28, six-phase feature push · Phase 1 (render polish) done

## The plan (owner-approved, phased PRs)

A six-workstream push, delivered as **one focused draft PR per phase**, in order:

1. **Render polish (PS2-in-ASCII)** ← **THIS PR (#?, devlog 0055)** — fog, ordered
   dither, CRT pass. **DONE, awaiting review.**
2. **2× world + collision + AI dwellers** — `PLATFORM_HALF 9.5 → 19`; add obstacle
   collision (none exists today; movement is free at `scene.ts:~1130`); render the
   server's existing `npc:*` entities (currently ignored) as robot/husk/spirit.
3. **Tutorial highlighting + account CTA** — `Tutorial.tsx` exists (6 steps) but has no
   element highlighting; add a spotlight overlay per step + a post-tutorial "Make Account
   to Save Progress" CTA (reuse `AccountSection` in `ProfileIcon.tsx`).
4. **Tap-to-lock camera + glow** — greenfield: add a raycaster, lock camera to a tapped
   player/NPC, pulsing-emissive + halo glow (NOT OutlinePass — iOS), release on
   tap-again / self / disconnect / distance.
5. **Emoticron system** (largest) — compose → manual review → library + wheel editor.
   Only 4 fixed glyphs exist today (`packages/shared/src/index.ts:6`). Owner chose the
   full canon (compose from a word DB, manual review queue via the Admin console, approved
   combos enter a per-user library; extra wheel slots **earned via play**). New migration
   `0007_emoticrons.sql`.

Owner decisions locked: render = tasteful/in-budget; emoticrons = compose→review→library;
extra slots = earned via play; delivery = phased PRs in the order above.
Full plan file (this session): `/root/.claude/plans/nested-tickling-reddy.md`.

## State of the build

- **prod `main`** has everything through the merged parallel PRs (#48–#53+): proxy-wallet,
  runner switch, a11y/`showModal()`, admin phases 1–4, auto-reconnect + grant toast,
  reduced-motion pass, profile live economy. **Migrations 0001–0005 run; 0006 still
  pending** (closes the profiles privilege-escalation hole — devlog 0053; SQL was handed
  to the owner this session, owner runs it in the Supabase SQL editor).
- **This branch** `claude/render-polish-ps2-ascii` is off latest `main` (`1d3b12a`).
- **CI/gates:** green — `pnpm lint` clean, `pnpm typecheck` 8/8, `pnpm build` 5/5.

## Phase 1 — what I did (devlog 0055)

- **Fog** (`scene.ts`): `Fog(0x0a1212, PLATFORM_HALF*0.8, PLATFORM_SIZE*2.0)`, nulled in
  the character + normals passes so the runner stays crisp.
- **Ordered dither** (`packages/ascii/ascii-pass.ts`): new `orderedDither` option +
  `bayer4`; scene enables it. Default off → other callers unchanged.
- **CRT pass** (`packages/ascii/crt-pass.ts`, new): scanlines + vignette + chromatic
  split, inserted after ASCII / before OutputPass. `?crt=off` disables. Mobile-safe.
- **Cool rim light** for silhouette separation.

## What's blocking / not verified

- **Not verifiable headless.** GLSL only compiles in a live WebGL context. Shaders are
  correct by inspection + the bundle builds, but the **visual result + iOS Safari check
  are owner-side**. A/B the CRT with `?crt=off`.
- **Migration 0006** still pending (owner action).

## What I would do next, in priority order

1. **Owner:** review/merge Phase 1 PR (eyeball the look; iOS Safari check).
2. **Owner:** run migration 0006 (still pending) — audit
   `SELECT id, role FROM profiles WHERE role <> 'user';`.
3. **Phase 2** — 2× world + collision + AI dwellers (new branch off latest `main`).

## Do NOT do these things

- Don't push to `main` — prod branch; deploys Pages + Fly.
- Don't merge any PR — owner-gated.
- Don't re-lock Tokens for bit_spekter (proxy-wallet canon retired, lore 009).
- Don't add a client-side `profiles` UPDATE of `role`/`tier` — re-opens the escalation
  hole fixed in migration 0006.
- Don't reach for `DepthTexture`/MRT/float targets in the ASCII pipeline (iOS Safari,
  devlog 0008). The new CRT pass is plain-RGBA on purpose.
- Don't surface `docs/lore/_sealed/` content anywhere player-facing.
- Don't write emoticron lore (the ~100-word DB) unilaterally — Q&A the owner in Phase 5.
- Don't edit `docs/lore/_sealed/`. Don't hand-edit `pnpm-lock.yaml`. Don't deploy to Fly
  from shell.

## Open questions for the owner

- Phase 1 look OK on desktop + iOS? Any CRT/fog/dither tuning before I carry the palette
  into later phases?
- Run migration 0006? (Strongly yes.)
- Phase 5 emoticrons: ready to Q&A the ~100-word DB content when we get there?
