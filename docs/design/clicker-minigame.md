# Design — Data Scrape mini-game (cookie-clicker economy)

**Status:** design + scaffold (this doc + a scaffolded menu/state model). Full
economy loop, isometric ASCII art, and juice animations are deliberately
deferred. **Owner decisions are locked** (see §10); open seams are flagged.

> **Roadmap honesty:** this is **not on `docs/devlog/0004` (the active Phase-2
> roadmap)**. It's an owner-directed addition. It is built fully **isolated**
> from the multiplayer/scene/network code so it cannot regress Phase 2. Treat
> balancing/polish as its own track, not a Phase-2 blocker.

---

## 1. One-paragraph pitch

A self-contained idle/clicker menu, opened from a launcher **directly under the
profile/account button**. You **SCRAPE** raw *bits* of data by clicking one big
isometric ASCII button. Bits **TABULATE** up a ladder — bits → strings →
serials → passcodes — and finished *passcodes* are **CALCULATED** into spendable
currency by trading them to **The Admin** (who destroys them to protect user
privacy) or **The Company** (who recycles them and wants you back). Each trade
earns one Samaritan-reputation point on the matching track. Progress is saved
on the device and survives reloads; it migrates into the account when auth lands.

## 2. The three verbs (locked)

| Verb | Trigger | Meaning |
|---|---|---|
| **SCRAPE** | Manual click of the big button | +1 **bit** |
| **TABULATING** | A tier converter button | Convert N of a tier into 1 of the next (bits→strings→serials→passcodes) |
| **CALCULATING** | Trade with Admin/Company | Convert passcodes → **Credits** (+1 reputation) |

Button label states: idle big button = `SCRAPE`; while a tier conversion
resolves = `TABULATING`; while a passcode→currency trade resolves =
`CALCULATING`.

## 3. The ladder (locked: uniform 8×, "serials")

```
8 bits      = 1 string
8 strings   = 1 serial      (64 bits)
8 serials   = 1 passcode    (512 bits)
1 passcode  → Credits       (via Admin or Company trade)
```

"cereals" was a transcription of **serials** (data serials). Ratio constant
`STEP = 8`, uniform across tiers. Tunable in one place (`economy.ts`).

## 4. Currency model (locked: canon-preserving)

Two currencies exist in the world; the clicker only mints the common one.

| Currency | Role | Source via clicker? | Canon note |
|---|---|---|---|
| **Credits** | Common "coin" — interchangeable | **Yes** — the passcode trade yields Credits | New term; what `bit_spekter` is allowed to earn |
| **Token** | Scarce "gem" — premium | **No** | Canon: *captured Server-Space data scraps; coveted by The Admin*. `bit_spekter` **cannot earn Tokens — no valid wallet; proxy-wallet unlock planned** (lore 003). The clicker must NOT mint Tokens, or it breaks canon on the only playable class. |

So for the current build (bit_spekter only): **clicker terminal output =
Credits.** Tokens enter the game later, elsewhere (Server Space / the planned
proxy wallet), never from this menu. Recorded in `docs/lore/007-data-economy.md`.

## 5. NPC trade + reputation

Trading passcodes (the CALCULATING step) is done with one of two quest-givers.
Both pay **Credits** ("the credit that is the same across all"). The difference
is narrative + which reputation track ticks:

| Trade with | Flavor (short, non-spoiler) | Reputation +1 |
|---|---|---|
| **The Company** | "Thank you for trading. Work with the Company again soon." (recycles passcodes) | **Corporate** Samaritan |
| **The Admin** | Destroys the passcodes to protect user privacy. | **BitRunner** Samaritan |

Consistent with `docs/lore/002-the-admin.md` and
`004-quests-and-samaritan-status.md`. **Reputation is a pluggable hook only**:
the faction-**reward** curve is an open owner Q&A (per `.claude/handoff.md`), so
the clicker emits a reputation-earned intent and stores a raw count; the reward
model is deferred. This is an intentional seam, not an omission.

## 6. Persistence (locked: device-local, migration-ready)

- Store: `localStorage['bitrunners.economy.v1']`, a single versioned JSON blob.
- Mirrors the existing settings pattern exactly (try/catch guarded; a
  `bitrunners:economy-changed` CustomEvent for cross-component reactivity, same
  as `bitrunners:settings-changed`).
- **No IP correlation, no server, no PII.** (The owner's original IP-guest-sync
  idea was rejected: it's PII tracking, contradicts the Admin's own
  privacy-protecting lore, risks the age-gated/minor case, and the backend isn't
  wired anyway.)
- Shape:
  ```ts
  { v: 1, bits, strings, serials, passcodes, credits,
    repCorporate, repBitrunner, lifetimeScrapes, updatedAt }
  ```
- **Account-migration seam:** when Supabase auth lands, a one-shot
  `migrateEconomyToAccount()` reads `v1`, pushes to the user row, marks
  migrated. The `v` field is the migration version gate. This is the
  "synchronizes and recalls progression" requirement — done the privacy-safe
  way (device now, account later), not via IP.

## 7. UI / placement

- A new launcher button `.scrape` rendered as a **sibling immediately after
  `<ProfileIcon/>`** in `App.tsx`'s `Game` component, styled to sit **directly
  under the profile/account button** on the same right rail. (This is the
  literal "menu directly under the account/settings menu" ask.)
- Clicking it opens `ScrapeMenu` — a modal reusing the existing
  `.panel-backdrop` / `.panel` vocabulary, with an **ASCII-glitch open/close
  transition** (see §8).
- Panel layout:
  - Top: the **big double-wide isometric ASCII SCRAPE button**.
  - A live readout: bits / strings / serials / passcodes / Credits.
  - One converter row per tier (`TABULATING` button), **enabled only when you
    hold ≥ STEP of the input tier** (button disabled + dimmed otherwise).
  - A trade row: **Admin** / **Company** buttons (`CALCULATING`), enabled only
    when passcodes ≥ 1.
- Each converter/trade button gets its own *smaller* isometric ASCII button
  (design below; scaffolded as a styled placeholder this pass).

## 8. ASCII-glitch transition (reuse, don't reinvent)

Reuse the established glitch vocabulary (`TransitionRain` columns; Boot
`boot-scan`/`boot-halo`/`boot-blink`). Open/close = a short (~280–400 ms)
ASCII scan-sweep + rain flecks over the panel, plus opacity/scale, ending on the
solid panel. Honors `prefers-reduced-motion` (fade only). Scaffolded as CSS
classes `scrape-panel--in` / `--out` with stub keyframes; full polish later.

## 9. Isometric ASCII button (design; scaffolded as placeholder)

- A double-wide control skewed into a ¾ iso parallelogram via CSS `transform`,
  bordered with box glyphs (`▛▀▜▌▐▙▄▟`), face filled with a dim dither.
- **Press:** translate down + inset shadow + a 1-frame glyph flicker
  (`steps()` like `profile-flicker`) + a brief char-scramble on the label.
- Smaller converter buttons: same treatment, half scale.
- This pass ships a **functional placeholder** (correct behavior, simple
  styling, press affordance). The full iso ASCII render is the deferred
  "animation" work.

## 10. Locked decisions (from owner Q&A this session)

1. Persistence: **device-local now**, account-migration seam. No IP sync.
2. Currency: **Tokens = premium (not clicker-minted, canon-gated); Credits =
   common (clicker output)**. Canon preserved.
3. Ladder: **serials**, **uniform 8×**.
4. Deliverable now: **design doc + menu scaffold** (this).

## 11. Component architecture

```
apps/web/src/economy.ts      pure model: types, STEP, defaults,
                              load/save (localStorage v1), pure ops
                              (scrape/tabulate/calculate), subscribe(),
                              migration seam stub, reputation hook seam
        ▲
        │ imports
apps/web/src/ScrapeMenu.tsx   launcher button + modal panel; wires UI to
                              economy.ts; glitch transition stub
        ▲
        │ rendered as sibling under <ProfileIcon/>
apps/web/src/App.tsx          Game component mounts <ScrapeMenu/>
apps/web/src/style.css        launcher + panel + button + glitch stub
```

No imports from/to `scene.ts`, `network.ts`, or server code. The mini-game is
fully isolated — it cannot affect multiplayer, the ASCII render pipeline, or
protocol.

## 12. Open follow-ups (next Q&A / phases)

- **Faction-reward curve** — blocked owner Q&A. Until then reputation is a raw
  counter + emitted intent; no rewards.
- **Token / proxy-wallet** — when/how Tokens enter; how a future non-bit_spekter
  class or proxy-wallet unlock changes clicker terminal output.
- **Idle/balancing numbers** — STEP=8 is locked; passive generation, costs,
  prestige, anti-cheat (device-local is trivially editable — acceptable for a
  cosmetic single-player loop; revisit if it ever grants multiplayer-visible
  value).
- **Account migration** — implement `migrateEconomyToAccount()` when Supabase
  lands (see `docs/setup/SERVICES.md` §6).
- **Sealed lore** — none surfaced. Admin/Company motivations drawn only from
  unsealed `002`/`004`. Do not surface `_sealed/` in any trade copy.

## 13. Shop framework (scaffold)

A small `shop ▸` button in the panel header swaps the body to a shop view
(no second modal). Module: `apps/web/src/shop.ts` — isolated, no
scene/network/server imports.

- **Model:** `ShopItem { id, name, blurb, category, currency, cost, locked?,
  lockReason? }`; `ShopCurrency = 'credits' | 'tokens'`. `evaluate(item)` →
  eligibility; `buy(item)` → spends via `economy.purchaseWithCredits`.
- **Currency rule (canon-safe):** purchasable items are **Credits-priced**.
  **Token-priced items exist but are hard-locked** with a canon reason
  (`bit_spekter` has no Server-Space wallet; proxy-wallet planned, lore
  003/007). The shop **cannot** spend or mint Tokens.
- **Ownership:** one-time items recorded in `EconomyState.owned: string[]` —
  **additive, backward-compatible** (older `v1` blobs lacking `owned` are
  normalised to `[]` on load; no schema-version bump, migration seam in §6
  unchanged). Owning a cosmetic only records ownership; wiring the visual
  effect is a later pass.
- **Catalog is PLACEHOLDER scaffold.** Two benign Credits cosmetics + one
  locked Token entry. The real reward set — and any lore it implies — is an
  **open owner Q&A** (cosmetics/outfits are Phase-3 and emoticrons are
  moderation-gated per `CLAUDE.md`; do not fabricate). Flagged, not invented.

### Data/token HUD aesthetic pass

The readout under the SCRAPE button is now a terminal-style HUD: per-tier
rows with an ASCII ladder micro-bar (`█`/`░`, fills toward the next 8×
step), a passcode row, a Credits row, a dimmed **locked Tokens** row
(`⌷ no wallet`, canon), a lifetime-scrapes stat, and a faint scanline
overlay. Consistent with the glyph-atlas / Caves-of-Qud terminal vocabulary;
reduced-motion safe (static). Full isometric ASCII button render + press
juice remain the deferred polish pass.

## 14. Clothing / pets / upgrades / inventory (framework)

Owner Q&A locked: framework + polish; **isolated appearance seam** (not
wired into the rig); device-local + account seam; **placeholder catalog,
real content via later lore Q&A**.

### Item kinds (`shop.ts`)

- **clothing** — `slot: head|chest|legs`, `rarity: normal|rare|ultra`.
  Rarity escalates *features* via a data-only `visual` descriptor: normal =
  `palette` only · rare = `+ effect` · ultra = `+ effect + texture +
  colour`. No pixels drawn here — the descriptor is consumed later by the
  render via the appearance seam.
- **pet** — same shape, `slot: pet`; priced far above clothing
  (placeholders: clothing 24–320 cr, pets 900–2400 cr).
- **upgrade** — raises a named rate (`upgradeKey`) up to `maxLevel`,
  repeatable, rising cost. `scrape` is wired live (`scrapeYield()` =
  `1 + level`); others (e.g. `tabulate`) store a level whose effect is a
  later pass.

### Inventory (`economy.ts`, additive)

- `slots: (string|null)[16]` — Minecraft-style grid; a bought
  clothing/pet auto-fills the first empty slot. Inventory-full blocks the
  buy.
- `equipped: {head,chest,legs,pet}` — one item per slot; equip/unequip
  toggles from a filled inventory cell.
- `appearanceHidden: boolean` — global show/hide of equipped cosmetics.
- All **additive & backward-compatible** (old `v1` blobs normalise; **no
  schema-version bump**; migration seam unchanged).

### Appearance seam (`appearance.ts`) — the isolation boundary

`getEquippedAppearance()` resolves equipped ids → a render-ready
`EquippedAppearance` (rarity/palette/effect/texture, honouring
`appearanceHidden`); `subscribeAppearance()` fires on equip/hide changes.
**Nothing imports `appearance.ts` yet.** scene.ts will later import *only*
this module to re-skin the bit_spekter rig — no economy/shop internals leak
into render, so the mini-game still cannot regress Phase-2.

### Account-link seam (`economy.ts`)

`exportProgress()` / `importProgress()` are the concrete hooks the future
Supabase layer calls (push on change, restore on login). One blob carries
bits→passcodes, Credits, reputation, upgrades, inventory, equipped, hidden.
Device-local now; IP linkage remains rejected (privacy/lore).

### Deferred (still)

Actual rig rendering of clothing/pets, real visual-effect/texture/colour
implementations, the real catalog + rarity/lore vocabulary (owner Q&A),
balancing numbers, reputation reward curve (faction-reward Q&A). Idle/auto
generation deliberately **not** added — `tabulate all` is manual bulk, not
an idle timer; auto-generation is a separate balance decision for the owner.

## 15. Completion pass (devlog 0036)

Finished the half-built bits of §1–§14 (no new content, no owner-gated
lore):

- **`tabulate` upgrade is now real.** Was an inert stored level; now powers
  a cascading **bulk "tabulate all"** (`tabulateAll()` / `canTabulateAll()`
  / `tabulateReach()`), reach = level capped at 3 tiers, **preserving the
  locked 8× ratio exactly** (it batches the same step). The `[ all ]` row
  appears once the cache is owned.
- **Open *and* close transition.** `scrape-panel--out` glitch-out runs
  before unmount; all close paths (✕, backdrop, Esc) route through
  `requestClose()`. Reduced-motion → instant.
- **Core-action juice.** Floating `+N` gain on SCRAPE; press-pop; faint
  iso scanline frame on the button.
- **Failure states surfaced.** `inventory full` now reported by
  `evaluate()` (was a silent buy failure); shop shows `owned`/`equipped`/
  `maxed`/reason; inventory shows an empty-state line.
- **Robustness.** Esc handler is mount-once via a ref; all transient
  timers tracked and cleared on unmount.

## 16. Skill tree + main-view surfacing (devlog 0038)

Owner-directed expansion. **Three owner decisions locked this pass** (Q&A;
recorded in `.claude/decisions.md`):

1. **Auto-click** ships **functional and free now**. It is *intended* to be a
   premium-member perk later, but no membership/billing system exists (out of
   phase, needs paid infra). `hasAutoScrape()` is the clean seam a future
   premium gate wraps. Not faked, not paywalled today.
2. **Path 3** raises **Credits minted per passcode at the Admin/Company
   trade** (`creditsPerPasscode()` = `CREDITS_PER_PASSCODE + yield`). The
   uniform **8× ladder (STEP) is NEVER touched** — §3/§10 stays locked, canon
   intact. "A bit is worth more over time" is delivered as *output value*, so
   shop prices can stay fixed (owner's intent) without a canon edit.
3. **Rate upgrades moved out of the shop into a passcode-priced skill tree.**
   Shop is now **cosmetics-only** (clothing/pets, Credits). Credits buy looks;
   **passcodes buy power**. This supersedes §14's `upgrade` shop kind — that
   `ItemKind` is removed; `economy.purchaseUpgrade` (credit-based) is replaced
   by `purchaseTreeNode` (passcode-based).

### The tree (`apps/web/src/skilltree.ts` — isolated, economy-only import)

Unlocks once the player has **ever minted a passcode**
(`economy.isTreeUnlocked()` ← new cumulative `lifetimePasscodes`, additive &
backward-compatible; seeded from current passcodes on load so existing players
aren't locked out; never decremented when spent).

| Path | Theme | Nodes (placeholder balance — all numbers in `skilltree.ts`, single tunable source) |
|---|---|---|
| **1 · scrape depth** | bits/tap | `deeper scrape` ×12, +1 bit/SCRAPE/lvl, cost `1+⌊lvl/2⌋` pc |
| **2 · persistent kit** | unique unlocks, escalating | `sustained pull` (hold-to-scrape, 3 pc) · `tabulate cache` ×3 (bulk reach I–III, 6/12/20 pc) · `autonomous pull` (auto-scrape, 40 pc) |
| **3 · conversion alchemy** | long game | `data appreciation` ×12, +1 Credit/passcode/lvl, cost `3+2·lvl` pc |

Balance is an explicit **first pass** (early game intentionally steep; Path 3
is the multi-session sink). It is **not** verified against the owner's "≈1
week of 1 h sessions" target — that needs live play; constants are isolated in
one module for tuning. Reputation reward curve remains the separate open Q&A.

### Hold / auto scrape

- **Hold-to-scrape** (Path 2 `hold`): press-and-hold repeats at `HOLD_MS`;
  a quick tap stays a single scrape (tap = `onClick`, hold = pointer interval).
- **Auto-scrape** (Path 2 `auto`): hands-free interval (`AUTO_MS`) **while the
  panel is open** — deliberately *not* an offline idle generator (offline idle
  stays a separate, untaken decision). HUD shows an `auto ▶` tag.
- Both intervals use a latest-closure ref (no stale state) and are cleared on
  release/unmount.

### Main-view surfacing (the only main-view touch — still no scene/net/server)

- Launcher sub-text **renamed** `> cookie-clicker` → `> data scrape`
  (eyebrow → `// minigame` to avoid a duplicate line).
- **Shop** is now a standalone right-rail **icon button** (`$` glyph) directly
  under the data-scrape launcher — opens the panel straight to the shop view.
  Shop/inventory are *also* still header tabs inside the panel (owner: keep
  the click-throughs too).
- **Inventory** opens from a new **centre button in the emote wheel** (`▦`),
  rendered last so the existing `:nth-child` flicker offsets don't shift.
- Cross-component open uses a `bitrunners:open-scrape` CustomEvent
  (`openScrape(view)`), matching the existing `bitrunners:*` bus — callers
  stay decoupled; `EmoteWheel` takes a plain optional `onInventory` prop and
  imports nothing from the mini-game.

Isolation guarantee from §11 is preserved: `skilltree.ts` imports only
`economy.ts`; no `scene.ts`/`network.ts`/server imports anywhere in the
mini-game. It still cannot regress Phase 2.
