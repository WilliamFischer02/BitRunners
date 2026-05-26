# 0047 — Admin console phase 1 + under-construction + sync indicator

**Date:** 2026-05-21
**Branch:** `claude/bitrunners-collaboration-EcqBv`

First secure phase of the owner admin console + a continuity indicator for the
account economy sync.

## Admin console — phase 1 (foundation + under-construction switch)

Built the foundation + the cheapest/highest-value feature; dialogue editor,
user table + grants, and activity stats are later phases.

- **`supabase/migrations/0003_admin_role_and_config.sql`** (new — **owner runs
  it**): `profiles.role` (`user`/`dev`/`admin`, default `user`); `is_admin()` /
  `is_dev_or_admin()` SECURITY-DEFINER helpers; `app_config` key/value table
  seeded with `under_construction=false`. RLS: config readable by everyone
  (incl. anon — the flag gates the app), **writable only by admins**. The role
  is set only via the SQL editor (no client write path).
- **Security model:** privilege lives in the DB + RLS. The client gate (show
  admin UI to admins) is **convenience only**; the write (toggling the flag) is
  enforced by the admin RLS policy. No service-role key in the client.
- **`AdminConsole.tsx`** — launcher renders only for `role==='admin'`; opens a
  panel with the **under-construction toggle** (+ placeholders for the next
  phases).
- **`ConstructionGate.tsx`** wraps the whole app: when the flag is on, everyone
  **except dev/admin** sees `UnderConstruction.tsx`; dev/admin bypass (live
  testing for marked accounts). **Fails OPEN** — any fetch error leaves the app
  visible, so a DB hiccup can never lock everyone out.
- **`supabase.ts`**: `getMyRole`, `fetchUnderConstruction` (fail-open),
  `setUnderConstruction` (admin-gated).

## Account continuity indicator

`economy-sync.ts` now emits `bitrunners:economy-synced` after a successful
load/save; the account panel shows **progress · synced ✓** (else `syncing…`)
when signed in — a visible confirmation that account storage/continuity works.

## Owner actions

1. **Run `0003_admin_role_and_config.sql`** in the Supabase SQL editor.
2. **Make yourself admin** (one line, in the SQL editor):
   `UPDATE public.profiles SET role='admin' WHERE id=(SELECT id FROM auth.users WHERE email='<you>');`
3. Then the `⚙ admin` launcher appears in-game for your account, and the
   under-construction switch works.

## Honest status

- Gates green: `pnpm lint` clean (52 files), `pnpm typecheck` 8/8,
  `pnpm build` 5/5.
- **Not verifiable headless + security-sensitive** — please verify live:
  (a) a non-admin account does NOT see the `⚙ admin` launcher; (b) toggling
  under-construction shows the page to a normal/guest account but NOT to your
  admin/dev account; (c) the construction fetch failing leaves the app visible
  (fail-open).
- Client + manual migration → **Pages-only deploy, no Fly.**

## Files

`apps/web/src/AdminConsole.tsx`, `ConstructionGate.tsx`, `UnderConstruction.tsx`
(new), `apps/web/src/supabase.ts` (role/config helpers),
`apps/web/src/economy-sync.ts` (synced event), `apps/web/src/ProfileIcon.tsx`
(sync row), `apps/web/src/App.tsx` (gate + launcher),
`apps/web/src/style.css`, `supabase/migrations/0003_admin_role_and_config.sql`
(new), this devlog, `.claude/decisions.md`, `.claude/handoff.md`.
