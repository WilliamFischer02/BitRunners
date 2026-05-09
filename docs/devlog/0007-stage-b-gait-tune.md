# 0007 — Stage B silhouettes + natural gait + visual tuning

**Date:** 2026-05-09

Owner feedback on the live build:
- "Lighting almost too contrasting without much of a gradient" — softer ramp shaping, dithering
- "Slight rotational additions for a more natural gait" — torso counter-twist, hip roll/yaw
- "Viewport angle slightly higher (more downward)" — steeper iso camera
- "If continuing with depth and other visual elements gets us closer sooner, follow that path" — green-light Stage B

All four addressed in this commit.

## Stage B v0.1 — silhouettes via depth-edge detection

The ASCII pass now reads the scene's depth buffer and emphasizes silhouettes by overriding glyph selection to a full block (`█`) wherever the depth gradient is sharp.

### Pipeline change

- The composer now uses an explicit `WebGLRenderTarget` carrying a `DepthTexture` (`UnsignedShortType`). Previously the depth was discarded after the render pass.
- That depth texture is bound into the ASCII shader as `tDepth` along with `uCameraNear`, `uCameraFar`, `uEdgeThreshold`, and a feature flag `uEdgeEnabled`.

### Edge detection (in the fragment shader)

Per cell:

```glsl
vec2 step = vec2(uCellSize) / uResolution;
float dC = linearDepth(cellCenterUv);
float dL = linearDepth(cellCenterUv - vec2(step.x, 0.0));
float dR = linearDepth(cellCenterUv + vec2(step.x, 0.0));
float dU = linearDepth(cellCenterUv - vec2(0.0, step.y));
float dD = linearDepth(cellCenterUv + vec2(0.0, step.y));
float edge = sqrt((dR-dL)*(dR-dL) + (dD-dU)*(dD-dU));
float edgeRatio = edge / max(dC, 0.001);
if (edgeRatio > uEdgeThreshold) glyphIdx = uGlyphCount - 1.0;
```

`edgeRatio` (gradient normalized by local depth) is used so distant objects don't fail to register edges. Threshold defaulted to `0.06`. Continuous floor reads `~0.003`; character vs floor silhouette reads `~1.9`. Wide separation = clean classification.

### Why depth-edge first (vs. normal sampling)

Depth-edge needs no second render pass — the depth attachment was already there. Normal-aware glyph picking (half-blocks following surface direction) needs a second `MeshNormalMaterial` pass. That's a bigger lift and lands in a follow-up. Depth-edge alone gives a strong silhouette read on the character, which was the most-missed visual element.

## Visual tuning

- `lumGain` 1.6 → **1.2**, `gamma` 0.85 → **1.0** — softer mid-tone curve, less posterized.
- New `dither` knob in the shader: per-cell hash noise of size `dither / glyphCount` added to luminance before quantization. Default 0.5, set to 0.6 here. Breaks up banding into stippled transitions.
- Ramp updated: `' .·-:;=+*░#▒▓█'` (added `;`) — 14 levels for slightly finer gradient.
- Sun intensity 2.4 → 1.9, hemi 0.85 → 1.05 — less directional clash, more ambient fill.
- Background `0x050807` → `0x070a09` (negligible, keeps dark cells from being pure void).
- `toneMappingExposure` 1.25 → 1.15.

## Camera tilt

- Offset `(5.5, 7.5, 5.5)` → **`(4.5, 9.5, 4.5)`**. Angle from horizontal: 44° → **57°**. Steeper top-down, character reads as occupying a position on the ground rather than floating against the wall.
- Look-at target raised from `+1.0` to `+0.9` so the character sits closer to screen center under the new angle.
- FOV `40°` → `38°` — slight compression, makes the iso projection feel more orthographic.

## Natural gait — rig restructure + counter-rotation

The walking rig got two new transform groups for biomechanical realism:

```
visual                      (vertical bob)
├── chest (y=1.0)            ← yaw counter-twists -CHEST_TWIST × swing
│   ├── head, visor, torso, belt, chest plate
│   └── armPivotL, armPivotR  (swing × ARM_AMP, opposite phase)
└── hip (y=0.65)             ← yaw +CHEST_TWIST×0.6 × swing  AND  roll +HIP_ROLL × swing
    └── legPivotL, legPivotR (swing × LEG_AMP, opposite phase)
```

So during a walk cycle, when the right leg swings forward:
- **Right leg goes forward** (rotation.x positive), left leg back
- **Right arm goes back** (rotation.x negative), left forward — opposite phase
- **Hips yaw slightly toward the forward leg** — natural pelvic rotation
- **Chest counter-twists the opposite direction** — torso resists hip rotation, anatomically correct
- **Hips roll slightly toward the planted leg** — weight shift
- **Torso bobs vertically** as a function of `|cos(phase)|`

`CHEST_TWIST = 0.12`, `HIP_ROLL = 0.05` — small angles, just enough to read as motion without looking comical. `WALK_RATE` dropped 9.0 → **8.5** to make the cycle feel slightly heavier (the bit_spekter is plate-armored).

Idle state still eases all rotations to 0 within ~70 ms.

## Build status

- 28 files lint clean
- Typecheck green
- Bundle: 631.43 → 633.04 kB (+1.6 kB for depth/edge uniforms and rig restructure)

## Service plumbing — none changed

No new dependencies. No new services. Phase 1 still single-player.

## Next per the active roadmap

With Stage B v0.1 in, the next two visual moves both build on it:
1. **Stage B v0.2 — normal-direction glyphs.** Add a `MeshNormalMaterial` second-render pass; sample per-cell normal; pick directional half-blocks (`▀▄▌▐`) and box-drawing characters (`─│`) at silhouettes based on the local edge orientation. This is what brings the look closer to the owner's reference ASCII portrait.
2. **Atlas v2 — keyed glyphs.** Extend the atlas with the directional and box-drawing glyphs and a richer mid-tone fill set (`╳ ╲ ╱` for cross-hatching).

After visual lands the FPS probe + first audio + the port becoming an interactable. Per the roadmap I'd take Stage B v0.2 next unless the owner directs otherwise.
