# 0046 — Account-synced economy + auth-aware profile + autonomous-task brief

**Date:** 2026-05-21
**Branch:** `claude/bitrunners-collaboration-EcqBv`

Addresses the "signed in but still guest / no wallet, progress not saved" report
and sets up the unattended daily task.

## The "still guest / no wallet" bug — two real causes, both fixed

1. **The profile button label was hardcoded `// guest`** — it never reflected
   auth. Now `ProfileIcon` subscribes to auth and shows `// <name>` when signed
   in. (The account *panel* already showed authenticated state.)
2. **No account economy existed** — credits/tokens/bits/etc. lived only in
   device `localStorage`, so signing in surfaced no wallet/progress. Now built:

## Account-synced economy

- **`supabase/migrations/0002_player_economy.sql`** (new — **owner must run it**):
  a `player_economy(user_id, blob JSONB, updated_at)` table with own-row RLS
  (select/insert/update `auth.uid() = user_id`). Dedicated table on purpose —
  the `profiles` UPDATE policy's `WITH CHECK` is tied to `display_name_status`
  and would intermittently block economy writes.
- **`economy-sync.ts`** (new): the only bridge between `economy.ts` and Supabase
  (economy.ts stays isolated). On sign-in it loads the account blob and adopts
  it if newer than local (`updatedAt` last-write-wins), else pushes local up. On
  any economy change it debounce-saves (1.5 s) the full `exportProgress()` blob.
  A `loading` guard stops the import→event echo from bouncing back.
- **`main.tsx`** calls `initEconomySync()` once at start. No-op until auth is
  configured.

This is account **SYNC**, not server-**authoritative** (own-row RLS; the client
writes its own blob — fine for saving one's own progress). Trading still needs
the stricter server-validated economy (p2p-trading-epic P1).

## Autonomous daily-task brief

`.claude/autonomous-task.md` — the standing prompt for a scheduled, unattended
Claude Code run: mandatory readback, work-priority order (security > bugs >
unblocked roadmap > gated-but-buildable > planning), hard guardrails (dev branch
only, never push main, never merge, gates before commit, no paid resources, no
Fly deploy, no dep bumps, canon/sealed-lore safe, no destructive git, escalate
big/ambiguous calls to the handoff), a per-run security checklist, and a wrap
routine (devlog + handoff + draft PR). Owner wires the schedule in Claude Code
on the web pointing at this brief.

## Owner action

- **Run `0002_player_economy.sql`** in the Supabase SQL editor (one-time) so
  progress saving works. Until then, sync silently no-ops (logs a warn) and the
  game stays device-local.
- If after deploy the account panel STILL shows guest after sign-in, the
  Supabase env vars aren't reaching the build — re-check Cloudflare Pages env +
  redeploy.

## Honest status

- Gates green: `pnpm lint` clean (49 files), `pnpm typecheck` 8/8,
  `pnpm build` 5/5.
- **Not verifiable headless** — needs auth live + migration 0002 run: confirm
  sign-in shows `// <name>`, progress persists across reload/devices,
  last-write-wins behaves. Conflict policy is timestamp-based (single-user
  across devices); not a CRDT.
- Client-only + a manual migration → **Cloudflare Pages deploy only, no Fly.**

## Files

`apps/web/src/economy-sync.ts` (new), `apps/web/src/main.tsx` (init),
`apps/web/src/ProfileIcon.tsx` (auth-aware label),
`supabase/migrations/0002_player_economy.sql` (new),
`.claude/autonomous-task.md` (new), this devlog, `.claude/decisions.md`,
`.claude/handoff.md`.
