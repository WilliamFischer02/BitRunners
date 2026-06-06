# 0061 — Sub-Phase E: Theme color shop + ASCII tint hot-swap

**Branch:** `claude/peaceful-thompson-0RFkw`. Draft PR.

## What this lands

Sub-Phase E of the Phase 3.5 roadmap: per-runner ASCII tint themes, purchasable
with Credits or Tokens, equipped from a new "theme" tab in the Scrape menu.

### New files

- **`apps/web/src/themes.ts`** — theme catalog (8 entries from lore 013) + `applyThemeToPass(pass, key)` helper that hot-swaps the three ASCII pass uniforms (`uTint`, `uTintTop`, `uBackground`) in-place. No pass re-creation, no allocations — safe on iOS/mobile.
- **`apps/web/src/ThemeShop.tsx`** — `ThemeView` component mounted as the new "theme" tab inside `ScrapePanel`. Shows all 8 themes with buy / equip buttons, faction-gate messaging, and a sign-in CTA for guests.
- **`supabase/migrations/0008_theme_rpcs.sql`** — three SECURITY DEFINER RPCs:
  - `purchase_theme(p_key TEXT)` — validates allowed-key list, verifies faction gate from `profiles.samaritan_*`, idempotent insert into `owned_themes`.
  - `equip_theme(p_key TEXT)` — verifies ownership (terminal_green always allowed), updates `profiles.equipped_theme`.
  - `get_my_themes()` — returns the user's owned themes.

### Modified files

- **`apps/web/src/scene.ts`** — identity subscription now calls `applyThemeToPass(asciiPass, next.equippedTheme)` whenever the equipped theme changes; also applies on initial identity load.
- **`apps/web/src/supabase.ts`** — three new client wrappers: `fetchMyOwnedThemes`, `purchaseTheme`, `equipTheme`.
- **`apps/web/src/ScrapeMenu.tsx`** — `View` type gains `'themes'`; new tab button + `<ThemeView />` render branch; titles record updated.
- **`apps/web/src/style.css`** — new `.theme-list`, `.theme-row`, `.theme-row-*`, `.theme-err` classes.

## Theme catalog (8 entries)

| Key | Price | Notes |
|-----|-------|-------|
| `terminal_green` | free | Default. Tint values match current scene hardcoding. |
| `amber_crt` | 800 cr | — |
| `paper_white` | 800 cr | — |
| `void_purple` | 1 200 cr | Faction-gated: BitRunner Samaritan ≥ 30 |
| `corp_orange` | 1 200 cr | Faction-gated: Corporate Samaritan ≥ 30 |
| `null_blue` | 1 500 cr | — |
| `signal_red` | 2 tk | Token-gated |
| `aether_drift` | 5 tk | Token-gated |

## Architecture notes

- **Hot-swap only.** `applyThemeToPass` mutates `Uniform<Vector3>.value` in place — identical to how `setAsciiPassResolution` already works. No shader recompile, no pass recreate. Mobile-safe by construction (no DepthTexture/MRT).
- **Balance verification is client-side.** The economy is still a device-local JSONB blob (not server-authoritative). The `purchase_theme` RPC only verifies the faction gate (from `profiles.samaritan_*`) and the allowed-key list. When the P2P trading epic adds a server-authoritative economy, balance verification can move server-side. This is noted in migration 0008.
- **Refund on RPC error.** The client deducts locally before calling the RPC; if the RPC rejects (e.g. faction gate), the client immediately refunds via `addCredits/addTokens`. This keeps the economy consistent even if the faction check surprises the user.
- **Guest mode.** All themes are visible but the panel is greyed-out and shows a sign-in CTA. Guests always render `terminal_green` (equippedTheme is '' for guests; `applyThemeToPass` no-ops on empty string).
- **`terminal_green` default.** The catalog's terminal_green values match the scene's current hardcoded tints exactly, so no visual delta for anyone who hasn't changed their theme. Equipping `terminal_green` explicitly produces no perceptible difference.

## Owner actions required

1. **Apply migration 0007 first** (Sub-Phase B prerequisite — adds `owned_themes`, `profiles.equipped_theme`).
2. **Apply migration 0008** (`purchase_theme`, `equip_theme`, `get_my_themes` RPCs).
3. **Review tint values in `themes.ts`.** All values except `terminal_green` are first-pass hex conversions from lore 013 drafts. Owner should eyeball them against the live ASCII pipeline.
4. **Review prices in lore 013.** Prices are as drafted; tune before shipping.

## Verification

- `pnpm lint` ✓ (63 files, no fixes)
- `pnpm typecheck` ✓ (8/8 packages)
- `pnpm build` ✓ (gzip 250 kB main bundle — +0 kB vs baseline)
- Visual / interactive verification needs a live browser (GLSL not testable headless).

## What's deferred (C, D, F…)

- Sub-Phase C: Samaritan-threshold badge auto-award trigger.
- Sub-Phase D: 8-slot emote wheel + emoticron submission.
- Sub-Phase F: Starmap HUD minimap.
