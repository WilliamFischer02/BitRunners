# Handoff — 2026-05-26, session: auto-reconnect + grant toast (devlog 0054)

## State of the build

- **⚠️ DEPLOY STATE:** prod `main` (`5d70d20`) has everything through **PR #48**
  (merged): proxy-wallet/Tokens, runner switch, a11y (`<dialog>`), admin phases
  1/2/4, SAMM glow + security, the autonomous open-PR protocol, distinct pet
  shapes, **admin phase 3 (user table + grants + RLS fix)**. **Migrations
  0001–0005 are run. Migration 0006 is NOT YET RUN** (closes the column-grant
  privilege escalation hole — owner must run it in the Supabase SQL editor).
- **Tokens are LIVE** (proxy-wallet, lore 009) — spendable, account-synced.
- **Live server (Fly):** protocol v1, idle-disconnect (120 s silence), ambient NPCs.
- **This session (devlog 0054, branch `claude/peaceful-thompson-TfjaS`,
  PR pending):** auto-reconnect on server kick + grant-received toast.
- **CI status:** local gates green — `pnpm lint` clean (52 files),
  `pnpm typecheck` 8/8, `pnpm build` 5/5.

## What I did this session

- **Auto-reconnect (`network.ts`, `scene.ts`):** when the server kicks an idle
  client, the client now attempts to reconnect with a 3 s → 6 s → 12 s backoff
  (3 attempts). On success, `reconnectAttempt` resets. After 3 failures, status
  shows "reload to reconnect". Intentional disconnects (runner swap, unmount)
  are guarded by `intentionalLeave`/`sceneDisposed` flags so they never
  trigger the reconnect loop. Remote avatars + emote DOM are cleaned up before
  each reconnect attempt.
- **Grant toast (`App.tsx`, `style.css`):** the `Game` component now listens for
  `bitrunners:grant-received` and shows a brief `<output>` live region centered
  below the hint line, with glowing amount labels and a "admin grant received"
  label. Auto-dismisses after 4.5 s; reduced-motion safe.

## ⚠️ Migration 0006 still needs to be run

`0006_admin_user_management.sql` (added last session, devlog 0053) closes the
column-grant privilege escalation hole. Until it runs, any authenticated user
can PATCH their own `profiles.role` to `'admin'`. Run it and audit:
`SELECT id, role FROM profiles WHERE role <> 'user';` — expect only you.

## What's blocking / not verified

- **Not verifiable headless.** Auto-reconnect needs a live server + 120 s idle
  or a forced server-side `client.leave()`. Toast needs a live admin grant.
- Both paths are correct by inspection; the signal wiring is established.

## What to do next, in priority order

1. **Owner: run migration 0006** (closes the escalation hole). Critical.
2. **Verify admin phase 3 + reconnect + toast on the deploy preview.**
3. **Trading backend** (p2p-trading P1) — the next big focused session. Hard
   prerequisites: live accounts + server-authoritative tradeable economy.
4. Optional polish deferred from prior sessions:
   - Tutorial card placement (eyeball on preview).
   - `.showModal()` focus-trap upgrade for the panels.
   - In-world toast for SAMM quips (lower priority).

## Files touched this session

- `apps/web/src/network.ts` — `onDisconnect` callback + `intentionalLeave`.
- `apps/web/src/scene.ts` — reconnect refactor (clearRemoteAvatars, connectSphere,
  sceneDisposed, reconnectAttempt, RECONNECT_DELAYS).
- `apps/web/src/App.tsx` — grant toast state + listener + `<output>` element.
- `apps/web/src/style.css` — grant toast styles.
- `docs/devlog/0054-auto-reconnect-and-grant-toast.md` — new.
- `.claude/handoff.md` (this).

## Do NOT do these things

- Don't push to `main` — prod branch; deploys Pages + Fly.
- Don't merge any PR — owner-gated.
- Don't add a client-side `profiles` UPDATE of `role`/`tier` — re-opens the
  escalation hole. Use the `admin_set_*` functions.
- Don't let the clicker mint Tokens (it mints Credits only).
- Don't deploy to Fly from shell — GitHub Actions owns deploys.
- Don't edit `docs/lore/_sealed/`. Don't hand-edit `pnpm-lock.yaml`.

## Open questions for the owner

- **Run migration 0006?** (closes the escalation hole; additive.) Strongly yes.
- Trading backend: ready to scope a dedicated session?
- Grant caps OK (≤10M credits / ≤1M tokens per grant)? Tune if needed.
