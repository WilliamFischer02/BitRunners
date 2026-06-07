# Decisions log

Running log of architectural / safety calls and their reasons. Newest first.
Keep signal-dense — record decisions, not routine feature work (that's the devlog).

---

## 2026-06-04 — Sub-Phase E: theme balance verification stays client-side

**Decision:** `purchase_theme` RPC verifies the faction gate (from `profiles.samaritan_*`) but NOT the credit/token balance. The economy is a device-local JSONB blob (player_economy, migration 0002) — not server-authoritative. A client-deduct-then-RPC pattern is used; the client refunds on RPC error. This is consistent with all other purchases (SAMM, shop). Server-authoritative balance verification is the P2P trading epic concern.

**Why it matters:** Tempting to add balance verification in the SQL function, but the blob is client-trusted — a player can just push a large balance blob and the RPC can't detect it. Adding fake server-side balance checks creates false security and extra complexity with no actual protection until the economy is server-authoritative.

**Future sessions:** When the P2P trading epic lands a server-authoritative economy (see `docs/design/p2p-trading-epic.md`), upgrade `purchase_theme` to verify balance there.

---

## 2026-06-04 — ASCII tint hot-swap: uniform mutation, no pass recreate

**Decision:** `applyThemeToPass` mutates `Uniform<Vector3>.value` in-place on the existing `ShaderPass`. No pass re-creation, no `EffectComposer` change. Pattern copied directly from `setAsciiPassResolution`.

**Why it matters:** Recreating the ShaderPass would involve a new `ShaderMaterial`, texture re-binding, and composer re-wiring. Uniform mutation is the designed hot-path for three.js material parameters. Mobile-safe (no DepthTexture/MRT). Verifiable by inspection without WebGL.

---

## 2026-06-03 — Free-text proximity DM permitted (canon reversal)

**Decision:** The original `CLAUDE.md` rule *"No free-text input anywhere in the
game"* is reversed for the proximity DM surface only. Owner chose option (c) of
three (emote-only DM / cut DM / free-text with moderation). Moderation stack:
verified-account gate + age gate + server-side profanity filter + 30 msg/min
rate limit + per-pair block list + audit log.

**Implementation pointer:** `docs/lore/015-chat-policy.md`. `CLAUDE.md`
moderation paragraph amended in the same commit that records the decision.
Free text remains forbidden on every other surface (usernames, emoticrons,
mission dialogue, admin dialogue).

**Why it matters:** This is the largest moderation lift in the Phase 3.5
roadmap. It's deferred to Sub-Phase I so the identity, badge, theme, and HUD
layers settle first.

---

## 2026-06-03 — Single PROTOCOL_VERSION bump for the entire Phase 3.5 roadmap

**Decision:** `PROTOCOL_VERSION = 2` lands in Sub-Phase B (username + badge +
theme on `PlayerState`). Migration `0007` reserves every column the rest of
the roadmap (badges, themes, missions, hack-QTE, DMs) will need, so no further
schema or protocol bumps are planned through Sub-Phase J.

**Why it matters:** Multiple bumps in a short window thrash the "old client
soft-warn" path and make rollback windows ambiguous. One coordinated server +
client deploy covers everything that touches state shape; subsequent sub-phases
only add UI / RPCs that don't change the wire.

---

## 2026-06-03 — Identity changes fan out via Colyseus identity message, NOT broadcast

**Decision:** `apps/server/src/sphere-room.ts` `'identity'` handler trusts the
authenticated client's `displayName / equippedBadge / equippedTheme` payload
after shape validation, because the SECURITY DEFINER RPCs the client must call
*before* sending it (`submit_display_name`, `equip_badge`, `purchase_theme`)
already re-check ownership against `earned_badges` / `owned_themes`. The room
shape-validates length / charset / key pattern only.

**Why it matters:** Keeps the room hot path tiny (no Supabase round-trip on the
'identity' message) without giving up server-authoritative ownership. The
control plane is in Supabase; the room is the data plane.

---

## 2026-05-16 — Clothing/pets/inventory framework: appearance.ts is the render isolation boundary

**Decision:** Built the clothing/pet/upgrade/inventory framework with the
character-render integration as a dedicated **seam module `appearance.ts`**
that nothing imports yet. Equip/inventory/upgrade state lives in the pure
`economy.ts` blob (additive, no schema bump); `appearance.ts` resolves it to a
render-ready descriptor + change event. scene.ts will later import **only**
`appearance.ts` — economy/shop internals never reach the render pipeline. This
keeps the deliberate isolation (the mini-game cannot regress Phase-2
multiplayer/render) while still giving clothing a real path to the 3D rig.
Added `exportProgress`/`importProgress` as the concrete account-link seam (one
blob; device-local now, IP still rejected). Catalog remains placeholder; real
clothing/pet/rarity content + lore is an open owner Q&A — not invented.

**Why it matters:** "clothing changes the character" is the exact place an
isolated mini-game would normally have to break isolation. Routing it through a
one-way descriptor module preserves the safety property and the future wiring
is a small, contained change.

## 2026-05-16 — Shop framework: Credits-only, Tokens hard-locked; `owned` additive

**Decision:** Added a scaffold shop. Purchasable items are **Credits-priced**;
**Token-priced items are present but hard-locked** with a canon reason
(`bit_spekter` has no Server-Space wallet — lore 003/007). The shop cannot
spend or mint Tokens, keeping the currency canon intact. Ownership is stored in
`EconomyState.owned: string[]` as an **additive, backward-compatible** field
(old `v1` blobs without it normalise to `[]` on load) — **no schema-version
bump**, migration seam unchanged. Catalog is explicitly placeholder; the real
reward set is an open owner Q&A (cosmetics Phase-3, emoticrons moderation-gated)
— flagged, not fabricated. `shop.ts` stays isolated (no scene/network/server).

**Why it matters:** a shop is the obvious place a "trade for Tokens" feature
would quietly violate the bit_spekter canon; locking the Token path by
construction prevents that. Additive persistence avoids a migration for a
scaffold.

## 2026-05-16 — Data Scrape mini-game: reject IP guest-sync; preserve currency canon; isolate from Phase-2

**Decision:** Scaffolded a clicker economy mini-game with three locked calls:

- **Rejected the owner's IP-correlated guest-progression idea.** It's PII
  tracking, directly contradicts the Admin's own privacy-protecting lore,
  carries age-gate/minor risk, and the persistence backend isn't wired. Chose
  **device-local** (`localStorage` v1, versioned) with a documented
  account-migration seam. Privacy-safe and ships now. (Owner agreed via Q&A.)
- **Currency canon preserved.** The clicker mints **Credits** (new common
  currency) only. **Token** stays the scarce Server-Space premium currency and
  is **not** clicker-minted — `bit_spekter` canonically cannot earn Tokens
  (lore 003, proxy-wallet planned). A clicker that minted Tokens would break
  canon on the only playable class. Recorded in `docs/lore/007`.
- **Isolation.** The mini-game has no imports to/from `scene.ts`/`network.ts`/
  server. It cannot regress Phase-2 multiplayer; it's off the `0004` roadmap
  and owner-directed, so it's a separate track, not a Phase-2 blocker.

**Why it matters:** the privacy call is a safety decision the owner should see
persisted; the canon call prevents a day-one lore contradiction; isolation
keeps an off-roadmap feature from endangering the roadmap. Reputation **reward**
curve remains an open faction-reward Q&A — wired only as a pluggable intent.

## 2026-05-16 — `docs/setup/SERVICES.md` is the canonical setup source; Neon deprecated; Stripe deferred; Steam needs a Worker

**Decision:** Created `docs/setup/SERVICES.md` as the single canonical service-
setup reference. It supersedes the setup steps in devlogs 0020/0021/0026 (those
remain immutable history). Within it:

- **Neon → DEPRECATED.** Zero code references anywhere; Supabase Postgres is the
  committed DB (devlog 0026 schema + RLS). Running both = two DBs to keep alive
  for no benefit. Guide instructs: do not provision/wire Neon; safe to delete a
  stray exploration project once Supabase is confirmed.
- **Stripe → deferred** from setup scope (owner answered "defer"). Not in the
  service list; drags legal scaffolding (ToS/refund/tax). Separate doc later.
- **Steam → custom Cloudflare Worker required.** Supabase Auth has no Steam
  provider (OpenID 2.0). Documented as a build task (OpenID handshake → mint
  Supabase session via service-role key, server-side), not a dashboard toggle.

**Why it matters:** the guide's secret-placement column is derived from an
actual config-surface scan, not assumption — only 6 secrets/bindings are wired
today; everything else is labelled ACCOUNT-ONLY so account setup is never
mistaken for feature activation.

**Caution for future sessions:** the in-chat "passcode-gated diagnostics/tester
menu" + Stripe stack proposal was an accidental prompt — explicitly out of
scope. It never entered a committed file. Do not build it; keep SERVICES.md
verification manual.

## 2026-05-16 — Multiplayer fixes: client-side toroidal rendering, protocol bump, server emote allowlist

**Decision (a) — fix "small visibility radius" purely client-side via nearest-image rendering, add no server AOI.** The symptom was the 3×3 world-wrap drawing remote avatars at their single raw coord; fixed by rendering each at `local + wrapDelta(remote − local)`. Considered and rejected adding a server-side area-of-interest radius: there is none today, the board is only 19×19, and an AOI would *add* bandwidth/CPU on the 256 MB Fly box for zero benefit at current scale. Cost posture unchanged.

**Decision (b) — interpolation snaps on seam wraps; accept the remote-crosses-seam pop.** Local-wrap seamlessness (happens constantly while roaming) is prioritised over smoothing a remote player's seam crossing (rare, usually off-screen). Documented in devlog 0031; revisit only if it reads badly live.

**Decision (c) — `PROTOCOL_VERSION` 0→1, and the emote allowlist lives in `@bitrunners/shared`.** The bump is safe: protocol is only in the `/health` payload, not a join handshake, and web+server deploy together from `main`. The canonical glyph set was moved to shared so the server can reject anything not in it — this is what makes the "no free-text input anywhere" moderation rule actually enforced server-side, not just a client convention.

## 2026-05-16 — Collapse corrupt `.claude/settings.json` to the single hardened object

**Decision:** `.claude/settings.json` was two concatenated JSON objects (invalid JSON): a hardened `allow`/`ask`/`deny` config followed by a leftover permissive one with no `deny`. Rewrote the file as the single hardened object only.

**Why:** Invalid JSON means the harness can't parse it, so the mechanical guardrails CLAUDE.md advertises (block secrets, `_sealed/` lore edits, `fly`/`wrangler deploy`, force-push, push-to-`main`) were **not enforced** at all. The leftover permissive object also directly contradicted the hardening. The owner had explicitly prioritized making these guardrails active, so restoring the intended hardened config (verbatim) is faithful execution, not a new policy. Net effect tightens constraints on the agent (removed a permissive fallback) — aligned with owner safety intent, not self-serving. Caught via Biome (3 lint errors, all this file). Detail in devlog 0030.

**Caution for future sessions:** when updating `settings.json`, *replace* — never prepend/append a new permissions object. Validate it's a single well-formed JSON object (`pnpm lint` will catch concatenation). `Edit(.claude/settings.json)` is intentionally NOT in the allow-list, so changes to it prompt the owner — that gate is correct; keep it.

## 2026-05-16 — Reconcile `claude/bitrunners-collaboration-EcqBv` by reset to the work branch

**Decision:** Reset `claude/bitrunners-collaboration-EcqBv` to `origin/claude/ascii-overhead-game-14dir` (`7734455`) rather than rebasing.

**Why:** The collaboration branch was just `main`'s merge-commit bubbles (PRs #22–#31), tree-identical to the work branch except for the two missing `.claude/` files — zero unique content. A literal rebase would replay ~10 redundant merge commits. Reset gives the exact intended end-state (full feature history + continuity/guardrail files) with no loss; prior tip `6e694ea` == `origin/main`, so it stays fully recoverable. Active development continues on `claude/bitrunners-collaboration-EcqBv` per the current working agreement.

## 2026-05-19 — Clicker skill tree: three owner Q&A decisions (devlog 0038)

**Decision (a) — auto-click ships functional and FREE now; "premium" is a deferred seam, not built.** The owner described auto-click as a premium-member feature, but no membership/billing system exists anywhere in the codebase and adding one needs paid infra + is out of phase. Building real billing was offered and not chosen. Auto-click works for everyone today; `economy.hasAutoScrape()` is the single seam a future premium gate wraps. Rationale: shipping a functional feature now > a fake/paywalled stub; the premium decision can be made later without reworking the mechanic.

**Decision (b) — Path 3 raises Credits-per-passcode at the trade; the locked 8× ladder is NOT touched.** The owner asked for "a bit worth more over time, shop prices fixed." Taken literally that mutates the uniform 8× ladder, which is a **locked canon decision** (clicker design §3/§10). Offered both interpretations via AskUserQuestion; owner chose the canon-safe one. `creditsPerPasscode()` = `CREDITS_PER_PASSCODE + upgrades.yield`; STEP is never modified. Delivers the owner's intent (more purchasing power late-game, fixed shop prices) with zero canon/lore edit. **Future sessions: do not "simplify" Path 3 by editing STEP — that silently breaks a locked decision.**

**Decision (c) — rate upgrades moved out of the Credits shop into a passcode skill tree; shop is cosmetics-only.** Two purchase systems for the same upgrades (credit shop vs passcode tree) is incoherent. Owner chose consolidation: Credits buy looks, passcodes buy power. Removed the shop `upgrade` `ItemKind` and credit-based `economy.purchaseUpgrade`; added `purchaseTreeNode` (passcode sink) + cumulative `lifetimePasscodes` (additive, backward-compatible, never decremented — gates the tree, seeded from current passcodes on load so existing players keep access). This supersedes design-doc §14's `upgrade` shop kind.

**Caution for future sessions:** clicker balance numbers (skilltree.ts costs/maxLevels, HOLD_MS/AUTO_MS) are a deliberate **first pass** and are NOT verified against the owner's "≈1 week of 1 h sessions" target — that needs live play. All constants are isolated in one module on purpose; tune there, don't scatter magic numbers. The faction-reward curve remains a separate open Q&A (unchanged).

## 2026-05-19 — Sprint roadmap Q&A: vending NPC, trade venue, tutorial reward, rig wiring (devlog 0039)

Four forks locked via owner Q&A before scoping a 5-chunk sprint (vending machine, trade offers, shop+rig, tutorial). Recorded so future sessions don't re-litigate or accidentally break canon.

**Decision (a) — vending machine is a NEW sentient NPC, and its Token output stays hard-locked behind the proxy-wallet.** It's new lore (name/personality is a still-open Q&A for Chunk C — do NOT invent it). Critically: it gambles for Tokens, but bit_spekter cannot hold Tokens (locked canon, lore 003 + clicker design §4). So Token drops are gated behind the planned proxy-wallet unlock — canon-safe. Do not let the vending machine mint spendable Tokens to bit_spekter.

**Decision (b) — trade offers are reviewed/accepted at the existing depots/ports**, not new "trade centre" buildings. Reuses world objects already present; no new placement/art/lore.

**Decision (c) — tutorial completion unlocks `server_speaker`** as the 2nd playable class. Its origin lore already exists (003-classes-origins.md), so only the unlock plumbing is new (device-local flag now, account-linked later). The boot grid already lists it locked.

**Decision (d) — clothing/pets render via primitive recolor/scale** from the existing data-only `visual` descriptors (palette/effect/texture), NOT commissioned meshes. First pass so equipped gear is visible on the rig without blocking on art; this is the first time `scene.ts` consumes `appearance.ts`.

**Process caution:** the recurring strand-after-merge pattern bit us 3× (devlogs 0037/0038/0039 setups). Going forward: don't merge a PR mid-session if more commits are coming, or expect a fresh PR per post-merge push. Chunk A was started only AFTER PR #35 merged, for this reason.

## 2026-05-21 — SAMM gambling machine: in-world, real house edge, Tokens locked (devlog 0041)

**Decision (a) — SAMM is built in-world now, reusing the existing `vending` prop.** Owner chose the in-world machine (walk-up proximity) over a launcher button. No new mesh — the `vending` prop at (6.0, −5.5) IS SAMM; `scene.ts` fires `bitrunners:samm-range` on approach and the React layer shows a `use SAMM` prompt → betting terminal. Same one-way CustomEvent pattern as the Admin encounter; `samm.ts` stays isolated (economy/shop only).

**Decision (b) — real house edge; a pull can lose outright.** Owner chose a genuine gamble over always-win. Credit EV ≈ 0.84× bet (the State profits — fits the "government-profit machine" lore). All odds/payouts centralized in `samm.ts` as a first-pass, tunable table.

**Decision (c) — Tokens stay locked (canon preserved).** SAMM can *win* Tokens but bit_spekter has no wallet (lore 003/007/008), so Token wins go to `economy.lockedTokens` (display-only, never spendable) and Token *betting* is UI-disabled. This is the proxy-wallet hook, not a canon break. **Future sessions: do not make SAMM mint spendable Tokens to bit_spekter.**

**Lore recorded:** `docs/lore/008-samm.md` (name = State Authored Money Machine; personality = formal/jolly/impersonal). Open follow-ups noted there (SAMM faction ties, quests/reputation, what a Token win unlocks post-proxy-wallet) — not invented.

## 2026-05-21 — P2P trading is a backend epic, deferred until auth (devlog 0042)

**Decision:** Chunk D ("trade offers at depots/ports") was scoped as NPC-posted offers, but the owner clarified they want **player-to-player** trading (browse others' offers, create your own; item↔item, pet↔item, credit↔item, credit↔pet; Tokens excluded per canon). Real P2P **cannot run on the current architecture** — economy is device-local `localStorage`, the Colyseus room is in-memory/ephemeral, and auth is scaffolded but not live. A client-trusted version would be a dupe exploit. Owner chose **"plan the P2P backend epic first"** over scaffolding a local stub or shipping NPC-mediated trades.

**Outcome:** wrote `docs/design/p2p-trading-epic.md` — the reviewable plan. Hard prerequisites: **live accounts** + a **server-authoritative tradeable economy** (Supabase Postgres as system of record; atomic transactional `accept_trade`). Builds on the existing `supabase/migrations/0001` scaffold (`profiles`/`inventory`/`equipped_outfit`); gaps = no wallet column, no `trade_offers`. No new paid infra expected (Supabase free tier). **No trade code shipped this session.**

**Caution for future sessions:** do NOT build a device-local "marketplace" — it can't show other players' offers and trading device-local items is trivially exploitable. Trading is gated on auth; revisit per the design doc's phasing + open questions. The fallback "NPC/system-posted offers" is a *different, smaller* feature, not this epic.

## 2026-05-21 — Admin panel epic + server-hygiene tasks added; auth redesigned email-only; room-code join (devlog 0044)

**Decision (a) — admin panel is a server-enforced backend epic, not built now.** Owner wants an owner-only panel (dialogue editing, user table + currency grants + account status/permissions, activity stats, under-construction switch w/ dev-bypass). Recorded in `docs/design/admin-panel-epic.md`. **Hard rule: every admin action must be server-authorized (admin role + RLS / privileged functions).** A client-only admin panel or client-side currency grant is an instant exploit — never ship that. Gated on live auth + an admin role + (for grants) the server-authoritative economy shared with trading. "Elevated" account status names the premium/season-pass concept (the deferred auto-click gate can later key off it).

**Decision (b) — engine tasks queued as server-side "server hygiene" (buildable now, → Fly):** idle-player disconnect (anti-clutter) + NPC wander/emote liveliness. Isolated server changes; not built this pass (owner's gate was "add to timeline first").

**Decision (c) — auth UI is email/password ONLY** (owner): unified sign-in/sign-up form + confirm-password + password-peek; OAuth buttons removed. Client-only; functional once Supabase env is set.

**Decision (d) — room-code join is client-only** via Colyseus `joinById` (no server change → Pages-only). First pass **applies on reload** (scene reads `bitrunners.settings.roomCode` at connect); live re-join without reload is a deferred polish item. Falls back to matchmaking if the coded room is gone/full.

## 2026-05-21 — Server hygiene: silence-based idle disconnect + ambient NPCs (devlog 0045)

**Decision (a) — idle disconnect keys off SILENCE, not stillness.** The client sends `move` every tick (~15 Hz) regardless of movement, so a live client always transmits; a client we've heard nothing from for `IDLE_TIMEOUT_MS` (120 s) is dead/frozen/backgrounded and gets `client.leave()`d. This deliberately does NOT kick a player actively using the clicker while standing still (their client keeps sending). Known gap: no client auto-reconnect yet, so a dropped/backgrounded player stays disconnected until reload — follow-up.

**Decision (b) — NPCs are server-only `PlayerState` entries** (`npc:N` ids) in the room state, wandering + emoting via the sim tick. They ride the existing player sync (no client change), don't count against the 40-human cap or matchmaking fullness, and don't keep empty rooms alive (auto-dispose is client-based). No schema change.

**Note:** these are server changes → merging triggers a Fly redeploy (owner-gated).

## 2026-05-21 — Account-synced economy + autonomous-task brief (devlog 0046)

**Decision (a) — account economy is SYNC, not server-authoritative (yet).** Signed-in progress saves as one JSONB blob (`exportProgress()`) to a dedicated `player_economy` table (migration 0002) with own-row RLS; load-on-login adopts the newer of account/local by `updatedAt` (last-write-wins). The bridge is `economy-sync.ts` — the ONLY place economy.ts meets the network (economy.ts stays isolated). Used a dedicated table, NOT a `profiles` column, because the `profiles` UPDATE policy's WITH CHECK is tied to `display_name_status` and would block economy writes once a name is approved. **Trading still needs the stricter server-authoritative validation (p2p-trading-epic P1) — do not treat this sync as trade-safe.**

**Decision (b) — profile button label is now auth-driven** (was hardcoded `// guest`). Part of the "signed in but still guest" fix.

**Decision (c) — owner must run `0002_player_economy.sql`** for saving to work; until then sync silently no-ops.

**Decision (d) — autonomous daily task** is governed by `.claude/autonomous-task.md` (standing brief). Guardrails: dev branch only, never push main, never merge, gates before commit, draft PRs, no paid resources / no Fly deploy / no silent dep bumps, canon + sealed-lore safe, no destructive git, security pass every run, escalate big/ambiguous calls to the handoff rather than guessing. Owner wires the schedule in Claude Code on the web.

## 2026-05-21 — Admin console phase 1: role + RLS-gated config, fail-open construction gate (devlog 0047)

**Decision (a) — admin privilege is DB + RLS, never client.** `profiles.role` (user/dev/admin) set only via SQL editor; `is_admin()`/`is_dev_or_admin()` SECURITY-DEFINER helpers; admin actions (e.g. the under-construction flag in `app_config`) gated by RLS policies, not by UI visibility. The client admin gate is convenience only. No service-role key in the client. This is the standing pattern for ALL future admin features (user table, grants, dialogue writes, stats) — enforce server-side.

**Decision (b) — under-construction gate FAILS OPEN.** `ConstructionGate` blocks non-dev/admin only when it positively reads the flag as on; any fetch error → app stays visible. A config/DB hiccup must never lock everyone (incl. the owner) out. `app_config` is readable by anon (the flag must gate guests too); writable only by admins.

**Decision (c) — account continuity surfaced** via a `bitrunners:economy-synced` event + a "progress · synced ✓" row in the account panel.

**Owner actions:** run `0003_admin_role_and_config.sql`; set own `profiles.role='admin'` via SQL. Phases left: dialogue editor, user table + token/credit grants, activity stats — each needs its own admin-RLS migration; grants additionally need the server-authoritative economy (shared with trading).

## 2026-05-25 — Admin phase 2: editable NPC dialogue (devlog 0048)

**Decision (a) — dialogue editor = registry + override-or-default.** `dialogue.ts` holds in-code defaults for 12 entries (Admin opening + 4 replies; SAMM greeting/insufficient + 5 quips); the `dialogue` table (migration 0004) stores only admin-edited overrides; `getLines()` returns override ?? default. Components read the registry instead of hardcoded constants. Adding more entries later (tutorial copy, etc.) is just more registry rows.

**Decision (b) — dialogue writes are admin-RLS-enforced** (world-readable, `is_admin()` write) — same server-enforced model as the construction flag. Admin-authored text is exempt from no-free-text (owner-only).

**Decision (c) — samm.ts stays network-isolated** by returning a `quipKey` (registry key) from `gamble()`; the UI (`Samm.tsx`) resolves the text via `dialogue.getLine()`. samm.ts never imports the dialogue/network layer.

**Owner action:** run `0004_dialogue.sql`. Next admin phases: user table + token/credit grants (needs admin-read RLS + auth.users email via a view/function + server-authoritative economy), then activity stats (session logging + chart).

## 2026-05-26 — Proxy-wallet (Tokens go live) + runner switch (devlog 0049)

**Decision (a) — the "bit_spekter has no Token wallet" canon is retired as the planned proxy-wallet unlock** (lore 009; owner chose "proxy-wallet unlock" framing). Tokens are now a real spendable currency in the account-synced economy blob (NO migration — JSONB blob). Legacy `lockedTokens` are folded into the spendable balance on load (the release moment). `economy.tokens` replaces `lockedTokens`. **Future sessions: do not re-lock Tokens for bit_spekter.**

**Decision (b) — Credits→Tokens is ONE-WAY** (owner): `exchangeCreditsForTokens`, `CREDITS_PER_TOKEN=100` (tunable), exposed as a "buy tokens" control in the shop. No cash-out → Tokens stay a premium sink.

**Decision (c) — store has token-priced PREMIUM items** (`ShopItem.currency`); SAMM bets in Credits OR Tokens (currency toggle, token tiers `[1,3,10]`, payouts in the bet currency, rare token bonus). `samm.ts` stays network-isolated (emits `quipKey`).

**Decision (d) — "change runner" = in-game class switch** (NOT a currency exchanger — owner corrected my read). `Boot` gains `startAtSelect`; a `bitrunners:change-runner` event returns to the class-select grid; a profile-panel button triggers it. Swapping re-inits the scene on the new class.

**Note:** Tokens remain client-trusted (device-local blob); server-authoritative validation is the trading-epic concern. Trading's "Tokens excluded" assumption is now obsolete — revisit when trading is built.

## 2026-05-26 — Combined four open PRs into one merge-ready PR; dropped #45 as a dup (devlog 0051)

**Decision:** #43 (proxy-wallet + runner switch) couldn't merge — `main` advanced to `b5fa113` (PR #42 polish/security) and the scheduled autonomous task left #44/#45/#46 open. Combined `main` + #43 + #44 + #46 onto #43's branch via merges (resolving conflicts in `Samm.tsx`, `style.css`, `handoff.md`), gates green, so #43 is now conflict-free/merge-ready. **Dropped #45** — a duplicate of #46 (autonomous task built admin phase-4 activity-stats twice); kept #46 for its stronger security (SECURITY DEFINER aggregate, no raw-row client read). Close #44/#45/#46 as superseded.

**Process caution:** parallel autonomous runs off divergent `main` snapshots caused the conflicts + the dup. The autonomous brief should check for an existing open PR on the same roadmap item before starting; the owner merging promptly (or pausing the schedule during manual sessions) prevents divergent bases. Single new migration from this combine: `0005_session_logging.sql`.

## 2026-05-26 — Autonomous open-PR coordination protocol + distinct pet shapes (devlog 0052)

**Decision (a) — parallel instances coordinate via OPEN PRs (shared GitHub state), not files.** Scheduled instances run in separate containers (no shared FS), so the autonomous brief (`.claude/autonomous-task.md` §1b) now mandates: fetch + list open PRs before picking work; don't start an item an open PR covers; prefer a disjoint file footprint; branch off latest `main`; claim early (open the draft PR after the first commit); re-check/merge `main` before pushing; never force-push or merge another instance's PR to resolve a collision. This is the fix for the #43–#46 pileup + the #45/#46 duplicate. Also fixed two stale brief lines (epics are now live; Tokens unlocked — don't re-lock).

**Decision (b) — distinct pet shapes:** `scene.ts` `petGeometryFor(itemId)` gives each pet a distinct primitive (sphere/octahedron/tetrahedron/cone/icosahedron/torus); the appearance applier rebuilds the pet mesh when the equipped id changes. Isolated via the appearance seam.

**Next big items (focused sessions, not marathon tails):** admin phase 3 (user table + grants — security-critical SECURITY DEFINER + auth.users email exposure + cross-user economy writes) and the trading backend.

## 2026-05-26 — Admin phase 3: user table + currency grants + profiles RLS fix (devlog 0053)

**Decision (a) — currency grants use an append-only LEDGER, not a direct blob write.** The economy is account-*synced* (client owns its `player_economy.blob`, own-row RLS, 0002), not server-*authoritative*. An admin writing another user's blob would be clobbered by that user's own client sync (last-write-wins by `updatedAt`). So `admin_grant_economy` (SECURITY DEFINER, re-checks `is_admin`) appends to `economy_grants`; the recipient claims via `claim_economy_grants()` — one atomic `UPDATE … RETURNING` CTE that marks all their unclaimed rows claimed and returns the sums (exactly-once, own-rows-only). `economy-sync.ts` claims after the load guard clears, folds into the balance, pushes up. This is the scoped bridge until the trading epic's server-authoritative economy exists — at which point grants can become direct authoritative writes.

**Decision (b) — CRITICAL pre-existing security fix: profiles column-grant lockdown.** RLS is row-level, not column-level. `profiles_update_own` (0001) + Supabase default column grants let any authenticated user `PATCH` their own profile to `role='admin'` and self-escalate (the 0003 "no client UPDATE policy grants it" note was wrong). 0006 `REVOKE UPDATE ON profiles FROM PUBLIC, anon, authenticated` then `GRANT UPDATE (display_name, display_name_status, display_name_note) TO authenticated`. role/tier now writable only via SECURITY DEFINER `admin_set_*`. **Future sessions: never add a client-side profiles UPDATE of role/tier — it re-opens the hole.**

**Decision (c) — admin reads of others' data go through a SECURITY DEFINER function with the `is_admin` gate in the WHERE clause** (`admin_list_users` returns zero rows to non-admins), so `auth.users.email` is exposed to admins only. `admin_set_role` blocks changing your *own* role (lockout guard — bootstrap admin via SQL, 0003). Grants are capped (≤10M credits / ≤1M tokens) against fat-finger minting.

**Decision (d) — `account tier` = `profiles.tier` (`free`|`elevated`).** Names the deferred premium concept; the clicker auto-click "premium" gate can later key off `tier='elevated'` instead of being free.

**Owner action:** run `0006_admin_user_management.sql` (closes the escalation hole). Audit: `SELECT id, role FROM profiles WHERE role <> 'user';` — expect only the owner.

## 2026-05-28 — Six-phase feature push; Phase 1 = render polish (devlog 0055)

**Context:** owner requested a big coordinated push (PS2-in-ASCII look, tutorial highlighting + account CTA, 2× world + collision + AI dwellers, canonical 2-word emoticron editor, tap-to-lock camera). Delivered as **phased draft PRs**, one per workstream, branched off latest `main` (coordination protocol, 0052). Plan file: `/root/.claude/plans/nested-tickling-reddy.md`.

**Owner decisions (AskUserQuestion):** (a) render = **tasteful polish in budget** (not full retro emulation) — mobile/iOS-safe is the constraint; (b) emoticrons = **compose → manual review → library** (full canon, no-free-text), built incrementally; (c) extra wheel slots (the "6 for certain characters") = **earned via play** (progression), not tier/class; (d) delivery = **phased PRs in my proposed order** (render → world/collision/AI → tutorial/CTA → tap-lock → emoticrons).

**Phase 1 decisions (devlog 0055):**
- **Ordered (Bayer) dither replaces hash noise** in the ASCII shader, behind an `orderedDither` option (default off → no regression for other callers); scene opts in. The cross-hatch gradient is the core "rendered" upgrade.
- **CRT/diode = a separate `ShaderPass`** (`packages/ascii/crt-pass.ts`) after ASCII / before OutputPass, **not** folded into the ASCII shader — keeps the glyph shader single-responsibility and lets `?crt=off` skip it cleanly. Plain-RGBA, UV-space math, no time roll → **iOS-safe by construction** (devlog 0008 lesson; no DepthTexture/MRT/float).
- **Fog is nulled during the offscreen character + normals passes** (same save/restore the code already does for `scene.background`) so the hero never dims with camera distance and normal data isn't fog-corrupted. Fog near/far derive from `PLATFORM_*` so they auto-retune when Phase 2 doubles the world.
- **No tone-mapping change.** `renderer.toneMappingExposure=1.15` is a latent no-op (toneMapping is None) but left alone — changing it interacts with OutputPass colour management and risked the pipeline; out of scope for "in budget".

**Honest status:** GLSL isn't verifiable headless (no WebGL context); correct by inspection + bundle builds. Visual + iOS check are owner-side.

## 2026-05-28 — Phase 2: per-class identity + pet behaviours (devlog 0056)

**Context:** owner expanded the six-phase push with three new objectives: per-class visual identity (option (a) — rudimentary primitive rigs, not free CC0 assets), distinct pet movement behaviours, per-class clothing impact. Plus a dedicated optimisation sweep added as Phase 7 (cross-cutting principles also applied inside every phase). Plan file: `/root/.claude/plans/nested-tickling-reddy.md`.

**Decision (a) — six classes share the IDENTICAL skeleton + `ClassRig` return shape**, so the existing tick animation drives them all unchanged. Differences live only in body geometry, props, and material palette. New `apps/web/src/class-rigs.ts` owns every class builder + `buildClassRig(className)` router. **Why:** zero animation-code surface area touched; trivial to add a 7th class later.

**Decision (b) — limb geometries are module-level singletons** (`G_ARM_UPPER`, `G_HAND`, etc.) shared across all six class rigs (and the remote-avatar shell). Visually correct (limbs are similar enough across classes) and a real allocation win as we add more classes / per-class remote variants.

**Decision (c) — data_miner's hunched lean = `root.rotation.x = 0.08`, not `chest.rotation.x`.** The tick OVERWRITES `chest.rotation.x` every frame (lean-while-walking), so a build-time chest tilt would be erased the moment the player moved or idled. `root.rotation` lives outside the animation surface and stacks cleanly. Camera follow uses `root.position`, not rotation, so the camera doesn't tilt.

**Decision (d) — per-class clothing impact comes "for free" from distinct base materials.** No per-class clothing tuning code. Each class has its own armour material (different color/roughness/metalness/emissive), so the existing `applySkin()` palette overlay inherits a different undertone per class. A `applySkin()` amplifier per class is a one-line follow-up if owner wants louder.

**Decision (e) — remote avatars are palette-only per class this PR**, not full per-class rigs. A `REMOTE_LOOKS` table swaps armour/dark/emissive; same 6-mesh shell. Cheap (no extra meshes per remote) and ships per-class colour identity for multiplayer immediately. Phase 7 can add one distinguishing prop per class to the remote shell if desired.

**Decision (f) — `?class=NAME` URL override** for visual QA of locked classes. Boot's class-grid lock state is unchanged (lore-canon for which classes are selectable). The override is validated via `isValidClass()` to avoid arbitrary strings reaching the rig router.

**Decision (g) — per-pet behaviours live in `pets.ts`** alongside `petGeometryFor`. Switched on `itemId` in the tick (one function call per frame), no per-frame allocations. The default branch preserves the prior shipped behaviour exactly → no regression for an absent or unrecognised pet.

**Honest status:** GLSL/visual still not verifiable headless. Eyeball + tune per class via the override.

## 2026-05-31 — Phase 3: 2x world + collision + dweller archetypes (devlog 0057)

**Decision (a) — `PLATFORM_HALF`/`SIZE` moved to `@bitrunners/shared`** before doubling them, so server and client cannot drift. They had been duplicated in `scene.ts` (9.5) and `sphere-room.ts` (9.5). Phase 3 doubles to 19/38 in one place. Decorations stay at their interior positions (still <±7 from centre), so the same prop layout sits in a 4x area. Fog near/far derive from these so the depth cue auto-retunes.

**Decision (b) — server tags NPC archetype via existing `className` field** (cycled over `DWELLER_ARCHETYPES = ['dweller.robot','dweller.husk','dweller.spirit']`), not a new schema field. Avoids a PROTOCOL_VERSION bump. Old clients receive the same payload shape; `dweller.*` className falls through `REMOTE_LOOKS` to the bit_spekter default, so old clients still render NPCs (just without archetype). The server-side concept is dweller, but the field is "string label" — flexible.

**Decision (c) — client routes by id prefix, not className contents.** `onJoin`: `p.id.startsWith('npc:')` → `buildDweller(p.className)`; else `buildRemoteAvatar(p.className)`. id-prefix is the authoritative "is this an NPC" signal; className is the per-NPC kind. Player classes and dweller archetypes occupy disjoint className namespaces (`bit_spekter` etc. vs `dweller.*`).

**Decision (d) — collision = wrap-aware circle-vs-AABB, axis-separated slide, allocation-free.** Chose AABB colliders (10 entries total) over per-mesh raycasts for cheapness and predictability. `slideMoveInto(pos, nextX, nextZ, r, cs)` mutates the player's Vector3 in place — no per-frame allocations. Wrap-awareness lives inside `colliders.ts` via `wrapDelta` so collision works across the seam without per-tile collider duplication.

**Decision (e) — existing decorations (port/vending/monolith/terminal) get colliders, which is a behaviour change** (used to be walk-through). Reads as "real props" and matches the new "obstacles + AI dwellers" world feel. If owner wants any to stay walk-through for an interaction reason, comment its entry out of `COLLIDERS`.

**Decision (f) — six new obstacle props added inside `worldTile`** (so they appear in all nine wrap clones via the existing tile-clone pattern). Two shared materials (`obstacleRustMat`, `obstacleStoneMat`) cover all six — module-level material sharing baked in per the Phase 7 cross-cutting optimisation principle.

**Decision (g) — NPC count NOT bumped from 4.** The canon cap is 10 NPCs + 40 humans per sphere; staying at 4 keeps Phase 3 focused. Cycle distributes archetypes (robot/husk/spirit/robot) so all three are still represented. Owner can bump `NPC_COUNT` in `sphere-room.ts` independently.

**Honest status:** Visual + collision feel still need a browser. PROTOCOL_VERSION not bumped (no schema/message change).

## 2026-05-31 — Phase 4: tutorial highlight + account CTA (devlog 0058)

**Decision (a) — highlight = pulsing dashed ring, NOT a darkened spotlight cutout.** Spotlight cutout (SVG mask or 4 shutter divs) was the agent's seam suggestion; I chose a simpler dashed-border ring. Reasons: easier CSS, no SVG mask complexity, mobile-cheap (no blur), terminal-ASCII aesthetic, doesn't fight existing modal z-index. Pointer-events: none keeps it from blocking clicks.

**Decision (b) — `bitrunners:open-profile` event** to pop the panel open from outside. `ProfileIcon`'s `open` state stays internal; the tutorial CTA fires the event, ProfileIcon listens. Keeps the caller decoupled from `ProfileIcon`'s implementation and matches the codebase's existing event-driven cross-component pattern (e.g. `bitrunners:open-scrape`).

**Decision (c) — three-phase tutorial: `steps | reward | cta`**, with `cta` only entered for guests. Authenticated players' "[ done ]" on reward dismisses the tutorial outright (no nag). Guests see one CTA, then their `setActive(false)` choice dismisses for the session — the `tutorialDone` flag is already set when reward fires, so the CTA never re-shows.

**Decision (d) — no guest→account migration fix needed.** Audited `economy-sync.ts`: `loadFromAccount(uid)` does last-write-wins by `updatedAt`. Fresh account (no remote row) → falls to `saveNow(uid)` → local progress is pushed up. Existing account on fresh device → `importProgress(remote)` restores. The agent's seam suggestion ("confirm migration is correct") was the right one — the migration was already correct.

**Decision (e) — target re-read uses both `window.resize` + capturing `window.scroll` + `ResizeObserver(target)` + a one-shot setTimeout retry.** Belt-and-braces: HUD elements rarely move but the retry covers the case where the target wasn't mounted at step-change time; the capturing scroll listener covers scrolling inside any internal panel; ResizeObserver covers the target re-laying out.

**Honest status:** Visual + interactive verification needs a browser.
