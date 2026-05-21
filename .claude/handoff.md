# Handoff — 2026-05-16, session: multiplayer emote-sync + smoothing, then services setup guide

## State of the build

- **⚠️ DEPLOY STATE:** prod `main` now has **everything through devlog 0038** — PR #34 merged 0032–0037 (06:07), PR #35 merged 0038 (the skill tree). Both were Cloudflare-Pages-only deploys (no server/packages changes). **Chunk A (devlog 0039) is NEW work, not yet on a PR** — it'll be its own PR (the branch advanced past #35's merge, the recurring strand pattern; expected).
- **Live web (bitrunners.app):** clicker + skill tree + mobile pass all live. Chunk A (emote fix + polish) pending its PR/merge.
- **Live server (bitrunners.fly.dev):** multiplayer (protocol v1, emote schema) live since the #33 merge. **Chunk A's emote fix is client-only — no server change, no Fly redeploy.**
- **Active plan:** original 5-chunk sprint (devlog 0039) all merged/planned (A/B/C/E shipped; D = trading backend epic, deferred until auth). **Newer work (devlogs 0044–0045):** auth-UI redesign (email/password-only) + room-code join + **server hygiene (idle disconnect + ambient NPCs)** BUILT — all on PR #39 (pending). **⚠️ #39 now includes a server change → merging it triggers a Fly redeploy, not just Pages.** **Two backend epics on the timeline, gated on owner Supabase setup:** trading (`docs/design/p2p-trading-epic.md`) + **admin panel** (`docs/design/admin-panel-epic.md` — owner-only; MUST be server-enforced). **Owner believes auth env is set (email enabled).** No further migrations to apply yet — `0001` covers auth; new migrations (wallet, trade_offers, role, app_config) ship WITH the trading/admin backends.
- **Isolation boundary update:** as of Chunk B, `scene.ts` now imports `appearance.ts` (equipped cosmetics render on the rig) — this is the ONE designed crossing. The mini-game modules (economy/shop/skilltree/ScrapeMenu) still import nothing from scene/network/server. Recolor affects the LOCAL rig only (device-local appearance); remote players don't see each other's gear yet.
- **Local repo branch:** `claude/bitrunners-collaboration-EcqBv` + Chunk A commit.
- **CI status:** local gates green — `pnpm lint` clean (44 files), `pnpm typecheck` 8/8, `pnpm build` 5/5. No test suite (`vitest run` exits 1 on "no tests" — pre-existing, not a regression).
- **⚠️ Emote fix unverifiable headless** — needs a live 2-client test; receiving tab's console logs `[bitrunners] remote emote …` on arrival (tells us send-vs-receive if it still fails).

## What I did this session

Fixed the three reported multiplayer defects (full detail in `docs/devlog/0031`):

1. **Emoticrons now sync to other players.** Added `emote`/`emoteSeq` to the player schema, an allowlisted `onMessage('emote')` server handler, `sendEmote`/`onEmote` client wiring, and screen-tracked emote bubbles above remote avatars. `triggerEmote()` now also sends to the server.
2. **Remote players visible across the seam.** Root cause was the 3×3 world-wrap drawing avatars at the raw server coord. Now drawn at the nearest periodic image (`wrapDelta`). Pure client render math — no server/bandwidth cost, no AOI added.
3. **Smooth remote movement.** `onUpdate` records a target; the render loop exponential-smooths position + rotation toward it. Seam wraps snap (invisible — identical tiles).

Also: moved the canonical emote glyph set + `isValidEmote()` to `@bitrunners/shared` (single source of truth; enforces the "no free-text" moderation rule server-side), bumped `PROTOCOL_VERSION` 0→1, wrote devlog 0031, logged the architectural calls in `.claude/decisions.md`.

**Second deliverable — `docs/setup/SERVICES.md` (devlog 0032):** the canonical master setup guide for every external service — what/why/free-tier/click-by-click/exact-secret-and-destination/verify, in dependency order. Built from an actual config-surface scan (only 6 secrets/bindings wired today; everything else explicitly labelled ACCOUNT-ONLY). Supersedes setup steps in devlogs 0020/0021/0026. Decisions recorded: Neon DEPRECATED, Stripe DEFERRED, Steam needs a custom Worker. The earlier in-chat "diagnostics/tester menu" + Stripe stack proposal was an **accidental prompt — out of scope, do not build**; verified it never entered a committed file. Docs-only commit; no code, no deploy impact.

**Third deliverable — Data Scrape mini-game design + scaffold (devlog 0033):** cookie-clicker economy in a new menu directly under the profile/account button. Design `docs/design/clicker-minigame.md`; lore Q&A `docs/lore/007-data-economy.md` (+ glossary/index). Code: `economy.ts` (pure model + device-local persistence) + `ScrapeMenu.tsx` (launcher + panel scaffold), mounted in `App.tsx`, styled in `style.css`. Loop: SCRAPE→bits, TABULATING up the 8× ladder (bits→strings→serials→passcodes), CALCULATING passcodes→Credits via Admin (destroy) / Company (recycle), +1 Samaritan on the matching track. Locked: device-local (IP-sync rejected — privacy), Credits not Tokens (canon preserved), serials 8×. Fully isolated from scene/network/server. Deferred: full iso ASCII art, press juice, balancing. Blocked seam: reputation reward curve (faction-reward Q&A). **Continued (devlog 0034):** aesthetic terminal HUD for the data/token section under the SCRAPE button (ASCII ladder micro-bars, locked Tokens row, scanline) + a `shop ▸` header button and isolated `shop.ts` framework — Credits-priced items, Token items hard-locked per canon, `owned` added to economy state (additive, no schema bump). Shop catalog is placeholder; real rewards = open Q&A. **Continued (devlog 0035):** framework for clothing (head/chest/legs, 3 escalating rarities), pets (priced ≫ clothing), rate upgrades (scrape wired live), a 16-slot inventory grid, equip/unequip, show/hide cosmetics — all additive in `economy.ts` (no schema bump). New `appearance.ts` is the **render isolation boundary** (resolves equipped→descriptor; nothing imports it yet; scene.ts wires it later). Concrete account-link seam added: `exportProgress`/`importProgress`. Polished the clicker (press-pop, scrape-yield readout, all timers cleaned on unmount). Catalog/rarity/pet lore still placeholder — open owner Q&A (lore 007). **Completion pass (devlog 0036):** wired the inert `tabulate` upgrade to a real cascading bulk `tabulate all` (8× canon preserved; manual, no idle); finished the open **and** close glitch transition (all close paths via `requestClose`); added SCRAPE `+N` juice + press-pop + iso scanline; surfaced `inventory full`/`owned`/`equipped`/`maxed` states; robustness (mount-once Esc, all timers cleaned). No new content; canon/isolation/no-IP unchanged. **Mobile/desktop + deploy-gap (devlog 0037):** found PR #33 only merged the multiplayer commit (rest stranded, no open PR) — opened a new PR for the 5+ stranded commits. Added `@media (max-width:540px)` (launcher scale + clicker header overflow fix) and `@media (pointer:coarse)` (38–46px tap targets) — append-only, desktop untouched. Not device-verified (headless) — use the Pages PR preview to eyeball before prod merge. **Skill tree + surfacing (devlog 0038):** owner Q&A locked 3 forks — (a) auto-click ships **functional & free**, premium is a deferred seam (`hasAutoScrape()`), no billing built; (b) Path 3 raises **Credits-per-passcode at the trade**, the locked 8× ladder is NOT touched (canon-safe); (c) rate upgrades **moved out of the Credits shop into a passcode skill tree** (shop now cosmetics-only; `purchaseUpgrade` removed, `purchaseTreeNode` + cumulative `lifetimePasscodes` added — additive, backward-compatible). New isolated `skilltree.ts` (3 paths, all balance numbers centralized). Wired hold-to-scrape + auto-scrape (panel-open, not offline idle). Main view: launcher renamed `> data scrape`, standalone **shop icon button** on the right rail, **inventory button in the emote-wheel centre**, new `tree` tab; cross-open via `bitrunners:open-scrape` event. Isolation preserved (no scene/net/server imports; EmoteWheel stays presentational). **Balance is a first pass, NOT tuned to the "≈1 week of 1 h" target — needs live play.** Not device-verified.

## What's blocking forward progress

- **Browser verification.** Headless env — I could not run two clients to eyeball the emote round-trip, seam visibility, or smoothing feel. Logic is gate-verified and reasoned against the real code paths; it needs a live two-client check on a deployed build.
- Unchanged from prior: owner-side service wiring (Supabase keys, Resend DNS, OAuth IDs) still blocks the account system.

## What the owner is doing in parallel

- Wiring Supabase + Resend + OAuth — **now follow `docs/setup/SERVICES.md` (canonical), not devlog 0026 (history).** Critical-path order is in §1.
- Owns prod deploy approvals. No `main` push happened or is requested this session.

## What I would do next, in priority order

1. **Owner-side: execute `docs/setup/SERVICES.md` §1 critical path (steps 1–7).** Highest-leverage unblock — accounts/persistence/email/OAuth all wait on this. The guide is click-by-click with exact secret destinations.
2. **Two-client live test on a deployed build:** emote appears over the correct remote avatar and fades; remote players stay visible when crossing the seam; movement reads smooth (not rubber-banding or jittering).
3. Tune `REMOTE_LERP_K` (scene.ts, currently 14) if motion feels laggy (raise) or jittery (lower) live.
4. Re-check the remote-crosses-seam pop (devlog 0031 known tradeoff) — only act if it reads badly.
5. Still open: run-toggle + reworked-tendrils live eyeball (from 0030/0029).
6. Phase 2: aether snapshot on `onLeave` (TODO in `sphere-room.ts`) — Upstash setup steps are in SERVICES.md §12.
7. Steam login: build the OpenID→Supabase-session Worker (SERVICES.md §10 explains why it's a build task, not a toggle).
8. Mini-game: get the **faction-reward Q&A** answered — it unblocks both the 20-achievements design AND the clicker's reputation rewards (currently a raw counter + emitted intent). Then the deferred polish pass: full isometric ASCII button render + press juice, glitch open/close polish, idle/balancing numbers. Implement `migrateEconomyToAccount()` (call `exportProgress`/`importProgress`) when Supabase lands.
9. Mini-game content/render: owner Q&A for the real clothing/pet catalog + rarity/lore vocabulary (lore 007), then the deferred render pass — wire `scene.ts` to `appearance.ts` (`getEquippedAppearance`/`subscribeAppearance`) to actually re-skin the bit_spekter rig. That's the one place isolation is intentionally crossed; do it via the seam only.

## Files touched this session

- `packages/shared/src/index.ts` — protocol bump; `EmoteId`/`EMOTE_GLYPHS`/`isValidEmote()` (new SoT).
- `apps/web/src/EmoteWheel.tsx` — re-export from shared.
- `apps/server/src/state.ts` — `emote` + `emoteSeq`.
- `apps/server/src/sphere-room.ts` — allowlisted `emote` handler.
- `apps/web/src/network.ts` — emote snapshot/interfaces, `onEmote`, `sendEmote`, seq tracking.
- `apps/web/src/scene.ts` — `wrapDelta`, structured `remoteAvatars`, interpolation + nearest-image, tracked remote emote bubbles, send-on-emote, dispose cleanup.
- `apps/web/src/style.css` — `.emote-anchor`.
- `docs/devlog/0031-multiplayer-emote-sync-and-smoothing.md` — new.
- `docs/setup/SERVICES.md` — new (master services setup guide; second deliverable).
- `docs/devlog/0032-services-setup-master-guide.md` — new.
- `docs/design/clicker-minigame.md` — new (mini-game architecture).
- `docs/lore/007-data-economy.md` — new (economy Q&A); `docs/lore/README.md` — index + glossary updated.
- `apps/web/src/economy.ts`, `apps/web/src/ScrapeMenu.tsx` — new (mini-game model + UI scaffold).
- `apps/web/src/App.tsx` — mount `<ScrapeMenu/>` under `<ProfileIcon/>`; `apps/web/src/style.css` — scrape launcher/panel/button + glitch stub.
- `docs/devlog/0033-clicker-minigame-scaffold.md` — new.
- `apps/web/src/shop.ts` — new (shop framework); `economy.ts` — `owned` + purchase; `ScrapeMenu.tsx`/`style.css` — HUD + shop view; `docs/devlog/0034-clicker-hud-and-shop-scaffold.md` — new.
- `apps/web/src/appearance.ts` — new (render isolation seam); `economy.ts`/`shop.ts` — clothing/pets/upgrades/inventory + export/import seam; `ScrapeMenu.tsx`/`style.css` — inventory view + nav + press polish; `docs/devlog/0035-clicker-clothing-inventory-framework.md` — new.
- `economy.ts`/`shop.ts`/`ScrapeMenu.tsx`/`style.css` — completion pass (bulk tabulate-all, close transition, juice, surfaced failure states, robustness); `docs/design/clicker-minigame.md` §15; `docs/devlog/0036-clicker-completion-polish.md` — new.
- `apps/web/src/style.css` — responsive (≤540px) + touch (pointer:coarse) rules for clicker/shop/inventory; `docs/devlog/0037-mobile-pass-and-deploy-gap.md` — new.
- `apps/web/src/skilltree.ts` — new (3-path passcode tree, isolated); `economy.ts` — `lifetimePasscodes`/`creditsPerPasscode`/`hasHold`/`hasAuto`/`isTreeUnlocked`/`purchaseTreeNode`, `purchaseUpgrade` removed; `shop.ts` — cosmetics-only (upgrade kind dropped); `ScrapeMenu.tsx` — tree view + hold/auto + shop launcher + `openScrape`; `EmoteWheel.tsx`/`App.tsx` — emote-centre inventory button; `style.css` — appended; `docs/design/clicker-minigame.md` §16; `.claude/decisions.md` appended; `docs/devlog/0038-clicker-skill-tree-and-surfacing.md` — new.
- `.claude/decisions.md` — appended (multiplayer; services/Neon/Stripe/Steam; mini-game privacy/canon/isolation).
- `.claude/handoff.md` — this file.

## Do NOT do these things (specific to right now)

- Don't push to `main` without explicit owner confirmation in the live conversation. Active branch is `claude/bitrunners-collaboration-EcqBv`. Server paths changed — a `main` push WILL trigger a Fly redeploy.
- Don't add a server-side AOI/visibility radius to "fix" anything — the small-radius bug was a client render bug and is fixed client-side. An AOI would add cost for no benefit at 19×19 / current scale (see decisions.md).
- Don't loosen the emote allowlist or accept free-text emotes — it's the server-side enforcement of a moderation rule.
- Don't edit `.claude/settings.json` by append/prepend (see prior handoff/decisions).
- **Don't build a passcode-gated diagnostics / in-game "tester" menu, and don't add a Stripe/payments setup section.** Both were an accidental in-chat prompt the owner explicitly retracted. SERVICES.md verification is intentionally manual (curl/browser). Stripe is deferred to its own future doc.
- Don't treat devlog 0026 as the setup source anymore — `docs/setup/SERVICES.md` is canonical; devlogs are immutable history.
- **Don't let the Data Scrape clicker mint Tokens** — it mints Credits only; Tokens are canon-scarce and `bit_spekter` can't earn them (lore 003/007). Don't couple `economy.ts`/`ScrapeMenu.tsx` to `scene.ts`/`network.ts`/server — isolation is deliberate so an off-roadmap feature can't regress Phase-2.

## Open questions for the owner

- After a live test: does emote sync / seam visibility / smoothing read correctly? Any rubber-banding?
- `REMOTE_LERP_K = 14` acceptable, or want snappier/smoother?
- The remote-crosses-seam pop (devlog 0031 tradeoff) — acceptable, or worth the extra complexity to smooth?
- Re-confirm auto-merge-to-`main` policy if you want future sessions to ship without per-PR approval.

## Retrospective (not sycophantic)

- The "small radius" bug is the instructive one: the obvious read ("visibility/AOI problem → widen a radius") would have been wrong and would have *added server cost*. Reading the actual wrap render code showed it was a client-side toroidal nearest-image bug — opposite conclusion, zero cost. Worth restating: confirm the root cause in code before reaching for the config knob the symptom suggests.
- Two of three fixes are pure client render math with no protocol/cost impact; only the emote feature touched the wire. Keeping that boundary explicit (and the allowlist in shared) is what kept a "make multiplayer feel better" request from quietly becoming a bandwidth or moderation regression.
- Still no browser proof. Said so plainly rather than implying it works. Gates catch type/lint/build breakage, not "does it feel smooth with two real clients" — that gap is real and is the top next-step.
