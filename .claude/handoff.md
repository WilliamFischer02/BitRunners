# Handoff — 2026-05-16, session: multiplayer emote-sync + smoothing, then services setup guide

## State of the build

- **Live web (bitrunners.app):** Unchanged — this work is on `claude/bitrunners-collaboration-EcqBv`, not merged to `main`.
- **Live server (bitrunners.fly.dev):** Unchanged. Server paths changed this session (`state.ts`, `sphere-room.ts`) but no Fly redeploy happened or was requested — that rides a `main` push, owner-gated.
- **Local repo branch:** `claude/bitrunners-collaboration-EcqBv` + this session's commit.
- **Uncommitted changes:** none after the session commit; pushed; draft PR opened/refreshed.
- **CI status:** local gates green — `pnpm lint` clean (39 files), `pnpm typecheck` 8/8, `pnpm build` 5/5. No test suite (`vitest run` exits 1 on "no tests" — pre-existing, not a regression).

## What I did this session

Fixed the three reported multiplayer defects (full detail in `docs/devlog/0031`):

1. **Emoticrons now sync to other players.** Added `emote`/`emoteSeq` to the player schema, an allowlisted `onMessage('emote')` server handler, `sendEmote`/`onEmote` client wiring, and screen-tracked emote bubbles above remote avatars. `triggerEmote()` now also sends to the server.
2. **Remote players visible across the seam.** Root cause was the 3×3 world-wrap drawing avatars at the raw server coord. Now drawn at the nearest periodic image (`wrapDelta`). Pure client render math — no server/bandwidth cost, no AOI added.
3. **Smooth remote movement.** `onUpdate` records a target; the render loop exponential-smooths position + rotation toward it. Seam wraps snap (invisible — identical tiles).

Also: moved the canonical emote glyph set + `isValidEmote()` to `@bitrunners/shared` (single source of truth; enforces the "no free-text" moderation rule server-side), bumped `PROTOCOL_VERSION` 0→1, wrote devlog 0031, logged the architectural calls in `.claude/decisions.md`.

**Second deliverable — `docs/setup/SERVICES.md` (devlog 0032):** the canonical master setup guide for every external service — what/why/free-tier/click-by-click/exact-secret-and-destination/verify, in dependency order. Built from an actual config-surface scan (only 6 secrets/bindings wired today; everything else explicitly labelled ACCOUNT-ONLY). Supersedes setup steps in devlogs 0020/0021/0026. Decisions recorded: Neon DEPRECATED, Stripe DEFERRED, Steam needs a custom Worker. The earlier in-chat "diagnostics/tester menu" + Stripe stack proposal was an **accidental prompt — out of scope, do not build**; verified it never entered a committed file. Docs-only commit; no code, no deploy impact.

## What's blocking forward progress

- **Browser verification.** Headless env — I could not run two clients to eyeball the emote round-trip, seam visibility, or smoothing feel. Logic is gate-verified and reasoned against the real code paths; it needs a live two-client check on a deployed build.
- Unchanged from prior: owner-side service wiring (Supabase keys, Resend DNS, OAuth IDs) still blocks the account system.

## What the owner is doing in parallel

- Wiring Supabase + Resend + OAuth — **now follow `docs/setup/SERVICES.md` (canonical), not devlog 0026 (history).** Critical-path order is in §1.
- Owns prod deploy approvals. No `main` push happened or is requested this session.

## What I would do next, in priority order

1. **Owner-side: execute `docs/setup/SERVICES.md` §1 critical path (steps 1–7).** Highest-leverage unblock — accounts/persistence/email/OAuth all wait on this. The guide is click-by-click with exact secret destinations.
2. **Two-client live test on a deployed build:** emote appears over the correct remote avatar and fades; remote players stay visible when crossing the seam; movement reads smooth (not rubber-banding or jittering).
3. Tune `REMOTE_LERP_K` (scene.ts, currently 14) if motion feels laggy (raise) or jittery (lower) live.
4. Re-check the remote-crosses-seam pop (devlog 0031 known tradeoff) — only act if it reads badly.
5. Still open: run-toggle + reworked-tendrils live eyeball (from 0030/0029).
6. Phase 2: aether snapshot on `onLeave` (TODO in `sphere-room.ts`) — Upstash setup steps are in SERVICES.md §12.
7. Steam login: build the OpenID→Supabase-session Worker (SERVICES.md §10 explains why it's a build task, not a toggle).

## Files touched this session

- `packages/shared/src/index.ts` — protocol bump; `EmoteId`/`EMOTE_GLYPHS`/`isValidEmote()` (new SoT).
- `apps/web/src/EmoteWheel.tsx` — re-export from shared.
- `apps/server/src/state.ts` — `emote` + `emoteSeq`.
- `apps/server/src/sphere-room.ts` — allowlisted `emote` handler.
- `apps/web/src/network.ts` — emote snapshot/interfaces, `onEmote`, `sendEmote`, seq tracking.
- `apps/web/src/scene.ts` — `wrapDelta`, structured `remoteAvatars`, interpolation + nearest-image, tracked remote emote bubbles, send-on-emote, dispose cleanup.
- `apps/web/src/style.css` — `.emote-anchor`.
- `docs/devlog/0031-multiplayer-emote-sync-and-smoothing.md` — new.
- `docs/setup/SERVICES.md` — new (master services setup guide; second deliverable).
- `docs/devlog/0032-services-setup-master-guide.md` — new.
- `.claude/decisions.md` — appended (multiplayer call + services/Neon/Stripe/Steam call).
- `.claude/handoff.md` — this file.

## Do NOT do these things (specific to right now)

- Don't push to `main` without explicit owner confirmation in the live conversation. Active branch is `claude/bitrunners-collaboration-EcqBv`. Server paths changed — a `main` push WILL trigger a Fly redeploy.
- Don't add a server-side AOI/visibility radius to "fix" anything — the small-radius bug was a client render bug and is fixed client-side. An AOI would add cost for no benefit at 19×19 / current scale (see decisions.md).
- Don't loosen the emote allowlist or accept free-text emotes — it's the server-side enforcement of a moderation rule.
- Don't edit `.claude/settings.json` by append/prepend (see prior handoff/decisions).
- **Don't build a passcode-gated diagnostics / in-game "tester" menu, and don't add a Stripe/payments setup section.** Both were an accidental in-chat prompt the owner explicitly retracted. SERVICES.md verification is intentionally manual (curl/browser). Stripe is deferred to its own future doc.
- Don't treat devlog 0026 as the setup source anymore — `docs/setup/SERVICES.md` is canonical; devlogs are immutable history.

## Open questions for the owner

- After a live test: does emote sync / seam visibility / smoothing read correctly? Any rubber-banding?
- `REMOTE_LERP_K = 14` acceptable, or want snappier/smoother?
- The remote-crosses-seam pop (devlog 0031 tradeoff) — acceptable, or worth the extra complexity to smooth?
- Re-confirm auto-merge-to-`main` policy if you want future sessions to ship without per-PR approval.

## Retrospective (not sycophantic)

- The "small radius" bug is the instructive one: the obvious read ("visibility/AOI problem → widen a radius") would have been wrong and would have *added server cost*. Reading the actual wrap render code showed it was a client-side toroidal nearest-image bug — opposite conclusion, zero cost. Worth restating: confirm the root cause in code before reaching for the config knob the symptom suggests.
- Two of three fixes are pure client render math with no protocol/cost impact; only the emote feature touched the wire. Keeping that boundary explicit (and the allowlist in shared) is what kept a "make multiplayer feel better" request from quietly becoming a bandwidth or moderation regression.
- Still no browser proof. Said so plainly rather than implying it works. Gates catch type/lint/build breakage, not "does it feel smooth with two real clients" — that gap is real and is the top next-step.
