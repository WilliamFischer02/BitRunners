# 0011 — Stronger character pop + 3 world props

**Date:** 2026-05-09

Owner reported on the live build: the dim from 0010 wasn't visible, and "the other objects aren't visible" — pointing out that the platform feels empty (the user expected to see e.g. a vending machine).

Verified the deploy first: `main` is at commit `e5ae7ea` (the 0010 character-mask merge), CI green, Cloudflare Pages green. The build IS live. So the issue is one or both of:

1. `backgroundDim: 0.7` reads as too subtle on a phone screen, especially against the already low-contrast ASCII palette.
2. iOS Safari's aggressive cache may still be holding the previous build for some users — closing and reopening the tab usually fixes it.

This commit hits both: a much more obvious visual gap between character and world, plus three new world objects so the platform reads as inhabited.

## Stronger character pop

Three layered changes pushing in the same direction:

### 1. Character emissive

All three character materials (`armor`, `dark`, `accent`) now carry a small `emissive` color and `emissiveIntensity ~0.5`. This adds a constant self-light that lighting can't take away — even in shadow, character pixels stay near the high end of the luminance ramp.

```ts
const armor = new MeshStandardMaterial({
  color: 0xe4e8ec,            // brightened
  roughness: 0.5,
  metalness: 0.25,
  emissive: 0x1a1d22,
  emissiveIntensity: 0.6,
});
```

The `accent` (visor cross) gets a cool teal emissive (`0x223344`) to make the cross-mark identifiable even at small cell sizes.

### 2. Background dim 0.7 → 0.5

Non-character output cells now render at **50 %** intensity instead of 70. Effectively halves the brightness of the world while keeping the character at full strength. The contrast gap goes from ~30 % to ~50 %.

### 3. Brighter base armor color

`0xd4d8dc → 0xe4e8ec` (a bit brighter), and `dark` plates `0x3c4046 → 0x4c5056` (a bit lighter so they don't disappear into the dimmed background). The character's silhouette now has more inherent luminance variation visible across body parts.

## Three world props

Joined the port in distinct corners so the platform feels populated, each styled per the lore vocabulary in `docs/lore/005-trade-depots-and-ports.md`:

| Prop | Position | Lore role | Look |
|---|---|---|---|
| **Port** (existing) | NW corner | Passage to Server Space | Light grey frame, indigo emissive panel pulsing |
| **Vending machine** (new) | NE corner | Consumables depot | Light grey body, soft green screen, dark dispense slot |
| **Monolith** (new) | SE corner | Quest objective anchor | Tall dark slab with a thin amber emissive seam down the front |
| **Terminal** (new) | SW corner | Social / command-line interactable | Wide low cabinet, angled mint-green screen |

All four are now visible from any starting position, and walking up to one telegraphs each one's affordance via emissive color identity. None of them are interactable yet — the depot system arrives in Phase 3 — but they fill the world with intent.

Lore note: this matches the depot vocabulary the project owner wrote in lore round 1: *"pneumatic-tube kiosks for trading, monoliths for certain objectives, command-line terminals for social features, vending machines for smaller transactions."* The vending machine specifically completes the four-type vocabulary.

## How to tell if you're seeing the new build

Look for the orange/amber glow in one corner — that's the monolith and only exists in this commit. If you see four distinct objects (port + vending + monolith + terminal), the build is fresh.

iOS Safari cache buster: pull-to-refresh the page, or close the tab and reopen. The Pages CDN serves with cache-control headers but Safari can still hold the old HTML.

## Build

- 28 files lint-clean, typecheck and build green
- Bundle: 633.92 → 635.18 kB (+1.3 kB for prop geometries)

## What's next

- Mobile FPS report from owner — still outstanding, closes the Phase 1 mobile probe roadmap item
- Stage B v0.2 (directional glyphs at silhouettes via `MeshNormalMaterial` second pass) — the layered-render pattern is now proven on mobile from devlog 0010
- Visual response to whether the dim is now too aggressive (0.5 might be too dark; can tune to 0.6 if needed)
