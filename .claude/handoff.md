# Handoff — 2026-05-16, session run-toggle + settings-fix

## State of the build

- **Live web (bitrunners.app):** Single-player bit_spekter scene, ASCII pipeline, levitate-trail body anim, multiplayer live, profile/emote/boot UI, reworked ground-dash tendrils. No new deploy this session — work is on `claude/bitrunners-collaboration-EcqBv`, not merged to `main`.
- **Live server (bitrunners.fly.dev):** Unchanged. No server-path changes this session; no Fly redeploy expected.
- **Local repo branch:** `claude/bitrunners-collaboration-EcqBv` — reset to the work-branch history (`7734455`) + this session's run-toggle/settings-fix/devlog commit on top.
- **Uncommitted changes:** none after the session commit; pushed, draft PR opened.
- **CI status:** local gates green — lint clean (39 files), typecheck 8/8, build 5/5. Repo has no test suite (`vitest run` exits 1 on "no tests" — pre-existing, not a regression).

## What I did this session

- **Branch reconciliation:** `claude/bitrunners-collaboration-EcqBv` was `main`'s merge bubbles, tree-identical to `claude/ascii-overhead-game-14dir` except missing the two `.claude/` files (zero unique content). Reset it to `origin/claude/ascii-overhead-game-14dir` so it carries full history + continuity/guardrails. Recorded in `.claude/decisions.md`.
- **Found + fixed a real bug:** `.claude/settings.json` was two concatenated JSON objects (invalid JSON) — a hardened block followed by a leftover permissive one with no `deny`. The mechanical guardrails were NOT being enforced (Biome flagged it). Collapsed to the single hardened object. Lint now clean. Recorded in `.claude/decisions.md` + devlog 0030.
- **Shipped the run-speed toggle** (handoff item 2 / backlog 11 remainder): `$ settings` panel row `run speed [on]/[off]`, mirrors the joystick-toggle pattern (localStorage `bitrunners.settings.run`, default off, `bitrunners:settings-changed` event). Scene swaps `WALK_SPEED 3.2` / `RUN_SPEED 5.6` live.
- Wrote `docs/devlog/0030-run-toggle-and-settings-fix.md`; created `.claude/decisions.md` (did not exist before).

## What's blocking forward progress right now

- Unchanged from 0029: owner-side service wiring (Supabase keys, Resend DNS, OAuth client IDs) blocks the account system, display-name input/approval queue, persisted "met The Admin"/inventory/achievements.
- 20-achievements design still blocked on the faction-reward Q&A with the owner.

## What the owner is doing in parallel

- Wiring Supabase + Resend + OAuth (guide in devlog 0026).
- Owns prod deploy approvals. No `main` push happened or is requested this session.

## What I would do next, in priority order

1. Eyeball the run toggle on a deployed build: flips speed live without reload, persists across reload, default = walk. (Couldn't browser-test from this headless env — logic verified via typecheck/lint/build + mirrors the working joystick toggle.)
2. Still open from 0029: confirm reworked tendrils read correctly on bitrunners.app.
3. Once owner confirms Supabase/Resend/OAuth env: wire display-name input + approval queue, then persisted "met The Admin".
4. Faction-reward Q&A → design the 20 achievements (backlog 12).

## Files touched this session

- `apps/web/src/scene.ts` — `MOVE_SPEED` split into `WALK_SPEED 3.2` / `RUN_SPEED 5.6`; `readRunEnabled()` (default off); `runEnabled` state + `bitrunners:settings-changed` listener (removed in `dispose()`); move tick uses the selected speed.
- `apps/web/src/ProfileIcon.tsx` — `readRun()` + `run speed` toggle row in `$ settings`, mirrors joystick row.
- `.claude/settings.json` — collapsed from two concatenated objects to the single hardened object (integrity fix).
- `.claude/decisions.md` — created; settings-fix + branch-reset decisions.
- `.claude/handoff.md` — this file.
- `docs/devlog/0030-run-toggle-and-settings-fix.md` — new devlog.

## Do NOT do these things (specific to right now)

- Don't push to `main` without explicit owner confirmation in the live conversation. Active branch is `claude/bitrunners-collaboration-EcqBv`.
- Don't prepend/append a new permissions object to `.claude/settings.json` — *replace* it, and confirm it's a single valid JSON object (`pnpm lint` catches concatenation). Editing it correctly prompts the owner; that gate is intended.
- Don't rely on a curl/`GITHUB_TOKEN` poller to gate merges — token not in shell env. Use `mcp__github__pull_request_read` with `get_check_runs` (NOT `get_status` — this repo uses Check Runs; `get_status` is `total_count:0` forever).
- Don't reintroduce a shared tendril material; don't add `DepthTexture` render targets (iOS Safari, devlog 0008); don't deploy Fly from a session shell.

## Open questions for the owner

- Run-speed values OK? Walk 3.2 (unchanged), Run 5.6 (1.75×). Easy to retune in `scene.ts`.
- Confirm run toggle behaves right on a live build (couldn't browser-test here).
- Faction-reward model for the 20-achievements design.
- Re-confirm auto-merge-to-`main` if you want future sessions to ship without per-PR approval.
- Tendril look from 0029 still needs a live eyeball / adjustment call.

## Retrospective (not sycophantic)

- The settings.json corruption is the headline: a file CLAUDE.md treats as the *enforced* safety layer was silently inert (invalid JSON) and shipped that way across two commits + a merge to `main`. It was only caught because lint runs on `.claude/**`. Keep `pnpm lint` in the standard gate precisely so config corruption surfaces; a session that skipped lint would have inherited dead guardrails again.
- Reset-vs-rebase: reset was correct here only because the branch had provably zero unique content and the old tip equals `origin/main`. That equivalence is what made it non-destructive — don't generalize "reset to reconcile" without re-verifying both conditions.
- No browser verification was possible from this environment; said so plainly rather than claiming the UI works. The toggle rides a pattern already proven in prod (joystick), which is the basis for confidence — not a visual check.
