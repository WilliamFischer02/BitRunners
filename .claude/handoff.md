# Handoff — 2026-05-31, Phase 4 (tutorial highlight + account CTA) DONE

## The plan (7 phases)

| # | Phase | Status |
|---|---|---|
| 1 | Render polish (fog, ordered dither, CRT) | **MERGED — PR #54** |
| 2 | Class identity + pet behaviours + clothing | **MERGED — PR #57** |
| 3 | 2× world + obstacle collision + AI dwellers (`npc:*`) | **MERGED — PR #58** |
| 4 | **Tutorial highlighting + account CTA** | **DONE — this PR** |
| 5 | Tap-to-lock camera + glow | queued (next) |
| 6 | Emoticron compose → review → library + wheel editor | queued |
| 7 | Optimisation sweep | queued |

## Phase 4 — what I did (devlog 0058)

- **`apps/web/src/Tutorial.tsx`** — added `target?: string` to each step;
  built a `TutorialHighlight` inner component that draws a pulsing dashed
  ring (`getBoundingClientRect` + `ResizeObserver`) around the HUD element
  each step talks about. New `'cta'` phase between `reward` and dismiss —
  only shown to guests, never authenticated players.
- **`apps/web/src/ProfileIcon.tsx`** — added a `bitrunners:open-profile`
  event listener so the tutorial CTA can pop the existing AccountSection
  open without coupling to the panel's local state.
- **`apps/web/src/style.css`** — `.tutorial-highlight` ring (pulsing
  dashed; `prefers-reduced-motion` disables animation); `.tutorial-card
  --cta` blue-accent variant.
- Verified `economy-sync.ts` already handles guest → account migration
  safely (last-write-wins by `updatedAt`). No fix needed.

## State of the build
- **prod `main`** at `ece183d` (PR #58 merged). Migration **0006 still
  pending**.
- **This branch** `claude/tutorial-highlight-and-account-cta` is off latest
  `main`.
- **CI/gates:** green — `pnpm lint` clean (58 files), `pnpm typecheck` 8/8,
  `pnpm build` 5/5.

## What's blocking / not verified

- **Not verifiable headless.** Need a browser to confirm: dashed ring lands
  on the right element per step, repositions on resize, CTA only fires for
  guests, "make account" button opens the profile panel.
- **Migration 0006** still pending (owner action).

## What I would do next, in priority order

1. **Owner:** review Phase 4 PR — clear the tutorial in a fresh browser
   profile (or `localStorage.clear()`) to retrigger; verify rings + CTA.
2. **Owner:** run migration 0006 (still pending).
3. **Phase 5** — tap-to-lock camera + glow. Greenfield: add a raycaster,
   tap-pick remote players + NPC dwellers, lock camera target, pulsing
   emissive + halo torus (mobile-safe, NOT `OutlinePass`).

## Do NOT do these things
- Don't push to `main` — prod branch; deploys Pages + Fly.
- Don't merge any PR — owner-gated.
- Don't add per-frame allocations to `TutorialHighlight` — the
  ResizeObserver + scoped listeners are the budget.
- Don't add a client-side `profiles` UPDATE of `role`/`tier` — re-opens
  the escalation hole fixed in migration 0006.
- Don't reach for `DepthTexture`/MRT/float targets in the ASCII pipeline
  (iOS, devlog 0008).
- Don't unilaterally write emoticron lore (Phase 6 needs Q&A).

## Open questions for the owner
- Tutorial highlight ring reads well? Colour/intensity right, or tune?
- CTA copy ("save your progress …") OK, or rephrase?
- Migration 0006?
