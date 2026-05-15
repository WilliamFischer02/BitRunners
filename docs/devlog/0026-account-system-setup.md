# 0026 — Account system scaffold + Supabase / Resend setup guide

**Date:** 2026-05-15

Owner has the Supabase project created and Resend DNS connected — keys not generated yet, no SQL run yet. This commit:

- Ships the **client-side scaffold** (Supabase client, account section in profile panel with Google / GitHub / Microsoft / email-password sign-in) **gated on env-var presence** so the live site keeps working unauthenticated
- Ships the **SQL schema migration** at `supabase/migrations/0001_initial_schema.sql` for the owner to run when ready
- Ships a **leaner robot rig** for the bit_spekter character (item 5 from the backlog)
- Fixes the tab title from "BitRunners — Stage A" → "BitRunners"
- This guide walks through everything in order

## Tab title

`apps/web/index.html` updated. Browser tab now reads just "BitRunners".

## Robot rig redesign (item 5)

The rig is leaner and more articulated, Marathon-Rook-style without the licensing:

- Smaller helmet (sphere radius 0.34 → 0.26)
- **Antenna** on top of the head with a tip
- Narrower neck segment between head and torso
- Torso shrunk: 0.78 wide → 0.55 wide, 0.46 deep → 0.32
- **Two-segment chest plate** (top accent + bottom dark)
- **Shoulder pads** outside the torso
- Arms split into upper + elbow + lower + hand (was just arm + hand)
- Legs split into thigh + knee + shin + boot (was just leg + boot)
- All limb widths thinned ~30 %

Walk animation still rotates `armPivotL/R` and `legPivotL/R` so all sub-segments swing as a unit; the elbows/knees don't articulate independently (Phase-3 polish if we want it).

## Account system architecture

### Stack

- **Auth provider**: Supabase Auth — handles OAuth (Google / GitHub / Microsoft via `azure` provider) + email-password, session storage, refresh tokens. No custom auth code on our side.
- **Postgres**: Supabase Postgres — stores `profiles`, `inventory`, `equipped_outfit`, `achievements`, `samaritan_status`, `emoticron_submissions`, `unlocked_emoticrons`. Row-Level Security so users can only read/write their own data.
- **Transactional email**: Resend, wired in as Supabase's custom SMTP provider for the email-confirm / password-reset / magic-link flows. Custom domain emails (e.g. `noreply@bitrunners.app`) once the Resend DNS verification is complete.
- **Auth callback**: redirects back to `https://bitrunners.app/`. Supabase's `detectSessionInUrl: true` parses the hash on return.

### Why these providers

- **Google** — most ubiquitous, easy OAuth setup
- **GitHub** — best fit for the developer-audience the game targets early; substitutes for Steam (Steam uses OpenID 2.0 which Supabase doesn't natively support; we can wire it as a custom provider later if owner wants)
- **Microsoft** — via Supabase's `azure` provider (Microsoft entra ID / personal accounts); covers Outlook / Xbox / corporate users
- **Email + password** — fallback for users without any of the above

### Schema overview

See `supabase/migrations/0001_initial_schema.sql` for the full file. Tables:

| Table | Purpose |
|---|---|
| `profiles` | display_name (10 char max) + approval status (`unset / pending / approved / rejected`) |
| `inventory` | items the user owns (item_id, item_type ∈ outfit/consumable/key/cosmetic) |
| `equipped_outfit` | JSONB map of slot → item_id currently worn |
| `achievements` | unlocked achievement_id with faction (`admin` / `company`) |
| `samaritan_status` | corporate + bitrunner reputation counters |
| `emoticron_submissions` | custom 2-word combos awaiting owner approval |
| `unlocked_emoticrons` | base 8 + approved custom emoticrons available to play |

RLS policies: users can SELECT/INSERT/UPDATE their own rows only. Approvals (display name + emoticron) happen via the service-role key (owner). New-user trigger seeds the 8 base emoticrons automatically.

### Client scaffold shipped this commit

- `apps/web/src/supabase.ts` — singleton client, env-gated via `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`. Exposes `subscribeAuth`, `signInWithProvider`, `signInWithEmail`, `signUpWithEmail`, `signOut`, `isAuthConfigured`.
- `apps/web/src/ProfileIcon.tsx` — new `AccountSection` component. Three states:
  - **Auth not configured** → placeholder text + disabled sign-in button (current state)
  - **Authenticated** → email + truncated user id + sign-out button
  - **Guest with auth configured** → three OAuth buttons (`google`, `github`, `microsoft`) + email/password form toggle

The session persists in localStorage via Supabase's default. After OAuth redirect, the next page load detects the session and the panel flips to authenticated.

## Step-by-step setup guide (owner action)

Do these in order. Total time ≈ 25 minutes including the OAuth dev console visits.

### Step 1 — Apply the SQL schema

1. Open your Supabase project → **SQL Editor** → **New query**
2. Copy the contents of `supabase/migrations/0001_initial_schema.sql` from this repo and paste
3. Click **Run**
4. Verify tables appear under **Table Editor**: `profiles`, `inventory`, `equipped_outfit`, `achievements`, `samaritan_status`, `emoticron_submissions`, `unlocked_emoticrons`

The migration is idempotent (uses `CREATE … IF NOT EXISTS` and `DROP POLICY IF EXISTS`), so re-running is safe.

### Step 2 — Get Supabase API keys

1. Supabase dashboard → **Project Settings** → **API**
2. Copy:
   - **Project URL** (looks like `https://abcdefg.supabase.co`)
   - **anon public key** (safe for the client, RLS-bound)
   - **service_role secret** (server-only, bypasses RLS — store carefully, used later for the moderation tool)

### Step 3 — Wire env vars in Cloudflare Pages

1. Cloudflare dashboard → Pages → **bitrunners** → Settings → **Environment variables**
2. Add two **plaintext** vars to the **Production** environment:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon public key
3. Click **Save**
4. Deployments → **Retry deployment** on the latest (or push any commit) so Pages rebuilds with the new env baked in

### Step 4 — Resend SMTP for transactional email

This makes Supabase send password-reset / email-confirm / magic-link emails through your Resend account, branded from `@bitrunners.app`.

1. Resend dashboard → **API Keys** → **Create API Key**, scoped to **Send access** for the `bitrunners.app` domain. Copy the key (starts with `re_`).
2. Supabase dashboard → **Project Settings** → **Auth** → **SMTP Settings**
3. Toggle **Enable Custom SMTP**
4. Fill in:
   - **Sender email**: `noreply@bitrunners.app`
   - **Sender name**: `BitRunners`
   - **Host**: `smtp.resend.com`
   - **Port**: `465`
   - **Username**: `resend`
   - **Password**: paste the Resend API key
   - **Minimum interval**: leave default
5. Click **Save** → **Send test email** to verify

If the test fails: confirm Resend has the `bitrunners.app` domain marked **Verified** (DKIM + SPF + DMARC). You said DNS is connected — Resend's domain page will show all three as green ticks if it's fully done.

### Step 5 — URL configuration in Supabase

1. Supabase → **Authentication** → **URL Configuration**
2. **Site URL**: `https://bitrunners.app`
3. **Redirect URLs** (add both):
   - `https://bitrunners.app`
   - `http://localhost:5173` (for `pnpm dev`)

### Step 6 — Google OAuth provider

1. Visit <https://console.cloud.google.com> → create a new project (or use existing)
2. **APIs & Services** → **Credentials** → **Create credentials** → **OAuth client ID**
3. App type: **Web application**
4. **Authorized redirect URIs**: `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - Get the exact URL from Supabase → Auth → Providers → Google (it shows the callback there)
5. Copy the generated **Client ID** + **Client secret**
6. Back in Supabase → **Authentication** → **Providers** → **Google** → enable, paste Client ID + secret, save

### Step 7 — GitHub OAuth provider (substitute for Steam)

1. Visit <https://github.com/settings/developers> → **OAuth Apps** → **New OAuth App**
2. **Homepage URL**: `https://bitrunners.app`
3. **Authorization callback URL**: same Supabase callback URL as above (from Auth → Providers → GitHub)
4. Register, then **Generate a new client secret**
5. Supabase → Authentication → Providers → **GitHub** → enable, paste Client ID + secret

> **Steam**: Steam uses OpenID 2.0, not OAuth 2.0, so it can't be wired directly into Supabase's provider list. The clean path is a small Cloudflare Worker that handles the Steam OpenID dance and exchanges the result for a Supabase session via the service-role key. Filed as a follow-up — happy to ship it as a separate commit when you want Steam specifically.

### Step 8 — Microsoft (Entra ID) OAuth provider

1. Visit <https://entra.microsoft.com> (or the Azure portal) → **App registrations** → **New registration**
2. Name: `BitRunners`, supported account types: **Personal Microsoft accounts** (or pick the broader option if you want corporate logins too)
3. **Redirect URI** (Web): same Supabase callback URL
4. After creation: **Certificates & secrets** → **New client secret** → copy the value
5. **API permissions** → **Microsoft Graph** → **User.Read** (default is fine)
6. Supabase → Authentication → Providers → **Azure** → enable, paste Application (client) ID + secret

### Step 9 — Verify end-to-end

1. Open `bitrunners.app` (after Step 3's Pages redeploy completes)
2. Click the profile button top-right
3. Account section should now show three OAuth buttons + email form
4. Click **[ google ]** → Google consent screen → back to bitrunners.app
5. Reopen profile panel → should show your email and a sign-out button
6. In Supabase → Table editor → `profiles` → you should see a new row with your user id
7. Same row in `equipped_outfit`, `samaritan_status`, and 8 rows in `unlocked_emoticrons` (from the trigger)

If anything fails at this step, the AccountSection in the panel surfaces the Supabase error message inline.

## What's still deferred

| # | Item | Next step |
|---|---|---|
| 3c | Tendrils particles | Particle pool in `packages/game-core` |
| 11 (full) | Name input + owner approval queue | Wire in a separate commit once owner has been signed in once and we have the admin tooling |
| 12 | 20 achievements | Owner answers "what 10 things does each faction reward" |
| 13 | Admin-hacks-on-obelisk dialogue | Dialogue UI component + emoticron-keyed branching; lands after (12) |
| Steam OAuth | Custom worker for OpenID 2.0 → Supabase session exchange |

## Build

- 39 files lint-clean
- Typecheck green
- Bundle size +~85 kB for `@supabase/supabase-js` (lazy-loaded with the AccountSection? no, currently in the main chunk; will code-split if it matters)

## Files added / changed

- `apps/web/index.html` — title
- `apps/web/package.json` — `@supabase/supabase-js@^2.47.10`
- `apps/web/src/supabase.ts` — auth client + helpers (env-gated)
- `apps/web/src/ProfileIcon.tsx` — `AccountSection` with three states
- `apps/web/src/style.css` — auth UI styles
- `apps/web/src/scene.ts` — leaner robot rig
- `supabase/migrations/0001_initial_schema.sql` — full schema + RLS + new-user trigger

## What's next

Once you complete Step 9 (verified end-to-end), tell me which to take:

1. **Display-name input + approval queue** (item 11 full)
2. **Achievement design Q&A** (item 12)
3. **Admin-hacks-on-obelisk dialogue event** (item 13)
4. **Tendrils particles** (item 3c)
5. **Steam OpenID worker**
