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
