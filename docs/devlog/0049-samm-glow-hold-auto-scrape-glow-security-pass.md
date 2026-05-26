# 0049 — SAMM proximity glow, hold/auto-scrape glow, security pass

**Date:** 2026-05-26
**Branch:** `claude/peaceful-thompson-jqCb1`

Autonomous run. Three deliverables: a security hardening fix (innerHTML → textContent),
SAMM machine proximity glow in the 3D scene, and hold/auto-scrape glow states in the
Data Scrape panel.

## Security fix

- **`apps/web/src/scene.ts:882`** — replaced `innerHTML` template literal with explicit
  `createElement` + `textContent` for the player tag. The `playerCode` value is
  cryptographically-safe alphanumeric (6 chars from a 36-char set; no user input),
  so actual risk was low — but defence-in-depth applies: `textContent` is never
  a vector regardless of what passes through. No behaviour change.

## SAMM proximity glow (`apps/web/src/scene.ts`)

The vending machine screen (`vendingScreen`, emissive orange) now pulses brighter as
the player approaches. Uses the same distance-driven `emissiveIntensity` pattern as
the port/depot glow:

- At trigger distance edge (2.6 m): intensity ≈ baseline 0.7
- At player position: intensity ≈ 0.7 + 0.85 ± 0.22 (≈ 1.33–1.77)
- Pulse frequency: ~3.1 rad/s (≈ 0.5 Hz, slower than the port's 2.4 so they feel distinct)

No new mesh, no new light source — just the material's own emissive channel.
Client-only change. No Fly redeploy.

## Hold/auto-scrape glow (`ScrapeMenu.tsx`, `style.css`)

Previously the `.scrape-glow` element only activated on manual single-tap (`is-on` class,
420ms flash). Hold-to-scrape and auto-scrape produced no visual feedback — noted as a
"deliberate first pass" in devlog 0039.

Added two new glow states:

- **`is-holding`** — dim sustained glow (opacity 0.5) while the player holds the SCRAPE
  button. Set in `onScrapeDown`; cleared in `stopHold`. Transition 80ms ease-in so it
  appears immediately on hold start and fades cleanly on release.
- **`is-auto`** — repeating pulse animation (period 650ms = `AUTO_MS`) while auto-scrape
  is active. Opacity 0.35→0.7, scale 0.95→1.03. Makes it clear the panel is working
  hands-free.

Cascade order ensures `is-on` (manual press) overrides both when all classes are present —
no visual conflict.

`@media (prefers-reduced-motion: reduce)`: `is-auto` animation suppressed (static 0.35
opacity instead); `is-on` and `is-holding` animations suppressed (opacity only). Existing
`is-on` reduced-motion rule is now consolidated in the single media block.

## Security scan findings

Full pass run per the autonomous-task brief. No critical or high-priority issues found.
Complete results in this devlog rather than the handoff (no escalation needed):

| Category | Result |
|---|---|
| Client-trusted privileged actions | PASS — all admin actions enforce via Supabase RLS |
| `dangerouslySetInnerHTML` | PASS — not used anywhere |
| `innerHTML` (non-React) | LOW RISK — one instance (playerCode, fixed charset); fixed this session |
| Injection (SQL/XSS/command) | PASS — no raw SQL; all user-facing text from fixed catalogs |
| Hardcoded secrets | PASS — only `VITE_` env vars |
| Free-text player input | PASS — emotes + class names use allowlists |
| RLS policy gaps | PASS — all 10 tables have correct policies |
| CF Pages board endpoint | ACCEPTABLE — no-auth by design (slug = bearer token) |

## Honest status

- Gates green: `pnpm lint` clean (52 files), `pnpm typecheck` 8/8, `pnpm build` 5/5.
- **Not verifiable headless** — SAMM glow and scrape glow states need live eyeball.
  To verify: walk toward the vending machine and confirm the orange screen brightens;
  hold SCRAPE and confirm the dim glow appears; enable auto-scrape and confirm the
  repeating pulse.
- Client-only changes (no server/packages touches). **Pages-only deploy, no Fly.**

## Files

`apps/web/src/scene.ts` (innerHTML fix, SAMM proximity glow),
`apps/web/src/ScrapeMenu.tsx` (holding state, glow class list),
`apps/web/src/style.css` (is-holding, is-auto rules + reduced-motion update),
this devlog, `.claude/handoff.md`.
