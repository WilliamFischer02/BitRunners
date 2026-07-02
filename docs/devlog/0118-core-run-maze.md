# 0118 — core_run shrinking maze (mega-batch 2 · 4.5)

## What

A new cartridge, `// core_run`: insert it and the runner is dropped at the
edge of a procedural maze arena. Reach the glowing core at the center before
a 90 s clock expires. Starting at 60 s remaining, the maze's outer rings
dissolve into "raw data" every 8 s — the playable area shrinks inward; get
caught in a dissolving ring and the run fails.

## Architecture

- **`maze-core.ts`** (pure, unit-tested) — recursive-backtracker perfect maze
  on a 21×21 room grid, lightly braided (~10 % of dead ends reopened for
  loops), goal at the exact center, entrance on the perimeter. Deterministic
  from a seed (mulberry32). `generateMaze(seed)` reject-samples up to 24 seeds
  for **difficulty normalisation** (see below) and always returns a maze with a
  reachable center (it's carved from the center, so it's fully connected).
- **`maze-scene.ts`** — `MazeArena` turns a `MazeGrid` into three.js meshes:
  one floor plane, one **InstancedMesh** for all wall segments (cheap — 1 draw
  call), a glowing goal beam, and four dark "void" slabs that grow inward as
  rings dissolve. Exposes wall colliders, `cellToWorld`/`worldToCell`,
  `playableBound(rings)`, and `isInVoid`.
- **`scene.ts` maze mode** — a self-contained mode inside the existing scene
  (no second WebGL context). On enter: hide the 3×3 world tiles + mission
  markers + skybox + remote avatars, show the `MazeArena` group, teleport the
  rig to the entrance. The tick swaps in the maze colliders + a shrinking clamp
  and **skips all world work** (proximity triggers, network sendMove, minimap,
  remote interpolation/tags) — every change is guarded behind `mazeActive`, so
  the normal multiplayer/render path is byte-identical when not in a maze. The
  scene runs the maze clock (dissolve schedule, win = reach center, fail =
  caught by a ring or timeout) and reports progress via window events.
- **`CoreRun.tsx`** (lazy chunk) — the thin overlay: ready screen → a small
  top HUD that does **not** capture input (so you steer the rig normally) →
  victory / fail screens. Driven purely by window events
  (`bitrunners:core-run-enter` / `-abort`; scene fires `maze-tick` / `-win` /
  `-fail` / `-enter` / `-exit`). `Starmap.tsx` hides itself on `maze-enter`
  (the minimap would leak the layout) and restores on `maze-exit`.

## Difficulty band — decision (differs from the brief's number)

The brief suggested a shortest-path band of **[55, 85]** assuming a
wall-inclusive-cell metric. This implementation measures the path in
**room-to-room edges** on the 21×21 room grid, a different (roughly half-scale)
metric. Measured distribution of raw recursive-backtracker mazes: median ~52,
so the shipped band is **[30, 70]** (`BAND_MIN`/`BAND_MAX`). Empirically that
band accepts ~100 % of seeds within 24 attempts (measured over 500 seeds) while
still rejecting the trivial-short and marathon tails. Recorded in the decisions
log; tunable in one place.

## Multiplayer (v1 default)

While in the maze the network session stays connected but outbound moves are
frozen, so the runner simply appears **parked** to others in the shared sphere.
Documented here as the intentional v1 behaviour.

## Reward (STOP-AND-ASK default — flag for tuning)

40 credits base + 1 per full second remaining, capped at 100. Repeat runs
allowed. First clear as a guest fires the 4.3 account nudge. No persistence /
no economy field (unlike circuit_patch's first-clear flag) — every run is
independent.

## Tests

`maze-core.test.ts` (6 cases): 50 seeded runs all land in band with a reachable
center; determinism; center is the exact middle; entrance on the perimeter;
walls symmetric between adjacent rooms; `shortestPath` identity = 0.

## Follow-up

The 4.7(a) leaderboard popup (owner request) will hook the victory screen —
`core_run` submits its time-remaining score there. Not wired in this PR.

## Verify (owner)

- Open Protocols → `core_run` → `[ enter maze ]`. You teleport into a maze;
  the minimap disappears. Steer to the purple core beam → victory + reward.
- Wait past 30 s without finishing: the outer edge starts dissolving into dark
  glitch bands and the walkable area shrinks. Get caught → run lost.
- `abort` (HUD button or ESC → confirm) leaves the maze with no reward and
  restores you to where you were standing. The world + minimap return.
