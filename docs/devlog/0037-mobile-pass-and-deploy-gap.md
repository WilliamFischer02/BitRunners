# 0037 — Mobile/desktop pass + deploy-gap correction

**Date:** 2026-05-19
**Branch:** `claude/bitrunners-collaboration-EcqBv`

## The deploy gap (root cause of "not seeing them deployed")

PR **#33 was merged on 2026-05-16 at its first commit only** (`b6d34fb`, the
multiplayer fixes), then closed. Every commit after that — `8f4a8c2` (services
guide) and the entire Data Scrape mini-game `74bcb82`/`17e31c7`/`29ac37a`/
`5423b91` (devlogs 0033–0036) — landed on the branch with **no open PR**, so
nothing past the multiplayer work ever reached `main`. Prod `bitrunners.app`
therefore only has the multiplayer changes.

Process fix: a **new PR** is opened for the 5 stranded commits + this one.
Future sessions: after pushing, check the existing PR is *open* — a
merged/closed PR does not pick up new commits; open a fresh one.

**Deploy scope of the stranded work:** `git diff --name-only origin/main..HEAD`
= `apps/web/**` + `docs/**` + `.claude/**` only. **No `apps/server` or
`packages/` changes** → merging triggers a **Cloudflare Pages prod deploy
only, no Fly deploy**. (The server-side protocol bump etc. is in `b6d34fb`,
already on main.)

## Mobile/desktop compatibility pass

The `.panel` was already responsive (`width:min(520px,100%)`,
`max-height:86vh`, scrolls) and the viewport meta is correct. Gaps were in
the **new** clicker chrome, which had zero responsive rules:

- `.scrape-launch` didn't shrink with `.profile` on small screens (fixed
  `min-width:170px`).
- The clicker header (title + scrape/shop/inv/✕) would **overflow** a narrow
  phone (no wrap, fixed sizes).
- Touch tap targets (`.scrape-mini`, `.shop-buy`, `.scrape-tabbtn`,
  `.inv-slot`, `.panel-toggle`) were 9–11px controls — too small for fingers.

Added (style.css, append-only, no base-rule changes so **desktop is
untouched**):

- `@media (max-width: 540px)` — launcher scaled to match the profile,
  `.panel-header`/`.scrape-headbtns` wrap + shrink (fixes overflow), HUD/shop/
  inventory typography tightened.
- `@media (pointer: coarse)` — min tap heights (38–46px) for clicker
  controls; touch only, mouse unaffected.

## Honest status

- Gates green: `pnpm lint` clean (43 files), `pnpm typecheck` 8/8,
  `pnpm build` 5/5.
- **Not device-verified** (headless env). Rules follow the existing
  540/380 breakpoint patterns and the panel's known sizing, but a real
  phone/desktop eyeball is still needed — the **Cloudflare Pages PR preview**
  is the place to do that before any prod merge.
- Prod deploy of the stranded work is **owner-gated** — not done; see PR.

## Files

`apps/web/src/style.css` (responsive + touch rules), this devlog,
`.claude/handoff.md`.
