# 0147 — Remote appearance sync: equipped cosmetics on the wire (P3)

**⚠️ SERVER CHANGE — merging triggers a Fly redeploy.**

Until now equipped clothing/pets were local-only: you saw your own
visor, nobody else did. This wires the four equip slots
(head/chest/legs/pet) through the identity pipe so every runner in the
sphere renders every other runner's cosmetics.

## Wire

- `PlayerState` gains `equippedHead/Chest/Legs/Pet` (state.ts). Appended
  string fields = **no PROTOCOL_VERSION bump** (same precedent as
  `level`, devlog 0119 note in state.ts).
- `packages/shared`: new `isValidItemId` — `^[a-z0-9_.]{1,32}$` shape
  gate. Server can't import the web shop catalog (separate package), so
  it shape-validates only; receiving clients re-validate against the
  catalog before rendering (never trust the wire).
- `sphere-room.ts`: the `'identity'` handler and `onJoin` options both
  accept the four fields, gated by `'' || isValidItemId(...)` (empty
  string = explicit unequip).

## Client

- `network.ts`: fields on `RemotePlayer` / `IdentityUpdate` /
  `JoinOptions`, snapshot defaults `?? ''`, join payload only sends
  non-empty, `sendIdentity` empty-guard, and four `listen()`s that all
  funnel into the existing **microtask-coalesced** `fireIdentity` — one
  callback per patch, not four (perf house rule).
- `appearance.ts`: new `resolveSlotAppearance(itemId, slot)` — resolves
  a *wire-supplied* id into the same descriptor shape the local rig
  uses. Null unless the id exists in the shop catalog, carries a
  rarity, and matches the slot it arrived on. This keeps the
  economy/shop isolation seam intact: scene.ts still only imports the
  appearance module, never shop internals.
- `scene.ts`:
  - `buildRemoteAvatar` now gives each remote rig **per-slot materials**
    (head/torso/legs were one shared material) plus a `petAnchor`
    group, returning SkinTargets so the existing `applySkin` path is
    reused verbatim for remote runners.
  - `applyRemoteAppearance` re-skins on join + identity patches, keyed
    by a `lastAppearanceKey` string so name-only identity updates don't
    re-run material work. Pets are built via the same
    `petGeometryFor`/`setSaturated` helpers as the local pet; disposed
    on unequip and on leave (`disposeRemotePet`).
  - On connect the join options carry the current
    `getEquippedAppearance()` snapshot; afterwards
    `subscribeAppearance` pushes an identity patch on every
    equip/unequip/hide toggle.

## Cost / perf

- Four extra small strings per player row; delta-synced, so idle cost
  is zero. No per-frame work: re-skin happens only on coalesced
  identity patches, and the appearance key skips no-op patches.

## Owner verify (two browsers)

1. Open two browsers, join the same sphere.
2. On A: equip a head item + a pet. Within a tick B renders both on
   A's rig.
3. Unequip on A → B reverts to the base shell.
4. Invalid/unknown ids (or slot-mismatched ids) render the base shell —
   `resolveSlotAppearance` returns null for anything not in the
   catalog.
