# 0056 — Class identity: per-class rigs, pet behaviours, CRT tweak

**Date:** 2026-05-28
**Branch:** `claude/class-identity-and-pets`

Phase 2 of the six-part feature push. Three threads:

1. **All six classes now render visually distinct**, grounded in the lore at
   `docs/lore/003-classes-origins.md`.
2. **Each pet has a distinct motion behaviour** (not just a distinct shape).
3. **CRT chromatic aberration cut to ~⅓ strength** (owner feedback on PR #54 —
   the tweak landed *after* #54 was merged, so it's bundled into this PR).

## Per-class visual identity (new `apps/web/src/class-rigs.ts`)

All six classes share the **identical rig skeleton** (root → visual → chest/hip,
the same arm/leg pivot groups, a `petAnchor` on the chest) and the same
`ClassRig` return shape, so the animation code in the tick loop drives them all
unchanged. Differences live in body geometry, props, and material palette.

Designs (grounded in the canon lore on each class):

| Class | Silhouette cue | Palette | Distinct props |
|---|---|---|---|
| **bit_spekter** *(baseline)* | Heavy plate, crosshair visor | white/grey | antenna, segmented chest plate |
| **server_speaker** | Tall, slim, draped | bluish-white + gold trim | comm-ring on head, robe-skirt cone, face band (no crosshair) |
| **data_miner** | Hunched, stocky, weighted | drab institutional green/grey | static `root.rotation.x = 0.08` hunch, backpack box, orange jumpsuit tag + ankle bands |
| **terminal_runner** | Asymmetric, clustered | purple/teal with strong emissive | octahedral head, four offset cube shards orbiting torso, emissive seam |
| **hash_kicker** | Symmetric, industrial, branded | chrome with Company orange | single visor strip (no crosshair), brand stripe down chest, exaggerated shoulder pads |
| **web_puller** | Authority figure, caped | dark purple/black with gold | flat halo ring above head, cape panel behind torso |

### Optimisation notes baked into Phase 2

- **Shared limb geometries.** `G_ARM_UPPER`/`ELBOW`/`LOWER`/`HAND`/`THIGH`/
  `KNEE`/`SHIN`/`BOOT` are allocated **once at module load** and reused across
  every class rig — limbs are visually similar enough across classes that
  sharing the BufferGeometry is correct. The previous code allocated a fresh
  geometry per Mesh per rig build; with five additional classes (and an
  eventual per-class remote variant) that would have multiplied.
- **Materials are still per-rig** because clothing tints mutate them; sharing
  here would smear tints across classes.
- **No per-frame allocations** in the new code paths.

### Hunched data_miner — why `root.rotation.x`, not `chest.rotation.x`

The tick animation **overwrites** `chest.rotation.x` every frame (`walkActive *
LEAN_CHEST`), so a build-time chest tilt would be erased the moment the player
moved (or, worse, faded back to upright at idle). `root.rotation.x = 0.08` lives
outside the animation surface and stacks cleanly with chest/hip motion.
Camera follow uses `root.position` (not rotation) so the camera doesn't tilt.

### Locked-class debug seam

The class-select grid still only unlocks `bit_spekter` (+ `server_speaker` via
tutorial completion). For visual QA of the other four, `?class=NAME` overrides
the boot selection. Validated against `isValidClass()` so a typo falls through
to the boot-selected class.

## Per-pet movement behaviour (new `apps/web/src/pets.ts`)

`petGeometryFor()` (distinct primitive per pet) **and** the per-pet motion now
both live in `pets.ts`. The tick loop's pet block shrinks from four lines to
one (`applyPetBehaviour(petId, rig.petAnchor, petMesh, elapsed)`). No
per-frame allocations.

| Pet | Geometry | Behaviour |
|---|---|---|
| `pet.byte_pup` | sphere | fast orbit, bouncy short hops near floor |
| `pet.glint_drone` | octahedron | steady mid orbit, slow self-rotation |
| `pet.null_kit` | tetrahedron | irregular tumble on all three axes |
| `pet.spark` | cone | quick darting — orbit radius wobbles in/out |
| `pet.mote_ultra` | icosahedron | wide slow arc + gentle breathing scale |
| `pet.token_seraph` | torus | flat halo, fast self-spin, slow drift |
| *(no pet equipped / default)* | box | the prior shipped behaviour (no regression) |

## Per-class clothing impact (free, no new code)

The `applyAppearance` path is unchanged. With each class now having distinct
**base armour materials** (different colour, roughness, metalness, emissive),
the same clothing palette overlay naturally reads different on each class —
slate on the chrome `hash_kicker` glints; the same slate on the matte
`data_miner` looks like dyed cotton. If owner wants the differences louder, a
per-class palette amplifier multiplier on `applySkin` is a one-line follow-up.

## Per-class remote players (palette-only this PR)

`buildRemoteAvatar(className)` now picks armour/dark/emissive from a
`REMOTE_LOOKS` table per class. The 6-mesh shell stays the same (no per-class
props yet — that's Phase 7's lightweight extension), so multiplayer cost is
identical but every remote runner is colour-identifiable at a glance.

## CRT aberration tuning

`createCrtPass({ … aberration: 0.4 })` → `0.13`. Owner feedback on PR #54
preview — the chromatic split was reading too strong. (My follow-up commit
landed *after* #54 was merged, so it didn't make it into `main`; bundled here.)

## Files changed
- `apps/web/src/class-rigs.ts` — new (all six rig builders + shared helpers +
  `ClassRig` / `SkinTarget` / `ClassId` types + `isValidClass`).
- `apps/web/src/pets.ts` — new (`petGeometryFor` migrated; `applyPetBehaviour`
  new).
- `apps/web/src/scene.ts` — remove the migrated code; import the new modules;
  add per-class `REMOTE_LOOKS` table + class-aware `buildRemoteAvatar`; rename
  `_className → className` and add `?class=` override; aberration `0.4 → 0.13`.
- `docs/devlog/0056-class-identity-and-pets.md` — this file.
- `.claude/handoff.md` — updated.

## Honest status
- Gates green: `pnpm lint` clean (54 files), `pnpm typecheck` 8/8,
  `pnpm build` 5/5.
- **Not verifiable headless.** Visual identity needs a browser. Eyeball each
  class via `?class=server_speaker`, `?class=data_miner`, etc. (Tutorial unlock
  also still works for `server_speaker`.) Pet behaviours need an equipped pet.
- No new dependencies. No protocol bump.

## Next (Phase 3)
2× world (`PLATFORM_HALF 9.5 → 19`) + obstacle collision (still none; movement
is free at `scene.ts:~1130`) + render the server's existing `npc:*` entries
(currently ignored) as robot/husk/spirit dwellers. Separate branch off latest
`main`.
