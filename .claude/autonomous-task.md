# Autonomous task — standing brief for scheduled Claude Code runs

You are running **unattended** on a schedule to move BitRunners forward while
the owner is away. Make safe, reviewable progress and leave the repo green and
documented. The owner reviews your draft PRs later — you do **not** ship to
production.

## 1. Start of every run (mandatory readback)

Read, in order, before touching anything:
1. `CLAUDE.md` (project rules — they override everything here).
2. `.claude/handoff.md` (where the last session left off; "what's next").
3. `.claude/decisions.md` (locked architectural/canon decisions — do not relitigate).
4. The newest file in `docs/devlog/` and `docs/devlog/0039` (sprint roadmap).
5. The epic plans in `docs/design/` (`p2p-trading-epic.md`,
   `admin-panel-epic.md`) for gated/blocked work.

Then pick **one** coherent piece of work (below) and do it end to end.

## 1b. Check open PRs FIRST (coordinate with other instances)

Other instances run in **separate containers** — the only shared state is
GitHub. Use **open PRs + branches as the coordination lock.** Before picking
work:

1. `git fetch origin`, then **list open PRs** (GitHub MCP `list_pull_requests`,
   `state=open`). Note each one's title, head branch, and changed files
   (`pull_request_read` → `get_files`).
2. **Do NOT start an item an open PR already covers.** If the roadmap item you'd
   pick is the subject of an open PR (by title/scope), pick a **different,
   uncovered** item. Two PRs for one feature is the duplicate that caused the
   #45/#46 mess — avoid it.
3. **Prefer a disjoint file footprint.** Choose an item that touches files no
   open PR is editing, so concurrent work merges cleanly. (Beware shared hot
   files: `economy.ts`, `AdminConsole.tsx`, `supabase.ts`, `style.css`,
   `ScrapeMenu.tsx`, `Samm.tsx`, `scene.ts`.)
4. **Branch from the latest `origin/main`** — always `git fetch` first; never
   build on a stale snapshot.
5. **Claim early:** after your *first* commit, open your **draft** PR
   immediately (not at the end), titled for the item, so other instances see
   it's taken.
6. **Re-check before pushing:** `git fetch` again; if `main` moved, merge it in
   and re-run gates so your PR stays conflict-free. If an open PR now covers
   your item, **stop and pick another** — don't ship a duplicate.
7. **Never** resolve a same-item collision by force-push or by merging another
   instance's PR. Leave consolidation to the owner (or a single combine pass)
   and note it in `.claude/handoff.md`.

If every near-term roadmap item is already covered by an open PR, do a security
pass or a docs/test improvement instead (§2.1 / §2.5) rather than duplicating
in-flight work.


## 2. What to work on (priority order)

1. **Security issues** — if you find one (see §4), fix it first; it outranks features.
2. **Bugs / regressions** noted in the handoff.
3. **Unblocked roadmap items** — polish + features: UI/UX cleanup, game-feel/
   optimization, deferred polish (distinct pet shapes, tutorial-card placement,
   client auto-reconnect on disconnect), perf passes, reduced-motion coverage,
   test coverage.
4. **Backend epics** — auth + account-economy + admin role/config are now LIVE
   (migrations 0001–0005 run). Next: **admin phase 3** (user table + credit/
   token grants — security-critical: `SECURITY DEFINER` + `is_admin()` gating,
   careful `auth.users` email exposure) and the **trading backend**
   (server-authoritative economy). Large + security-sensitive — take ONE phase,
   design RLS carefully, flag for owner verification.
5. **Roadmap planning** — if nothing else is actionable, refine an epic plan or
   propose next steps in a devlog. Planning is a valid run.

Prefer small, shippable, isolated changes over large risky ones. One feature or
one polish batch per run.

## 3. Hard rules (non-negotiable)

- **Branch:** work only on the designated dev branch (see CLAUDE.md / handoff).
  **Never push to `main`.** Deploys (Pages + Fly) are owner-gated.
- **Never merge PRs.** Open a **draft** PR and stop. The owner merges.
- **Gates before every commit:** `pnpm lint`, `pnpm typecheck`, `pnpm build`
  must all pass. Never commit red. Use the Biome formatter; don't hand-fight it.
- **No paid resources, no new Fly machines, no plan upgrades.** No deploying to
  Fly from the shell.
- **No silent dependency bumps/additions** — if one is truly needed, devlog it
  (name, version, why) and prefer a zero-dep solution.
- **Canon & lore:** never invent lore unilaterally (Q&A → record). Never surface
  `docs/lore/_sealed/` content in any player-facing surface. Preserve locked
  decisions (e.g. the fixed 8× ladder). NOTE: Tokens are now UNLOCKED for
  bit_spekter via the proxy-wallet (lore 009) — do not re-lock them.
- **Secrets:** never read/edit `.env*`, keys, or anything under `**/secrets/**`.
- **Git safety:** no force-push, no `reset --hard`, no history rewrites, no
  `--no-verify`. Create new commits.
- **Don't guess on big calls.** If a task is architecturally significant or
  genuinely ambiguous, do NOT improvise — write the question + your
  recommendation into `.claude/handoff.md` for the owner and pick something else.

## 4. Security review (every run)

Spend part of each run scanning for and, where safe, fixing:
- Client-trusted privileged actions (admin/role checks, currency grants) — these
  MUST be server-enforced (RLS / privileged functions), never client-only.
- Supabase RLS gaps: every user-writable table must restrict to own-row
  (`auth.uid()`). New tables need policies.
- Injection (SQL/command/XSS), unsanitized external input, `dangerouslySetInnerHTML`.
- Secrets committed to the repo or logged.
- Dependency advisories (note them; don't auto-upgrade majors).
- Moderation rule: no free-text player input anywhere (emotes/trades use fixed
  catalogs).
Log findings in the devlog; fix the small/clear ones, escalate the rest to the
handoff.

## 5. Wrap up every run

- Gates green (lint/typecheck/build).
- Append a new `docs/devlog/NNNN-*.md` describing what changed + honest status
  (call out anything not verifiable headless).
- Update `.claude/handoff.md` (state, what's next, any new blockers/questions).
- Record any new decisions in `.claude/decisions.md`.
- Commit (descriptive message), push the dev branch, open/refresh a **draft** PR.
- If you changed `apps/server` or `packages/`, flag in the PR that merging
  triggers a Fly redeploy.
- Leave the working tree clean.

## 6. Time-box & restraint

Keep each run to one coherent deliverable. Don't sprawl across many systems.
Don't refactor for its own sake. If you finish early, do a security pass or
improve docs/tests rather than starting something large you can't finish
cleanly. Better to under-promise and leave the repo green than to leave a
half-built feature.
