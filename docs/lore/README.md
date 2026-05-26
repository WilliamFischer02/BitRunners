# Lore notebook

Lore is developed via Q&A with the project owner. Don't invent unilaterally — ask questions, then record the answer here.

## How to add lore

Append a new file `NNN-topic.md` containing:
- The question(s) asked
- The owner's answer, lightly edited
- Any in-game implications (mechanics, naming, art direction)
- Open follow-up questions for the next round

## Sealed lore (`_sealed/`)

Plot beats that **must not surface in player-facing text** until released by the project owner. Engineering and design reference only. Do not quote in UI, NPC dialogue, marketing, or LLM-NPC system prompts.

## Index

| File | Topic |
|---|---|
| `001-the-cloud-and-server-space.md` | Cosmology: cloud-env.central, server-env.space, tokens |
| `002-the-admin.md` | The Admin: companion, shopkeeper, quest-giver, mystery |
| `003-classes-origins.md` | Origin stories for all 6 classes |
| `004-quests-and-samaritan-status.md` | Quest-givers and the two reputation tracks |
| `005-trade-depots-and-ports.md` | Depots, ports, vending — visual vocabulary of the world |
| `006-runner-lifecycle.md` | Upload, login, logout, aether |
| `007-data-economy.md` | Data ladder (bits→strings→serials→passcodes), Credits vs Tokens |
| `008-samm.md` | SAMM, the State Authored Money Machine (gambling NPC) |
| `009-proxy-wallet.md` | The proxy wallet — Tokens unlocked for bit_spekter |
| `_sealed/web-pullers.md` | ⚠️ SEALED future-event plot beat |

## Glossary (canonical names)

| Term | Meaning |
|---|---|
| **the cloud** | Slang. The habitable world. |
| **cloud-env.central** | Technical name of the world. |
| **Server Space** / **server-env.space** | The raw substrate around the Cloud. Source of tokens. |
| **bitrunner** / **runner** | A player's in-world avatar. |
| **The Admin** | Code-entity NPC. Companion, shopkeeper, quest-giver. Dangerous yet benevolent. |
| **The Company** | Corporate quest-giver. Builder of hash_kicker template bodies. |
| **Token** | Captured data scraps from Server Space. Scarce/premium currency. Coveted by The Admin. **Not** produced by the scrape mini-game; obtained via the **proxy wallet** (Credits→Tokens one-way, SAMM token prizes). See `007`/`009`. |
| **Credit** | Common, interchangeable currency. Earned by trading passcodes to The Admin/The Company. Lesser than a Token. See `007`. |
| **bit / string / serial / passcode** | Ascending refinements of scraped data (8× each). A passcode is the finished, tradeable artifact. See `007`. |
| **Aether** | Drifting offline-runner remnant. Passive world decoration. |
| **Samaritan Status** | Reputation. Two tracks: *Corporate* (The Company) and *BitRunner* (The Admin). |
| **Port / depot** | Physical interactable in the Cloud that exposes Server Space behind it. |
| **SAMM** | *State Authored Money Machine.* Government-profit gambling vending machine. Formal, jolly, impersonal. Bets Credits for a chance at rewards; Tokens stay locked (no wallet). See `008`. |
