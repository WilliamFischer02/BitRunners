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
