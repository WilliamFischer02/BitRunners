# 017 — Tether Hop & Chatter

## Question

Owner brief (paraphrased):

> Tether Hop is a minigame in which there are 3 "bands" / lines going from
> the game's horizon toward the player's viewport — think Guitar Hero or
> Beat Saber, with the 3 lines as "data channels". Waveform disturbances
> travel down the lines toward the player at gradually increasing rates.
> When the player taps the band as the disturbance arrives, the waveform
> is "captured" as **chatter**. Chatter exchanges to The Admin or The
> Company for credits.

## Answer (canon — owner Q&A 2026-06-08)

### Tether Hop

The third Protocols cartridge (after Scrape and Objectives). A Guitar-Hero
style lane minigame rendered in a 2D canvas — three vertical bands recede
to a horizon vanishing point; waveform disturbances scroll from the
horizon toward a strike line near the bottom of the play area.

- **Channels:** 3 (`ch-1`, `ch-2`, `ch-3`), tinted purple / green / orange.
- **Run duration:** 60 s per run.
- **Spawn cadence:** starts at 1.5 s, ramps to 0.48 s over the run.
- **Wave speed:** starts at `0.5 t-units/s`, ramps to `1.05 t-units/s`.
- **Strike line:** at `t = 0.92`; ±0.06 window counts as a hit.
- **Tap input:** single-finger pointerdown / tap. NO swipes (mobile-safe
  rule from `012-hack-qte.md`).
- **Reward:** each hit captures 1 chatter. Misses just don't count — no
  damage / streak break in v1.

### Chatter

A new device-local economy field (`EconomyState.chatter`, additive,
backward-compatible). Captured chatter is **not a currency** by itself —
the runner exchanges it to The Admin or The Company for credits.

Lore framing: chatter is fragmentary data the runner caught flying past
their terminal — not the polished output of a finished Scrape pipeline.
Both factions want it (for very different reasons), but the immediate
in-game payoff is the same.

### Exchange

- **Rate:** 1 chatter = 5 credits, regardless of faction.
- **Faction:** flavor-only in v1. Picking the Admin or the Company just
  changes the closing line. No Samaritan award yet — that lands when the
  full Admin / Company NPC interactions ship (Sub-Phase F follow-up).
- **All-or-nothing:** the v1 exchange UI consumes the entire chatter
  balance in one click. A future partial-exchange could split the
  transaction by faction.

## In-game implications

- `EconomyState` adds `chatter: number`. `normalize` seeds it to 0 for
  older v1 blobs. New helpers: `addChatter(n)`, `spendChatter(n)`.
- New `apps/web/src/games/tether-hop/game.ts` — pure 2D canvas + RAF
  loop. No three.js / shader work, no ASCII pass; the game runs inside
  its own modal panel.
- New `apps/web/src/games/tether-hop/TetherHop.tsx` — protocol panel:
  ready → running → result → exchange views.
- New `apps/web/src/games/tether-hop/Exchange.tsx` — two-faction
  exchange surface; mirrors the `MissionDialogue` two-choice button
  styling (purple = BitRunner, orange = Corporate).
- Protocols registry adds the cartridge: `key: 'tether_hop'`, glyph
  `≋`, corp-tinted edge.

## Owner-tunable values

| What | v1 default | Where |
|---|---|---|
| Run duration | 60 s | `game.ts` `RUN_DURATION_MS` |
| Initial spawn interval | 1.5 s | `game.ts` `BASE_SPAWN_MS` |
| Final spawn interval | 0.48 s | `game.ts` `FLOOR_SPAWN_MS` |
| Initial wave speed | 0.5 t/s | `game.ts` `BASE_SPEED` |
| Final wave speed | 1.05 t/s | `game.ts` `PEAK_SPEED` |
| Strike window | ±0.06 t | `game.ts` `STRIKE_WINDOW` |
| Exchange rate | 5 credits / chatter | `Exchange.tsx` `CREDITS_PER_CHATTER` |

## Open questions

- Should the run end early on N misses, or always run to the timer?
  V1 ships "always run to timer"; aborting is allowed but doesn't
  forfeit captured chatter.
- Faction loyalty mechanic: should chronic Admin-only / Company-only
  exchanges drift Samaritan? Owner to decide once Sub-Phase F's NPC
  interactions land.
- Token reward at high tier?  Currently chatter only converts to
  credits, mirroring the canon that bit_spekter cannot earn tokens
  natively (lore 003 / 009).
