# BitRunners — Services Setup Guide (master)

**Audience:** the project owner (non-technical-friendly). **Purpose:** the single
place that says, for every external service in the stack, *what it is, why it's
here, what it costs, exactly how to set up the account, exactly which secret goes
exactly where, and how to confirm it works.*

This **consolidates and supersedes** the setup steps previously scattered in
`docs/devlog/0020`, `0021`, and `0026`. Those devlogs stay as history; **this
file is the canonical setup reference from now on.**

> ⚠️ **Honesty rule used throughout:** each service has a **STATUS** badge.
> Setting up an account for a service marked `ACCOUNT-ONLY` does **not** turn a
> feature on — no code reads that secret yet. That's expected and fine; it just
> means "safe to prepare now, wiring comes in a later phase." Nothing here is a
> lie of omission.

---

## 0. Read this first — the 4 places a secret can live

You'll see "where does this go?" everywhere below. There are **four** real
destinations (not three — the extra nuance matters and is called out so you
don't put a secret in the wrong place):

| # | Destination | How you set it | Used by | Gotcha |
|---|---|---|---|---|
| **A** | **Cloudflare Pages → Settings → Environment variables → Production** | Dashboard text field | The website (client) | **Build-time.** The value is *baked into the site when it builds*. Change it → you must **redeploy** Pages or it keeps the old value. Only vars starting `VITE_` reach the client. |
| **B** | **Cloudflare Pages → Settings → Functions → KV namespace bindings** | Dashboard binding (pick a namespace, name it) | The writer-board API | This is a **binding, not an env var.** No string to paste — you attach a KV namespace and give the binding a name. |
| **C** | **Fly.io** — two sub-types | (i) `fly.toml [env]` = committed plain text. (ii) **Secrets** via `flyctl secrets set NAME=value` or Fly dashboard → app → Secrets | The game server | Never put a real secret in `fly.toml [env]` — that file is in git. Real keys go in **Fly Secrets**. |
| **D** | **GitHub → repo → Settings → Secrets and variables → Actions** | Dashboard, "New repository secret" | CI/CD deploy workflows | Only the GitHub Actions runner can read these. The website and server **cannot**. |

### The one footgun that already happened

The Fly deploy token was once put into **Cloudflare Pages** by mistake (see
`docs/devlog/0020`). **Cloudflare Pages only builds the static website — it
cannot deploy the server and cannot read that token.** The Fly token is a
**GitHub Actions secret (D)**, full stop. If a server deploy ever fails with an
auth error, check this first.

### Build-time vs runtime (important for a non-dev)

- **Website env vars (A)** are frozen at build time. If you change
  `VITE_SERVER_URL`, the live site keeps the old URL until Pages rebuilds.
  Trigger a redeploy after any change.
- **Server env/secrets (C)** are read when the server boots. Changing a Fly
  secret restarts the server with the new value.

---

## 1. The order to do this in (the critical path)

Do them **in this order** — each unlocks the next. Items marked *(prepare now,
wired later)* are safe to set up anytime but won't change the game yet.

1. **GitHub Actions secret `FLYIO_ACCESS_KEY`** — unlocks server deploys.
2. **Fly.io** — the game server exists at `bitrunners.fly.dev`.
3. **Cloudflare Pages** — the website, with `VITE_SERVER_URL` pointing at Fly.
4. **Cloudflare KV (`BOARD`)** — the writer board works.
5. **Supabase** — accounts/persistence (run the SQL migration; set 2 Pages vars).
6. **Resend** — magic-link/OAuth emails actually send (needs domain DNS).
7. **OAuth: Google, Microsoft, GitHub** — social login.
8. **Cloudflare Web Analytics** — privacy-first traffic stats *(can do now)*.
9. **Steam** — *(prepare now, wired later — needs a custom Worker, not built)*.
10. **Sentry** — error reporting *(prepare now, wired later)*.
11. **Upstash Redis** — aether persistence *(prepare now, wired later)*.
12. **Cloudflare R2** — profile images *(prepare now, wired later)*.
13. **Cloudflare Workers AI** — NSFW image moderation *(prepare now, wired later)*.
14. **Cloudflare Turnstile** — bot/abuse gate *(prepare now, wired later)*.
15. **Anthropic API** — LLM NPC "The Admin" *(prepare LAST — paid; needs a spend breaker)*.

**Steps 1–7 give you a fully working, account-enabled game. 8 is free and quick.
9–15 are preparation; they light up when the matching code phase lands.**

### STATUS legend

- ✅ **WIRED** — code reads this; setting it up changes the live product now.
- ⚠️ **ACCOUNT-ONLY** — safe to set up; **no code consumes it yet**; wiring is a future coding task.
- ⛔ **DEPRECATED** — do **not** set up; superseded by another service.

---

## 2. GitHub Actions secret — `FLYIO_ACCESS_KEY`  ✅ WIRED

**What:** the token the deploy robot uses to ship the server to Fly.
**Why:** every push to `main` that touches server code auto-deploys via
`.github/workflows/deploy-server.yml`. Without this secret, that fails.
**Cost:** free (GitHub Actions on a private repo includes a generous free tier).
**Depends on:** a Fly.io account/token (step 3 — do Fly first to get the token,
then come back and set this; they're a pair).

### Setup (click-by-click)

1. Get the token from Fly first (see **§3, "the deploy token"**).
2. GitHub → the `bitrunners` repo → **Settings** → **Secrets and variables** →
   **Actions** → **New repository secret**.
3. **Name:** `FLYIO_ACCESS_KEY` (exact — the workflow reads this name).
4. **Secret:** paste the Fly token. **Add secret.**

### Secret

| Name | Destination | Notes |
|---|---|---|
| `FLYIO_ACCESS_KEY` | **D — GitHub Actions secret** | The workflow maps it to `FLY_API_TOKEN` internally (`.github/workflows/deploy-server.yml`). **Do NOT put this in Cloudflare.** |

### Verify

- GitHub → repo → **Actions** tab → the **deploy-server** workflow → trigger it
  (push to `main` touching `apps/server/**`, or use **Run workflow**) → it
  should reach "Deploy" and finish green. A red auth error = wrong/missing secret.

---

## 3. Fly.io — realtime game server  ✅ WIRED

**What:** the always-on multiplayer server (Colyseus + Fastify), one small VM.
**Why:** the game's realtime sphere rooms run here; the website connects to it
over WebSocket. Auto-stops when idle to cost ~nothing.
**Free/cost:** Fly's small shared-CPU 256 MB machine with auto-stop is effectively
free at idle / pennies under light load. The cost cliff is scaling to many
always-on machines — not a near-term risk.
**Depends on:** nothing (do this first).

### Setup (click-by-click)

1. Create an account at **fly.io**. Install the CLI: `flyctl` (a.k.a. `fly`).
2. The app already exists in config as **`bitrunners`** (`fly.toml`, region `sjc`).
   First-time only: `fly apps create bitrunners` (skip if it already exists).
3. **The deploy token:** Fly dashboard → **Account / Tokens** (or
   `fly tokens create deploy -x 999999h`). Copy it. Put it in **§2** as the
   GitHub secret `FLYIO_ACCESS_KEY`. **Do not deploy from your laptop** — the
   GitHub workflow owns deploys.

### Config & secrets

| Name | Destination | Notes |
|---|---|---|
| `PORT` = `8080` | **C(i) — `fly.toml [env]`** (already committed) | Not a secret. |
| `LOG_LEVEL` = `info` | **C(i) — `fly.toml [env]`** (already committed) | Not a secret. |
| *(future)* `UPSTASH_REDIS_REST_URL` / `_TOKEN` | **C(ii) — Fly Secrets** | See §12. Not yet read by code. |
| *(future)* `ANTHROPIC_API_KEY` | **C(ii) — Fly Secrets** | See §15. Not yet read by code. |

There is **no secret to set for Fly to simply run** — `PORT`/`LOG_LEVEL` are
already in `fly.toml`. Real secrets only appear when §12/§15 get wired.

### Verify

- Visit **`https://bitrunners.fly.dev/health`** in a browser. Expect JSON like
  `{"ok":true,"uptimeMs":...,"protocol":1,"tickHz":15}`. (First hit may take a
  few seconds — the machine cold-starts from auto-stop.)
- `https://bitrunners.fly.dev/` returns a small JSON status object.

---

## 4. Cloudflare Pages — web host + CDN  ✅ WIRED

**What:** hosts and globally CDN-serves the website (the Vite/React/three.js
client) and the writer-board Functions.
**Why:** static-fast, free, edge-cached, integrates with KV and Functions.
**Free/cost:** Pages free tier (unlimited static requests, generous Functions
free tier). Effectively free at this scale.
**Depends on:** Fly (§3) for the value of `VITE_SERVER_URL`.

### Setup (click-by-click)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   connect the `bitrunners` GitHub repo.
2. Build settings: framework preset **Vite** (or: build command
   `pnpm -w build`, output dir `apps/web/dist`). Production branch: **`main`**.
3. **Settings → Environment variables → Production** — add the three below.
4. After adding/changing any of them: **Deployments → Retry/redeploy** (these
   are build-time — see §0).

### Secrets / env (all destination **A — Cloudflare Pages env, Production**)

| Name | Value | Wired by | Notes |
|---|---|---|---|
| `VITE_SERVER_URL` | `wss://bitrunners.fly.dev/` | `apps/web/src/network.ts` | Note **`wss://`** and the app name **`bitrunners`** (not `bitrunners-server` — that older value is wrong, see `docs/devlog/0021`). |
| `VITE_SUPABASE_URL` | from Supabase (§6) | `apps/web/src/supabase.ts` | Set after Supabase exists; safe to leave blank until then (auth just won't work yet). |
| `VITE_SUPABASE_ANON_KEY` | from Supabase (§6) | `apps/web/src/supabase.ts` | The **anon/public** key — never the service-role key. |

### Verify

- Open **`https://bitrunners.app`**. The game boots.
- Bottom-of-screen **net status badge**: `net: connected …` means
  `VITE_SERVER_URL` is correct and Fly is reachable. `net: offline ·
  VITE_SERVER_URL unset` means the Pages var is missing or the site wasn't
  rebuilt after setting it.

---

## 5. Cloudflare KV — board store  ✅ WIRED

**What:** key-value store backing the writer board (`/api/board/<slug>`).
**Why:** tiny, free, edge-fast; perfect for small collaborative text blobs.
**Free/cost:** KV free tier (generous daily reads/writes). Free at this scale.
**Depends on:** Cloudflare Pages (§4).

### Setup (click-by-click)

1. Cloudflare → **Workers & Pages → KV** → **Create namespace**. A namespace
   named `bitrunners-board` already exists (id
   `38395cc6954e4735a2b2d8fb0c37cbcc`) — use it; only create one if missing.
2. **Workers & Pages → bitrunners (Pages) → Settings → Functions → KV namespace
   bindings → Add binding.**
3. **Variable name:** `BOARD` (exact — `functions/api/board/[slug].ts` reads
   `env.BOARD`). **KV namespace:** `bitrunners-board`. Save.
4. Redeploy Pages so the binding takes effect.

### Secret / binding

| Name | Destination | Notes |
|---|---|---|
| `BOARD` | **B — Cloudflare Pages Functions KV binding** | Not an env var — a namespace binding. No string to paste. |

### Verify

- `curl https://bitrunners.app/api/board/test` → JSON (empty/default is fine, no
  500). Then open `https://bitrunners.app/#board/test`, type, reload — text
  persists. A 500 = binding missing/misnamed.

---

## 6. Supabase — auth + Postgres  ✅ WIRED (client) · migration is manual

**What:** user accounts (email magic-link + OAuth) and the Postgres database
(profiles, inventory, achievements, emoticron submissions, etc.).
**Why:** one service for identity + relational data, generous free tier, RLS
security model already designed in the migration.
**Free/cost:** free tier. **Cost cliff to know:** the free project **pauses
after ~7 days of inactivity** — a low-traffic game can get auto-paused. Mitigation:
a tiny keep-warm ping (tracked as a follow-up) or upgrading later.
**Depends on:** Cloudflare Pages (§4) for the two `VITE_` vars.
**Deep guide:** `docs/devlog/0026` has the long-form walkthrough; this section
is the canonical summary.

### Setup (click-by-click)

1. Create a project at **supabase.com** (note the project ref/region).
2. **SQL Editor** → paste the contents of
   `supabase/migrations/0001_initial_schema.sql` → **Run**. (Migrations are run
   **manually by you** in the SQL editor — there is no auto-migration in CI.)
3. **Project Settings → API** → copy **Project URL** and the **anon public** key.
4. Put them in **Cloudflare Pages env (Production)** as `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` (§4). Redeploy Pages.
5. **Authentication → URL Configuration** → set Site URL to
   `https://bitrunners.app` and add it to redirect allow-list.

### Secrets / env

| Name | Destination | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | **A — Pages env** | Public; safe in the client bundle. |
| `VITE_SUPABASE_ANON_KEY` | **A — Pages env** | The **anon** key only. |
| **service-role key** | **NOT in this repo / not in Pages** | Only ever used server-side (e.g. the future Steam Worker, §10). Never ship to the client. |

### Verify

- On `https://bitrunners.app`, the profile/login UI should attempt a real
  Supabase call (no "Supabase not configured" message). Magic-link email
  delivery itself needs **Resend (§7)**.

---

## 7. Resend — transactional email  ⚠️ ACCOUNT-ONLY (provider config, not repo code)

**What:** sends the auth emails (magic links, OAuth confirmations).
**Why:** Supabase's built-in email is rate-limited and not for production;
Resend is the SMTP provider Supabase will use.
**Free/cost:** free tier ~3,000 emails/month. Fine early.
**Depends on:** Supabase (§6) **and** DNS control of `bitrunners.app`.

> **STATUS note:** there is no Resend key in *our* code — Resend is configured
> **inside Supabase's dashboard** as the SMTP provider. So it's "account + provider
> config," not a repo secret.

### Setup (click-by-click)

1. Create a **resend.com** account. **API Keys → Create** (you'll paste it into
   Supabase, not the repo).
2. **Domains → Add `bitrunners.app`.** Resend shows DNS records (SPF, DKIM,
   sometimes a return-path/MX). Add them at your DNS host (Cloudflare DNS) and
   wait for "Verified."
3. Supabase → **Authentication → Emails / SMTP Settings** → enable custom SMTP →
   enter Resend's SMTP host/port/user and the **API key as the password**
   (per `docs/devlog/0026`). Set the from-address to your verified domain.

### Secret

| Name | Destination | Notes |
|---|---|---|
| Resend API key | **Supabase dashboard (SMTP password)** — *not* A/B/C/D | Lives in Supabase, not in this repo or any of the 4 destinations. |

### Verify

- Trigger a magic-link login on `https://bitrunners.app`. The email arrives
  (check spam first time). Resend dashboard → **Logs** shows the send. No email +
  Supabase auth log error = SMTP misconfigured or domain not verified.

---

## 8. OAuth — Google, Microsoft, GitHub  ⚠️ ACCOUNT-ONLY (configured in Supabase)

**What:** "Sign in with Google/Microsoft/GitHub."
**Why:** lower-friction login than email for many players.
**Free/cost:** free (provider developer consoles).
**Depends on:** Supabase (§6) and a verified domain (§7) for clean redirects.

> **STATUS note:** client IDs/secrets live **in Supabase's Auth providers
> config**, *not* in this repo. Nothing in our code changes per provider.

### Setup (click-by-click) — repeat per provider

1. Supabase → **Authentication → Providers** → pick the provider → it shows the
   **callback URL** (`https://<your-project>.supabase.co/auth/v1/callback`).
   Copy it.
2. In the provider console, create an OAuth app:
   - **Google:** Google Cloud Console → APIs & Services → Credentials → OAuth
     client ID (Web). Authorized redirect URI = the Supabase callback.
   - **GitHub:** GitHub → Settings → Developer settings → OAuth Apps → New.
     Authorization callback URL = the Supabase callback.
   - **Microsoft:** Azure Portal → App registrations → New. Redirect URI (Web)
     = the Supabase callback. (Use "common" tenant for personal + work accounts.)
3. Copy the provider's **Client ID + Client Secret** into the Supabase provider
   form. Enable. Save.

### Secret

| Name | Destination | Notes |
|---|---|---|
| Per-provider Client ID/Secret | **Supabase dashboard (Auth Providers)** | Not in repo / not A–D. |

### Verify

- Each provider button on `https://bitrunners.app` completes a round-trip and
  returns you logged in. "redirect_uri mismatch" = the callback URL in the
  provider console doesn't exactly match Supabase's.

---

## 9. Cloudflare Web Analytics — analytics  ⚠️ ACCOUNT-ONLY · privacy-first · quick & free

**What:** privacy-respecting traffic analytics (no cookies, no cross-site
tracking, no PII).
**Why:** matches the project's privacy posture; PostHog and cookie analytics
were explicitly rejected. Free.
**Free/cost:** free.
**Depends on:** the site being live (§4).

### Setup (click-by-click)

1. Cloudflare → **Analytics & Logs → Web Analytics → Add a site** →
   `bitrunners.app`.
2. Either enable the **automatic** setup (Cloudflare injects the beacon since
   DNS is on Cloudflare) **or** copy the beacon snippet/token to add to the site
   `<head>` (a small follow-up code task if you choose manual).

### Secret

| Name | Destination | Notes |
|---|---|---|
| Beacon token (only if manual) | **A — Pages env** as e.g. `VITE_CF_BEACON` *(if/when wired)* | Automatic mode needs **no secret at all**. |

### Verify

- Cloudflare → Web Analytics shows visits within a few minutes of real traffic.

---

## 10. Steam — login  ⚠️ ACCOUNT-ONLY · **needs a custom Worker (not built)**

**What:** "Sign in through Steam."
**Why:** you asked for it; it's the dominant identity for the eventual desktop
audience.
**Free/cost:** free (a Steam Web API key).
**Depends on:** Supabase (§6).

> **HONEST STATUS — read this:** Supabase **cannot** do Steam natively (Steam
> uses OpenID 2.0, which Supabase Auth doesn't support — see `docs/devlog/0026`).
> Steam login requires a **custom Cloudflare Worker** that (a) runs the Steam
> OpenID handshake, then (b) mints a Supabase session using the **service-role
> key** (server-side only). **That Worker does not exist yet.** You can get the
> API key now; the feature lights up when the Worker is built (a tracked coding
> task, not a dashboard toggle).

### Setup you can do now

1. Get a **Steam Web API key**: `https://steamcommunity.com/dev/apikey`
   (requires a Steam account; domain field can be `bitrunners.app`).
2. Hold it — do not paste it anywhere yet. When the Worker is built it will be a
   **Worker secret** (`wrangler secret put STEAM_WEB_API_KEY`), alongside the
   Supabase **service-role** key as a Worker secret.

### Secret (future)

| Name | Destination (future) | Notes |
|---|---|---|
| `STEAM_WEB_API_KEY` | **Cloudflare Worker secret** (new Worker) | Not A–D; a Worker has its own secrets store. |
| Supabase service-role key | **Cloudflare Worker secret** | Server-side only, ever. |

### Verify (future)

- N/A until the Worker exists. When built: the Steam button completes login and
  a Supabase user row appears.

---

## 11. Sentry — error reporting  ⚠️ ACCOUNT-ONLY (no code yet)

**What:** captures client (and later server) crashes/exceptions.
**Why:** errors-only, low-noise visibility; pairs with privacy-first analytics
(no product tracking).
**Free/cost:** free tier ~5k errors/month.
**Depends on:** site (§4) / server (§3).

> **STATUS:** no Sentry SDK in the code yet. Setting up the project is safe; it
> reports nothing until the SDK is wired (a future coding task).

### Setup (click-by-click)

1. **sentry.io** → create org/project. Pick platform: **React** (browser) — and
   later a **Node** project for the server.
2. Copy the **DSN** for each.

### Secret (when wired)

| Name | Destination | Notes |
|---|---|---|
| `VITE_SENTRY_DSN` | **A — Pages env** | Client DSN (DSNs are not high-secret but treat as config). |
| `SENTRY_DSN` | **C(ii) — Fly Secret** | Server DSN, when server reporting is added. |

### Verify (when wired)

- Throw a test error; it appears in Sentry within a minute.

---

## 12. Upstash Redis — aether persistence  ⚠️ ACCOUNT-ONLY (no code yet)

**What:** stores "aether" snapshots (a disconnected player's last
outfit/position drifting in-world).
**Why:** serverless, per-request pricing, scale-to-zero — fits the cost posture;
the Fly server keeps no durable state itself.
**Free/cost:** free tier, per-request. Effectively free early.
**Depends on:** Fly (§3) — the server reads it.

> **STATUS:** the server has a TODO for this in `apps/server/src/sphere-room.ts`
> (`onLeave`), but **no Redis client is imported yet**. Prepare the DB now;
> wiring is a Phase-2 coding task.

### Setup (click-by-click)

1. **upstash.com** → create a **Redis** database (pick a region near Fly `sjc`).
2. Copy the **REST URL** and **REST token**.
3. When wired, set them as **Fly Secrets**:
   `flyctl secrets set UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=...`

### Secret (when wired)

| Name | Destination | Notes |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | **C(ii) — Fly Secret** | Server-side only. |
| `UPSTASH_REDIS_REST_TOKEN` | **C(ii) — Fly Secret** | Server-side only. |

### Verify (when wired)

- Disconnect a player; reconnect within the TTL; the aether snapshot is restored.

---

## 13. Cloudflare R2 — profile images  ⚠️ ACCOUNT-ONLY (no code yet)

**What:** object storage for player profile images.
**Why:** S3-compatible, **zero egress fees** (big deal for image serving), same
Cloudflare ecosystem.
**Free/cost:** free tier ~10 GB storage; **no egress charges**.
**Depends on:** Cloudflare account (§4); gated behind moderation (§14) and the
age/consent gate.

> **STATUS:** no bucket referenced in code. Phase-3 feature.

### Setup (click-by-click)

1. Cloudflare → **R2 → Create bucket** (e.g. `bitrunners-profiles`).
2. Configure CORS for `bitrunners.app` when wired. Create a scoped **R2 API
   token** at wiring time.

### Secret (when wired)

| Name | Destination | Notes |
|---|---|---|
| R2 access key id / secret | **C(ii) — Fly Secret** or a Pages Function binding | Decided at wiring; server-mediated uploads preferred. |

### Verify (when wired)

- Upload a profile image; it persists and serves via the CDN.

---

## 14. Cloudflare Workers AI — NSFW image moderation  ⚠️ ACCOUNT-ONLY (no code yet)

**What:** runs an NSFW classifier on profile images as defense-in-depth.
**Why:** images are consent-gated and default-hidden; this is the automated
backstop. Same ecosystem.
**Free/cost:** Workers AI free allocation; small per-inference cost beyond it.
**Depends on:** R2 (§13) and the moderation/consent gate.

> **STATUS:** not in code. Phase-3, pairs with §13.

### Setup

1. Workers AI is enabled per Cloudflare account — no separate signup. At wiring
   time the classifier is called from a Worker/Function (binding, not a pasted
   key).

### Secret (when wired)

| Name | Destination | Notes |
|---|---|---|
| Workers AI binding | **Worker/Pages Function binding** | Binding, not an env secret. |

### Verify (when wired)

- An NSFW test image is flagged and blocked before becoming visible.

---

## 15. Cloudflare Turnstile — bot / abuse gate  ⚠️ ACCOUNT-ONLY (no code yet)

**What:** privacy-friendly CAPTCHA alternative on signup/sensitive actions.
**Why:** blocks bot signups without Google reCAPTCHA's tracking; same ecosystem.
**Free/cost:** free.
**Depends on:** site (§4) / Supabase (§6).

> **STATUS:** not in code yet.

### Setup (click-by-click)

1. Cloudflare → **Turnstile → Add site** (`bitrunners.app`). Get the **site key**
   (public) and **secret key** (server-side validation).

### Secret (when wired)

| Name | Destination | Notes |
|---|---|---|
| `VITE_TURNSTILE_SITE_KEY` | **A — Pages env** | Public site key, client widget. |
| `TURNSTILE_SECRET_KEY` | **C(ii) — Fly Secret** (or Pages Function) | Server-side verification only. |

### Verify (when wired)

- The widget appears on signup; tokens validate server-side; a missing/invalid
  token is rejected.

---

## 16. Anthropic API — LLM NPC "The Admin"  ⚠️ ACCOUNT-ONLY · 💸 **PAID** · do LAST

**What:** powers dynamic dialogue for The Admin NPC.
**Why:** the one genuinely smart NPC; everything else is scripted.
**Cost:** **this is the only real variable cost in the whole stack.** Usage-
based, no free tier of substance.
**Depends on:** everything else stable first.

> **HARD RULE (from `CLAUDE.md`):** this ships **inert behind a spend circuit-
> breaker**. Do not enable live LLM calls without a hard monthly budget cap and
> a kill switch. No breaker → don't wire it. Sealed-lore must never enter the
> system prompt.

### Setup (only when you're ready to spend)

1. **console.anthropic.com** → create an API key. **Set a billing/usage limit
   in the Anthropic console** as the outer safety net.
2. At wiring time the key is a **Fly Secret**; the server enforces an internal
   budget breaker *in addition to* the console limit.

### Secret (when wired)

| Name | Destination | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | **C(ii) — Fly Secret** | Server-side only, ever. Never in the client. |

### Verify (when wired)

- The Admin responds dynamically; the budget breaker trips correctly in a forced
  over-budget test (and the NPC falls back to scripted lines).

---

## 17. ⛔ Neon Postgres — DEPRECATED, do not set up

Older devlogs (`0002`, `0004`) list Neon as the database. **It is unused** —
zero code references; **Supabase Postgres (§6) is the committed database.**
Running both is two databases to keep alive for no benefit. **Do not provision
or wire Neon.** If a Neon project was created during early exploration, it can be
deleted once Supabase is confirmed working. (Recorded in `.claude/decisions.md`.)

---

## 18. Cost summary (sanity check against the scale-to-zero goal)

| Tier | Reality |
|---|---|
| **Idle (no players)** | ~$0–5/mo. Everything is free-tier or scale-to-zero. Fly auto-stops; Supabase free; Cloudflare free. |
| **Light traffic (≤500 DAU)** | ~$30–60/mo *if* paid features are on. The swing factor is **Anthropic (§16)** — gate it hard. |
| **The cost traps to watch** | (1) Anthropic usage with no breaker. (2) Supabase free project pausing after 7d idle (keep-warm follow-up). (3) Always-on Fly machines (don't disable auto-stop without reason). |
| **Deferred (not in this guide)** | **Stripe / payments** — excluded by request; it drags legal scaffolding (ToS, refund, tax) and will get its own doc when monetization is the active priority. |

---

## 19. Quick reference — every secret, one table

| Secret / binding | Destination | Status |
|---|---|---|
| `FLYIO_ACCESS_KEY` | **D** GitHub Actions secret | ✅ wired |
| `PORT`, `LOG_LEVEL` | **C(i)** `fly.toml [env]` (committed) | ✅ wired |
| `VITE_SERVER_URL` | **A** Pages env (Production) | ✅ wired |
| `VITE_SUPABASE_URL` | **A** Pages env | ✅ wired (set after §6) |
| `VITE_SUPABASE_ANON_KEY` | **A** Pages env | ✅ wired (set after §6) |
| `BOARD` | **B** Pages KV binding | ✅ wired |
| Resend API key | Supabase SMTP (not A–D) | ⚠️ provider config |
| OAuth client IDs/secrets | Supabase Auth providers (not A–D) | ⚠️ provider config |
| CF Web Analytics token | none (auto) / **A** if manual | ⚠️ quick, optional |
| `STEAM_WEB_API_KEY` + Supabase service-role | Cloudflare Worker secrets (new Worker) | ⚠️ needs Worker (not built) |
| `VITE_SENTRY_DSN` / `SENTRY_DSN` | **A** / **C(ii)** | ⚠️ not wired |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | **C(ii)** Fly Secrets | ⚠️ not wired |
| R2 keys | **C(ii)** Fly Secret / binding | ⚠️ not wired |
| Workers AI | binding | ⚠️ not wired |
| `VITE_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | **A** / **C(ii)** | ⚠️ not wired |
| `ANTHROPIC_API_KEY` | **C(ii)** Fly Secret | ⚠️ not wired · 💸 paid |
| Neon `DATABASE_URL` | — | ⛔ deprecated, do not set |

---

*Maintenance: when a service gets wired, change its STATUS here and update the
row in §19. This file — not the devlogs — is the source of truth for setup.*
