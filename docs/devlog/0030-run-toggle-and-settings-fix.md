# 0030 — Run-speed toggle + settings.json corruption fix

**Date:** 2026-05-16
**Branch:** `claude/bitrunners-collaboration-EcqBv`

Three things this session: branch reconciliation, a settings.json integrity fix, and the run-speed toggle (handoff item 2 / backlog item 11 remainder).

## Branch reconciliation

`claude/bitrunners-collaboration-EcqBv` was sitting on `main`'s merge-commit history (PRs #22–#31), tree-identical to `claude/ascii-overhead-game-14dir` **except** it was missing the two `.claude/` continuity/guardrail files. It carried zero unique content (verified: symmetric diff was purely the two added files; old tip `6e694ea` == `origin/main`, fully recoverable). Reset the branch to `origin/claude/ascii-overhead-game-14dir` (`7734455`) so it now carries the full feature history + handoff + settings, then continued work here.

## settings.json was corrupt — guardrails were NOT active

`.claude/settings.json` (commits `bf04bfd` + `acd20d2` on the ascii branch) was **two concatenated JSON objects** — invalid JSON (`}{` at the seam):

- Object 1: the intended hardened config (`allow`/`ask`/`deny` — gates secrets, `_sealed/` lore, `fly`/`flyctl`/`wrangler deploy`, force-push, push-to-`main`).
- Object 2: a leftover **permissive** config — broad `allow` (`git push:*`, `fly:*`, `flyctl:*`, `wrangler:*`), **no `deny`**.

A prior session prepended the hardened block instead of replacing the old one. Consequences:

1. Invalid JSON → the harness can't parse it → the mechanical guardrails CLAUDE.md advertises were **not enforced** (Biome flagged it: 3 lint errors, all this file).
2. The leftover permissive object is a fallback that *contradicts* the hardening — exactly the protections that were prioritized.

**Fix:** collapsed the file to the single hardened object (object 1, verbatim — the one the owner asked for). Lint now clean (39 files, 0 errors). This is faithful execution of the "port the hardening first" instruction, not a new policy decision — recorded in `.claude/decisions.md`.

## Run-speed toggle (backlog 11 remainder)

A settings toggle to switch player movement between walk and run. Mirrors the existing joystick-toggle pattern exactly (localStorage + `bitrunners:settings-changed` event), so no new conventions.

- `apps/web/src/scene.ts`: `MOVE_SPEED = 3.2` → `WALK_SPEED = 3.2` (unchanged feel) + `RUN_SPEED = 5.6` (1.75×). New `readRunEnabled()` (default **off** — preserves current walk feel for existing players). Scene reads it once, re-reads on `bitrunners:settings-changed`, applies `(runEnabled ? RUN_SPEED : WALK_SPEED) * dt` in the move tick. Listener removed in `dispose()`.
- `apps/web/src/ProfileIcon.tsx`: new `readRun()` + a `run speed [ on ]/[ off ]` row in the `$ settings` section, directly below the joystick row. Persists to `localStorage['bitrunners.settings.run']`, dispatches the shared settings-changed event so the scene picks it up live without reload.

Run multiplier applies uniformly across keyboard and partial-joystick input (speed scales the already-capped move vector), so analog deflection still works proportionally.

## Build

- Lint: clean, 39 files (was 3 errors, all the corrupt settings.json — now resolved)
- Typecheck: green, 8/8 tasks
- Build: green, 5/5 tasks (pre-existing 800 kB chunk-size warning unrelated)
- Tests: repo has no test files yet (`vitest run` exits 1 on "no tests") — pre-existing, not a regression

## Not verified

Could not eyeball the toggle in a live browser from this environment (headless, no practical way to drive the three.js canvas + localStorage interaction). Logic is verified by typecheck/lint/build and by mirroring the already-working joystick toggle. Live UI confirmation is an owner/next-session check.

## What's next

1. Eyeball run toggle on a deployed build: toggle flips speed live (no reload), persists across reload, default is walk.
2. Still pending from 0029: confirm reworked tendrils read correctly on bitrunners.app.
3. Owner-blocked items unchanged: Supabase/Resend/OAuth env wiring (account system), faction-reward Q&A (20 achievements).
