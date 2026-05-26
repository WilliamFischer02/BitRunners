# 0050 — Admin phase 4: activity stats (session-log migration + SVG chart)

**Date:** 2026-05-26
**Branch:** `claude/peaceful-thompson-jJ61I`

Autonomous run. One coherent deliverable: the activity-stats panel for the admin
console (admin-panel-epic.md §c). Includes the Supabase migration, sign-on
logging wiring, and a hand-rolled SVG bar chart — no new dependencies.

## What shipped

### Migration `0005_session_log.sql`

New `sign_on_log` table — one row per user sign-in, keyed by `user_id` +
`signed_in_at`:

- **INSERT:** own-row only (`auth.uid() = user_id`). Written by the client on
  sign-in; no service-role key needed.
- **SELECT:** admin-only (`is_admin()` from migration 0003). No public read of
  the activity log.
- No UPDATE / DELETE policies — the log is append-only.
- One index on `signed_in_at DESC` for the daily-aggregation query.

**Owner action required:** run `supabase/migrations/0005_session_log.sql` in
the Supabase SQL editor (same workflow as migrations 0002–0004).

### `logSignOn()` in `supabase.ts`

New export that fires-and-forgets an insert into `sign_on_log` for the
currently signed-in user. Silent no-op when Supabase is not configured or the
session is anonymous. Error-resistant (no throw; Supabase-client handles
retries).

### `fetchSignOnStats(days)` in `supabase.ts`

Admin-only query (enforced by RLS): reads `sign_on_log` for the last `days`
days, groups client-side by calendar date (ISO `YYYY-MM-DD`), fills missing
days with 0. Returns `DayCount[]`. Returns `[]` if not admin, not configured,
or the table doesn't exist yet.

### Sign-on log wiring in `economy-sync.ts`

`initEconomySync()` already subscribes to `subscribeAuth`. Added `void logSignOn()`
alongside the existing `loadFromAccount()` call on `SIGNED_IN`. Single call
site — no new subscription; no echo risk.

### `ActivityStats` component in `AdminConsole.tsx`

New panel section `$ activity · last 14 days`:

- Calls `fetchSignOnStats(14)` on mount.
- **Loading state:** shows `─── loading…` stub.
- **Empty state (migration not run yet):** shows `─── no sign-on data yet. run migration 0005 to enable.` — not an error, the data-less case is expected until the owner runs the migration.
- **Data state:** hand-rolled SVG bar chart (14 bars, `viewBox 0 0 260 72`).
  Bar heights proportional to the daily max. Labels shown at day 0, 7, and 13
  (MM/DD format). Below the chart: total sign-on count for the 14-day window.

No charting library. Pure SVG with `<title>` for accessibility (satisfies the
Biome `noSvgWithoutTitle` rule).

Updated "$ coming next" stub: removed "activity stats" (done), left "user table
+ token/credit grants" (still gated on server-authoritative economy + live auth).

### CSS in `style.css`

Three new rules (`.admin-chart`, `.admin-chart-bar`, `.admin-chart-label`).
Bar fill: `#7b5fc4` (purple, matches admin theme). Labels: `#7a8490` (dim),
8px monospace.

## Security scan

No new attack surface introduced:
- `logSignOn()` inserts only the caller's own `auth.uid()` — no privilege escalation.
- `fetchSignOnStats()` reads only via RLS (admin-gated). A non-admin user who
  calls the function gets an empty array (Supabase returns 0 rows, no error).
- No new `innerHTML`, no free-text input, no client-trusted privilege.

## Honest status

- Gates green: `pnpm lint` clean (52 files), `pnpm typecheck` 8/8, `pnpm build` 5/5.
- **Activity chart is not verifiable headless.** To verify: (a) run migration
  0005 in Supabase SQL editor, (b) sign in, (c) open admin console → `$ activity`
  section should show bars after the first sign-on.
- **Empty state is the expected pre-migration state** — the chart will show
  `─── no sign-on data yet…` until the owner runs 0005 AND has at least one sign-in.
- Client-only changes (no server/packages touches). **Pages-only deploy, no Fly.**

## Files

`supabase/migrations/0005_session_log.sql` (new),
`apps/web/src/supabase.ts` (logSignOn, fetchSignOnStats, DayCount),
`apps/web/src/economy-sync.ts` (logSignOn call on sign-in),
`apps/web/src/AdminConsole.tsx` (ActivityStats component, imports, coming-next update),
`apps/web/src/style.css` (admin-chart rules),
this devlog, `.claude/handoff.md`.
