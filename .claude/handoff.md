# Handoff — 2026-05-27, session: profile panel live economy + stale copy fixes

## State of the build

- **⚠️ DEPLOY STATE:** prod `main` (`5d70d20`) has everything through **PR #48**
  (merged): proxy-wallet/Tokens, runner switch, a11y (`<dialog>`), admin phases
  1–4, SAMM glow + security, distinct pet shapes, admin phase 3 (user table +
  grants + profiles RLS fix). **Migrations 0001–0006 are run (0006 pending owner
  action — see below).**
- **⚠️ MIGRATION 0006 — NOT YET RUN.** Additive; closes the pre-existing
  profiles self-escalation hole. Owner: run it in the Supabase SQL editor.
- **Tokens are LIVE** (proxy-wallet, lore 009) — spendable, account-synced.
- **Live server (Fly):** protocol v1, idle-disconnect, ambient NPCs.
- **This session (devlog 0054, branch `claude/peaceful-thompson-F9dTL`):**
  profile panel wired to live economy data (credits/tokens/owned-count/rep)
  + stale stub text fixes. Pages-only, no server touch.
- **Open PRs:**
  - **PR #49** (`claude/peaceful-thompson-TfjaS`): auto-reconnect after server
    kick + grant-received toast. Ready to merge.
  - **PR #50** (`claude/peaceful-thompson-Ls9H1`): prefers-reduced-motion full
    pass (a11y). Ready to merge.
  - **This PR** (`claude/peaceful-thompson-F9dTL`): profile panel live economy.
- **CI status:** local gates green — `pnpm lint` clean (52 files),
  `pnpm typecheck` 8/8, `pnpm build` 5/5.

## What I did this session

- **`ProfileIcon.tsx`:** added `subscribeEconomy` to `ProfilePanel`; replaced
  hardcoded stubs with live `eco.credits`, `eco.tokens`, `eco.owned.length`,
  `eco.repCorporate`, `eco.repBitrunner`. Renamed `$ inventory` → `$ economy`
  (the full inventory is in the scrape panel). Removed dead `<section hidden>`
  ("account-stub"). 
- **`ScrapeMenu.tsx`:** updated stale stub text in `InventoryView` — was
  "equipped look feeds appearance.ts; the 3D render reads it in a later pass"
  (Chunk B has been wired for several sessions); now says to tap a slot to equip
  and that cosmetics appear on the runner.
- **Security scan:** no XSS/injection/free-text issues. Board API has no rate
  limiting (minor concern at scale; noted in devlog). open PRs #49/#50 are clean.

## What's blocking / not verified

- Migration 0006 not yet run (owner action needed).
- Profile panel changes not verifiable headless (needs a browser session).
- PRs #49 and #50 need owner review + merge.

## What I would do next, in priority order

1. **Owner: run migration 0006** (closes the RLS escalation hole).
2. **Merge open PRs** #49 (reconnect + toast), #50 (reduced-motion), this PR.
3. **Verify admin phase 3** on the deploy preview (devlog 0053 checklist).
4. **Trading backend** (p2p-trading P1) — next big focused session once auth is
   live.
5. **Board API rate limiting** — minor concern; add once DAU justifies it. A
   simple KV-based per-IP counter would work within the Cloudflare Pages Function.
6. Deferred polish: `.showModal()` focus-trap upgrade for panels; tutorial-card
   placement eyeball; live re-join room without reload.

## Files touched this session

- `apps/web/src/ProfileIcon.tsx`
- `apps/web/src/ScrapeMenu.tsx`
- `docs/devlog/0054-profile-panel-live-economy-data.md` — new.
- `.claude/handoff.md` (this).

## Do NOT do these things

- Don't push to `main` — prod branch; deploys Pages + Fly.
- Don't merge any PR — owner-gated.
- Don't re-lock Tokens for bit_spekter (proxy-wallet canon retired, lore 009).
- Don't add a client-side `profiles` UPDATE of `role`/`tier` (reopens the RLS
  hole, migration 0006 closes it).
- Don't edit `docs/lore/_sealed/`. Don't hand-edit `pnpm-lock.yaml`.
- Don't deploy to Fly from shell — GitHub Actions owns deploys.

## Open questions for the owner

- **Run migration 0006?** (strongly yes — closes the escalation hole.)
- After 0006: audit `SELECT id, role FROM profiles WHERE role <> 'user';` —
  expect only your account.
- Trading backend: ready to scope a dedicated session?
- Board API rate limiting: prioritize now or wait until DAU warrants it?
