#!/usr/bin/env node
// Bundle budget gate (perf pass, devlog 0142). Run AFTER `vite build`:
//
//   pnpm --filter @bitrunners/web build && pnpm --filter @bitrunners/web check-bundle
//
// Fails (exit 1) when:
//   * the entry chunk (the JS file referenced by dist/index.html) exceeds
//     ENTRY_BUDGET_GZIP_KB — this is the title-screen boot path that the
//     P1 pass cut from 289 kB to ~12 kB gzip; don't let it creep back.
//   * ANY chunk exceeds CHUNK_BUDGET_GZIP_KB — worst offenders today are
//     Board (~148) and the three vendor chunk (~124), both lazy.
//
// Zero dependencies: reads dist/, gzips with node:zlib. Budgets are
// deliberately loose (~2× current) so the gate catches regressions, not
// normal feature growth. Update the numbers alongside a devlog entry if a
// deliberate change moves them.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const ENTRY_BUDGET_GZIP_KB = 120;
const CHUNK_BUDGET_GZIP_KB = 350;

const dist = join(import.meta.dirname, '..', 'dist');
const assets = join(dist, 'assets');

let indexHtml;
try {
  indexHtml = readFileSync(join(dist, 'index.html'), 'utf8');
} catch {
  console.error('[check-bundle] dist/index.html not found — run `vite build` first.');
  process.exit(1);
}

// The entry chunk is the module script index.html loads directly.
const entryMatch = indexHtml.match(/src="\/assets\/(index-[^"]+\.js)"/);
const entryName = entryMatch?.[1] ?? null;
if (!entryName) {
  console.error('[check-bundle] could not find the entry <script> in dist/index.html.');
  process.exit(1);
}

const failures = [];
const rows = [];
for (const file of readdirSync(assets).sort()) {
  if (!file.endsWith('.js')) continue;
  const path = join(assets, file);
  const raw = statSync(path).size;
  const gz = gzipSync(readFileSync(path), { level: 9 }).length;
  const gzKb = gz / 1024;
  const isEntry = file === entryName;
  rows.push(
    `  ${isEntry ? '▶' : ' '} ${file.padEnd(36)} ${(raw / 1024).toFixed(1).padStart(8)} kB  ${gzKb
      .toFixed(1)
      .padStart(7)} kB gzip`,
  );
  if (isEntry && gzKb > ENTRY_BUDGET_GZIP_KB) {
    failures.push(
      `entry chunk ${file} is ${gzKb.toFixed(1)} kB gzip — budget ${ENTRY_BUDGET_GZIP_KB} kB. The boot path is regressing: check for new static imports in main.tsx / App.tsx (anything game-only belongs in Game.tsx or a lazy chunk).`,
    );
  }
  if (gzKb > CHUNK_BUDGET_GZIP_KB) {
    failures.push(
      `chunk ${file} is ${gzKb.toFixed(1)} kB gzip — budget ${CHUNK_BUDGET_GZIP_KB} kB. Split it or devlog the deliberate increase and bump the budget.`,
    );
  }
}

console.log(`[check-bundle] dist/assets (entry = ${entryName}):`);
for (const row of rows) console.log(row);

if (failures.length > 0) {
  console.error('\n[check-bundle] FAIL:');
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(
  `\n[check-bundle] OK — entry ≤ ${ENTRY_BUDGET_GZIP_KB} kB gzip, all chunks ≤ ${CHUNK_BUDGET_GZIP_KB} kB gzip.`,
);
