# 008 — SAMM, the State Authored Money Machine

## Question(s) asked

For the gambling-machine NPC: what is it, what's its name, and what's its personality? And how does it treat Tokens vs Credits (given `bit_spekter` canonically has no Token wallet)?

## Owner's answer (lightly edited)

The character is the **State Authored Money Machine — "SAMM"**: a
government-profit machine that lets runners **bet** Credits (and, in principle,
Tokens) for a chance at rewards. Personality: **incredibly formal and overly
jolly, but not very personal** — a cheerful bureaucrat in a vending-machine
shell that is delighted to take your money for the good of the State.

## In-game implications

- **Identity / voice.** SAMM speaks in formal, jolly, impersonal civic-service
  register — "valued participant", "the State thanks you", "noted in the
  ledger". Warmth without intimacy. Never uses the player's name; addresses
  everyone as a citizen/participant.
- **Mechanic.** A real gamble with a **house edge** (the State profits): a
  single pull can lose outright. Weighted outcomes — most pulls lose or pay
  small, item wins are rare, Token wins are very rare. (Numbers live in
  `apps/web/src/samm.ts`, single tunable source.)
- **Currency canon (unchanged).** Betting and winning **Credits** is fully
  functional. **Tokens stay hard-locked**: `bit_spekter` has no Server-Space
  wallet (see `003`/`007`), so the "bet Tokens" option is shown but disabled,
  and a Token *win* is recorded as locked winnings the player cannot yet spend
  — surfaced as the planned **proxy-wallet** hook, not a canon break.
- **Placement.** SAMM is the **vending machine** already standing in the world
  (the depot/port/vending vocabulary, lore `005`) — repurposed, not a new prop.
  Walk-up proximity opens the betting terminal.
- **Tone guard.** SAMM is benign civic kitsch. It must not surface any
  `_sealed/` plot material; its cheer is surface-level, not a plot reveal.

## Open follow-ups (next round)

- Does SAMM ever give quests / Samaritan reputation, or is it purely a money
  sink? (Currently: pure sink, no reputation.)
- What does a Token win actually unlock once the proxy-wallet ships?
- SAMM's relationship (if any) to The Company vs The Admin — currently
  unaffiliated "the State". Confirm before tying it to a faction.
