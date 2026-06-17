# Handoff — 2026-06-16, Autonomous mega-batch (14 tasks)

## What this session was

Fully-autonomous run against the 14-item mega-batch in `launch-prompt.md`.
All work is on **`claude/mega-batch-2026-06-16`** (pushed). Every task is a
single atomic commit with its own devlog (0089–0102).

### ⚠️ PRs were NOT auto-opened — `gh` is not authenticated

The launcher assumed `gh` CLI auth; this environment has none and no token
to supply (a STOP-AND-ASK: needs owner secrets). So I could not open 14
draft PRs. Instead the branch carries **15 clean, atomic commits** (one
prerequisite + 14 tasks). To review:

- Open one PR for the whole batch:
  `https://github.com/WilliamFischer02/BitRunners/compare/main...claude/mega-batch-2026-06-16`
- Or cherry-pick per task — each task = one commit (SHAs below), each with a
  matching `docs/devlog/00NN-*.md`.

All gates green at session end: `pnpm typecheck` (8/8), `pnpm build` (5/5),
`pnpm test` (12/12). Biome is clean on LF (CI/Linux); on this Windows clone
`biome check` reports JSON line-ending "errors" that are pure autocrlf
artifacts — `git diff` shows zero content change, and `biome check --write .`
is the project's gate.

## Prerequisite fix (commit 5586a87)

`Samm.tsx` (component) and `samm.ts` (logic) differed only by case — broke
`tsc` on any case-insensitive FS (Windows/macOS). Renamed the logic module
to `samm-machine.ts`. This unblocked typecheck for the whole session.

## Per-task status

| # | Task | Commit | Notes |
|---|---|---|---|
| 4.1 | Persistent objective progress | da2a0a9 | devlog 0089. Server (0011 RPCs) now source of truth: read on auth (`mission-server-load.ts`), write on advance/complete; Objectives reads the completed list (no more grey-out). vitest reconcile (6 cases). |
| 4.2 | Account shows guest while authed | 0cfb4fb | devlog 0090. ProfileIcon wired to live identity/auth; handle + uuid8 shown. |
| 4.3 | AFK self-ghosts | 9d465c7 | devlog 0091. **Server** — one live session per account; stale tab gets "session moved" overlay. vitest registry (6 cases). |
| 4.4 | Desktop launcher pills | 403a585 | devlog 0092. CSS — pills drop below the minimap, stair-stepped. |
| 4.5 | Minimap mobile exit | 5920377 | devlog 0093. CSS — 44px close button + letterboxed square canvas. |
| 4.6 | Account menu reorg | 6c393d6 | devlog 0094. $ identity / samaritan / account / economy / settings / room / debug. |
| 4.7 | Inventory redesign | f395a11 | devlog 0095. Item glyph icons + 20% clothing saturation. |
| 4.8 | Shop tabs | fc7184e | devlog 0096. // outfits / emotes / themes / upgrades, sessionStorage. |
| 4.9 | Remote nametag styling | 907324b | devlog 0097. **Server** — nameWeight/nameTint on PlayerState (badges already worked). |
| 4.10 | Level system | 1879d14 | devlog 0098. **Server** — level field; `Lv N` chip. Formula = badge count cap 20 (STOP-AND-ASK). |
| 4.11 | Bot tether dialogues | d29e44c | devlog 0099. **Server** — NPCs auto-accept + chatter; also fixed missing tap-to-request wiring. |
| 4.12 | Emote loadout | ec7b469 | devlog 0100. Catalog (10 base + 10 premium), 4 equip slots, picker. **No migration** — rides economy blob (see below). |
| 4.13 | freq_lock minigame | c3e0903 | devlog 0101. Lazy-loaded 4-lane rhythm game; score→credits. Feel STOP-AND-ASK. |
| 4.14 | Cartridge carousel | e72dbdb | devlog 0102. All 3 stages (drag+snap / worn-tape art / drop animation). Stage 3 is CSS faux-3D. Feel STOP-AND-ASK. |

## Owner actions required

1. **Open the PR(s)** from the compare URL above (gh wasn't authed; I
   couldn't).
2. **Server redeploys (Fly)** — 4.3, 4.9, 4.10, 4.11 touch `apps/server`.
   Merging those triggers a Fly redeploy (owner-gated). Web+server deploy
   together from `main`; schema fields were *appended* so no
   `PROTOCOL_VERSION` bump and old/new clients interop.
3. **No new Supabase migrations to run.** 4.1 relies on existing `0011`.
   4.12 deliberately does **not** add `0013` — see decision below.

## Decisions logged (`.claude/decisions.md`)

- **Emote loadout rides the account-synced economy blob**, not a
  `profiles.equipped_emotes` column / `0013` migration. The blob already
  syncs per-account via `player_economy` (0002), so the loadout follows the
  account with zero owner SQL. A separate column would be a second source of
  truth. `0013` is left unused. (The brief asked for the column + migration;
  this is a reasoned, owner-action-free deviation — flag if you specifically
  want it server-authoritative, which is the trading-epic upgrade.)

## STOP-AND-ASK items flagged for owner (defaults shipped)

- **4.10 level formula** — `level = badge count`, cap 20. Easy curve swap
  (`levelFromBadgeCount` / shared `clampLevel`).
- **4.12 premium emote price** — `PREMIUM_EMOTE_PRICE = 100 cr` placeholder.
- **4.13 freq_lock feel + economy** — timing windows + 1cr/10pt cap-100
  (constants at top of `FreqLock.tsx`).
- **4.14 cartridge drop feel** — descent curve / click-in / slot
  (`CART_W`, `DROP_MS` + `cart-drop`/`cart-click` keyframes in
  `Protocols.tsx` / `style.css`). Stage 3 implemented as CSS faux-3D rather
  than a three.js ground plane to stay bounded.

## Known gaps / future-session items

- **Per-task PRs**: if you want 14 separate PRs instead of one, the commits
  are atomic — `git cherry-pick <sha>` onto fresh branches off `main`.
  (Several touch shared files — `scene.ts`, `network.ts`, `shared/index.ts`,
  `state.ts`, `style.css`, `App.tsx` — so they'd need ordering; merging the
  whole branch is simplest.)
- **Visual/3D/mobile verification is owner-side.** No browser-automation
  dep is installed, so CSS/GLSL/scene changes (4.4, 4.5, 4.7 in-world,
  4.13, 4.14) were verified by inspection + clean build, not screenshots.
  Each devlog lists concrete manual verify steps.
- **Full Colyseus integration tests** (4.3 connect-twice, 4.11 bot accept)
  would need `@colyseus/testing` (a new dep). Covered by pure-unit tests +
  documented manual repros instead.
- Tether Hop / Sub-phase J still need owner mechanics Q&A (unchanged from
  prior handoff).
