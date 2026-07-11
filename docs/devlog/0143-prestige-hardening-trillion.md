# 0143 — Prestige hardening + trillion-scale counters

## 1. Supercomputer resets on prestige (owner call — reverses devlog 0125)

prestigeReset previously preserved BOTH capstones through the wipe.
Keeping the Supercomputer let a prestiged runner re-farm at capstone
speed from turn one, trivialising every later prestige. Now only
Corporate Greed Protocol survives; the Supercomputer returns to
locked/purchasable like the rest of the tree. Panel copy updated.

## 2. Prestige requires the full tree (greed excepted)

New `prestigeTreeComplete()` in skilltree.ts — every node except
`t.greed` must be maxed. ScrapeMenu keeps the prestige section visible
once auras unlock it, but the [ trade ] button is disabled with a
locked stub until the tree is rebuilt. Combined with fix 1 this kills
the instant re-prestige loop (the wipe itself makes the gate false).

## 3. Counters legible to a trillion

JS numbers are exact to 2^53 (~9e15) and the blob is plain JSON, so
1e12 was always REPRESENTABLE — but displays capped at an "M" tier
(1e12 rendered as "1000000.0M") and raw digits overflowed HUD rows.
New shared `fmtCompact` (k/M/B/T, unit-tested in
economy-format.test.ts) now drives the CreditsHud and every scrape-HUD
counter row. No server/schema change needed: the 0016 save guard and
grant ledger already use plain numerics.
