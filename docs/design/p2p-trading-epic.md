# Design — Player-to-player trading (backend epic)

**Status:** PLAN ONLY — owner-requested before any build (Chunk D, sprint
0039). No trade code ships until this is reviewed and scheduled. Owner decision
on 2026-05-21: "plan the P2P backend epic first."

## TL;DR

Real player-to-player trading is a **backend epic, not a chunk**. It is
**hard-blocked on two things the project doesn't have yet**: (1) **live
accounts**, and (2) a **server-authoritative economy** for the assets being
traded. The current economy is device-local `localStorage` and the multiplayer
room is in-memory/ephemeral — neither can host a shared, cheat-resistant
marketplace. Recommended path: **do not start until Supabase auth is live**,
then migrate tradeable assets (items/pets/credits) to a server system-of-record,
then build the marketplace on Supabase Postgres with an **atomic, transactional
accept**. Estimated 4 phases. No new paid infra expected at current scale
(Supabase free tier), but DB usage must be watched.

## The feature (owner's words)

> Other players leave trade offers when they play. A list of available trades a
> player can view, or an "offer trade" button to create your own. Trades:
> item↔item, pet↔item, credit↔item, credit↔pet.

Tokens are **excluded** from trading (locked canon — bit_spekter has no wallet;
lore 003/007/008).

## Why today's architecture can't host it

| Need | Today | Gap |
|---|---|---|
| Offers visible to all, outliving a session | Colyseus room state is **in-memory, ephemeral** (Fly auto-stops, state wiped) | No durable shared store |
| Verify "you own X" / transfer it | Inventory + credits are **device-local `localStorage`** (`economy.ts`) — server never sees them | No server-authoritative ownership |
| Attribute "who offered / who owns" | Players are **guests**, no stable identity (auth scaffolded, **not live**) | No accounts |
| Cheat resistance | Device-local state is **trivially editable** (clicker design §12 explicitly allowed this *only* while it grants no multiplayer value) | Trading makes local items multiplayer-valuable → dupe/forge farm |

**Conclusion:** a device-local "marketplace" literally cannot show other
players' offers, and a client-trusted one would be a dupe exploit. Trading must
be server-authoritative.

## Existing scaffold we can build on

`supabase/migrations/0001_initial_schema.sql` already defines (unused until auth
lands): `profiles`, **`inventory`** (`user_id`, `item_id`, `item_type`,
`UNIQUE(user_id,item_id)`), `equipped_outfit`, `achievements`,
`samaritan_status`, emoticron tables — all with RLS + a new-user trigger.

**Missing for trading:**
- **No wallet/credits** anywhere (credits live only in `localStorage`). Needs a
  `profiles.credits` column or a `wallet` table.
- **No `trade_offers`** table.
- `inventory` has no quantity (one row per item) — fine for one-off cosmetics/
  pets, which is all we trade.

## Recommended architecture

**System of record = Supabase Postgres** (auth already lives there; relational
integrity + transactions are exactly what atomic trades need; free tier).

- **Not Cloudflare KV / Upstash for the exchange step** — eventually-consistent,
  no multi-key transactions → race conditions and dupes on accept. KV could
  *cache* the browse list, but Postgres is the source of truth.
- The **trade accept** is the dangerous part (two-sided ownership swap). Do it
  as a single `SECURITY DEFINER` Postgres function / transaction that locks the
  offer row (`SELECT … FOR UPDATE`), re-verifies both sides still own what they
  pledge, performs the swap, and closes the offer — so two acceptors can't
  double-spend one offer.

### New data model (sketch)

```sql
ALTER TABLE profiles ADD COLUMN credits BIGINT NOT NULL DEFAULT 0;

CREATE TABLE trade_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  give_kind TEXT CHECK (give_kind IN ('item','credits')),
  give_item_id TEXT,            -- when give_kind='item'
  give_credits BIGINT,          -- when give_kind='credits'
  get_kind  TEXT CHECK (get_kind IN ('item','credits')),
  get_item_id TEXT,
  get_credits BIGINT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','accepted','cancelled','expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);
-- accept_trade(offer_id, acceptor_id) : transactional swap (see above)
```

(Item↔item, pet↔item, credit↔item, credit↔pet all expressed as
give_kind/get_kind = item|credits, where pets are just items with a pet slot.)

## The crux: server-authoritative economy migration

This is the biggest, riskiest piece. Item ownership + credits must move from
device-local to DB-backed, validated server-side. Two scoping options (owner
Q below):

- **(A) Full server-authoritative economy.** Most secure; biggest migration —
  the clicker, shop, skill tree, SAMM all read/write balances via DB. Heavy.
- **(B) Server-authoritative only for tradeable assets.** Items/pets/credits
  become DB-owned and trade-validated; the clicker keeps earning device-local
  but **reconciles** balances to the server (push on change, server is truth for
  trades). Lighter, but needs a careful reconcile/anti-rollback design.

The economy already exposes the right seam: `exportProgress` /
`importProgress` / `migrateEconomyToAccount` (`economy.ts`). Recommendation:
**(B)** to scope the epic, accepting a documented reconcile design.

## Anti-cheat & moderation

- Ownership verified server-side on **create** and **accept**; client can't
  forge.
- Offers reference **catalog item ids only** (no free text) → within the
  existing no-free-text moderation rule. No new text surface.
- Rate-limit offer creation; cap open offers per user; offers expire (TTL).
- Trades require an account (guests excluded) — closes the anonymous-dupe vector.

## Cost

- Supabase **free tier** very likely covers browse/create/accept at the
  500-DAU target; trading adds modest DB reads/writes. **No new paid infra
  expected.** Flag: watch row counts (expire/sweep old offers) and egress.
- No Fly change (this is Pages + Supabase). Aligns with scale-to-zero posture.

## Phasing

0. **Auth live** (Supabase) — hard prerequisite. (Separate, already scaffolded.)
1. **Server-authoritative tradeable economy** — `profiles.credits` + populate
   `inventory` from `economy`; reconcile seam; server is truth for tradeables.
2. **Marketplace read + create** — `trade_offers` table, browse list at a
   depot/port (walk-up, mirroring SAMM), "offer trade" create UI.
3. **Atomic accept** — the transactional `accept_trade` RPC + transfer + UI.
4. **Polish** — expiry sweep, cancellation, rate-limits, empty/full states.

## Open questions for the owner (next round)

1. **Economy scope:** full server-authoritative (A) or tradeable-assets-only (B,
   recommended)?
2. **Marketplace reach:** global (any player, pure DB) or limited to players in
   the same sphere/room?
3. **Guests:** confirm trading requires an account (recommended yes).
4. **Offer limits:** expiry window? max open offers per player?
5. **Sequencing:** schedule this **after** auth lands (and likely after Chunk E
   tutorial). Confirm priority vs. other roadmap items.

## Recommendation

Park trading until **auth is live**. It is not a near-term chunk. When
scheduled, run phases 1→4 above on Supabase. Until then, if a "trades at the
depot" *feel* is wanted sooner, the fallback is **NPC/system-posted offers**
(no backend) — but that is a different feature from true P2P and would be its
own small chunk, not this epic.
