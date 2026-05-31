# 0058 — Tutorial step highlighting + post-tutorial account CTA

**Date:** 2026-05-31
**Branch:** `claude/tutorial-highlight-and-account-cta`

Phase 4 of the six-part feature push. Two small, disjoint additions to the
existing first-play tutorial (devlog 0043):

1. **Each tutorial step now points at the HUD element it talks about** — a
   pulsing dashed ring around the target, repositioning on resize/scroll.
2. **After the reward phase, guest players get a one-shot "save progress"
   CTA** that opens the existing AccountSection in the profile panel.
   Authenticated players skip the CTA entirely.

## Tutorial step highlighting (`Tutorial.tsx`)

- `STEPS[]` gains an optional `target: string` (CSS selector) per step:
  - "your inventory" → `.emote-center` (▦ button)
  - "the shop" → `.shop-launch` ($ button)
  - "data scrape" → `.scrape-launch` (// data scrape rail)
  - "moving around" → `.hint` (the class · arrows hint at top)
  - Welcome + Points of Interest steps have no target (they talk about
    the 3D scene or the boot state, not a HUD element).
- New inner component `TutorialHighlight` reads the target's
  `getBoundingClientRect()` and renders a position-fixed `<div
  className="tutorial-highlight">` with a 6 px pad. Re-reads on:
  - `window.resize`, `window.scroll` (capturing — covers internal
    scrollable panels too), and
  - `ResizeObserver(target)` for when the target itself resizes, plus
  - a one-shot `setTimeout(220ms)` retry in case the target wasn't yet in
    the DOM when the step changed.
- CSS (`style.css`):
  - `.tutorial-highlight` — pulsing dashed green ring; `pointer-events:
    none` so it never blocks input; `z-index: 28` (just below the tutorial
    card at 30 so the card sits visually on top); `prefers-reduced-motion`
    disables the pulse + transition.

## Account CTA (`Tutorial.tsx` + `ProfileIcon.tsx`)

- New tutorial phase: `'cta'`, inserted between `'reward'` and
  `active = false`. **Only guests see it** — authenticated players' "[ done
  ]" closes the tutorial.
- The "[ make account ]" button dispatches `bitrunners:open-profile`;
  `ProfileIcon.tsx` listens for that event and pops the panel open so the
  existing `AccountSection` (signup/signin) is in view. Keeps callers
  decoupled from `ProfileIcon`'s internal `open` state.
- "[ continue without ]" dismisses the CTA without opening anything; the
  user's progress stays in `localStorage` and can be claimed later via the
  profile panel.
- Visual: `.tutorial-card--cta` variant — blue accent (vs reward's gold).

### Guest → account migration is already safe (no fix needed)

Verified by reading `economy-sync.ts`:
- On sign-in, `loadFromAccount(uid)` does last-write-wins by `updatedAt`.
- For a fresh account (no remote row), the condition
  `remote && remoteUpdated >= getEconomy().updatedAt` is `false`, so the
  branch falls to `saveNow(uid)` — local progress is pushed up.
- For an existing account on a fresh device, the remote `updatedAt > 0`
  and local `updatedAt === 0`, so `importProgress(remote)` adopts the
  account state.

Either branch is correct — first sign-in preserves local progress,
subsequent sign-ins on new devices restore the account.

## Files changed
- `apps/web/src/Tutorial.tsx` — `target` field on STEPS, `TutorialHighlight`
  inner component, `'cta'` phase + auth subscription.
- `apps/web/src/ProfileIcon.tsx` — `bitrunners:open-profile` listener that
  sets the panel `open`.
- `apps/web/src/style.css` — `.tutorial-highlight` ring, `.tutorial-card
  --cta` variant.
- `docs/devlog/0058-tutorial-highlight-and-account-cta.md` — this file.
- `.claude/handoff.md` — updated.

## Honest status
- Gates green: `pnpm lint` clean (58 files), `pnpm typecheck` 8/8,
  `pnpm build` 5/5.
- **Not verifiable headless.** Need a browser to confirm: the dashed ring
  lands on the right element per step, repositions correctly on resize and
  small-viewport (mobile / pointer:coarse), the "make account" button opens
  the profile panel, and the CTA only fires for guests.
- No new dependencies. No protocol bump.

## Optimisation discipline baked in
- `TutorialHighlight` only mounts when the active step has a `target`; the
  whole highlight surface is gone otherwise.
- ResizeObserver scoped to the single target element (not the document).
- Animation respects `prefers-reduced-motion`.

## Next (Phase 5)
Tap-to-lock camera + glow on the tapped player/NPC. Greenfield (no raycaster
exists). Mobile-safe approach: emissive pulse + halo torus rather than
`OutlinePass`. Separate branch off latest `main`.
