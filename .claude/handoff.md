# Handoff — 2026-06-04, Sub-Phase E (themes) IN DRAFT

## What just shipped (this branch)

`claude/peaceful-thompson-0RFkw`, draft PR pending. Devlog: `docs/devlog/0061-theme-shop-ascii-tint.md`.

### Sub-Phase E — theme shop + ASCII tint hot-swap
- **`apps/web/src/themes.ts`** — 8-theme catalog + `applyThemeToPass()` hot-swap helper (uniform mutation, no pass recreate, mobile-safe).
- **`apps/web/src/ThemeShop.tsx`** — `ThemeView` component: lists all themes, buy/equip buttons, faction-gate messaging, guest CTA.
- **`supabase/migrations/0008_theme_rpcs.sql`** — `purchase_theme`, `equip_theme`, `get_my_themes` SECURITY DEFINER RPCs (faction gate verified server-side; balance still client-side — economy not server-authoritative).
- **`apps/web/src/scene.ts`** — identity subscription now hot-swaps `asciiPass` tints on theme change.
- **`apps/web/src/supabase.ts`** — `fetchMyOwnedThemes`, `purchaseTheme`, `equipTheme` wrappers.
- **`apps/web/src/ScrapeMenu.tsx`** — "theme" tab added.
- **`apps/web/src/style.css`** — theme-row CSS.

## Roadmap reference

Full plan: `/root/.claude/plans/nested-tickling-reddy.md`. Sequence:

```
A (DONE) → B (DONE) → (C ∥ D ∥ E ∥ F) → G → H → I → J
```

| Sub-phase | Topic | Status |
|-----------|-------|--------|
| A | Lore + schema reservations | **DONE** |
| B | Username overhead label + protocol bump | **DONE** |
| C | Badge earn loop (Samaritan-threshold trigger + UI integration) | next |
| D | 8-slot emote wheel + emoticron submission + admin queue | next |
| E | Theme color shop + ASCII tint hot-swap | **DONE** |
| F | Starmap HUD minimap (SAMM + Admin + Company NPC + active checkpoint) | next |
| G | Physical missions ("Recover an aether's last data" first) | queued |
| H | Hack QTE + 30s minigame lockout | queued |
| I | Free-text proximity DM with moderation stack | queued |
| J | Second minigame + Scrape skill-tree expansion | queued |

## Before merging this PR — required owner actions

1. **Apply migration `0007`** (Sub-Phase B — adds `owned_themes`, `profiles.equipped_theme`, badge tables, etc.).
2. **Apply migration `0008`** (`purchase_theme`, `equip_theme`, `get_my_themes` RPCs).
3. **Review tint values** in `apps/web/src/themes.ts` and `docs/lore/013-themes-catalog.md`. All non-default values are first-pass hex conversions — eyeball against the live ASCII pipeline before committing.
4. **Review prices** in lore 013.
5. **PROTOCOL_VERSION = 2** (Sub-Phase B) — server + client must deploy together.

## Prior constraint: Sub-Phase B (migrations 0007 + 0008 not yet applied)

The Sub-Phase B PR (#61) was merged but migrations 0007/0008 haven't been applied yet. Until they are, the identity/badge/theme RPCs return errors. The client handles this gracefully (guest fallback names, no crash). Theme purchases will error silently until 0008 is applied.

## Verification done

- `pnpm lint` ✓
- `pnpm typecheck` ✓
- `pnpm build` ✓ (gzip 250 kB main bundle)
- Browser / iOS Safari — **NOT YET DONE**; gated on owner applying migrations 0007 + 0008.

## Next suggested sub-phase

Sub-Phase C (badge earn loop) or Sub-Phase D (emote wheel). Both are buildable without additional infra. Sub-Phase C requires Supabase triggers/functions that auto-insert into `earned_badges` when Samaritan scores cross thresholds. Sub-Phase D requires expanding the `EmoteWheel` to 8 slots and wiring the emoticron submission flow through `emoticron_dictionary`.

## What was NOT done (deliberate scope cut)

- Badge auto-award trigger (Sub-Phase C).
- Emote wheel expansion (Sub-Phase D).
- Starmap HUD minimap (Sub-Phase F).
- Theme visibility to remotes (v1 is personal-only, as per lore 013).
- Faction-gate bypass for free `terminal_green` (always allowed — no purchase call needed).
