# 0127 — Round-2 fixes: maze, landmarks, minimap, freq_lock

Four owner-reported fixes that all touch the scene / HUD / CSS, committed
together (shared `scene.ts` + `style.css`).

## core_run maze (`maze-scene.ts`, `scene.ts`, `CoreRun.tsx`)

- **Wider alleys**: `MAZE_CELL` 1.25 → **1.8**, `WALL_T` 0.22 → **0.18** — much
  roomier corridors for easier navigation.
- **Visible closing storm**: the dissolve slabs were dark + short and got missed.
  They're now **hot-magenta, high-emissive walls that tower** (height 2.6× the
  maze walls) so the raw-data storm is plainly seen closing in from the edges.
- **Countdown**: the scene now emits `nextIn` (seconds until the next ring
  dissolves, or until the storm begins) on `maze-tick`. The CoreRun HUD shows a
  pulsing red `storm ▓N · Xs` / `storm in Xs` readout so the stakes read.
- **Center arrow**: the feet-arrow (below) points to the maze core while in the
  maze.

## Landmarks (`scene.ts`)

- **Beacon cones**: hovering, glowing, downward-pointing cones above SAMM, the
  obelisk, and the glitch switch (in `worldTile`, so they clone across tiles).
- **Player-feet arrow**: a glowing ground arrow at the runner's feet that points
  to the **nearest** landmark (SAMM / obelisk / vault / glitch switch / active
  mission checkpoint) when within ~22 units, re-aiming as the closest changes;
  in the maze it points to the core. Skipped in the void.
- **Glitch switch visibility**: brighter lever, a glowing camera-facing "interact"
  panel, and a beacon above it — it's now clearly a landmark and interactable
  (proximity prompt already existed). Kept axis-aligned so its collider matches.

## Minimap (`Starmap.tsx`, `minimap-state.ts`, `style.css`)

- **Dot colors**: NPC dots stay purple; **human player dots are now green**
  (distinguished by the `npc:` id prefix). Local player stays the green center
  marker.
- **Smaller/thinner** character dots (remotes + player).
- **Vault label**: the pressure-plate vault is now a labelled minimap anchor
  (`VAULT`, cyan) like SAMM / ADMIN.
- **Legibility**: `MAP_RANGE` 34 → **26** (a local-navigation window, so markers
  aren't cramped at the doubled scale).
- **Fullscreen fix**: the expanded minimap's backdrop + wrapper + canvas are now
  `pointer-events: none` (only the ✕ card stays interactive), so the on-screen
  **joystick works while the map is maximized on mobile**; the canvas was already
  a locked square (no stretch). Close via ✕ or ESC.

## freq_lock rewrite (`FreqLock.tsx`, `style.css`)

Rebuilt as the "tesseract of audio signals" the owner described:

- **3 corner lanes**: one from the top-right (angling down-left), one top-left
  (down-right), one from top-center straight down — their tap targets cluster
  low-center (the "user").
- **Waveform blips** replace the falling dots: each note is a faux, randomly
  generated audio waveform (bars) that **swells silent → loud** as it travels
  its lane. Tap the matching lane ( J / K / L / arrows / touch the target ) the
  instant it reaches the target for max points.
- Scoring, timer, credits, and the leaderboard submit are unchanged.

## Verify (owner)

Maze: alleys are wide; past 30s a bright magenta storm visibly closes in with a
HUD countdown. A feet-arrow points to the core (maze) or the nearest landmark
(overworld). Beacons hover over SAMM/obelisk/switch; the switch is obvious +
interactable. Minimap: green players vs purple NPCs, a VAULT label, and the
joystick works while the map is fullscreen. freq_lock: three corner lanes with
swelling waveforms.
