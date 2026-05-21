# 0042 — Chunk D: P2P trading scoped as a backend epic (plan only)

**Date:** 2026-05-21
**Branch:** `claude/bitrunners-collaboration-EcqBv`

Chunk D turned out not to be a chunk. The owner clarified that trade offers are
**player-to-player** (browse others' offers, post your own; item↔item, pet↔item,
credit↔item, credit↔pet — Tokens excluded per canon), not NPC-posted.

## Why no code shipped

Real P2P trading is hard-blocked on architecture the project doesn't have:

- Economy is **device-local `localStorage`** — the server never sees what you
  own, so it can't verify or transfer it.
- The Colyseus room is **in-memory/ephemeral** — can't host a durable, shared
  offers list.
- **Auth isn't live** — no stable identity to attribute ownership.
- Device-local state is editable → a client-trusted market is a dupe exploit
  (the clicker design §12 allowed device-local *only* while it grants no
  multiplayer value; trading breaks that).

Offered the owner three paths (scaffold-local + seam / NPC-posted trades now /
plan the backend epic). **Owner chose: plan the epic first.**

## Deliverable

`docs/design/p2p-trading-epic.md` — the reviewable plan:

- Hard prerequisites: **live accounts** + **server-authoritative tradeable
  economy**.
- System of record = **Supabase Postgres** (transactions for an atomic
  `accept_trade`; not KV/Upstash for the swap). Builds on the existing
  `supabase/migrations/0001` scaffold (`profiles`/`inventory`/`equipped_outfit`);
  gaps = no wallet column, no `trade_offers` table.
- Anti-cheat (server-verified ownership, account-gated, catalog-only items),
  cost (Supabase free tier; no new paid infra expected), and a 4-phase plan.
- Open questions for the owner (economy scope, global vs same-sphere, guest
  exclusion, offer limits, sequencing).

## Recommendation

Park trading until auth is live; it's not a near-term chunk. Sprint continues
with **Chunk E (tutorial + server_speaker unlock)** next, which has no backend
dependency.

## Files

`docs/design/p2p-trading-epic.md` (new), this devlog, `.claude/decisions.md`,
`.claude/handoff.md`. No code.
