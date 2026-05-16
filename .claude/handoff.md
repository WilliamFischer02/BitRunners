# Handoff — 2026-05-16, session tendril-rework-ship

## State of the build

- **Live web (bitrunners.app):** Single-player bit_spekter scene with ASCII pipeline, levitate-trail body animation, multiplayer live ("NET: CONNECTED"), profile/emote/boot UI. Tendril particles just changed to thin ground dashes — Cloudflare Pages deploy from `main` SHA `6e694ea` was triggered ~00:46 UTC; visual not yet eyeballed on the live site.
- **Live server (bitrunners.fly.dev):** Colyseus + Fastify, single sphere, 15 Hz, scale-to-zero. No server-path changes this session, so no Fly redeploy expected (deploy-server.yml only fires on server-path diffs). Last known state: working multiplayer.
- **Local repo branch:** `claude/ascii-overhead-game-14dir` @ `43fe526` — "feat: rework tendril particles — ground dashes, sparse, fade in place".
- **Uncommitted changes:** clean.
- **CI status:** green. PR #31 check runs: `ci` ×2 success, Cloudflare Pages success, Supabase Preview skipped (expected). Merged into `main` via merge commit `6e694ea`.

## What I did this session

- Reviewed the staged tendril diff in `apps/web/src/scene.ts` against devlog 0029 to confirm parity before committing.
- Committed the tendril rework + `docs/devlog/0029-tendrils-reworked.md` (commit `43fe526`) and pushed to `claude/ascii-overhead-game-14dir`.
- Opened PR #31 (`claude/ascii-overhead-game-14dir` → `main`) via GitHub MCP, polled check runs to green, merged with `merge_method: merge` (merge SHA `6e694ea`), which triggers the Pages prod deploy.
- Subscribed this session to PR #31 activity; verified post-merge there are zero unresolved review comments and all 4 checks passed — no action required.

## What's blocking forward progress right now

- Owner-side service wiring (Supabase project keys, Resend DNS verification, OAuth client IDs) is not yet plugged into env. The account system is scaffolded and env-gated but inert until the owner provides credentials. This blocks: display-name input, owner approval queue, persisted "met The Admin"/inventory/achievements/samaritan.
- 20-achievements design is blocked on a faction-reward Q&A with the owner (not yet held).

## What the owner is doing in parallel (their action items)

- Wiring Supabase + Resend + OAuth ("tomorrow", per their last message before this session). Step-by-step guide is in `docs/devlog/0026`.
- Owns prod deploy approvals — standing auto-merge-to-`main` confirmation was given for THIS conversation only; a fresh session must re-confirm before pushing to `main`.

## What I would do next, in priority order

1. Eyeball bitrunners.app once the Pages deploy settles (~1–2 min after merge) — confirm dashes read as thin `-`/`:` slivers under the runner, sparse while moving, near-invisible idle. If they read wrong, iterate geometry/rates in `scene.ts` tendril block.
2. Run-toggle button (backlog item 11 remainder) — a UI toggle to switch walk/run movement speed. Self-contained, no owner deps.
3. Once owner confirms Supabase/Resend/OAuth env is live: wire display-name input + owner approval queue, then persisted "met The Admin" flag (currently per-session only).
4. Hold the faction-reward Q&A with the owner, then design the 20 achievements (backlog item 12).

## Files touched this session

- `apps/web/src/scene.ts` — tendril pool reworked: geometry `BoxGeometry(0.26,0.014,0.045)` flat dash, spawn radius `0.12+rand*0.42` under `rig.root` at y `0.045`, no velocity (stationary), per-particle `MeshStandardMaterial`, fade `1 − lifeT²` on emissiveIntensity+opacity, rates `4`/sec moving · `0.35`/sec idle, pool 36→24, disposal of geom + 24 mats on teardown.
- `docs/devlog/0029-tendrils-reworked.md` — new devlog documenting the before/after.

## Do NOT do these things (specific to right now)

- Don't push to `main` from a fresh session without re-confirming with the owner — the standing auto-merge approval was scoped to the prior conversation only.
- Don't rely on a backgrounded curl/`GITHUB_TOKEN` poller to gate a merge — `GITHUB_TOKEN` is not in the shell env here. Use `mcp__github__pull_request_read` with `get_check_runs`.
- Don't gate merges on `get_status` — this repo uses GitHub Actions Check Runs, not the legacy Statuses API, so `get_status` returns `total_count:0`/pending forever. Use `get_check_runs`.
- Don't reintroduce a shared tendril material — the rework deliberately uses per-particle materials so each dash fades on its own clock; a shared material breaks independent in-place fade.
- Don't add `DepthTexture` render targets to the ASCII pipeline — iOS Safari breaks (devlog 0008).
- Don't deploy to Fly from a session shell — the GitHub Actions workflow owns deploys.

## Open questions for the owner

- Faction-reward model for the 20-achievements design — needed before that work can start.
- Confirm the new tendril look is right on the live site, or specify adjustments (count, length, fade speed, spawn radius).
- Re-confirm auto-merge-to-`main` if you want the next session to keep shipping without per-PR approval.

## Diagnostic retrospective (not sycophantic)

- The ship subagent spun up a backgrounded curl-based check poller that silently failed auth (`GITHUB_TOKEN` absent) and emitted an unreliable "all concluded" signal. It was caught and overridden by an authoritative MCP `get_check_runs` call, but a less careful run could have merged on a bogus signal. Future ship agents should not use curl polling at all.
- `get_status` is a trap on this repo: it always reports `total_count:0`/pending because CI is wired as Check Runs, not legacy commit Statuses. Anyone gating a merge on `get_status` will either hang forever or merge blind. `get_check_runs` is the only correct gate here.
- No architectural decisions were made — this was a pure visual/feature iteration plus the standard ship cycle, so `decisions.md` and `CLAUDE.md` were intentionally left untouched. Resisting the urge to log non-decisions keeps those files signal-dense.
- `.claude/handoff.md` and `.claude/decisions.md` did not exist despite `CLAUDE.md` prescribing them as session-continuity reads. This handoff is the first; a fresh session should not expect a `decisions.md` yet.
