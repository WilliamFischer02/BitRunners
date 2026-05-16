# Decisions log

Running log of architectural / safety calls and their reasons. Newest first.
Keep signal-dense — record decisions, not routine feature work (that's the devlog).

---

## 2026-05-16 — Collapse corrupt `.claude/settings.json` to the single hardened object

**Decision:** `.claude/settings.json` was two concatenated JSON objects (invalid JSON): a hardened `allow`/`ask`/`deny` config followed by a leftover permissive one with no `deny`. Rewrote the file as the single hardened object only.

**Why:** Invalid JSON means the harness can't parse it, so the mechanical guardrails CLAUDE.md advertises (block secrets, `_sealed/` lore edits, `fly`/`wrangler deploy`, force-push, push-to-`main`) were **not enforced** at all. The leftover permissive object also directly contradicted the hardening. The owner had explicitly prioritized making these guardrails active, so restoring the intended hardened config (verbatim) is faithful execution, not a new policy. Net effect tightens constraints on the agent (removed a permissive fallback) — aligned with owner safety intent, not self-serving. Caught via Biome (3 lint errors, all this file). Detail in devlog 0030.

**Caution for future sessions:** when updating `settings.json`, *replace* — never prepend/append a new permissions object. Validate it's a single well-formed JSON object (`pnpm lint` will catch concatenation). `Edit(.claude/settings.json)` is intentionally NOT in the allow-list, so changes to it prompt the owner — that gate is correct; keep it.

## 2026-05-16 — Reconcile `claude/bitrunners-collaboration-EcqBv` by reset to the work branch

**Decision:** Reset `claude/bitrunners-collaboration-EcqBv` to `origin/claude/ascii-overhead-game-14dir` (`7734455`) rather than rebasing.

**Why:** The collaboration branch was just `main`'s merge-commit bubbles (PRs #22–#31), tree-identical to the work branch except for the two missing `.claude/` files — zero unique content. A literal rebase would replay ~10 redundant merge commits. Reset gives the exact intended end-state (full feature history + continuity/guardrail files) with no loss; prior tip `6e694ea` == `origin/main`, so it stays fully recoverable. Active development continues on `claude/bitrunners-collaboration-EcqBv` per the current working agreement.
