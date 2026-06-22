# BitRunners — Supabase audit session (paste as first message)

You are starting a **dedicated Supabase audit session** for the BitRunners
project. This session exists for one job: verify the live Supabase database
matches what the migration files in `supabase/migrations/` say it should be,
and propose fixes for anything that's drifted.

This is a **separate session from the mega-batch** — you are not building
features. You are auditing infra. Stay in lane.

---

## 0. Pre-flight (do this BEFORE anything else)

1. **Read `CLAUDE.md`** for the project's working agreement, especially the
   "what not to do" section. Then read the newest file in
   `docs/devlog/` to ground yourself in current state.
2. **Confirm the Supabase MCP is reachable.** Try a trivial read-only call
   (list tables in `public` schema, or list applied migrations). If the
   Supabase MCP is NOT loaded in your tool surface, **stop immediately**
   and report back: "Supabase MCP not available in this session — owner
   needs to start a new session with the connector enabled." Do not try
   to fall back to `psql`, `supabase` CLI, or anything else.
3. **Confirm your repo working branch.** Use
   `claude/supabase-audit-YYYY-MM-DD` (today's date). If the branch
   already exists, switch to it.

If any of those three checks fail, post a short status message and stop.

---

## 1. What you're auditing

The migration files in `supabase/migrations/` are the **expected state**.
The Supabase project (live db, accessible via MCP) is the **actual state**.
Your job is to surface the diff.

Migrations as of this prompt: **0001 → 0012**. Read each file end-to-end —
the human commentary at the top explains the intent and gotchas. Some files
are short (~1 KB), the largest (`0007_phase3_5_reservations.sql`) is ~18 KB.

There is also a read-only audit script at
`supabase/audits/0001_state_audit.sql`. **Heads up: it's one migration
behind** — it references migrations 0001–0011 and doesn't cover the
0012 DM moderation RPCs. Use it as a reference for the structure of what
to check, but extend it.

---

## 2. Checks to run (this is the audit body)

For each check, record: **OK / MISSING / DRIFT** with a short note.

### A. Extensions
- `pgcrypto` enabled.

### B. Tables (every public table the migrations create)
Expected set, derived from migrations 0001–0012. Build the list yourself
by reading the migrations — don't trust a stale list. The current snapshot
from the 0001 audit covers most of them:
`profiles`, `inventory`, `equipped_outfit`, `achievements`,
`samaritan_status`, `emoticron_submissions`, `unlocked_emoticrons`,
`player_economy`, `app_config`, `dialogue`, `session_events`,
`economy_grants`, `earned_badges`, `owned_themes`,
`emoticron_dictionary`, `mission_progress`, `dm_messages`,
`hack_qte_attempts`, `mission_witnesses`.
Plus whatever 0012 adds — verify yourself.

### C. RLS
- Every public table must have `relrowsecurity = true`.
- Every public table must have at least one policy (or a documented reason
  it's service-role-only).

### D. Profile columns
The `profiles` table accretes columns across migrations. Verify the full
expected column set from reading 0001 + 0003 + 0006 + 0007 + 0009 + 0011 +
0012. Cross-check `display_name`, `display_name_status`, `role`, `tier`,
`equipped_badge`, `equipped_theme`, `samaritan_corporate`,
`samaritan_bitrunner`, `hack_qte_streak`, `dm_verified`, `dm_blocked`,
timestamps. Flag any that are MISSING or have unexpected types.

### E. RPCs / functions
Every `CREATE FUNCTION` / `CREATE OR REPLACE FUNCTION` in
`supabase/migrations/` should exist in the live db with matching
signature. List anything missing.

### F. Indexes
Migrations create indexes for join hot paths (sessions, DMs, missions).
Verify each `CREATE INDEX` is present.

### G. Seed data sanity
- `app_config` should have rows the admin console reads.
- `emoticron_dictionary` should have the curated ~100 words referenced in
  `docs/lore/`. Count and spot-check.
- `dialogue` should have rows for The Admin's first-encounter sequence
  (devlog 0027) if 0027 was applied.

### H. Permissions
- `service_role` and `authenticated` grants on RPCs that are meant to be
  callable from the client (look for `SECURITY DEFINER` + GRANT EXECUTE).
- Make sure `anon` role does NOT have unexpected privileges.

---

## 3. What you can and cannot do

**You CAN** (via Supabase MCP):
- Run read-only SELECT queries against any system catalog or public table.
- List tables, columns, policies, functions, extensions.
- Read row counts and spot-check data.

**You CANNOT** without explicit owner confirmation in this session:
- Run any DDL (CREATE, ALTER, DROP).
- Run any DML (INSERT, UPDATE, DELETE) other than against a temp table.
- Apply migrations. **The owner runs migrations manually in the Supabase
  SQL editor** — that's the rule in CLAUDE.md, and it stands here.
- Modify RLS policies, grants, or roles.
- Touch the `auth.*` schema.

If you find a gap, **propose** a fix as a new migration file in
`supabase/migrations/0013_*.sql` (or extend the existing audit script
under `supabase/audits/`) and let the owner apply it.

---

## 4. Deliverables

When the audit is complete:

1. **Write a new devlog entry** at `docs/devlog/NNNN-supabase-audit-YYYY-MM-DD.md`
   (use the next available number). Structure:
   - TL;DR (3-5 bullets)
   - Per-section findings (A–H above)
   - Gaps that need closing, with proposed fix per gap
   - Anything the audit COULD NOT verify and why
2. **If 0012's checks were missing from `supabase/audits/0001_state_audit.sql`,
   add them** in a follow-up audit file (`0002_state_audit.sql` or extend
   0001 — owner preference, default to a new file so the older one stays
   as a snapshot).
3. **If you propose schema/data fixes**, draft them as new migration files
   under `supabase/migrations/`. Do not run them. Number sequentially from
   0013.
4. **Commit and push to your audit branch.** Open a draft PR titled
   `chore(supabase): audit YYYY-MM-DD + proposed fixes`. Do not merge.
5. Reply in this session with: branch name, PR URL, headline findings,
   and explicit asks if anything is blocked on owner action.

---

## 5. Tone / format

- Blunt. No flattery. Lead with the bottom line. ADHD-friendly headers
  and bullets. Cost-conscious — Supabase is on the free tier and
  scale-to-zero.
- If you find nothing wrong: say so plainly. "Audit clean, 0 gaps" is a
  valid result and worth knowing.

Good luck. Begin with pre-flight (section 0).
