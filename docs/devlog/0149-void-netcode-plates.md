# 0149 — Void netcode + plate press polish (P5)

**⚠️ SERVER CHANGE — merging triggers a Fly redeploy.**

The vault void room was single-player: entering it left your avatar
parked in the cloud for everyone else, and anyone else in the void was
invisible to you. Now the void is shared space.

## Zone wire

- `packages/shared`: `ZONES = ['cloud', 'void']` + `isValidZone`
  allowlist. P7C (sky-grid plots) will extend this with `plot:<idx>`.
- `PlayerState.zone` (default `'cloud'`) — appended string field, **no
  protocol bump**. NPCs never leave `'cloud'`.
- Server `'zone'` message: allowlist-gated store, nothing else. Moves
  keep flowing on the existing delta path regardless of zone.

## Client

- `network.ts`: `zone` on `RemotePlayer` (snapshot default
  `'cloud'`), `sendZone()`, and a `listen('zone', fireUpdate)` — zone
  rides the coalesced *update* microtask since visibility filtering
  lives next to positioning.
- `scene.ts`:
  - `applyRemoteZoneVisibility` / `refreshRemoteZoneVisibility`: a
    remote renders only when it shares the local zone (maze is still
    solo → all hidden there). Applied on join, on zone patches, and on
    local transitions — **never per frame**.
  - `setWorldVisibleForMaze(true)` now restores remotes zone-filtered
    instead of en masse.
  - `enterVoid` sends `'void'` + refilters; `exitVoid` sends
    `'cloud'` (the `setWorldVisibleForMaze(true)` inside it refilters).
    Reconnects re-send `'void'` if the runner is mid-void.
  - **Outbound moves now send in the void** (the old gate froze them):
    void coords are |x,z| ≤ 14, safely inside the wrap range, and
    cloud runners hide void players anyway.
  - Feet compass: in the void it points at the exit door (no wrap;
    hides when standing on it).
- Plate polish: plates now keep their tile meshes (`plateTiles`) —
  a lit plate **depresses 0.05y** and flashes emissive 2.8 → settles
  to 1.7 via a scalar decay inside `checkVaultPlates` (no timers, no
  allocation). Unlit restores height + 0.5. Plates were already
  unlit on teleport (resetPlateLights in both directions).

## Deferred (deliberate)

Broadcasting plate *presses* so other runners see the sequence light up
requires a server relay + remote plate-state tracking — not trivially
cheap, deferred per the brief. The plates are a solo puzzle for now;
the void behind them is shared.

## Owner verify (two browsers)

1. A and B in the same sphere, standing near each other.
2. A steps the plate sequence → teleports to the void → **A vanishes
   from B's cloud view** (avatar + nametag).
3. B follows through the plates → both see each other **in the void**,
   moving live.
4. A walks into the door frame → back in the cloud; B (still in void)
   no longer sees A, and vice versa.
5. Plates: each correct step visibly depresses + flashes the tile.
