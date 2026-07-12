# 0153 — data_base: sky-grid multiplayer plots + visits (P7 Stage C)

**⚠️ SERVER CHANGE — merging triggers a Fly redeploy.**

The plot goes multiplayer. Every human gets a slot on an 8×8 grid
floating at y = +120 (64 units apart — 64 slots ≥ the 40-human cap);
entering data_base parks your pad at your slot and flips the P5 zone
wire to `plot:<idx>`, so plot isolation falls out of the existing
visibility filter. Tethered runners can visit each other's builds,
read-only, capped at 3 guests.

## Wire (no protocol bump — appended fields + new messages)

- `packages/shared`: `isValidZone` now also accepts `plot:<idx>`
  (strict `parsePlotZone`, idx < 64); sky-grid constants
  (`PLOT_GRID_COLS/SLOTS/SPACING/BASE_Y/GUEST_CAP/COORD_MAX`) +
  `plotSlotOrigin(idx)`.
- `PlayerState.plotIndex` (appended, default −1; NPCs stay −1).
  Server assigns the lowest free slot at join; slots free implicitly
  on leave (assignment scans current occupants).
- `'zone'` handler: a runner may claim only its OWN plot zone
  directly — someone else's plot is reachable only via `'visit'`.
- `'move'` handler: plot-zone positions are **clamped** to the grid
  extent instead of torus-wrapped (wrapAxis at ±38 would corrupt
  sky coords at ±224). Cloud/void moves wrap exactly as before.
- `'visit' {target}`: validates target (human, has a slot), counts
  current guests in the host's plot zone (cap 3), then moves the
  sender's zone server-side and replies `visit-ok {zone, hostUserId}`
  or `visit-denied {reason}`. The host uid rides back so the guest
  client can fetch the build via `get_voxel_plot` (0019) — an
  authenticated-RPC surface those uids already flow through.

## Client

- Own plot: `enterPlot` reads `getPlotIndex()` from room state, parks
  `plotGroup` at `plotSlotOrigin(idx)`, teleports the rig (incl. y),
  sends the zone, and **unfreezes outbound moves** (Stage A froze
  them). Offline / no session → plot stays at origin, moves frozen,
  remotes hidden — exact Stage A behavior.
- Visits: TetherChat's tethered panel gains `[ visit ]` → scene sends
  `'visit'` → on grant, fetches the host build (empty pad on fetch
  failure — migration 0019 unapplied etc.) and enters read-only
  Corporeal (`enterPlotVisit`): no editor, no tab switch, no saves;
  the HUD mounts in `// data_base · visiting` trim.
- Zone visibility: localZone is now derived as
  maze→null / plot→`plot:<idx>` (null offline) / void / cloud; plot
  occupants render at `PLOT_BASE_Y`. Name tags + emote bubbles
  project with the avatar's y.
- Voxel collision takes the slot origin (`slideMoveVoxel` grew
  optional origin args; existing tests unchanged via defaults).
- Reconnect mid-plot pops the runner back to the cloud — a fresh
  session may assign a DIFFERENT slot, and restoring a stale origin
  would strand the rig. The build is safe in the store.

## Fixed in passing (pre-existing P5 gaps)

Remote **interpolation** and **name-tag projection** were both gated
`!voidActive`, so void-mates rendered frozen at stale positions with
stuck tags — contradicting the 0149 acceptance ("both see each other
in the void, moving live"). Both gates are now maze-only (the maze is
genuinely solo); hidden avatars skip tag projection.

## Owner verify (two browsers, after Fly redeploy + migration 0019)

1. A opens data_base, builds a wall, exits. B (tethered with A) hits
   `[ visit ]` → B walks A's wall read-only; both see each other on
   the pad, name tags tracking.
2. B in the cloud no longer sees A while A edits (A vanished on
   entry, returns on exit).
3. Two more guests can join; a fourth gets `// plot visit denied —
   full` in the tether log.
4. Void regression check: two runners in the void now see each other
   MOVING (was frozen).

Gates: biome · typecheck 8/8 · test 85/85 · build 5/5 · bundle OK.
