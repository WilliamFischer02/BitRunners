# 0136 — Performance-pass kit: setup script + recon-seeded launch prompt

## What this is

Owner is about to run a dedicated local Claude Code session (Fable 5,
ultracode, bypass permissions) to do a full performance pass. This kit:

- `setup-perf-pass.ps1` — admin PowerShell bootstrap: winget-updates
  PowerShell 7 / Git / Node LTS, re-execs under pwsh 7 if needed,
  activates the pinned pnpm via corepack, installs/updates the Claude
  Code CLI, syncs the repo to origin/main, cuts
  `claude/perf-pass-YYYY-MM-DD`, frozen install + baseline build, then
  launches `claude --model claude-fable-5 --permission-mode
  bypassPermissions` with MAX_THINKING_TOKENS and the prompt below.
  ASCII-only (PR #101 lesson).
- `perf-pass-prompt.md` — the lead-developer brief. First word is
  `ultracode` (multi-agent opt-in). Structured: measure baseline →
  P0 economy event storm → P1 bundle/load path → P2 render loop →
  P3 network/auth cadence → guardrails (CI bundle budget script,
  docs/PERFORMANCE.md house rules, permanent ?perf=1 HUD).

## Recon behind the prompt

A 4-scout workflow (render, react, bundle, network) surveyed the tree
and returned 31 file:line findings, embedded in the prompt as the
verified backlog. Headlines:

- `scLadderDrain` + per-mutation `persist()` can produce ~2000
  synchronous localStorage writes/sec under the 90 ms supercomputer
  tapper (ScrapeMenu.tsx:834 / economy.ts:272).
- The title screen pays the full 1,037 kB (289 kB gzip) single chunk —
  scene.ts (three.js + colyseus) is statically imported (App.tsx:37),
  no manualChunks, dialogue table fetched at boot for every visitor.
- ~16 independent `subscribeAuth` call sites each own a GoTrue
  subscription + getSession round-trip; hourly token refreshes fan out
  into redundant DB queries (supabase.ts:37 et al.).
- 15 Hz `sendMove` with no dirty check; x/z/rotY as 3 separate
  listeners → ~1800 allocations/sec at a full sphere (network.ts:202).

The perf session re-verifies every line number before editing.
