# 0052 — Autonomous open-PR coordination + distinct pet shapes

**Date:** 2026-05-26
**Branch:** `claude/bitrunners-collaboration-EcqBv`

Two things: hardened the autonomous-task brief so parallel instances stop
duplicating/conflicting, and a small roadmap polish (pets get distinct shapes).
All migrations 0001–0005 are run; auth + economy + admin config are live.

## Autonomous-task brief — open-PR coordination (`.claude/autonomous-task.md`)

Root cause of the recent #43/#44/#45/#46 conflict + #45/#46 duplicate: scheduled
instances run in **separate containers** (no shared filesystem), branched off
different `main` snapshots, and two built the same activity-stats feature. The
only shared coordination surface is **GitHub itself**.

Added a new **§1b "Check open PRs FIRST"** protocol:
- `git fetch` + `list_pull_requests(state=open)`; read each PR's title + changed
  files before picking work.
- **Don't start an item an open PR already covers** — pick an uncovered one.
- **Prefer a disjoint file footprint** (named the hot files: `economy.ts`,
  `AdminConsole.tsx`, `supabase.ts`, `style.css`, `ScrapeMenu.tsx`, `Samm.tsx`,
  `scene.ts`).
- **Branch from latest `origin/main`**; **claim early** (open the draft PR after
  the first commit); **re-check before pushing** (merge `main` if it moved).
- **Never** resolve a same-item collision by force-push or by merging another
  instance's PR — leave consolidation to the owner.

Also corrected two stale lines in the brief: backend epics are now **live**
(not "gated on auth"), and **Tokens are unlocked** (proxy-wallet, lore 009) —
the old "bit_spekter has no Token wallet" guard was removed so an instance
won't wrongly re-lock them.

## Distinct pet shapes (deferred Chunk B polish)

Equipped pets were all the same box. `scene.ts` now renders a distinct
primitive per pet (`petGeometryFor`): byte pup = sphere, glint drone =
octahedron, null kitten = tetrahedron, code spark = cone, aether mote =
icosahedron, data seraph = torus. The appearance applier rebuilds the pet mesh
when the equipped pet id changes (old geometry/material disposed); palette
recolour + orbit/bob unchanged. Isolated to `scene.ts` via the existing
`appearance.ts` seam.

## Honest status

- Gates green: `pnpm lint` clean (53 files), `pnpm typecheck` 8/8,
  `pnpm build` 5/5.
- Pet shapes **not visually verified** (headless) — eyeball on the Pages
  preview that each pet reads as a distinct shape and rebuilds cleanly on swap.
- Pages-only, no migration.

## Next big items (need focused sessions)
- **Admin phase 3** — user table + credit/token grants. Security-critical:
  `SECURITY DEFINER` + `is_admin()` gating, careful `auth.users` email exposure,
  cross-user economy writes. Now unblocked (auth live) but deserves a dedicated
  pass + owner verification.
- **Trading backend** — server-authoritative economy (p2p-trading-epic).

## Files

`.claude/autonomous-task.md` (open-PR protocol + stale-line fixes),
`apps/web/src/scene.ts` (per-pet geometry), this devlog, `.claude/decisions.md`,
`.claude/handoff.md`.
