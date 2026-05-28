# Handoff — 2026-05-27, session: showModal() focus-trap (AdminConsole + Samm)

## State of the build

- **⚠️ DEPLOY STATE:** prod `main` (`5d70d20`) has everything through **PR #48**
  (merged): admin phases 1–4, proxy-wallet/Tokens, runner switch, a11y, SAMM glow,
  security, autonomous open-PR protocol, distinct pet shapes.
  **Migrations 0001–0005 are run.** Migration **0006 is pending** (closes the
  profiles privilege-escalation hole — devlog 0053; owner runs in Supabase SQL editor).
- **Live server (Fly):** protocol v1, idle-disconnect, ambient NPCs.
- **Open draft PRs (do NOT start work that overlaps these):**
  - **#49** (`claude/peaceful-thompson-TfjaS`) — auto-reconnect + grant-received toast
  - **#50** (`claude/peaceful-thompson-Ls9H1`) — reduced-motion a11y full pass
  - **#51** (`claude/peaceful-thompson-F9dTL`) — profile panel live economy wiring + stale copy fixes
- **This session (devlog 0054, branch `claude/peaceful-thompson-d3osN`):**
  `showModal()` focus-trap upgrade for AdminConsole and Samm panels; PR opened.
- **CI status:** gates green — `pnpm lint` clean (52 files), `pnpm typecheck` 8/8,
  `pnpm build` 5/5.

## What I did this session

- **`AdminConsole.tsx`:** replaced `<dialog open>` + manual Escape listener + 
  `panel-backdrop` wrapper with `showModal()` + native `cancel` event + focus return.
- **`Samm.tsx`:** same `showModal()` migration. Removed `onCloseRef` escape handler.
- **`style.css`:** added `dialog.panel::backdrop` (matches old overlay look), changed
  `margin: 0` → `margin: auto` for top-layer centering, added `max-width: calc(100vw - 32px)`.
- **Security scan:** clean. No new issues.
- **Devlog 0054** written.

## What is NOT yet done (showModal migration)

`ScrapeMenu.tsx` and `ProfileIcon.tsx` still use `<dialog open>` + `.panel-backdrop`.
Both files are touched by open PR #51. **Migrate after PR #51 merges** — same
10-line pattern, no architecture change.

## What's blocking / not verified

- **Not verifiable headless.** Needs a browser to confirm focus trap, Escape key,
  backdrop click, and focus-return behaviour. See devlog 0054 "Honest status."
- **Migration 0006** still pending (owner action).
- **PR #51** must merge before completing the ScrapeMenu/ProfileIcon showModal migration.

## What I would do next, in priority order

1. **Owner: run migration 0006** (closes escalation hole).
2. **Verify PRs #49–#51** on deploy preview, then merge.
3. **Complete showModal migration for ScrapeMenu + ProfileIcon** after #51 merges
   (same pattern as this session; ~20 lines).
4. **Trading backend** (p2p-trading-epic P1) — next focused session once auth is live.
5. Optional: toast on `bitrunners:grant-received` is already in PR #49.

## Files touched this session

- `apps/web/src/AdminConsole.tsx` — showModal() migration.
- `apps/web/src/Samm.tsx` — showModal() migration.
- `apps/web/src/style.css` — ::backdrop + margin/max-width for modal dialogs.
- `docs/devlog/0054-showmodal-focus-trap-admin-samm.md` — new.
- `.claude/handoff.md` (this).

## Do NOT do these things

- Don't push to `main` — prod branch; deploys Pages + Fly.
- Don't merge any PR — owner-gated.
- Don't touch `ScrapeMenu.tsx` or `ProfileIcon.tsx` until PR #51 is merged.
- Don't add a client-side `profiles` UPDATE of `role`/`tier` — re-opens
  the escalation hole fixed in migration 0006.
- Don't let the clicker mint Tokens (mints Credits; Tokens come from
  exchange / SAMM).
- Don't edit `docs/lore/_sealed/`. Don't hand-edit `pnpm-lock.yaml`.
- Don't deploy to Fly from shell — GitHub Actions owns deploys.

## Open questions for the owner

- **Run migration 0006?** (Closes profiles privilege-escalation hole. Additive.)
- After 0006: audit query — `SELECT id, role FROM profiles WHERE role <> 'user';`
- Trading backend: ready to scope a dedicated session?
