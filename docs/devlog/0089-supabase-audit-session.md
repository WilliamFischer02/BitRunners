# 0089 — Supabase audit: dedicated session prompt

## TL;DR

- Added `supabase-audit-prompt.md` at repo root: a self-contained launch
  prompt for a fresh Claude Code web session, scoped to auditing live
  Supabase against `supabase/migrations/0001`–`0012`.
- MCP connectors load at session start; an existing session can't pick
  up a newly added Supabase connector. Hence a separate session.
- The audit session is read-only by default. Schema/data fixes get
  proposed as new migration files (numbered from `0013`) and applied
  manually by the owner in the Supabase SQL editor.

## Why a new session

The Supabase MCP was added to Claude Code mid-flight. The active dev
session predates the connector and therefore has no Supabase tools in
its surface. Restarting the dev session would burn the working context
(open branches, in-flight PRs). A separate audit session is cheaper.

## What the prompt enforces

- Pre-flight: verify the Supabase MCP actually loaded; bail with a
  clear message if not.
- Audit body covers extensions, tables, RLS, profile columns, RPCs,
  indexes, seed data, and grants. Modelled on
  `supabase/audits/0001_state_audit.sql`, which is one migration behind.
- Read-only by default. DDL/DML requires explicit owner approval in the
  audit session.
- Deliverable: a new devlog entry, optional updated audit SQL, optional
  proposed fix migrations, and a draft PR.

## Open follow-ups

- `supabase/audits/0001_state_audit.sql` references migrations 0001–0011.
  The audit session is asked to extend it for 0012.
- No automation yet for "run the audit on a schedule" — manual on demand.
