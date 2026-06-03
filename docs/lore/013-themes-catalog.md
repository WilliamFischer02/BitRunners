# 013 — Themes catalog

## Question

What themes (color palettes) can a runner unlock? How much do they cost?

## Answer (canon — owner draft 2026-06-03; **owner: review tint values + prices**)

### What a theme changes

A theme rebinds the **ASCII pass tint uniforms** for the local player only (themes are personal, not visible to remotes in v1). The three knobs:

- `tint` — the primary glyph color (RGB).
- `tintTop` — the upper-screen tint, used by the vertical gradient (devlog 0013).
- `background` — the cleared color behind the glyphs.

Themes do **not** change UI accent colors (yet) — purely the in-world ASCII render.

### V1 catalog (8 themes)

| Key | Name | Price | Currency | tint | tintTop | background | Vibe |
|-----|------|-------|----------|------|---------|------------|------|
| `terminal_green` | terminal_green | — | (default, free) | `#a8ffb0` | `#5a9a5e` | `#070a08` | The shipped look. Default for every new runner. |
| `amber_crt` | amber_crt | 800 credits | credits | `#ffc070` | `#a07030` | `#0a0805` | 1970s VT220 / Apple ][ vibe. Soft amber. |
| `paper_white` | paper_white | 800 credits | credits | `#e8e6dc` | `#9a988f` | `#1c1b18` | Newsroom monochrome. Calm, restrained. |
| `void_purple` | void_purple | 1200 credits | credits | `#b07cff` | `#6040a0` | `#08060e` | BitRunner faction tribute. Sub-Phase B unlocks this for +30 BitRunner Samaritan. |
| `corp_orange` | corp_orange | 1200 credits | credits | `#ff9450` | `#a0501c` | `#0c0805` | Company faction tribute. Unlocks at +30 Corporate Samaritan. |
| `null_blue` | null_blue | 1500 credits | credits | `#7cc0ff` | `#3060a0` | `#06090e` | server_speaker palette — cool and remote. |
| `signal_red` | signal_red | 2 tokens | tokens | `#ff7060` | `#a02830` | `#0c0606` | Aggressive — feels like an active alarm. Token-gated. |
| `aether_drift` | aether_drift | 5 tokens | tokens | `#d0d8ff` | `#7080c0` | `#04050a` | Drifting cold-light. Top-tier reward; matches the aether badge tier. Token-gated. |

### Faction-gated themes

`void_purple` and `corp_orange` are **dual-gated**: priced in credits AND require minimum Samaritan in their faction. The server-side `purchase_theme` RPC re-verifies both balance and faction reputation before inserting into `owned_themes`.

### Persistence

- Owned themes live in `owned_themes(user_id, theme_key, acquired_at)`.
- Equipped theme is `profiles.equipped_theme TEXT NULL`.
- Default (NULL) renders `terminal_green`.

## In-game implications

- New `apps/web/src/themes.ts` exports the catalog map.
- New `apps/web/src/ThemeShop.tsx` mounted inside the Scrape menu as a new tab.
- `apps/web/src/scene.ts` reads `profiles.equipped_theme` at scene init and hot-swaps `asciiPass.material.uniforms.uTint.value` etc. on `bitrunners:theme-changed` events. No pass re-create (mobile-safe).
- New SECURITY DEFINER RPC `purchase_theme(p_key TEXT)` re-verifies balance (via `player_economy` blob) + faction gate, then inserts into `owned_themes`.

## Open questions

- **Owner: review tint values.** These are credible drafts but the project owner should eyeball them against the actual ASCII pipeline before approval.
- **Owner: review prices.** Drafted to give a clear progression (free → cheap → mid-priced → faction-gated → token-rare).
- Should the default `terminal_green` be **purchasable as a re-equip option** once a runner has owned another theme? Trivial to add; assumed yes.
- Should themes be **transferable / tradeable** in the P2P trading epic? Defer to that epic.
- **Owner: review names.** Drafts feel right but the naming convention is owner's call.
