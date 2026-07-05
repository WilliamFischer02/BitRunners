# 0131 — Supercomputer converts at scrape speed

## The intent (owner clarification)

The Supercomputer capstone was ticking conversions at the shared
BOT_TICK_MS like every other converter bot, so bits piled up far
faster than they converted. The upgrade's actual spirit: carry the
scrape cadence THROUGH the ladder — as bits stream in, strings /
serials / passcodes rise proportionally (factoring down 8:1 per rung)
at whatever speed the player scrapes (tap, hold-down, or the forced
tier-4 auto-tapper).

## What changed (`ScrapeMenu.tsx`)

- New `scLadderDrain()` runs inside `doScrape()` — i.e. after EVERY
  scrape from any source. When Supercomputer is owned + master bots
  on, it drains each rung with a bounded while-loop
  (`canTabulate → tabulate`, cap 64/rung/tick) so conversion always
  keeps up with income, whatever the scrape rate.
- Per-bot switches (devlog 0129) still gate each rung inside the
  drain, so "pause serials→passcodes" keeps working on capstone
  accounts.
- The BOT_TICK_MS loop no longer scrapes on behalf of the
  Supercomputer (the forced tier-4 auto-tapper already does) but
  remains the fallback converter for sc accounts with scraping paused,
  and the only driver of passcodes→auras.

## Interpretation flag

"All 4 levels up to passcodes" = bits → strings → serials → passcodes
at scrape speed. **Auras are excluded** — passcodes→auras stays on the
slow bot tick, since auras are a spend decision rather than part of
the flow. Easy to fold in if the owner wants it.
