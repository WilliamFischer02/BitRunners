# 007 — The data economy (bits → strings → serials → passcodes → Credits)

Recorded from owner Q&A, 2026-05-16. Drives the Data Scrape mini-game
(`docs/design/clicker-minigame.md`).

## Questions asked

1. Progression persistence before accounts exist — IP-correlated guest sync, or
   something privacy-safe?
2. There's a "credits" and a "tokens" currency. How do they relate, and how does
   that sit with canon (Token = scarce Server-Space currency; `bit_spekter`
   cannot earn Tokens — proxy-wallet planned, lore 003)?
3. Is the tier "cereals" actually **serials**? Ratios?

## Owner's answers (lightly edited)

1. **Device-local progression now**, migrating into the account when auth lands.
   No IP correlation.
2. **Two currencies. `Token` = premium ("gem"), scarce — unchanged canon.
   `Credit` = common ("coin"), interchangeable — this is what the data-scrape
   ladder produces.** `bit_spekter` earns **Credits only**; Tokens remain gated
   behind the planned proxy-wallet unlock and Server Space. The clicker must
   never mint Tokens.
3. **Serials.** Uniform **8×** ladder: 8 bits = 1 string, 8 strings = 1 serial,
   8 serials = 1 passcode.

## Canon (this extends; it does not contradict prior lore)

- **Token** is **unchanged** from the glossary: captured Server-Space data
  scraps, scarce, coveted by The Admin. It is **not** produced by the scrape
  mini-game. (Preserves lore 003: `bit_spekter` has no valid wallet.)
- **Credit** is **new**: the common, interchangeable currency a runner earns by
  trading finished **passcodes** to a quest-giver. The mundane in-Cloud money,
  distinct from Server-Space Tokens.
- **bit / string / serial / passcode**: ascending refinements of scraped data.
  Raw **bits** are scraped; refined upward; a **passcode** is the finished,
  tradeable artifact both factions value (for opposite reasons).

## In-game implications

- **The Company** accepts passcodes, recycles them, thanks the runner and asks
  them back — corporate loop. Earns **Corporate Samaritan** (+1). (Consistent
  with `004-quests-and-samaritan-status.md`, `003` hash_kicker/Company.)
- **The Admin** accepts passcodes and **destroys them to protect user privacy** —
  consistent with the dangerous-yet-benevolent framing in
  `002-the-admin.md`. Earns **BitRunner Samaritan** (+1).
- Reputation reward curve is **still open** (faction-reward Q&A, see
  `.claude/handoff.md`) — for now a trade only increments a raw counter.

## Glossary additions (mirror into README)

| Term | Meaning |
|---|---|
| **bit** | Smallest scraped unit of data. 8 → 1 string. |
| **string** | 8 bits. 8 → 1 serial. |
| **serial** | 64 bits (8 strings). 8 → 1 passcode. |
| **passcode** | 512 bits. The finished, tradeable artifact; valued by The Admin (destroys it) and The Company (recycles it). |
| **Credit** | Common, interchangeable currency. Earned by trading passcodes. Distinct from (and lesser than) a Token. What `bit_spekter` can earn. |
| **Token** | *(unchanged)* Scarce Server-Space scrap; premium. **Not** clicker-minted; `bit_spekter` cannot earn it (proxy-wallet planned). |

## Open follow-ups (next round)

- Faction-**reward** curve for Samaritan tracks (blocks meaningful reputation).
- When/how **Tokens** enter play; proxy-wallet unlock interaction with the
  ladder for non-`bit_spekter` classes.
- Does destroying vs recycling passcodes have any later world consequence
  (privacy meter, Company favour)? — defer, do not invent.
