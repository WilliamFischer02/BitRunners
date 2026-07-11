# 0137 — Performance pass: baseline + ?perf=1 instrumentation

Start of the dedicated performance pass (kit: devlog 0136). This entry
records the baseline every later perf PR measures against, and adds the
zero-dep instrumentation used to measure it.

## Baseline bundle (pnpm build, vite 6.4.2)

| chunk | raw kB | gzip kB |
| --- | ---: | ---: |
| assets/index-*.js (entry — three + colyseus + supabase + all panels) | 1,037.64 | 289.09 |
| assets/Board-*.js (Tiptap board, lazy) | 441.77 | 147.61 |
| assets/index-*.css (single global sheet) | 99.01 | 18.79 |
| assets/CircuitPatch-*.js | 11.57 | 4.10 |
| assets/FreqLock-*.js | 5.27 | 2.13 |
| assets/CoreRun-*.js | 4.76 | 1.39 |
| assets/BoardsLanding-*.js | 4.60 | 1.82 |
| index.html | 0.48 | 0.31 |

The title screen pays the full 289 kB gzip entry before a single button
is clickable. No manualChunks; supabase-js is pulled into the entry by
`main.tsx` → `dialogue.ts` / `economy-sync.ts`.

## Baseline runtime (analytic, from code; verify live with ?perf=1)

- `economy.ts persist()` = full-blob `JSON.stringify` + `localStorage.
  setItem` + CustomEvent dispatch on EVERY mutation.
- Hold-scrape (110 ms) ≈ 9 writes + 9 dispatches/sec.
- Supercomputer tapper (90 ms) + `scLadderDrain` (up to 64+64+64
  `tabulate()` calls per tap) ⇒ worst case ≈ 193 persists per tap ≈
  **~2,100 synchronous localStorage writes + dispatches per second**.
- Every dispatch re-renders the whole 1,181-line ScrapePanel via
  `setEco({...getEconomy()})`, ×3 via nested duplicate subscriptions
  (EmoteSlotsSection, BotsStatus), plus always-mounted CreditsHud /
  EmoteWheel / ProfileIcon clones.

## Instrumentation added (`apps/web/src/perf.ts`)

- Active only with `?perf=1`; one-branch no-op otherwise. Zero deps,
  plain DOM overlay (no React reconciliation cost).
- Shows: fps (rAF-counted), JS heap (Chrome `performance.memory`),
  and per-second rates for named counters.
- Counters wired: `eco.mutate` / `eco.write` (economy.ts persist),
  passive listeners for `bitrunners:economy-changed` /
  `bitrunners:appearance-changed` dispatch rates.
- `initPerfHud()` called once from `main.tsx`.

Every later perf PR reports before → after against this table.
