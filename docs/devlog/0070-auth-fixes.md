# 0070 — Auth fixes (verified landing, password reset, signup grant)

Branch: `claude/auth-verify-reset-grant`. Non-draft PR pending.

## Live user issues addressed

1. **Email verification links lead to `localhost`** — the link in the
   confirmation email comes from Supabase's email template, which uses
   the project's configured **Site URL**. If that's still set to
   `http://localhost:3000` (the dashboard default), every user's link
   resolves to localhost and dies on their device.
2. **No password reset surface.** Users blocked from logging in had no
   way to recover, especially when their verification email was stuck in
   junk and the link didn't work anyway.
3. **No reward signal on signup** — creating an account felt the same as
   playing as a guest, with no incentive to verify the email.

## What this lands (code)

- **`apps/web/src/AuthCallback.tsx`** — friendly landing page for two
  hash routes: `#auth/verified` (welcome card after successful sign-up
  verification) and `#auth/recovery` (set-new-password form for users
  who clicked a reset link). Both fall back to a clear "link expired"
  card after ~1.2 s if Supabase's `detectSessionInUrl` didn't establish
  a session.
- **`apps/web/src/App.tsx`** — extended hash-routing to recognize the
  two auth routes alongside the existing `#board/<slug>` route. Renders
  `<AuthCallback route="verified|recovery" />` for those.
- **`apps/web/src/supabase.ts`** — `signUpWithEmail` now passes
  `emailRedirectTo: ${origin}#auth/verified` so verifications land on
  the dedicated page. New `requestPasswordReset(email)` calls
  `auth.resetPasswordForEmail` with `redirectTo:
  ${origin}#auth/recovery`. New `updatePassword(newPassword)` for the
  recovery form to call.
- **`apps/web/src/ProfileIcon.tsx`** — `AccountSection` gains a third
  `reset` tab (and a "forgot your password?" inline link from the
  sign-in form) that emails a reset link. A small `auth-notice` block
  surfaces "check your email" copy after sign-up and reset requests.
- **`apps/web/src/signup-grant.ts`** — new. Watches auth state; on the
  first authenticated event for a given Supabase user id, awards
  `+250 credits` and `+2 tokens`. Stored as `bitrunners.signup-grant.v1`
  in localStorage keyed by user id, so the grant fires once per
  (account, device) pair and survives sign-out / sign-in. App.tsx boots
  the watcher with `startSignupGrant()` alongside the other startup
  hooks.
- **`apps/web/src/style.css`** — `.auth-callback`, `.auth-callback-card`,
  `.auth-callback-glyph`, `.auth-callback-title`, `.auth-callback-body`,
  `.auth-callback-cta`, plus `.auth-link`, `.auth-notice` for the new
  surfaces. All sizes use `clamp()` so they read on phone + desktop
  without separate breakpoints.

## ⚠️ Owner action required (Supabase dashboard config)

The "links go to localhost" problem is a **server config** issue. The
code above ensures the link points to the right *path*, but the *host*
is whatever Supabase has under **Auth → URL Configuration → Site URL**.
Set it to `https://bitrunners.app` (or your prod URL). While you're
there:

1. **Site URL** — `https://bitrunners.app`.
2. **Redirect URLs (allow list)** — add `https://bitrunners.app/**` and
   `https://*.pages.dev/**` (so Cloudflare preview deploys also work).
3. **Email Templates → Confirm signup** — check the `{{ .ConfirmationURL
   }}` token is intact; do NOT hard-code `localhost` anywhere.
4. **Email Templates → Reset password** — same check; the link comes
   here, not from the confirm template.

After the config change, existing un-clicked verification emails will
still point at the old host. Users with bad links can use the new
"forgot password?" or just request a new email by trying sign-up again
with the same address (Supabase will resend the verification).

## Verification (planned)

- `pnpm typecheck`, `pnpm lint`, `pnpm build` — local + CI.
- Manual: create a new account on the preview deploy, click the
  verification link in the email, land on the friendly `#auth/verified`
  page, see the signup grant toast (+250 ¢ / +2 ◈) once the scene loads.
- Manual: click "forgot your password?" → email arrives → click link →
  set new password → "password updated ✓" → sign back in with new
  password.

## What's deferred to follow-up PRs

- "Custom name" free-text approval queue not surfacing for owner review
  even with migration applied — debug pass in PR 84.
- Emote approval queue not picking up new submissions — debug pass in
  PR 84.
- Bold + solid/gradient/glow username styling for verified accounts —
  separate PR (badge-menu split, PR 79).

## No new dependencies. No protocol bump. No schema change.
