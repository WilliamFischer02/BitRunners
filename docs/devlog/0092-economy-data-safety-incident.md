# 0092 — economy data-loss incident response + data-safety system (0016)

Owner reported "significant user data loss" in-game. Investigated the live DB
read-only via the Supabase MCP (queries run as a privileged role that bypasses
RLS, so they show ground truth, not what the client can see).

## TL;DR

- **No mass data loss in the database.** All 4 accounts exist; all 3 that have
  ever signed in still have full, rich economy blobs (one with 16.5k bits /
  10.9k credits / 10k tokens / 13 cosmetics). RLS, every policy, and migration
  0015 are all intact and correct. The "missing" 4th `player_economy` row is an
  account that **never signed in** — nothing was ever saved.
- **Root cause / real risk:** `player_economy` is a single client-trusted JSONB
  blob, written as a last-write-wins upsert with **no trigger, no history, no
  validation** (confirmed: zero triggers on the table). Any client that syncs a
  fresh/empty/default blob overwrites good progress **silently and
  permanently**, with no recovery path.
- **No migration needs editing.** 0001–0015 are applied + ledgered (immutable).
  The fix is forward-only.
- **New migration `0016`** adds the safety net: history table + AFTER UPDATE
  capture trigger (recovery works immediately, no client change), a guarded
  `save_economy()` RPC (rejects stale + rollback writes), and admin
  list/restore RPCs.

## What was checked (read-only)

Row counts across all user tables, per-account mapping (auth.users ⋈
player_economy ⋈ profiles), full blob dumps, `pg_policies` integrity, and
triggers on `player_economy`. Findings:

- profiles = auth.users = 4 (no orphaning). All RPC-written tables
  (owned_themes, earned_badges, mission_progress, samaritan_status) intact.
- `equipped_outfit.slots = {}` for everyone — the table is vestigial; the blob
  is the sole store for economy + cosmetics + equipped.
- 0015's policies show the wrapped `(SELECT auth.uid())` form — applied cleanly,
  not the cause.

## Why the blob design loses data

`player_economy` (migration 0002) is account SYNC, not server-authoritative. The
client owns the truth and upserts the whole blob. Failure modes, all unguarded
today:

1. **Clobber-with-empty** — client loads a default/empty economy (cache cleared,
   reinstall, new device, or save-before-fetch race) and writes it over the good
   blob. #1 suspect for perceived loss.
2. **Stale-device overwrite** — an older device's blob overwrites newer progress
   (last-write-wins).
3. **No history** — the overwrite is in place, so the prior value is gone.

## 0016 — the fix

1. `player_economy_history` (append-only) + `capture_economy_history()` AFTER
   UPDATE trigger → every overwrite is snapshotted. **Recovery now works even
   while the client keeps doing raw upserts.**
2. `save_economy(blob)` RPC → rejects writes with an older `updatedAt` (stale) or
   a lower `lifetimeScrapes` (rollback / empty clobber), plus shape + 128 KB
   size checks. This is the PREVENTION path the client should adopt.
3. `admin_list_economy_history()` + `admin_restore_economy()` → browse + one-call
   restore (restore snapshots the current blob first, so it's reversible).
4. `prune_economy_history()` (optional) keeps history bounded.

Phased rollout: the trigger protects immediately; PREVENTION engages once the
web client calls `save_economy()` instead of the raw upsert; only then do we
revoke the direct INSERT/UPDATE grants (left commented in 0016).

## Open items (need owner input)

- **Scope the actual loss:** which account shows less than expected, and what
  should it have? Without history (only created now), the current blob IS the
  post-clobber value — recovery of *already-lost* data depends on a Supabase
  backup. `the4dmin` (admin) looks suspiciously light (350 credits, empty
  upgrades, 265 lifetime scrapes) — candidate, unconfirmed.
- **Backup tier:** Free has no PITR / limited backups; Pro has daily + optional
  PITR. Determines whether pre-loss data is recoverable at all.
- **Client wiring:** point `apps/web` economy sync at `save_economy()` and
  fetch-before-first-write. Separate follow-up.

No DB writes were made during this investigation. 0016 is owner-applied.
