# 0013 — Vertical glow gradient on character + tighter contrast

**Date:** 2026-05-09

Owner feedback on the live build: joystick perfect, FPS solid 60, character glyphs near vision. Asks:

1. Bigger contrast between background and character (still wants more pop)
2. More overall brightness/glow on the character
3. **Vertical gradient: bright at top of head → dim at the feet** where character "meets the ground"

Mobile FPS probe **passes**: 60 fps median on iPhone Safari. Recording the result against the Phase 1 exit criterion in the active roadmap.

## Implementation

The rig used three shared materials (`armor`, `dark`, `accent`) for every body part. That made head/torso/legs all glow at the same level — no way to gradient. This commit splits each into height-banded variants and reassigns body parts to the right band.

### New material set

| Material | Color | Emissive | Intensity | Used on |
|---|---|---|---|---|
| `armorHead` | `0xeef2f6` | `0x3a424c` | **1.6** | head sphere |
| `armorTorso` | `0xe4e8ec` | `0x222830` | **1.0** | torso, both arms |
| `armorLegs` | `0xc8ccd2` | `0x0c0e12` | 0.35 | both legs |
| `darkUpper` | `0x52565c` | `0x1c2028` | 0.8 | visor, chest plate, belt seam, both hands |
| `darkLower` | `0x3a3e44` | `0x060810` | 0.2 | both boots |
| `accent` | `0xcfd6e0` | `0x4a5a6e` | **1.2** | visor cross |

Going from head → feet: emissive intensity drops 1.6 → 1.0 → 0.35 → 0.2. Boots have almost no self-glow, so they read as the darkest part of the figure where it meets the floor. Visor cross gets a bright accent emissive so the bit_spekter's signature mark is clearly readable.

This produces a clear vertical gradient in luminance even before scene lighting is applied. Combined with the directional sun (top-down hitting the head/shoulders harder), the head reads close to the brightest end of the character ramp (`@`/`&`) while the boots sit near the low end (`-`/`:`).

### Tighter overall contrast

`backgroundDim` 0.5 → **0.42**. Non-character output is now at 42 % of the character's intensity — a ~58 % drop. Combined with the boosted character emissive, the contrast gap is roughly twice what it was in 0011.

## Knobs to tune (no code change needed if owner wants to nudge)

In `apps/web/src/scene.ts`:

- `backgroundDim` — current 0.42. Lower = more dramatic dim. 0.35 would be aggressive; 0.55 gentler.
- `emissiveIntensity` per material — head/torso/legs ratios. Currently 4.5 : 3 : 1.

## Mobile probe — passing

| Device | Median FPS | Threshold (target / acceptable) | Result |
|---|---|---|---|
| Owner's iPhone | **60** | 30 / 20 | **PASS** ✅ |

Logging this against `docs/devlog/0004-roadmap-revised.md` Phase 1 exit criterion. Ready to graduate from Phase 1 visual work into Phase 2 networking once the owner confirms the gradient lands well.

## Build

- 28 files lint-clean, build green
- Bundle: 636.85 → 637.18 kB (+0.3 kB for the additional material objects)

## What's next

Per the roadmap, with the mobile probe passing and visuals approved, we're at the **Phase 1 → Phase 2 transition**. Phase 2 brings:

1. `apps/server` real Colyseus + Fastify + Lucia auth
2. Email magic-link login → Neon Postgres users table
3. Single sphere room, two players see each other
4. Aether-on-disconnect via Upstash Redis
5. SPF/DKIM on `bitrunners.app` for transactional email

Before flipping to Phase 2 networking work I'd suggest one more visual round (Stage B v0.2 normal pass behind a flag) only if the owner wants it now — otherwise I land it later as polish. Awaiting direction.
