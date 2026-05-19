# 0038 — Clicker skill tree + main-view surfacing

**Date:** 2026-05-19
**Branch:** `claude/bitrunners-collaboration-EcqBv`

Owner-directed expansion of the Data Scrape mini-game. Three design forks were
architecturally significant (one touched a non-existent premium system, one a
**locked** canon decision, one restructured the shop) so they went through
`AskUserQuestion` first. Decisions recorded in `.claude/decisions.md` and
`docs/design/clicker-minigame.md` §16.

## Locked owner decisions

1. **Auto-click → functional & free now.** No membership/billing exists (out of
   phase, paid infra). Premium gating is a later seam (`hasAutoScrape()`); not
   faked, not paywalled today.
2. **Path 3 → raise credit-yield at the trade.** The uniform **8× ladder
   (STEP) is untouched** — the locked §3/§10 canon stays intact. A finished
   passcode is worth more *Credits* over time instead; shop prices can stay
   fixed as the owner wanted, with no canon/lore edit.
3. **Upgrades → moved into a passcode skill tree.** Shop is now cosmetics-only
   (Credits). Credits buy looks; passcodes buy power. The shop `upgrade`
   `ItemKind` and credit-based `purchaseUpgrade` are removed.

## What shipped

- **`skilltree.ts`** (new, isolated — imports only `economy.ts`): 3-path tree,
  all balance numbers centralized.
  - **Path 1 · scrape depth** — `deeper scrape` ×12 (+1 bit/SCRAPE/lvl).
  - **Path 2 · persistent kit** — `sustained pull` (hold-to-scrape),
    `tabulate cache` ×3 (bulk reach I–III), `autonomous pull` (auto-scrape).
  - **Path 3 · conversion alchemy** — `data appreciation` ×12
    (+1 Credit/passcode at the Admin/Company trade).
- **`economy.ts`** — additive `lifetimePasscodes` (gates the tree at "ever
  minted ≥1 passcode"; seeded from current passcodes on load so existing
  players aren't locked out; never decremented). `creditsPerPasscode()`,
  `hasHoldScrape()`, `hasAutoScrape()`, `isTreeUnlocked()`,
  `purchaseTreeNode()` (passcode sink). `purchaseUpgrade()` removed.
- **Hold-to-scrape** (press-and-hold repeat; quick tap stays one scrape) and
  **auto-scrape** (hands-free while the panel is open — *not* offline idle).
- **Main-view surfacing:** launcher renamed (`> data scrape`); standalone
  **shop icon button** on the right rail under the launcher; **inventory
  button in the emote-wheel centre**; new `tree` tab in the panel. Cross-open
  via a `bitrunners:open-scrape` CustomEvent (`openScrape(view)`).
- **`style.css`** — append-only: shop launcher, emote-centre, skill-tree
  grid + node rows, hints; ≤540px + `pointer:coarse` extensions. Desktop
  base rules untouched (continues the devlog-0037 norm).

## Isolation / canon

Isolation from §11 preserved: no `scene.ts`/`network.ts`/server imports
anywhere in the mini-game; `EmoteWheel` stays presentational (plain optional
`onInventory` prop). No new lore invented; no sealed content surfaced. The
faction-reward curve remains the separate open Q&A.

## Honest status

- Gates green: `pnpm lint` clean (44 files), `pnpm typecheck` 8/8,
  `pnpm build` 5/5. (Pre-existing >500 kB three.js chunk warning unchanged.)
- **Not device-verified** (headless). Specifically un-eyeballed: emote-wheel
  centre button fit at the glow-pass wheel size; skill-tree 3-col layout on a
  narrow phone; hold/auto cadence feel. Use the Cloudflare Pages PR preview.
- **Balance is a first pass, NOT tuned to the "≈1 week of 1 h sessions"
  target** — that needs live play. All constants isolated in `skilltree.ts`
  (+ `HOLD_MS`/`AUTO_MS` in `ScrapeMenu.tsx`) for one-place tuning.
- Shop launcher is icon-forward (`$` + tiny caption); say the word if you want
  it caption-free.
