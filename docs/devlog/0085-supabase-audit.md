# 0085 — Supabase audit + DM moderation RPCs (0012)

Owner asked me to audit the Supabase state and "get it to an acceptable
state according to my needs." No Supabase MCP is connected to this
session, so I can't query the live DB directly. This PR instead delivers
two things the owner can run + apply manually:

1. **`supabase/audits/0001_state_audit.sql`** — a paste-and-run audit
   script for the SQL editor. Reports every table, RLS toggle, policy
   count, column-grant lockdown, function, and seed expected by
   migrations `0001` through `0011`. Anything coming back `MISSING` or
   `GAP` flags a real hole.
2. **`supabase/migrations/0012_dm_moderation.sql`** — closes the only
   significant schema gap I found: the DM moderation RPCs reserved by
   `0007` but never created. PR #88 (tether moderation V1) and PR #90
   (client-side block list) both deferred this. The migration adds
   `dm_send_message`, `dm_block_user`, `dm_unblock_user`,
   `dm_list_blocked`, `admin_list_dm_reports`, plus a `dm_rate_counter`
   table for the 30-msg/min/pair sliding window.

## Audit findings (from reading the 11 migrations + client + server wiring)

### Solid
- Every public table has RLS enabled.
- Every admin RPC re-checks `is_admin(auth.uid())` server-side.
- `profiles` UPDATE is column-locked: `0006` revoked broad UPDATE, then
  `0007` re-granted only `display_name`, `display_name_status`,
  `display_name_note`, `dm_blocked` to `authenticated`. Role / tier /
  samaritan / equipped_* / dm_verified flow only through SECURITY
  DEFINER RPCs.
- Idempotency on `complete_mission`, `purchase_theme`, `equip_*`,
  `admin_grant_economy` + `claim_economy_grants` (the economy ledger is
  exactly-once).
- Realtime publication includes `earned_badges` so the badge-toast
  loop fires without polling.

### Gaps closed by this PR
- **`dm_messages` had no INSERT path.** `0007` reserved the table; PR
  #88's tether moderation went client-only with a sessionStorage audit
  log; the server side was deferred. `0012.dm_send_message` adds the
  full gate chain (verified → block list → rate limit → audit log) per
  `docs/lore/015`.
- **No server-side block list.** PR #90 shipped a `localStorage`
  blocklist keyed by Colyseus `sessionId`, which churns per join.
  `0012.dm_block_user` writes to `profiles.dm_blocked UUID[]` (already
  reserved by `0007`), so blocks survive the join cycle.
- **No owner review queue for flagged DMs.**
  `0012.admin_list_dm_reports` returns the last 14 days of flagged +
  blocked rows, owner-gated.

### Gaps NOT closed (deferred — flagged here so they don't get lost)
- **`hack_qte_attempts` has no INSERT RPC** — same pattern as DM. Fine
  for now; sub-phase H hasn't shipped a QTE.
- **`mission_witnesses` has no policies / no RPCs** — reserved-only per
  `0007`. Phase 4 work.
- **`session_events` has no rate-limit guard** — a malicious client
  could spam INSERTs to inflate the DAU number. Low-priority because
  the only consumer is the owner-only DAU widget.
- **`player_economy.blob` is fully client-trusted.** This is the
  documented compromise (`0002` comment + p2p-trading-epic.md P1).
  Server-authoritative economy waits for the trading epic.
- **Profanity classification lives in the server (Node), not in
  Postgres.** The DB only audit-logs the verdict the server computed.
  This keeps the moderation library a Node-only decision; downside is
  the DB cannot independently verify the verdict. Acceptable for V1.

## Client wiring

`apps/web/src/supabase.ts` gets a DM moderation block exporting
`dmSendMessage`, `dmBlockUser`, `dmUnblockUser`, `dmListBlocked`,
`adminListDmReports`. Tether chat (`apps/web/src/tether-chat.ts`)
and the block-list panel (`apps/web/src/TetherChat.tsx`) are not
re-pointed at these in this PR — that's a separate wire-up so the
schema lands first and the client switch can be reviewed against a
live `0012`.

## Owner action required

1. Open Supabase → SQL editor.
2. Paste `supabase/audits/0001_state_audit.sql` and run.
3. Confirm zero `MISSING` / `GAP` lines (except section M, which is
   expected to be MISSING until step 4).
4. Paste `supabase/migrations/0012_dm_moderation.sql` and run.
5. Re-run the audit; section M should flip to `OK`.
6. Confirm at least one row in section L (`admin_count >= 1`). If
   zero, run the bootstrap SQL in `0003_admin_role_and_config.sql`.

## Verification (this PR)

- `pnpm lint` ✓
- `pnpm typecheck` ✓
- `pnpm --filter @bitrunners/web build` ✓
- The migration file is paste-clean SQL — verified by structural
  read-through; not executed against a live DB from this session.

No new dependencies. No client-facing behavior change yet (RPCs land,
wire-up is a follow-up).
