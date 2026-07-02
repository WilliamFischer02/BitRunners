# 0117 — circuit_patch minigame (mega-batch 2 · 4.4)

## What

A new cartridge in the Protocols carousel: `// circuit_patch`, a
tile-placement puzzle. Route a POWER flow (thick amber) and a DATA flow
(thin cyan) from their border inlets to the opposite outlets **at the same
time**. Power conducts only along thick lines, data only along thin, and the
two never interconnect — `cross_bridge` is the only way they cross.

## Architecture

Board logic is a pure module so the win condition is unit-testable headless:

- **`circuit-core.ts`** — `Edge`/`Channel`/`PieceType`/`PlacedPiece`/`Board`,
  `connectors(piece)` (which channel each edge exposes, rotation-aware),
  `pathComplete(level, board, channel)` (BFS over `(cell, edge)` connector
  nodes — intra-piece: same-channel connectors are one wire; inter-cell: a
  shared edge conducts only when both pieces expose the same channel), and
  `isSolved = power && data`. `cellAt` / `setCell` are immutable, bounds-safe
  helpers (the repo runs `noUncheckedIndexedAccess`). Also holds the v1
  `CIRCUIT_LEVEL` + `circuitSolution()`.
- **`circuit-core.test.ts`** — 16 vitest cases. Encodes the intended solution
  and asserts the validator accepts it, plus: empty board rejected, wrong
  bridge rotation breaks both flows, a plain straight at the junction blocks
  data (proves the bridge is required), a single missing tile breaks its run,
  and power/data never bridge through a shared cell.
- **`CircuitPatch.tsx`** — lazy chunk (`CircuitPatch-*.js`, ~7 KB gzip 2.85).
  DOM/CSS grid in the terminal aesthetic; wires drawn as center→edge bars
  (power 6 px amber `#ffd860`, data 2 px cyan `#6cf0ff`). Tap a palette piece
  → tap a cell to place; tap a placed piece to rotate 90°; long-press /
  right-click to remove (returns to the palette). Win runs after every
  placement/rotation → a brief "circuit live" pulse, then the reward screen.

## v1 level

4×4 board. Power runs left→right across row 1; data runs top→bottom down
column 1; they cross at (1,1) via the single `cross_bridge` (rotated so power
is E–W, data N–S). Palette: 3 power straights, 3 data straights, 1 bridge,
plus 2 spare elbows so it isn't a paint-by-numbers exact fit. Level type
supports pre-placed immovable tiles (`fixed`) for future levels; v1 uses none.

## Reward (STOP-AND-ASK defaults — flag for tuning)

First-ever clear **100 credits**, repeat clears **20**. Tracked with a new
additive economy-blob field `circuitFirstClear` (defaulted `false` in
`normalize()`, so old blobs load clean; rides the `player_economy` sync like
every other cosmetic — no migration). First clear as a guest also fires the
4.3 account nudge (`nudgeAccount('minigame')`).

## Registry

New `PROTOCOLS` entry: key `circuit_patch`, label `circuit_patch`, glyph `⌗`,
tint `neutral`, launches via `CIRCUIT_PATCH_OPEN_EVENT`. Mounted in `App.tsx`
behind the same lazy `<Suspense>` shell as `freq_lock`.

## Follow-up

The 4.7(a) leaderboard popup (owner request) will hook the reward screen —
`circuit_patch` submits a completion score there. Not wired in this PR.

## Verify (owner)

- Open Protocols → the `circuit_patch` cartridge → insert. Place the straights
  along row 1 and column 1, drop the bridge at the center cell, rotate it
  until power (thick) runs across and data (thin) runs down. Both port pairs
  light → "circuit live" → reward.
- Rotate the bridge the wrong way: the circuit does not complete.
- Long-press (touch) or right-click (desktop) a placed tile removes it and
  returns it to the palette count.
- First clear pays 100 cr; play again → 20 cr.
