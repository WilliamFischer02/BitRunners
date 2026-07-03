# 0129 — Per-bot toggles in data_scrape

## TL;DR

- The `$ bots` section of the scrape panel now gives **each unlocked
  bot its own `[ on ]` / `[ off ]` switch** next to the existing
  master toggle (relabelled `[ all on ]` / `[ all off ]`).
- A bot runs only when `master && its own switch && unlocked`. The
  owner's motivating example — pausing just the passcodes→auras bot
  while the rest of the ladder keeps converting — now works.
- On Supercomputer accounts the capstone's continuous scrape rides the
  auto-tapper's switch, so "stop scraping, keep converting" works
  there too.

## Behaviour

| Switch | Governs |
| --- | --- |
| master (`[ all on ]`) | Everything at once — unchanged semantics |
| `auto-tapper` | The tiered auto-SCRAPE interval + the Supercomputer continuous scrape |
| `bits → strings` | That ladder rung's converter tick |
| `strings → serials` | 〃 |
| `serials → passcodes` | 〃 |
| `passcodes → auras` | 〃 |

Each row shows the effective state (`▶` running / `⏸` paused) computed
from master && own switch, so a row individually ON under a master OFF
reads as paused.

## Persistence

Device-local, like the master: new localStorage key
`bitrunners.settings.bots-sel` (JSON `Record<BotKey, boolean>`,
defaults all-true, unknown/malformed keys fall back to defaults).
Deliberately NOT on the account economy blob — bot preferences are a
device-level convenience, and keeping them out of the blob avoids
another merge surface after the 0016 hardening. Same call as the
master toggle made originally.

## Files

- `apps/web/src/ScrapeMenu.tsx` — `BotSelection` type + load/save
  helpers, per-bot state in `ScrapePanel`, both automation effects
  now consult the per-bot map, `BotsStatus` renders per-row toggles.

No schema, no server change, no new dependency.
