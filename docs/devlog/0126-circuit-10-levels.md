# 0126 — circuit_patch: 10 escalating levels + per-player progress + stopwatch

Owner ask: "the power/data minigame worked well — make 10 unique starter levels
that elevate in difficulty" and "record progress per player so they pick up on
the level they left off on." Built by a `fable` subagent; all gates verified.

## Levels (`circuit-core.ts`) — solution-first, so solvability is guaranteed

- New `levelFromSolution(w, h, ports, solution, extraInventory?, fixed?)`: builds
  the canonical solved board (`makeBoard` + `setCell`), then derives the level's
  `inventory` from the solution's piece multiset (+ optional spares). Because the
  level is generated *from* a valid solution, it's solvable by construction.
- **`CIRCUIT_LEVELS`** (10) + parallel **`CIRCUIT_SOLUTIONS`**. Board sizes:
  L1–3 on 4×4, L4–6 on 5×5, L7–10 on 6×6. Escalation: straight run + 1 bridge →
  elbowed doglegs → longer weaves → 6×6 snakes with **fixed immovable obstacle
  tiles** (2 on L7–9, 3 on L10) and **distractor spares** (incl. decoy bridges)
  in the palette on the late levels. `CIRCUIT_LEVEL` stays an alias to L1.
- Nice geometry find (documented in-code): a border-to-opposite-border power run
  separates the data inlet's side from its outlet's, so data must cross power an
  **odd** number of times — bridge counts are 1 or 3, never 2.

## Tests (`circuit-core.test.ts`)

New suite: for every level i∈0..9, `isSolved(CIRCUIT_LEVELS[i],
CIRCUIT_SOLUTIONS[i])` is true, dims match, empty board is not solved, and both
channels have inlet+outlet ports. 28 circuit tests + 46 suite-wide, all green.

## Progress (`economy.ts`)

Additive `circuitLevel: number` (default 0, clamped 0..9 in `normalize()`) +
`getCircuitLevel()` / `advanceCircuitLevel()`. Rides the account-synced blob —
no migration.

## Shell (`CircuitPatch.tsx`)

Mounts on `CIRCUIT_LEVELS[getCircuitLevel()]`; header shows `level N / 10 · …·
m:ss` (a live **stopwatch**, reusing `.circ-sub` — no new CSS). Win keeps the
reward + leaderboard submit and **advances stored progress only when clearing
the frontier level** (replaying an old one via `[ again ]` can't skip ahead).
Win overlay gains `[ next level ]` (hidden on L10).

## Verify (owner)

Open circuit_patch → it resumes at your saved level, shows `level N/10` + a
running timer. Solve → `[ next level ]` advances and the next session resumes
there. Later levels are bigger with fixed obstacle tiles + spare pieces.
