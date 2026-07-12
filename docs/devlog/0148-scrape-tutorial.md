# 0148 — data_scrape guided tour (P4)

Six-step in-panel walkthrough of the scrape → tabulate → calculate loop,
mounted inside the data_scrape panel. Unlike the first-play HUD tour
(devlog 0043), the "do it" steps advance on the **action itself**:

1. intro — `[ start ▸ ]`
2. scrape — highlights `.scrape-btn`; advances when `lifetimeScrapes`
   ticks up (i.e. the player actually pressed it)
3. tabulate — highlights the first `.scrape-mini` (bits → strings);
   advances when `strings` rises above the step-entry baseline
4. calculate explainer — `[ next ▸ ]` (minting a real passcode is
   25³ bits; nobody grinds that mid-tutorial)
5. tree tab — highlights the tree nav button
   (`.scrape-headbtns .scrape-tabbtn:nth-of-type(2)`); advances when
   the view flips to `tree`
6. tree explainer — highlights `.tree-node` if the tree is unlocked
   (gracefully no ring when locked) — `[ got it ]`

Skippable at every step; **finish and skip both set the flag**.

## Persistence

- `scrapeTutorialSeen` — additive boolean on the economy blob (same
  pattern as `circuitFirstClear`): default false, `=== true` normalize,
  rides the account-synced blob so the tour runs once per account, not
  once per device.
- Merge score (economy-sync.ts): `+10` when seen — beats a truly empty
  account row, never outweighs real earning progress.
- **Veteran gate**: blobs with `lifetimePasscodes ≥ 1` or
  `lifetimeScrapes ≥ 100` predate the flag — silently marked seen on
  first panel open instead of lecturing an existing player.
  (STOP-AND-ASK class: conservative default, noted here.)

## Layering

The scrape panel backdrop sits at z 50, so the old `.tutorial-card`
(z 30) / `.tutorial-highlight` (z 28) layers would render *under* it.
New `.scrape-tutorial` (z 52, fixed to the bottom edge — clear of the
SCRAPE button and tabulate rows) and `.scrape-tutorial-highlight`
(z 51) reuse the existing card/button typography classes.
`prefers-reduced-motion`: ring pulse off, same as the HUD tour.

## Owner verify

Fresh guest (or clear localStorage) → open data_scrape → card at the
bottom. Press SCRAPE → step advances by itself; bank 25 bits →
tabulate → advances; open the tree tab → advances. `[ skip ]` at any
point → never shows again (also synced to the account after sign-in).
