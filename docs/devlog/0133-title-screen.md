# 0133 — Title screen: Data Amalgam Inc.

## TL;DR

- New `TitleScreen.tsx` shown before the boot scroll (`Shell` phase
  chain is now title → boot → transition → game; LINK fires the
  existing boot/startup animation exactly as before).
- Copy is owner-authored canon, verbatim: pre-line "brought to you by
  Data Amalgam Inc.", ASCII block "bitrunners" logo, the neural-matrix
  subline, and the scrolling Neural Resplicing disclaimer ticker.
- `[ LINK ]` = start (glowing, reduced-motion safe). `[ account ]`
  opens a menu with log in / sign up / recover tabs. Recover =
  password reset AND resend-verification (shares the 0132 helper).
- In-game "change runner" still returns to the class grid directly —
  the title screen shows once per page load.

## Auth flow audit (owner ask)

- Signup → `emailRedirectTo` lands on `#auth/verified` → AuthCallback
  renders the friendly verified page; `detectSessionInUrl` consumes
  the token. ✓
- Password reset → `#auth/recovery` → AuthCallback reset form →
  `updatePassword`. ✓
- Resend verification (new, title screen + admin console) targets the
  same `#auth/verified` landing, so re-sent links behave identically
  to originals. ✓
- Gap to watch (dashboard, not code): Supabase Auth → URL
  Configuration must list `https://bitrunners.app` (and the write
  subdomain if desired) in Redirect URLs, or email links fall back to
  the Site URL. Owner-side check.

## Lore note

"Data Amalgam Inc." + the disclaimer are owner-authored (this brief).
Recorded here as canon-by-owner; not added to docs/lore/ index —
follow-up Q&A can place it properly.
