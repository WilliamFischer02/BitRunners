# 0021 — Fly deploy fix + full-screen boot + character select + transition rain + emote wheel + profile panel

**Date:** 2026-05-14

Owner reported the Fly v1 release failed and shared the machine log:

```
[PM01] machines API returned an error: "machine ID 2879325b42d318 lease currently held by 9af60c27-ee17-55df-bb0a-4f369e59839a@tokens.fly.io, expires at 2026-05-14T10:41:08Z"
```

Also asked for: full-screen boot scroll → character select → transition rain → game; an emote wheel; and a clickable profile icon top-right that opens a placeholder panel.

## Fly deploy — root cause and fix

### What broke

Two issues stacked:

1. **App name mismatch** — owner ran `flyctl launch` manually which named the app `bitrunners`, but the `fly.toml` I wrote said `bitrunners-server`. Owner's app is correct; my config was wrong.
2. **Workspace `.ts` imports at runtime** — the workspace packages `@bitrunners/shared` and `@bitrunners/game-core` have `"main": "./src/index.ts"` because Vite handles the transform for the web client. But the server runtime is plain Node — when the deployed server imports `@bitrunners/shared`, Node tries to load raw TypeScript and crashes immediately. This is why `release v1` failed at startup.

The lease error in the screenshot is a downstream symptom: the failed release left a machine in a half-started state holding a lease for ~2 min before auto-release.

### Fix: bundle the server with esbuild

Replaced the server's `tsc` build with an esbuild bundle:

- `apps/server/build.mjs` — single-file esbuild config: ESM output, target node22, bundles all workspace and `node_modules` deps into `dist/index.js` (~2.1 MB, self-contained)
- `apps/server/package.json` — `"build": "node build.mjs"`, kept `"typecheck": "tsc --noEmit"` as a separate gate
- Added `esbuild@^0.24.0` as a dev dep
- `experimentalDecorators` already on in `tsconfig.json` so Colyseus schemas compile correctly

### Fix: Dockerfile + fly.toml + workflow

- `apps/server/Dockerfile` simplified — runtime container is just `node:22-alpine` + the bundled `dist/index.js`. No `node_modules` copied at runtime; everything's inlined. ~150 MB → ~130 MB final image.
- `fly.toml` — `app = "bitrunners"` (matches the manually-launched app), region `sjc` to match the existing SJC machine
- `.github/workflows/deploy-server.yml` — `--app bitrunners` and added `--strategy immediate` to bypass stuck rolling releases from the previous failed attempts

### Action for owner (still needs)

1. **Move `FLYIO_ACCESS_KEY` from Cloudflare → GitHub Actions Secrets** (Cloudflare can't use it; GitHub workflow needs it)
2. **Update `VITE_SERVER_URL` in Cloudflare Pages env** from `wss://bitrunners-server.fly.dev/` → `wss://bitrunners.fly.dev/` (this matches the actual app hostname `https://bitrunners.fly.dev` shown in your screenshots)
3. Once both are correct, push or hit "Run workflow" on `Deploy server` in the GitHub Actions tab

If a stale machine is still holding a lease, `flyctl machine destroy 2879325b42d318 --force --app bitrunners` from the Fly CLI clears it. Or wait 3 min for auto-release.

## UI — boot scroll, character select, transition rain, profile panel, emote wheel

The whole page now starts as a phased experience:

### Phase 1 — `boot` (full-screen scroll)

`apps/web/src/Boot.tsx`. Full viewport (no window chrome). Faint purple grid background. Cursor-reveal of these lines:

```
$ init bitrunners.v0.20
$ probing cloud-env.central ............. ok
$ negotiating handshake with server-env.space ... ok
$ scanning network for upstream session id
!! no user_id detected ...............
$ loading class registry [bit_spekter,*]
```

Caret blinks at the typing edge. After the last line, transitions to character select.

### Phase 2 — `select` (character grid)

Same full-screen panel; the boot lines disappear and a class grid takes their place. Six tiles for the canonical classes from `docs/lore/003-classes-origins.md`:

- **bit_spekter** — clickable, highlighted, flavor: "controlled exploit · no valid wallet"
- The other five — greyed, dashed border, `[ locked ]`, tooltip "not yet developed"

A `> choose your stack ▌` prompt sits above the grid, followed by a footnote: `─── only bit_spekter loads. other stacks come online in later releases.`

### Phase 3 — `transition` (digital rain wipe)

`apps/web/src/TransitionRain.tsx`. When the user selects bit_spekter, a full-screen overlay of falling lavender ASCII glyphs animates over the game canvas (which is also being mounted underneath simultaneously). 48 columns of randomized characters with staggered fall speeds. After 1.3 s the overlay fades to transparent, revealing the game.

### Phase 4 — `game`

Same scene as before, with two new overlays:

#### Profile icon (top-right, clickable)

`apps/web/src/ProfileIcon.tsx`. Shows the chosen class in a small box with an animated 4-line digital-rain decoration in the background. The box is now a `<button>` — clicking it opens a placeholder panel:

```
$ stack       class = bit_spekter
              session = guest · no user_id

$ account     ─── login system not wired yet
              [sign in (coming soon)]

$ inventory   ─── empty
              tokens = ─, outfits = ─

$ samaritan   corporate = 0, bitrunner = 0
```

Modal-style with `esc` or click-outside to close. Pure placeholder UI; will be wired to Lucia/Neon when Phase 2 auth lands.

#### Emote wheel (bottom-right, mirroring the joystick)

`apps/web/src/EmoteWheel.tsx`. Four buttons arranged in a + layout:

- **▲ happy** → `^_^`
- **◀ tired** → `zz`
- **▶ okay** → `[ok]`
- **▼ help** → `!?`

Pressing one calls `controls.triggerEmote(text)` on the scene, which appends a floating `<span>` above the canvas center with a CSS rise+fade animation (~1.3 s). The bubble is a DOM overlay, not in the 3D scene — keeps the implementation simple and the visual styling consistent with the rest of the UI.

`scene.ts` now returns a `SceneControls` object: `{ dispose, triggerEmote }`. App.tsx wires the wheel's button presses through this.

## Build

- 38 files lint-clean
- Typecheck green across all 5 workspaces
- Web bundle: 645 kB main + 441 kB lazy Board chunk + new React UI ~5 kB
- Server: 2.1 MB self-contained `dist/index.js` (esbuild bundle)

## Files added / changed

- `apps/server/build.mjs` (new) — esbuild config
- `apps/server/package.json` — esbuild dep + build script
- `apps/server/Dockerfile` — runtime is just node + the bundled JS
- `fly.toml` — app name `bitrunners`, region `sjc`
- `.github/workflows/deploy-server.yml` — app name + `--strategy immediate`
- `apps/web/src/Boot.tsx` (rewritten) — full-screen scroll + character grid
- `apps/web/src/TransitionRain.tsx` (new) — digital-rain wipe between select and game
- `apps/web/src/EmoteWheel.tsx` (new)
- `apps/web/src/ProfileIcon.tsx` (rewritten) — clickable, opens placeholder panel
- `apps/web/src/App.tsx` — boot → transition → game state machine
- `apps/web/src/scene.ts` — returns `SceneControls` with `triggerEmote`
- `apps/web/src/style.css` — boot, transition, profile panel, emote wheel styles
- New devDep: `esbuild@^0.24.0`

## What's next

1. Owner moves `FLYIO_ACCESS_KEY` to GitHub Secrets + updates `VITE_SERVER_URL` to `wss://bitrunners.fly.dev/`
2. Re-trigger deploy (Actions → Deploy server → Run workflow)
3. Verify `bitrunners.fly.dev/health` returns 200
4. Two-device test of the multiplayer flow
5. Wire the Profile panel to real Lucia/Neon auth (Phase 2 milestone)
