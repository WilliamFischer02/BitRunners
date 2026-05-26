# Handoff — 2026-05-26, sessions: proxy-wallet + runner switch (PR #43) AND security pass + SAMM/scrape glow (PR #42)

## State of the build

- **⚠️ DEPLOY STATE:** prod `main` now has **everything through devlog 0049** — admin console phases 1 + 2 (dialogue editor) + SAMM proximity glow + hold/auto-scrape glow + security pass. **PR #43 (proxy-wallet + runner switch, devlog 0050) is pending merge** — a Pages-only change (no server/packages touches).
- **Live web (bitrunners.app):** clicker, skill tree, SAMM (with proximity glow), admin console, dialogue editor, room-code join, email/password auth, hold/auto-scrape glow all live (through 0049).
- **Live server (bitrunners.fly.dev):** protocol v1, idle-disconnect, ambient NPCs live. **No server change in either session.**
- **Tokens are LIVE (devlog 0050, proxy-wallet, lore 009):** `economy.tokens` is a real spendable balance (replaced display-only `lockedTokens`; legacy locked tokens fold in on load). Credits→Tokens one-way exchange (shop, `CREDITS_PER_TOKEN=100`); token-priced premium shop items; SAMM bets Credits OR Tokens. **No migration** (tokens ride the synced blob). The "bit_spekter can't hold Tokens" canon is RETIRED — do not re-lock. Trading's "Tokens excluded" note is now obsolete.
- **Runner switch (devlog 0050):** in-game "change runner" (profile panel) → back to class-select grid (`Boot startAtSelect`, `bitrunners:change-runner` event). Lets you swap between unlocked runners (e.g. server_speaker) mid-session.
- **⚠️ Owner runs migrations in order: 0002, 0003, 0004**, and sets own `profiles.role='admin'` (SQL). The admin launcher only appears once role=admin.
- **CI status:** gates green — `pnpm lint` clean (53 files), `pnpm typecheck` 8/8, `pnpm build` 5/5.

## What was done (PR #42 — merged)

**Security pass** (every-run mandatory):
- Found one `innerHTML` instance (`scene.ts:882`, playerCode — alphanumeric 6-char, low actual risk). Replaced with `createElement`+`textContent` for defence-in-depth. No other findings.
- Full table of results in devlog 0049. All RLS policies intact. No secrets, no free-text input, no client-trusted privilege escalation.

**SAMM proximity glow** (`scene.ts`):
- The vending machine screen (`vendingScreen`) now drives `emissiveIntensity` from its baseline 0.7 up to ~1.5± in the render loop based on player distance to SAMM coordinates. Pulsing at ~0.5 Hz (3.1 rad/s). Mirrors the existing port/depot glow pattern exactly.

**Hold/auto-scrape glow** (`ScrapeMenu.tsx`, `style.css`):
- Added `holding` state (set `onScrapeDown`, cleared `stopHold`).
- Glow div now gets `is-holding` (dim sustained glow, 0.5 opacity) when holding and `is-auto` (repeating 650ms pulse animation) when auto-scrape runs.
- `is-on` (manual press flash) is declared last in CSS so it wins cascade over the new states.
- Reduced-motion safe: animations suppressed, static opacity fallbacks.

## What was done (PR #43 — this PR)

**Proxy-wallet unlock (lore 009):**
- `economy.tokens` is now a real spendable balance. Legacy `lockedTokens` fold into spendable on load.
- Credits→Tokens one-way exchange (`+1`/`+5` in the shop, `CREDITS_PER_TOKEN=100`).
- Token-priced premium items (aurora crown, data seraph); currency-aware buy; `tk`/`cr` labels.
- SAMM: bet Credits or Tokens (currency toggle, token tiers `[1,3,10]`); payouts in the bet currency.
- Real token balance shown in HUD / SAMM / shop; "no wallet" copy retired.

**Runner switch:**
- In-game "change runner" (profile panel → `[ switch ]`) returns to class-select grid (`Boot startAtSelect` + `bitrunners:change-runner`), re-skinning the scene on the chosen class.

## What's blocking forward progress

- **Browser verification.** All visual changes (SAMM glow, hold glow, auto glow, token UI, runner switch) need eyeballing on a live preview.
- **Owner-side service wiring.** Supabase + Resend + OAuth still unblocked. Follow `docs/setup/SERVICES.md` §1 critical path.
- **Admin phases 3 + 4** (user table + grants, activity stats) gated on server-authoritative economy (shared with p2p-trading-epic P1) and live auth.

## What I would do next, in priority order

1. **Owner-side: execute `docs/setup/SERVICES.md` §1 critical path.** Highest leverage.
2. **Two-client live test:** emote sync, seam visibility, smooth movement.
3. **Tune visual values** after live eyeball:
   - SAMM glow: if too subtle raise the `0.85` multiplier; if too harsh lower it.
   - Scrape hold/auto: `is-holding` opacity 0.5 and `is-auto` range 0.35–0.7 are first-pass.
4. **Admin phase 3: user table + grants** — blocked on live auth + server-authoritative economy.
5. **Admin phase 4: activity stats** — hand-rolled SVG chart, session logging migration.
6. **Faction-reward Q&A** — unblocks reputation reward curve + 20-achievements design.
7. **P2P trading epic** — gated on auth + server-authoritative tradeables.
8. **Aether snapshot on `onLeave`** — Phase 2 polish; needs Upstash (SERVICES.md §12).

## Files touched (combined)

- `apps/web/src/scene.ts` — innerHTML→textContent fix; SAMM proximity glow in render loop.
- `apps/web/src/ScrapeMenu.tsx` — `holding` state; updated `stopHold`/`onScrapeDown`; glow class list.
- `apps/web/src/style.css` — `is-holding`, `is-auto` CSS rules; consolidated reduced-motion block.
- `apps/web/src/App.tsx` — runner switch event wiring.
- `apps/web/src/Boot.tsx` — `startAtSelect` prop for runner switch.
- `apps/web/src/ProfileIcon.tsx` — "change runner" button.
- `apps/web/src/Samm.tsx` — currency toggle (Credits/Tokens), token tiers.
- `apps/web/src/economy.ts` — `tokens` balance, `exchangeCreditsForTokens`, legacy fold-in.
- `apps/web/src/samm.ts` — token bet logic, currency-aware payouts.
- `apps/web/src/shop.ts` — token-priced items, currency-aware buy.
- `apps/web/src/dialogue.ts` — (auto-merged, no conflicts).
- `docs/devlog/0049-samm-glow-hold-auto-scrape-glow-security-pass.md` — PR #42 devlog.
- `docs/devlog/0050-proxy-wallet-tokens-and-runner-switch.md` — PR #43 devlog (renumbered from 0049).
- `docs/lore/009-proxy-wallet.md` — new lore entry.
- `docs/lore/README.md` — lore index update.
- `.claude/decisions.md` — proxy-wallet + runner switch decisions.
- `.claude/handoff.md` — this file.

## Do NOT do these things

- Don't push to `main` — prod branch; deploys Pages + Fly.
- Don't merge any PR — owner-gated.
- Don't build a passcode-gated diagnostics/tester menu or Stripe setup section (retracted prompt).
- Don't re-lock Tokens for bit_spekter — the proxy-wallet unlock is canonical.
- Don't edit `docs/lore/_sealed/`.
- Don't hand-edit `pnpm-lock.yaml`.
- Don't deploy to Fly from shell — GitHub Actions owns deploys.

## Open questions for the owner

- After live eyeball: SAMM glow — too subtle / too harsh? Target: "clearly brighter when nearby."
- Hold glow (0.5 opacity, 80ms transition): reads as feedback? Or too dim?
- Auto-scrape pulse (650ms cycle, 0.35→0.7 opacity, 0.95→1.03 scale): clear indicator? Or too busy?
- Proceed with admin phase 4 session-logging migration (no owner action needed, just writes a `.sql` file)?
- Two-client emote/seam test results (from prior open questions)?
- Buy tokens with credits; bet tokens at SAMM; buy a token-priced item — all verified?
- "Change runner" → select grid → pick a class → scene re-skins — verified?
