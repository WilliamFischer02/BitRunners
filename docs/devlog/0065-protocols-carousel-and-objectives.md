# 0065 — Protocols carousel + Objectives cartridge (Phase 1)

Branch: `claude/phase1-protocols-carousel`. Draft PR pending.

Phase 1 of the six-PR batch planned in
`/root/.claude/plans/nested-tickling-reddy.md`. The "data scrape" and "shop"
launchers in the HUD top-right used to be two narrow buttons next to the
minimap; they're now consolidated under a single **Protocols** cartridge
carousel, with the existing scrape menu and a new **Objectives** mission
browser as the first two cartridges. Phase 3 will add the Tether Hop
minigame as a third cartridge.

## What ships

### new

- `apps/web/src/protocols-registry.ts` — `ProtocolEntry` shape +
  `PROTOCOLS` catalog (scrape, objectives) + `openProtocols()` /
  `openObjectives()` event dispatchers. No UI deps.
- `apps/web/src/Protocols.tsx` — launcher button + carousel panel.
  Keyboard `←/→` cycle, swipe cycle, `Enter`/`Space`/tap-focused-cartridge
  to insert. Each cartridge dispatches its `launch()` and dismisses.
- `apps/web/src/Objectives.tsx` — read-only mission browser. Reads
  `MISSIONS` + `getActiveMission()` / `subscribeMissionChanges()` from
  `missions.ts`. Shows checkpoint pips with the active checkpoint glowing
  cyan; on completion shows the faction-flavored closing line.

### edits

- `apps/web/src/ScrapeMenu.tsx` — both launcher buttons removed. The
  component is now panel-only and listens for `bitrunners:open-scrape`
  which the Protocols registry's `launchScrape` helper dispatches. Shop
  is still reachable via `openScrape('shop')` — it's a tab inside the
  Scrape panel, not a top-level launcher.
- `apps/web/src/App.tsx` — mounts `<Protocols />` and `<Objectives />`
  alongside the existing surfaces.
- `apps/web/src/style.css` — old `.scrape-launch` / `.shop-launch`
  overrides removed. New `.profile, .protocols-launch` 60×60 row at
  `top:156, right:12/80` (desktop) and `top:116, right:8/68` (mobile).
  Carousel styling: cartridge frame, focused-tilt animation
  (`prefers-reduced-motion` safe), swipe-friendly horizontal rail with
  scroll-snap. Objectives panel + checkpoint-pip styles.

## Layout math (verified headless)

| element | desktop | mobile |
|---|---|---|
| minimap | top:12 right:12 132×132 | top:8 right:8 96×96 |
| profile | top:156 right:80 60×60 | top:116 right:68 54×54 |
| protocols | top:156 right:12 60×60 | top:116 right:8 54×54 |
| row width | 60+8+60 = 128 px (under 132 px minimap) | 54+6+54 = 114 px |

## Architecture

- **Cartridges as launchers, not hosts.** V1 cartridges dispatch external
  events; the existing `ScrapePanel` and the new `Objectives` modal mount
  outside the carousel. This keeps Phase 1 minimally invasive — no
  refactor of `ScrapePanel`'s tab system. Tether Hop (Phase 3) is also a
  full-canvas overlay, so the launcher-pattern keeps working.
- **Pure event bus.** `protocols-registry.ts` defines two new event
  names; both are constants exported alongside the helpers. Anywhere can
  open Objectives without importing the React component (mirrors the
  existing `openScrape(view)` pattern).
- **Shop launcher removed.** Shop, Themes, Inventory, Emoticons remain
  reachable as tabs inside the Scrape cartridge's panel; the standalone
  `.shop-launch` button is gone. Per the owner-approved plan, "Shop,
  Inventory, Themes, Emoticons all become sub-views inside the Scrape
  cartridge".

## Verification

- `pnpm typecheck` ✓
- `pnpm lint` ✓
- `pnpm --filter @bitrunners/web build` ✓ (gzip 258 kB main bundle)
- Headless Chromium repro:
  - launcher row geometry matches the table above
  - clicking Protocols opens the carousel with `data_scrape` focused
  - `ArrowRight` advances focus to `objectives`
  - clicking the focused cartridge opens the Objectives modal showing
    the active aether-recovery mission with the next-checkpoint pip
    highlighted
- Screenshot confirms carousel + Objectives modal render cleanly.

## What's deferred to later phases

- Phase 2: Page-Visibility standby + random spawn scatter (server side).
- Phase 3: Tether Hop cartridge.
- Phase 4: ASCII pixel-crush transition engine + circuit-board floor.
- Phase 5: retrofit transitions to legacy modals.

## No new dependencies. No protocol bump. No schema change.
