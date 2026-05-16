# 0031 — Multiplayer: emote sync, seam-correct visibility, movement smoothing

**Date:** 2026-05-16
**Branch:** `claude/bitrunners-collaboration-EcqBv` (not merged to `main`)

## TL;DR

Three reported multiplayer defects, all fixed:

1. **Emoticrons were invisible to other players** — they were a local DOM bubble only; no schema field, no server message, no broadcast. Now networked end-to-end through an allowlisted server message.
2. **Remote players only visible within a tiny radius** — root cause was the seamless 3×3 world wrap (devlog 0015): remote avatars were drawn at their single raw server coordinate, so they vanished across the seam. Now drawn at the periodic image nearest the local player.
3. **Choppy remote movement** — positions were hard-assigned at the ~15 Hz server cadence with zero interpolation. Now exponential-smoothed per frame.

No new external dependencies. No new billable services. No bandwidth/AOI change (fixes 2 and 3 are pure client-side render math).

## Detail

### 1. Emoticron sync

- `PlayerState` gained `emote: string` + `emoteSeq: number` (`apps/server/src/state.ts`). Clients react to `emoteSeq` advancing, so repeating the same glyph re-triggers the bubble.
- New room handler `onMessage('emote')` (`apps/server/src/sphere-room.ts`) validates against an allowlist and bumps the counter.
- The canonical glyph set + `isValidEmote()` moved to `packages/shared`. This is the single source of truth: the wheel UI imports it for display, the server validates against it. **This enforces the "no free-text input anywhere" moderation rule server-side** — a tampered client cannot inject arbitrary text into other players' DOM. (`bubble.textContent` was already XSS-safe; the allowlist closes the content-injection vector entirely.)
- `EmoteWheel.tsx` now re-exports the symbols from `@bitrunners/shared`, so `App.tsx` / `AdminDialogue.tsx` are unchanged.
- Client: `network.ts` exposes `onEmote(id, text)` (fired on `emoteSeq` increase, self filtered) and `sendEmote(text)`. `scene.ts` `triggerEmote()` now also sends to the server; remote emotes spawn a screen-tracked bubble anchored above the sender's avatar.

### 2. Seam-correct remote visibility

The world renders as a 3×3 clone grid of a 19×19 tile; the local player + camera are kept wrapped into the centre tile. Remote avatars were placed at the raw server coord, so when either player neared a seam the avatar was ~19 units away through the (visually identical) centre instead of ~1 unit across the seam — exactly the "only visible up close" symptom.

Fix: each frame the avatar is drawn at `localPlayer + wrapDelta(serverPos − localPlayer)` — the nearest periodic image. Pure client render math; **zero server or bandwidth cost** (there is no server-side AOI and none was added).

### 3. Movement smoothing

`onUpdate` no longer touches the transform. It records a target; the render loop exponential-smooths position and (shortest-angle) rotation toward it (`REMOTE_LERP_K = 14`, frame-rate independent). A delta larger than half the board signals a seam wrap by either player — that snaps instead of lerping, which is invisible because the 3×3 tiles are identical there.

**Known tradeoff:** when a *remote* player crosses a seam while the *local* player is mid-board, the remote pops to the opposite edge instead of sliding. This is physically correct on a torus and rarely both-edges-on-screen at once; smoothing it would break the far more common local-wrap seamlessness. Accepted; revisit only if it reads badly on a live build.

## Protocol / schema

`PROTOCOL_VERSION` bumped `0 → 1` (`packages/shared`). It is surfaced only in the server `/health` payload, **not** a connection handshake gate, so old and new clients still connect — the bump is honest bookkeeping for the schema + message change, not a break. Web and server deploy together from `main`, so there is no skew window in practice.

## Files touched

- `packages/shared/src/index.ts` — protocol bump; `EmoteId`, `EMOTE_GLYPHS`, `isValidEmote()` (new single source of truth).
- `apps/web/src/EmoteWheel.tsx` — re-export from shared (removes duplicate definitions).
- `apps/server/src/state.ts` — `emote` + `emoteSeq` fields.
- `apps/server/src/sphere-room.ts` — allowlisted `emote` message handler.
- `apps/web/src/network.ts` — emote in snapshot/interfaces; `onEmote`; `sendEmote`; per-player seq tracking.
- `apps/web/src/scene.ts` — `wrapDelta()`; structured `remoteAvatars`; per-frame interpolation + nearest-image; screen-tracked remote emote bubbles; send-on-emote; dispose cleanup.
- `apps/web/src/style.css` — `.emote-anchor` positioning wrapper.

## Testing status

- Gates green: `pnpm lint` clean (39 files), `pnpm typecheck` 8/8, `pnpm build` 5/5. No test suite in the repo (`vitest run` exits 1 on "no tests" — pre-existing, not a regression).
- **Not browser-verified.** This environment is headless; two-client multiplayer (emote round-trip, seam crossing, smoothing feel) could not be exercised. Logic is verified by gates + reasoning against the actual code paths. Needs a live two-client eyeball on a deployed build.

## Follow-ups

- Live two-client test: emote appears over the correct remote avatar; remote players visible across seams; movement reads smooth.
- Tune `REMOTE_LERP_K` if motion feels laggy (higher = snappier) or jittery (lower = smoother).
- Phase 2: aether snapshot on `onLeave` (still a TODO in `sphere-room.ts`).
