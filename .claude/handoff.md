# Handoff — 2026-05-27, combined: profile panel live economy + showModal focus-trap

## State of the build

- **⚠️ DEPLOY STATE:** prod `main` (`2874496`) has everything through **PR #52**
  (merged): proxy-wallet/Tokens, runner switch, a11y (`<dialog>`), admin phases
  1–4, SAMM glow + security, distinct pet shapes, admin phase 3 (user table +
  grants + profiles RLS fix), **showModal() focus-trap for AdminConsole + Samm**.
  **Migrations 0001–0005 are run.** Migration **0006 is pending** (closes the
  profiles privilege-escalation hole — devlog 0053; owner runs in Supabase SQL
  editor).
- **Live server (Fly):** protocol v1, idle-disconnect, ambient NPCs.
- **Open draft PRs (do NOT start work that overlaps these):**
  - **#49** (`claude/peaceful-thompson-TfjaS`) — auto-reconnect + grant-received toast
  - **#50** (`claude/peaceful-thompson-Ls9H1`) — reduced-motion a11y full pass
  - **#51** (`claude/peaceful-thompson-F9dTL`) — profile panel live economy wiring + stale copy fixes
- **CI status:** gates green — `pnpm lint` clean (52 files), `pnpm typecheck` 8/8,
  `pnpm build` 5/5.

## What has been done recently

**Devlog 0053 (PR #48, merged):** admin phase 3 — user table + currency grants +
profiles RLS security fix.

**PR #52 (merged, devlog 0054):** `showModal()` focus-trap for `AdminConsole.tsx`
and `Samm.tsx`. Added `dialog.panel::backdrop`, margin/max-width for top-layer
centering.

**PR #51 (open, this branch):** profile panel `$ economy` section wired to live
economy state (`credits`, `tokens`, `items owned`, `repCorporate`, `repBitrunner`).
Stale InventoryView stub text updated. Dead hidden stub section removed.

## What is NOT yet done

`ScrapeMenu.tsx` and `ProfileIcon.tsx` still use `<dialog open>` + `.panel-backdrop`
(not `showModal()`). Both are touched by open PR #51.
**Complete the showModal migration for those two after PR #51 merges** — same
~10-line pattern as the AdminConsole/Samm migration.

## What's blocking / not verified

- **Not verifiable headless.** Profile panel changes need a browser. AdminConsole +
  Samm showModal changes need a browser to confirm focus trap + Escape + backdrop.
- **Migration 0006** still pending (owner action — closes the privilege-escalation hole).
- **PR #51** must merge before completing ScrapeMenu/ProfileIcon showModal migration.

## What I would do next, in priority order

1. **Owner: run migration 0006** (closes the profiles escalation hole; additive).
   Audit after: `SELECT id, role FROM profiles WHERE role <> 'user';` — expect only you.
2. **Verify and merge PRs #49, #50, #51** on the deploy preview.
3. **Complete showModal migration for ScrapeMenu + ProfileIcon** after #51 merges
   (~20 lines; same pattern as AdminConsole/Samm).
4. **Trading backend** (p2p-trading-epic P1) — next focused session once auth is live.
5. Optional: toast on `bitrunners:grant-received` is already in PR #49.
6. Board API rate limiting — minor concern; add once DAU warrants it.

## Files touched this session (PR #51)

- `apps/web/src/ProfileIcon.tsx`
- `apps/web/src/ScrapeMenu.tsx`
- `docs/devlog/0054-profile-panel-live-economy-data.md` — new.
- `.claude/handoff.md` (this).

## Do NOT do these things

- Don't push to `main` — prod branch; deploys Pages + Fly.
- Don't merge any PR — owner-gated.
- Don't touch `ScrapeMenu.tsx` or `ProfileIcon.tsx` for showModal until PR #51 merges.
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
