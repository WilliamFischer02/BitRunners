# 0108 — Tutorial rewrite: current HUD + auth-gated

## TL;DR

- Rewrote the first-play tutorial from 6 outdated steps to **10 steps**
  that match the **post-cartridge-carousel HUD** (devlog 0102 and
  everything since).
- Logged-in users **skip the tour entirely**. On any auth-resolve to
  `authenticated`, the tutorial silently calls `completeTutorial()`
  (so the `server_speaker` unlock is preserved) and removes itself
  from the DOM.
- Added a `hasPersistedSession()` synchronous heuristic to suppress
  the brief flash returning logged-in users would otherwise see while
  `subscribeAuth` resolves.

## What was wrong before

The old STEPS pointed at HUD elements that no longer exist:

| Old target | What it was | Status |
| --- | --- | --- |
| `.shop-launch` | `$` button on the right rail | Removed when the cartridge carousel replaced the rail |
| `.scrape-launch` | `// data scrape` button on the right rail | Removed |
| `.emote-center` | Inventory `▦` in the emote wheel | Still exists |
| `.hint` | Control hint line | Still exists |

So a guest reaching steps 2–4 saw the highlight ring vanish because
the target selector returned `null`. The body copy also referenced
buttons that aren't there anymore.

## New STEPS

| # | Title | Target |
| --- | --- | --- |
| 1 | welcome, runner | — |
| 2 | moving around | `.hint` |
| 3 | // protocols | `.protocols-launch` |
| 4 | data_scrape | `.protocols-launch` |
| 5 | credits + tokens | `.credits-hud` |
| 6 | spectrum navigator | `.starmap` |
| 7 | emotes + inventory | `.emote-center` |
| 8 | your handle | `.profile` |
| 9 | levels + missions | `.protocols-launch` |
| 10 | one more thing — the obelisk | — |

Each step's body copy describes a current feature:

- The cartridge carousel and its five cartridges (data_scrape,
  objectives, shop, tether_chat, freq_lock).
- The scrape ladder (bits → strings → serials → passcodes → credits).
- The credits / tokens HUD strip and what each currency is for.
- The Spectrum Navigator (formerly starmap, devlog 0104).
- The emote-wheel + 4-slot loadout + inventory entry.
- Profile/account gating and what persists when you sign in.
- Levels capped at Lv 20 driven by earned badges.
- The obelisk finale (Admin encounter → `server_speaker` unlock).

## Auth gate

Two parts:

1. **Initial render check.** Looks at `localStorage` for any
   `sb-*-auth-token` key (supabase-js v2 storage convention). If
   present, the tutorial defaults to inactive immediately — no
   flash. Degrades gracefully (allows the brief flash) if Supabase
   ever renames its storage key.

2. **Live subscription.** The existing `subscribeAuth` callback now
   also flips the tutorial off when status transitions to
   `authenticated`, and silently calls `completeTutorial()` if the
   user hasn't already finished it. That preserves the
   `server_speaker` unlock that guests earn by walking through —
   account holders aren't penalised for skipping.

## What I didn't change

- The reward UI and the guest-only CTA (`make account` button) flow
  remain. Those still trigger when a guest reaches the obelisk.
- Localstorage `tutorialDone` semantics unchanged — `[skip]` still
  doesn't mark done (so a guest who dismisses can see it next visit);
  `[finish]` and the Admin encounter still do.
- No changes to `economy.completeTutorial()` or the
  `server_speaker` unlock mechanic.
- The pulsing-ring highlight component (`TutorialHighlight`) is
  identical to before — only its consumers (the STEPS list) changed.
