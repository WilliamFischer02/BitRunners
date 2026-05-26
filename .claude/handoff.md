# Handoff — 2026-05-26, session: admin phase 4 — activity stats

## State of the build

- **⚠️ DEPLOY STATE:** prod `main` has everything through devlog 0049. **Devlog
  0050 is new work on PR (not yet merged)** — Pages-only change (no server/packages).
- **Live web (bitrunners.app):** clicker, skill tree, SAMM, admin console, dialogue
  editor, room-code join, email/password auth all live (through 0049).
- **Live server (bitrunners.fly.dev):** protocol v1, idle-disconnect, ambient NPCs.
  **No server change this session.**
- **Active branch:** `claude/peaceful-thompson-jJ61I` (autonomous run branch).
- **CI status:** gates green — `pnpm lint` clean (52 files), `pnpm typecheck` 8/8,
  `pnpm build` 5/5.

## What I did this session

**Admin phase 4 — activity stats:**

- `supabase/migrations/0005_session_log.sql` — `sign_on_log` table (own-row INSERT,
  admin-only SELECT, append-only).
- `logSignOn()` + `fetchSignOnStats()` + `DayCount` added to `supabase.ts`.
- `economy-sync.ts` — `void logSignOn()` fires alongside `loadFromAccount()` on sign-in.
- `AdminConsole.tsx` — new `ActivityStats` component: hand-rolled SVG bar chart
  (last 14 days, no dep), loading/empty/data states. Updated "coming next" stub.
- `style.css` — 3 chart CSS rules.

**Security scan** (every-run mandatory):
- No new attack surface. `logSignOn()` inserts own-row only. `fetchSignOnStats()` is
  admin-RLS-gated (non-admin gets empty array). No innerHTML, no free-text. Full scan
  results in devlog 0050.

## What's blocking forward progress

- **Owner must run migration `0005_session_log.sql`** in the Supabase SQL editor
  before the activity chart shows data. Until then the panel shows an informative
  empty-state message.
- **Browser verification.** Activity chart needs live eyeball after migration is run.
- **Owner-side service wiring.** Supabase + Resend + OAuth still unblocked. Follow
  `docs/setup/SERVICES.md` §1 critical path.
- **Admin phases 3 + 4 (user table + grants)** gated on server-authoritative economy
  (shared with p2p-trading-epic P1) and live auth.

## What I would do next, in priority order

1. **Owner-side: execute `docs/setup/SERVICES.md` §1 critical path.** Highest leverage.
2. **Run migration 0005** after running 0002–0004 (if not done yet), then eyeball the
   activity chart.
3. **Two-client live test:** emote sync, seam visibility, smooth movement.
4. **Tune visual values** after live eyeball:
   - SAMM glow: if too subtle raise the `0.85` multiplier; if too harsh lower it.
   - Scrape hold/auto: `is-holding` opacity 0.5 and `is-auto` range 0.35–0.7 are first-pass.
5. **Admin phase 3: user table + grants** — blocked on live auth + server-authoritative economy.
6. **Faction-reward Q&A** — unblocks reputation reward curve + 20-achievements design.
7. **P2P trading epic** — gated on auth + server-authoritative tradeables (epic doc at
   `docs/design/p2p-trading-epic.md`).
8. **Aether snapshot on `onLeave`** — Phase 2 polish; needs Upstash (SERVICES.md §12).

## Files touched this session

- `supabase/migrations/0005_session_log.sql` — new migration.
- `apps/web/src/supabase.ts` — logSignOn, fetchSignOnStats, DayCount type.
- `apps/web/src/economy-sync.ts` — logSignOn call on sign-in.
- `apps/web/src/AdminConsole.tsx` — ActivityStats component + imports + coming-next update.
- `apps/web/src/style.css` — .admin-chart, .admin-chart-bar, .admin-chart-label rules.
- `docs/devlog/0050-admin-phase4-activity-stats.md` — new.
- `.claude/handoff.md` — this file.

## Do NOT do these things

- Don't push to `main` — prod branch; deploys Pages + Fly.
- Don't merge any PR — owner-gated.
- Don't build a passcode-gated diagnostics/tester menu or Stripe setup section (retracted prompt).
- Don't let the clicker mint Tokens (`bit_spekter` has no wallet — lore 003/007).
- Don't edit `docs/lore/_sealed/`.
- Don't hand-edit `pnpm-lock.yaml`.
- Don't deploy to Fly from shell — GitHub Actions owns deploys.

## Open questions for the owner

- **Run migration 0005** and sign in once to seed the activity chart. Then confirm
  the bars render correctly in the admin console.
- After live eyeball: SAMM glow — too subtle / too harsh?
- Hold glow (0.5 opacity, 80ms transition): reads as feedback? Or too dim?
- Auto-scrape pulse (650ms cycle, 0.35→0.7 opacity, 0.95→1.03 scale): clear indicator? Or too busy?
- Two-client emote/seam test results?
- Proceed with admin phase 3 (user table + grants) once server-authoritative economy is in scope?
