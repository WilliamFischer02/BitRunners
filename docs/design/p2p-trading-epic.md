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

- **P0a — Auth UI redesign** *(client-only, buildable now)*: unified
  sign-in/sign-up page + password-peek + create-account. Inert until env set.
- **P0b — Room-code join** *(client+server, buildable now)*: `joinById` +
  Settings UI to enter a room code. Independent of auth.
- **★ OWNER SETUP GATE — auth live**: set `VITE_SUPABASE_URL` +
  `VITE_SUPABASE_ANON_KEY` in Cloudflare Pages and run the SQL migrations in
  Supabase (see `docs/setup/SERVICES.md`, devlog 0026). **Blocks P1–P4.**
- **P1 — Server-authoritative tradeable economy (B)** — add `profiles.credits`;
  mirror owned items into `inventory`; reconcile seam; server truth for
  tradeables.
- **P2 — Marketplace read + create** — `trade_offers` table (room-scoped,
  `expires_at = now()+72h`), browse list at a depot/port (walk-up, mirroring
  SAMM), "offer trade" create UI.
- **P3 — Atomic accept** — transactional `accept_trade` RPC + transfer + UI.
- **P4 — Polish** — 72 h expiry sweep, cancellation, rate-limits, empty/full
  states, same-room filtering.

## Owner decisions (locked 2026-05-21)

1. **Economy scope: (B) server-authoritative for *tradeable assets only*** —
   items/pets/credits become DB-owned + trade-validated; the clicker keeps
   earning device-local and **reconciles** balances to the server (server is
   truth for tradeables).
2. **Marketplace reach: same sphere/room.** Offers are scoped to the room
   you're in. Paired with →
3. **Room-code / join-room in Settings.** A join-by-code control lets players
   hop between active rooms (e.g. into a friend's resident sphere) so they can
   co-locate to trade. Colyseus `joinById` + a settings UI; server allows
   joining a known room id/code.
4. **Trading requires an account**, and the auth UI is **redesigned**:
   - One **unified sign-in / sign-up page** (replaces the current several
     buttons). Same form for both; choosing *sign up* reveals extra fields
     (**password + confirm password**).
   - **Password-peek** (show/hide) on both sign-in and sign-up.
   - A dedicated **create-account** flow.
   - *(Open sub-question: keep OAuth providers on the unified page, or go
     email/password-only — decide before building the auth UI.)*
5. **Offers expire after 3 days (72 h).**

## Sequencing (revised)

The only part that needs **owner setup** is auth going live (Supabase env +
migrations). Everything else is either unblocked or gated on that one action.

- **Buildable now, no owner action:** the **auth UI redesign** (client-only —
  ships inert until env is set, exactly like today's AccountSection) and the
  **room-code join** UI/plumbing.
- **Gated on owner action:** server-authoritative tradeables, the
  `trade_offers` table, and the atomic accept — these need auth *live*.

## Recommendation

P0a (auth UI) and P0b (room-code) ship now with **zero owner action** (inert/
standalone until auth is configured). P1–P4 are gated on the **owner setup
gate** (Supabase env + migrations). Recommended: continue the sprint with
**Chunk E (tutorial)** next — also unblocked — then P0a/P0b, and run P1–P4 once
the owner has done the Supabase setup. The "NPC/system-posted offers" fallback
remains a *different, smaller* feature if a depot-trade feel is wanted before
all this lands.
