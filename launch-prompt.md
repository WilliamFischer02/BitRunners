# BitRunners — autonomous mega-batch 2 launch prompt (2026-07-01)

ultrathink

You are running in fully autonomous mode on the **BitRunners** repo on
branch `claude/mega-batch-YYYY-MM-DD` (already created and checked out
by the launcher). The owner has walked away — they will not be available
to answer follow-up questions during this session. Work at **maximum
effort and thoroughness**: read everything relevant before coding,
verify every change compiles and lints, and leave the repo in a
mergeable state.

## 0. Read these first, in this order

Do not skip this step. The whole session depends on knowing where the
project is RIGHT NOW.

1. `CLAUDE.md`
2. `.claude/handoff.md`
3. `.claude/decisions.md`
4. The newest files in `docs/devlog/` (read everything ≥ 0108 — the
   economy-persistence hardening in 0112 and migration 0016 changed how
   saves merge; your minigame rewards ride that system)
5. `docs/devlog/0004-roadmap-revised.md`
6. `docs/lore/README.md` (terminology glossary — use exact spellings)

After reading, do a one-paragraph readback in your own words covering:
phase / branch / what's blocked / what the active roadmap item is.

## 1. Working agreement (HARD rules — violating any is a session-stopper)

- **Never push to `main`.** Push to the working branch only. PRs open as **drafts**.
- **Never amend the lockfile by hand.** `pnpm install --frozen-lockfile` is the floor.
- **Never bypass `.claude/settings.json`** or its do-not-touch zones.
- **Never surface `docs/lore/_sealed/`** content in NPC dialogue, UI, or any player-facing surface.
- **Never add a paid resource.**
- **No new Supabase migrations in this batch.** Every reward/unlock in
  this batch rides the existing `player_economy.blob` additive-field
  pattern (see `.claude/decisions.md` 2026-06-16 emote-loadout entry and
  the merge rules in `economy-sync.ts` / migration 0016). If you believe
  a task truly needs schema, STOP: write the proposed migration's
  description + intended contents into `.claude/handoff.md` under
  "## proposed migrations" and leave the feature client-side. The owner
  has a separate Supabase agent that authors migrations against the live
  database.
- **Devlog every significant change.** New devlogs in `docs/devlog/NNNN-title.md`, next available number. Every PR has its own entry.
- **No new dependency without a devlog mention** (name, version, why).
- Before every commit: `pnpm exec biome check --write .` → `pnpm typecheck` → `pnpm build`. If any fails, **fix before committing.**
- The autonomous flag does NOT grant permission to delete branches, force-push, or interact with prod resources. Local tree + commits + draft PRs only.
- New economy fields must be **additive + defaulted** so old blobs load clean (`normalize()` pattern in `economy.ts`).

## 2. STOP-AND-ASK triggers

If you hit any of these, **stop, push what you have, leave a TODO comment
in the relevant file + a note in `.claude/handoff.md`, and move on to the
next task.** Do not invent answers.

- Minigame reward tuning — ship the defaults given below, flag in devlog.
- Protocol cartridge names — defaults below (`circuit_patch`, `core_run`); flag for rename.
- Any lore answer the canon files don't already specify (esp. void-room and glitch-switch flavour text).
- Anything that requires owner email / OAuth / secrets you don't have.
- Any task where you'd need a new migration (see hard rule above).
- Doubling-map edge cases you can't resolve from the code (e.g. server
  clamping you can't verify without a live deploy).

## 3. PR strategy

One PR per numbered task below. Each PR: own devlog entry, lints +
typechecks + builds clean, opened as **draft**, owner verification steps
in the body. Sub-branch per task off the mega-batch branch
(`claude/mega-batch-.../menu-pill`, `.../circuit-patch`, etc.).

Tasks 4.4 and 4.5 are large — staged PRs are fine (scaffold → mechanics
→ polish). Task 4.6 touches `packages/shared` + server: **flag in the PR
body that merging triggers a Fly redeploy.**

## 4. Priority order

Small, high-certainty wins first; the map rework last because it has the
widest blast radius.

### 4.1 Launcher pill says "Menu" instead of the class name

**What**: the HUD launcher pill (`.profile`, `apps/web/src/ProfileIcon.tsx`)
currently renders the player's class name (e.g. `bit_spekter`) as its
label, which reads as info, not as a button. Rename the visible pill text
to exactly `Menu` so it reads as the main menu affordance.

**Acceptance criteria**:
- The pill's cap/label text is `Menu`. The class name does NOT disappear
  from the game — keep it inside the opened panel (it's already there)
  and in the `.hint` line.
- aria-label updated to match ("open menu").
- No layout regression on mobile (≤ 540 px) or desktop — check the
  media-query variants in `style.css` that reposition `.profile`.

### 4.2 Character-select screen: obvious title + glowing options

**What**: the boot/class-select screen (`apps/web/src/Boot.tsx`) doesn't
announce itself. Add a clearly visible **"Character Select"** heading in
a DIFFERENT colour from the rest of the boot text, and give the class
option cards an animated glow so they are obviously interactive.

**Acceptance criteria**:
- Heading text exactly `Character Select`, styled in an accent colour
  distinct from the existing green/mono palette (suggest the BitRunner
  purple `#b07cff` family — matches faction tinting elsewhere).
- Class cards (locked AND unlocked states) get an animated glow:
  CSS keyframed `box-shadow` / `filter` pulse, ~2–3 s loop, stronger on
  hover/focus. The selectable card (bit_spekter + any unlocked classes)
  glows brighter than locked ones.
- `prefers-reduced-motion: reduce` → static glow, no animation.
- Do not change selection logic, order, or the locked-class behaviour.

### 4.3 Account-needed nudge

**What**: when a guest does something whose progress would only survive
across devices with an account, immediately prompt them with a small
modal that routes to account creation.

**Acceptance criteria**:
- New component `AccountNudge.tsx` + a tiny helper module that other
  systems call: `nudgeAccount(reason: string)`.
- Trigger points (guest only, each fires at most ONCE per session):
  first credits earned from any minigame, first shop purchase, first
  mission/objective completion, first badge earned, first emote-loadout
  change. (Tutorial-end already has its own CTA — leave it.)
- Modal copy: terminal aesthetic, explains progress is device-local as a
  guest, one primary button `[ make account ]` → dispatches the existing
  `bitrunners:open-profile` event (opens the account panel that already
  hosts sign-up), one secondary `[ later ]` → dismiss.
- Never shows for signed-in users. Never blocks input (dismissable, ESC
  works, backdrop tap dismisses).
- Reuse `.panel` styling; ≥ 44 px touch targets.

### 4.4 New minigame: `// circuit_patch` (circuit-routing puzzle)

**What**: a tile-placement puzzle. A grid board has a POWER inlet and a
DATA inlet on its border, each with a matching outlet on the opposite
corner/edge. The player places pieces from a fixed inventory to route
BOTH flows simultaneously from inlet to outlet. Power routes only along
THICK lines; data only along THIN lines; the two never interconnect.

**Mechanics (v1 — ship exactly this, tune later)**:
- Board: **4×4 placeable cells** (16 max tiles, per the owner's spec)
  with port stubs on the border. Level definition supports pre-placed
  immovable tiles (obstacles) for future levels — v1 level may use one.
- Piece types, each in a POWER (thick) and DATA (thin) variant:
  - `straight` — connects two opposite edges.
  - `elbow` — connects two adjacent edges.
  - `cross_bridge` — special: carries power straight through one axis
    AND data straight through the other axis without connecting them
    (this is how the two paths cross each other).
- Interaction: tap a palette piece to select, tap a cell to place; tap a
  placed piece to rotate 90°; long-press / right-click to remove. Pieces
  return to the palette on removal. Palette shows remaining counts.
- Win check: flood-fill from the power inlet along thick-line
  connectivity (two adjacent tiles conduct when both expose a thick
  connector on the shared edge) reaching the power outlet, AND the same
  for data along thin lines. Run the check after every placement /
  rotation; on win, play a brief "circuit live" pulse along both paths,
  then the reward screen.
- V1 ships **one hand-designed level** whose piece inventory admits at
  least one valid solution. **Write a unit test that encodes the
  intended solution and asserts the flood-fill validator accepts it**
  (vitest, pure functions — keep board logic in a `circuit-core.ts`
  module separate from the React component so it's testable headless).
- Rewards (STOP-AND-ASK defaults): first-ever completion 100 credits;
  repeat completions 20. Track via additive economy-blob fields
  (`circuitFirstClear: boolean`-style; defaulted in `normalize()`).
- Rendering: DOM/CSS grid in the terminal aesthetic (no three.js).
  Thick line = 6 px stroke, thin line = 2 px, both in the palette's
  existing tint colours (power = amber `#ffd860` family, data = cyan
  `#6cf0ff` family). Lazy-loaded chunk like `FreqLock`.
- Registry: new cartridge in `protocols-registry.ts` — key
  `circuit_patch`, label `circuit_patch`, glyph `⌗`, tint `neutral`.
  ESC / ✕ closes, same shell as freq_lock.

### 4.5 New minigame: `// core_run` (shrinking procedural maze)

**What**: inserting the cartridge teleports the runner to a separate
maze arena. Reach the CENTER of the maze before the timer expires. As
the timer counts down, the maze's outer rings progressively "dissolve
into raw data" — the playable map shrinks inward, adding urgency.

**Mechanics (v1 defaults — ship these, tune later)**:
- Maze: odd-sized grid (default **21×21** cells), generated with
  recursive-backtracker, entrance on the perimeter, goal at the exact
  center. After carving, apply light braiding (remove ~10 % of dead
  ends) so there are occasional loops.
- **Difficulty normalization** (the owner's key requirement — no unfair
  rolls): after generation, BFS the shortest path from entrance to
  center. Accept the maze only if path length ∈ a fixed band (default
  **[55, 85] cells** for 21×21). Regenerate up to 20 times; keep the
  closest-to-band candidate if none lands inside. Unit-test the
  generator: 50 seeded runs all produce accepted-band mazes and a
  reachable center (pure module `maze-core.ts`, vitest).
- Timer: default **90 s**. Dissolve starts at 60 s remaining: every
  **8 s**, the outermost intact ring converts to "raw data" — walls and
  floor cells render as scrambled ASCII glyph noise (reuse the glitch
  aesthetic from the boot dissolve) and become impassable void. If the
  ring containing the player dissolves, the run FAILS (eject back to the
  main map, no reward).
- The player navigates with the existing movement controls. Implement
  the maze as a **mode inside the existing scene** (hide the platform
  world group, render a maze group, move the rig to the maze entrance;
  restore on exit). Do NOT spin up a second WebGL context. Multiplayer:
  while in the maze the network session stays connected and the avatar
  simply appears parked to others — note this in the devlog as the v1
  default.
- Reaching the center: victory screen with time remaining → reward
  (STOP-AND-ASK defaults): 40 credits base + 1 credit per full second
  remaining, capped at 100 total. Repeat runs allowed.
- Minimap: hide/suppress the Starmap while in maze mode (it would leak
  the layout); restore on exit. ESC aborts the run (no reward) after a
  confirm.
- Registry: cartridge key `core_run`, label `core_run`, glyph `⍟`,
  tint `br`. Lazy chunk.

### 4.6 Double the base map + two interactive landmarks

**What**: double the platform's playable area and add two landmarks that
invite experimentation. **This is the widest-blast-radius task — do it
last, in its own PR, and flag the Fly redeploy.**

**Map doubling**:
- `PLATFORM_HALF` 19 → **38** (`PLATFORM_SIZE` 76) in
  `packages/shared/src/index.ts`. Client and server both consume the
  shared constant — verify every use: server room clamps/wrap, scene
  3×3 tiling, spawn scatter, collider placement, dweller wander bounds.
- **Fix the duplicated constant**: `apps/web/src/Starmap.tsx` hardcodes
  its own `PLATFORM_HALF = 19` — change it to import from
  `@bitrunners/shared` so it can't drift again. Bump the Starmap's
  `MAP_RANGE` (currently 22) to keep the minimap density readable at
  the new scale (suggest 30 — flag as taste).
- Re-scatter the Phase-3 obstacle set + add enough new obstacles that
  the doubled interior doesn't feel empty (aim ~2× the current count,
  keep them off the seam). Keep SAMM / obelisk / port / terminal at
  their current coordinates so existing anchors, missions, and lore
  stay valid.
- Verify the ASCII postprocess + fog still read correctly at the new
  extents; adjust fog distance if the horizon pops.

**Landmark 1 — the glitch switch**:
- A wall segment with a visible lever/switch mesh somewhere in the new
  interior. Interacting (walk-up + tap/E, same interaction pattern as
  SAMM) flips it and triggers a **full-screen glitch burst** for ~2 s —
  reuse/parameterize the existing boot-dissolve / aether glitch visual.
  Cosmetic only in v1. 10 s cooldown. Collider so it can't be walked
  through.

**Landmark 2 — the pressure-plate vault**:
- An enclosed roofless "building": 4 walls + a door gap, interior
  visible from the overhead camera. Inside: 4 floor pressure plates,
  each with a faint numeral glyph (1–4).
- Stepping on the plates **in order 1→2→3→4** (wrong plate resets the
  sequence with a brief flicker) teleports the runner to **the void**:
  a small, dark, featureless area far outside the platform (black
  floor, no fog glow, minimal light). The Starmap is hidden while in
  the void. Somewhere in the void stands a **free-standing door**
  (doorframe mesh, faintly lit). Walking through it teleports the
  runner back to just outside the vault on the main map, and the
  Starmap returns.
- Per-session only; no persistence. Multiplayer: same parked-avatar
  default as the maze — devlog it.
- Both landmarks need colliders in `COLLIDERS` and (if they can occlude
  the player) a check against the camera angle.

## 5. Housekeeping

- Update `.claude/handoff.md` at the end: a paragraph per task — status,
  PR number, what's left, plus the "## proposed migrations" section if
  anything wanted schema (expected: none; an optional
  `minigame_scores` leaderboard table is ALREADY sketched in devlog
  0113 for the owner's Supabase agent — don't build it).
- Append non-trivial calls to `.claude/decisions.md` (e.g. maze
  difficulty band, circuit reward numbers).
- Obvious broken things not in this list: fix only if < 10 lines and
  clearly correct; otherwise note in the handoff.

## 6. End of session

1. Final clean pass: `pnpm exec biome check --write .` → `pnpm typecheck` → `pnpm build`.
2. Any open draft PR failing its build: fix or revert before stopping.
3. Update `.claude/handoff.md` with what's outstanding, what was punted
   to STOP-AND-ASK, and what the owner needs to do next (including "run
   the Supabase agent for X" if any migration proposals exist).
4. Print a final summary listing every PR opened: number + title + status.

Begin with step 0.
