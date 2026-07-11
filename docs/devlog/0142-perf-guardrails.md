# 0142 — Perf guardrails: bundle budget gate + reference doc

Final tier of the performance pass (baseline 0137 · P0 0138 · P1 0139 ·
P2 0140 · P3 0141). The fixes are only half the assignment — this tier
makes regressing them loud.

## What shipped

- **`apps/web/scripts/check-bundle.mjs`** — zero-dependency budget gate.
  Reads `dist/index.html` to identify the true entry chunk, gzips every
  `dist/assets/*.js` with `node:zlib`, prints a size table, and exits 1
  if the entry exceeds **120 kB gzip** or any chunk exceeds **350 kB
  gzip**. Budgets are ~2× today's worst (entry ~12, Board ~148,
  three ~124) so they trip on regressions — e.g. a game module statically
  imported from `App.tsx` dragging three.js back onto the boot path —
  not on normal growth. Failure messages say what to check. Run:
  `pnpm --filter @bitrunners/web check-bundle` (new package script)
  after a build.
- **CI wiring deliberately NOT done.** `.github/workflows/` edits require
  explicit owner confirmation (CLAUDE.md working agreement). To wire it,
  add `pnpm --filter @bitrunners/web check-bundle` as a step after the
  web build in the Pages workflow — one line, whenever authorized.
- **`docs/PERFORMANCE.md`** — the keep-the-wins reference: budgets +
  gate usage, load-path rules (Game.tsx boundary, function-form
  manualChunks, no boot-path network calls), render-loop rules (no
  per-frame setState / allocation / layout reads / redundant style
  writes), network/auth cadence rules (shared subscribeAuth, uid-guarded
  refetches, no unchanged-state saves, the 10 s move keepalive and WHY
  it must survive), and the `?perf=1` HUD workflow.
- **`.claude/decisions.md`** — one consolidated 2026-07-11 entry locking
  the patterns (budget gate, function-form manualChunks, shared auth
  subscription, never-fully-silent client, per-frame hygiene) so future
  sessions don't "simplify" them back out.
- The `?perf=1` HUD itself shipped in the baseline tier (0137,
  `apps/web/src/perf.ts`) and stays in the production bundle — a
  single-branch no-op when the flag is absent.

## Verification

`check-bundle` run against the current build: OK — entry 12.2 kB gzip,
worst chunk Board 143.9 kB gzip, all under budget.

Gates: biome ✓ · typecheck 8/8 ✓ · test 46/46 ✓ · build 5/5 ✓.
No new dependencies.
