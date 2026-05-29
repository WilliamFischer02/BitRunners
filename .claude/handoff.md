# Handoff — 2026-05-29, showModal migration complete (ScrapePanel + ProfilePanel)

## State of the build

- **⚠️ DEPLOY STATE:** prod `main` (`1d3b12a`) has everything through **PR #53**
  (merged): proxy-wallet/Tokens, runner switch, a11y (`<dialog>`), admin phases
  1–4, SAMM glow + security, distinct pet shapes, admin phase 3 (user table +
  grants + profiles RLS fix), showModal() for AdminConsole + Samm, auto-reconnect
  + grant-received toast, reduced-motion full pass, profile panel live economy.
  **Migrations 0001–0005 are run.** Migration **0006 is pending** (closes the
  profiles privilege-escalation hole — devlog 0053; owner runs in Supabase SQL
  editor).
- **Live server (Fly):** protocol v1, idle-disconnect, ambient NPCs.
- **Open draft PRs (do NOT start work that overlaps these):**
  - **#54** (`claude/render-polish-ps2-ascii`) — depth fog, ordered dither, CRT pass
  - **This session's work** (current branch `claude/peaceful-thompson-7k3R6`) — showModal for ScrapePanel + ProfilePanel (draft PR to be opened)
- **CI status:** gates green — `pnpm lint` clean (52 files), `pnpm typecheck` 8/8,
  `pnpm build` 5/5.

## What has been done this session

**Devlog 0055 (this branch):** Completed `showModal()` migration for
`ScrapePanel` (in `ScrapeMenu.tsx`) and `ProfilePanel` (in `ProfileIcon.tsx`).

This was blocked on PR #51 merging (the two components were in its file
footprint). PR #51 is now merged, so the migration is complete.

All four panels now use the native HTML modal API (`showModal()`):
- ✅ AdminConsole — merged (PR #52)
- ✅ Samm — merged (PR #52)
- ✅ ScrapePanel — this session
- ✅ ProfilePanel — this session

Key implementation details:
- ScrapePanel: `cancel` event calls `e.preventDefault()` before `requestClose()`
  so the 240ms close animation plays before unmount
- ProfilePanel: simpler, `cancel` calls `onClose()` directly
- Both use the `closeRef` / `trigger?.focus()` pattern from the prior migration

Security scan showed no new issues (see devlog 0055).

## What is NOT yet done

- `.panel-backdrop` CSS class is now dead code (no component uses it). Safe to
  remove in a future CSS cleanup pass (harmless to leave for now).

## What's blocking / not verified

- **Not verifiable headless.** Focus-trap, Escape, backdrop-click, and
  focus-return need a browser.
- **Migration 0006** still pending (owner action — closes the profiles
  privilege-escalation hole).

## What I would do next, in priority order

1. **Owner: run migration 0006** (closes the profiles escalation hole; additive).
   Audit after: `SELECT id, role FROM profiles WHERE role <> 'user';` — expect only you.
2. **Verify and merge PRs #54 and this branch's PR** on the deploy preview.
3. **CSS cleanup:** remove the now-dead `.panel-backdrop` rule from `style.css`
   (~10-line cleanup pass; low priority, no behaviour change).
4. **Trading backend** (p2p-trading-epic P1) — next focused session once auth is live.
5. Board API rate limiting — minor concern; add once DAU warrants it.

## Files touched this session

- `apps/web/src/ScrapeMenu.tsx` — showModal migration for ScrapePanel
- `apps/web/src/ProfileIcon.tsx` — showModal migration for ProfilePanel; added `useRef` import
- `docs/devlog/0055-showmodal-scrape-profile-panels.md` — new
- `.claude/handoff.md` (this)

## Do NOT do these things

- Don't push to `main` — prod branch; deploys Pages + Fly.
- Don't merge any PR — owner-gated.
- Don't re-lock Tokens for bit_spekter (proxy-wallet canon retired, lore 009).
- Don't add a client-side `profiles` UPDATE of `role`/`tier` — re-opens the
  escalation hole fixed in migration 0006.
- Don't let the clicker mint Tokens (mints Credits; Tokens come from exchange / SAMM).
- Don't edit `docs/lore/_sealed/`. Don't hand-edit `pnpm-lock.yaml`.
- Don't deploy to Fly from shell — GitHub Actions owns deploys.

## Open questions for the owner

- **Run migration 0006?** (Strongly yes — closes profiles privilege-escalation hole.)
- After 0006: audit `SELECT id, role FROM profiles WHERE role <> 'user';`
- Trading backend: ready to scope a dedicated session?
- Board API rate limiting: prioritize now or wait until DAU warrants it?
