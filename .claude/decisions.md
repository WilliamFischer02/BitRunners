# Decisions log

Running log of architectural / safety calls and their reasons. Newest first.
Keep signal-dense — record decisions, not routine feature work (that's the devlog).

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
