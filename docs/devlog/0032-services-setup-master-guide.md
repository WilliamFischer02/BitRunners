# 0032 — Master services setup guide (`docs/setup/SERVICES.md`)

**Date:** 2026-05-16
**Branch:** `claude/bitrunners-collaboration-EcqBv` (rides PR #33; not merged to `main`)

## TL;DR

Added `docs/setup/SERVICES.md` — the canonical, director-friendly setup
reference for every external service: what it is, why it's in the stack, free-
tier limits, click-by-click account setup, the exact secret name + exactly which
of the real destinations it goes to, and a manual verification step. It
consolidates and supersedes the setup steps previously scattered across devlogs
`0020`, `0021`, `0026` (those stay as history).

No code changed. No new dependencies. No paid resource provisioned.

## Why / what it gets right (grounded, not guessed)

The "where does each secret go" column is built from an actual scan of the repo
config surface, not assumption:

- **Only 6 things are wired today:** `VITE_SERVER_URL`, `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY` (Cloudflare Pages env, build-time);
  `FLYIO_ACCESS_KEY` (GitHub Actions secret, via
  `.github/workflows/deploy-server.yml`); `PORT`/`LOG_LEVEL` (`fly.toml [env]`,
  committed, not secrets); the `BOARD` KV binding (Pages Functions).
- Every other service (Sentry, Turnstile, Upstash, R2, Workers AI, Anthropic,
  Steam, Cloudflare Web Analytics) is marked **ACCOUNT-ONLY**: safe to set up,
  but **no code consumes the secret yet**. The guide says this explicitly per
  service so the owner never thinks pasting a key activated a feature.
- Documented the real **4** secret destinations (not 3): Pages env (build-time),
  Pages KV binding, Fly (`fly.toml [env]` vs Fly Secrets), GitHub Actions
  secrets — plus the "Resend/OAuth live inside Supabase, not the repo" nuance.
- Captured the **known footgun**: the Fly token must be a GitHub Actions secret;
  it was once wrongly placed in Cloudflare Pages (devlog 0020).

## Decisions recorded (see `.claude/decisions.md`)

- **Neon → DEPRECATED.** Zero code refs; Supabase Postgres is the committed DB.
  Guide §17 says do not provision/wire Neon.
- **Stripe → deferred** from setup scope (owner decision; not in the service
  list; drags legal scaffolding). Gets its own doc when monetization is active.
- **Steam → needs a custom Cloudflare Worker** (Supabase can't do Steam OpenID
  2.0). Documented as a build task, not a dashboard toggle, so it isn't
  mistaken for "done" once an API key exists.

## Scope note (so future sessions don't resurrect it)

The earlier in-chat "passcode-gated in-game diagnostics/tester menu" + Stripe
stack proposal was an **accidental prompt** per the owner and is **explicitly
out of scope**. It never touched a committed file (verified by grep — the only
"diagnostic" hits are the unrelated, legitimate `0023` net-status-badge devlog,
left untouched). Do **not** build a diagnostics/tester menu. Verification in
`SERVICES.md` is intentionally all manual (curl/browser checks).

## Files touched

- `docs/setup/SERVICES.md` — new (the guide).
- `docs/devlog/0032-services-setup-master-guide.md` — this entry.
- `.claude/decisions.md` — Neon-deprecated / Stripe-deferred / Steam-Worker.
- `.claude/handoff.md` — updated for both this session's deliverables.

## Follow-ups

- Owner executes account setup in the §1 critical-path order (1–7 gives a fully
  working game; 8 is free/quick; 9–15 are preparation).
- Keep-warm ping for the Supabase free project (pauses after ~7d idle).
- When any ACCOUNT-ONLY service is wired in code, flip its STATUS in
  `SERVICES.md` §19 and its section.
- Steam: build the OpenID→Supabase-session Worker (separate task).
