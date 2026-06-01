# Handoff — 2026-05-31, Phase 5 (tap-to-lock + glow) DONE

## The plan (7 phases)

| # | Phase | Status |
|---|---|---|
| 1 | Render polish (fog, ordered dither, CRT) | **MERGED — PR #54** |
| 2 | Class identity + pet behaviours + clothing | **MERGED — PR #57** |
| 3 | 2× world + obstacle collision + AI dwellers (`npc:*`) | **MERGED — PR #58** |
| 4 | Tutorial highlighting + account CTA | **MERGED — PR #59** |
| 5 | **Tap-to-lock camera + glow** | **DONE — this PR** |
| 6 | Emoticron compose → review → library + wheel editor | queued (next; needs lore Q&A) |
| 7 | Optimisation sweep | queued |

## Phase 5 — what I did (devlog 0059)

- **`apps/web/src/target-lock.ts`** (new) — `createTargetRaycaster()`,
  `pickAvatar()` (closest-hit raycast against a map of lockable groups),
  `applyLock()` (snapshot per-material emissiveIntensity + add halo torus),
  `releaseLock()` (restore + dispose halo), `tickLock()` (per-frame pulse +
  spin).
- **`apps/web/src/scene.ts`** — `LOCK_RELEASE_DISTANCE = 14`; canvas-only
  `click` listener (not on host, so HUD clicks don't bubble in); tap-lock
  state declared **after** `remoteAvatars` so the closure references the
  initialised map; `onLeave` releases on disconnect; camera follow picks the
  locked avatar's `group.position` (already wrap-anchored near local, so
  seam-crossing is seamless); per-frame distance check + glow tick; dispose
  cleanup.
- **No `OutlinePass`** — depth-fragile on iOS (devlog 0008). Glow = emissive
  pulse + halo torus, all in the plain-RGBA pipeline. No new render pass.

### Release conditions
1. Tap the locked target again.
2. Tap a different lockable target (auto-switches).
3. Target disconnects (`onLeave`).
4. Target walks `> 14` units (wrapped distance) from local player.

## State of the build
- **prod `main`** at `68c178d` (PR #59 merged). Migration **0006 still
  pending**.
- **This branch** `claude/tap-to-lock-and-glow` is off latest `main`.
- **CI/gates:** green — `pnpm lint` clean (59 files), `pnpm typecheck` 8/8,
  `pnpm build` 5/5.

## What's blocking / not verified
- **Not verifiable headless.** Need a browser + server to confirm: tap picks
  the right entity from the composite ASCII output, camera follows smoothly
  across the seam, halo + emissive pulse read at glyph resolution, all four
  release conditions fire (test by having a 2nd browser tab as a 2nd player,
  or just tap an NPC dweller).
- **Migration 0006** still pending (owner action).

## What I would do next, in priority order
1. **Owner:** review Phase 5 PR — eyeball lock/release/distance feel; iOS
   Safari check that the click event reliably fires after tap.
2. **Owner:** run migration 0006 (still pending).
3. **Phase 6** — the big one. Needs **lore Q&A on the ~100-word emoticron
   DB** before I can build. I'll surface a starter list of categories
   (greetings, states, objects, ideograms…) and ask you to confirm /
   populate before any code lands.

## Do NOT do these things
- Don't push to `main` — prod branch; deploys Pages + Fly.
- Don't merge any PR — owner-gated.
- Don't migrate the tap-lock glow to `OutlinePass` — it re-introduces the
  iOS-Safari depth-buffer risk that devlog 0008 spent days untangling.
- Don't add a client-side `profiles` UPDATE of `role`/`tier` — re-opens
  the escalation hole fixed in migration 0006.
- Don't reach for `DepthTexture`/MRT/float targets in the ASCII pipeline.
- Don't unilaterally write emoticron lore.

## Open questions for the owner
- Tap-lock feel right? Distance threshold (14) right, or tune?
- Halo colour — gold reads neutral; could go faction-coded (orange for
  Company, purple for Admin) if you'd rather.
- Migration 0006?
