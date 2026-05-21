# Design — Owner admin panel (backend epic)

**Status:** PLAN ONLY — added to the timeline at owner request (2026-05-21).
Not built yet. **Hard-blocked on live auth + a server-enforced admin role**,
and most of it on a **server-authoritative economy** (shared with the trading
epic). No client-only version is acceptable (see Security).

## TL;DR

An owner-only control panel: (a) edit NPC/interaction dialogue, (b) a user
table with account status + currency grants, (c) daily activity stats, (d) an
"under construction" switch with per-account dev-bypass. Every one of these is
**privileged** — they must be enforced **server-side** (admin role + RLS /
privileged functions), never by hiding UI on the client. Several need the same
server-authoritative economy + persistent store the trading epic needs, so this
epic **follows auth** and overlaps trading's backend.

## ⚠️ Security (non-negotiable)

"Only I can see it" cannot be client-side. A client check like
`email === owner` is trivially bypassed, and a "grant credits/tokens" button
backed by client writes is an instant economy exploit. Requirements:

- An **admin/role flag on the server** — e.g. `profiles.role` (`'user' | 'dev'
  | 'admin'`), settable only via the Supabase SQL editor / service role, never
  by the client.
- **Every admin action behind server authorization** — Supabase RLS policies +
  `SECURITY DEFINER` functions that re-check the caller's role. Currency grants,
  dialogue writes, the construction flag, and the user list all gate on it.
- The admin UI is just a window onto those server-authorized actions; it renders
  for admins but **enforcement is on the server**.

## Features

### (a) Dialogue editing
- Today dialogue is **hardcoded** (`AdminDialogue.tsx`, SAMM quips in
  `samm.ts`, tutorial steps, etc.). To edit + persist + serve to all users it
  must move to a **server store** (a `dialogue` table keyed by id), with the
  client reading overrides from it (falling back to the in-code defaults).
- Admin UI: list all dialogue ids → select → edit text → save (writes via an
  admin-gated function). Moderation note: admin-authored, so the no-free-text
  rule doesn't apply to the admin — but it's owner-only.

### (b) User table + currency grants
- Needs accounts (auth) + the per-user economy in the DB. Columns: username
  (`profiles.display_name`), email (`auth.users.email`), **account status**
  (`'free' | 'elevated'` — "elevated" = premium / season pass; new field), and
  a **permissions** column (`role`, incl. `dev`).
- **Grant credits/tokens:** an admin-gated function adds to a user's
  server-authoritative balance. (Tokens granted to a bit_spekter still respect
  canon — they land locked until the proxy-wallet, like a SAMM token win.)
- Depends on the **server-authoritative economy** (same prerequisite as
  trading P1).

### (c) Daily activity stats
- Needs **session/sign-on logging** server-side (a `sessions` or `events` table,
  or Colyseus join/leave → a log row) + aggregation, rendered as a chart.
- Adds a **charting dependency** (e.g. a tiny SVG chart lib or hand-rolled
  SVG — prefer hand-rolled to avoid a heavy dep; devlog it either way).

### (d) Under-construction switch + dev-bypass
- A **global config flag** (`app_config.under_construction`) in the DB (or
  Cloudflare KV). The client checks it on load; if on, it renders an
  under-construction page **unless** the signed-in account's `role` is `dev`/
  `admin` (the "permissions" column). Live testing for marked accounts.
- The under-construction page itself is trivial; the gating needs auth (to know
  who's a dev) + the flag store.

## Dependencies & sequencing

1. **Live auth** (owner Supabase setup) — prerequisite for everything.
2. **Admin role** (`profiles.role`) + RLS/policies — set the owner to `admin`
   via SQL once.
3. **Server-authoritative economy** (shared with trading P1) — for (b)'s grants
   and any per-user balances.
4. Then build per-feature: (d) construction switch (cheapest) → (a) dialogue
   store + editor → (b) user table + grants → (c) activity logging + chart.

This epic **overlaps the trading epic's backend** (auth + server economy +
Supabase) — do them in the same backend push once auth is live.

## Cost

Supabase free tier likely covers the tables + functions at target scale. The
construction flag + dialogue overrides are tiny. Activity logging is the only
growth risk (row volume) — sweep/aggregate and keep raw events short-lived.
No new paid infra expected. Charting: hand-rolled SVG (no dep) preferred.

## Note: "elevated" status

This names the previously-deferred premium concept (`account status: elevated`
= premium / season pass). Once it exists server-side, the deferred auto-click
"premium" gate (clicker skill tree) can key off it instead of being free.
