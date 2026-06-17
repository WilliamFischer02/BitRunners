# 0090 — Account/runner panel shows live identity while signed in (mega-batch 4.2)

**Date:** 2026-06-16
**Branch:** `claude/mega-batch-2026-06-16`
**Type:** P0 bug

## Symptom

Even with an `authenticated` Supabase session, the profile/runner panel
showed the guest placeholder and a stale (or wrong) username:

- Floating profile button showed the email local-part, not the runner's
  display name.
- `$ stack` → `session` row was hardcoded to `guest · no user_id`
  regardless of auth state.

## Root cause

The pieces existed but weren't wired into the panel:

- `profile.ts` already re-fetches `fetchMyIdentity()` on every
  `subscribeAuth` flip and `UsernameEditor` already calls
  `refreshIdentity()` after a submit — so the cached identity *was* fresh.
- But `ProfileIcon` never subscribed to it. The floating status read
  `auth.user.email` and the panel's session row was a literal string.

## Fix

- **Floating button** now subscribes to `subscribeIdentity` and renders
  `// {displayName}`, with a trailing `·` marker while a signed-in name is
  still pending review. Updates the moment auth resolves.
- **`$ stack`** gains a `handle` row (live `displayName`) and the
  `session` row now shows the truncated user UUID + state:
  `xxxxxxxx · signed in` when authenticated, `guest · offline` otherwise
  (no more `no user_id`).
- Confirmed the editor save path already invalidates the cache via
  `refreshIdentity()` (UsernameEditor.tsx:117), so an approved name
  renders without a reload. Left a note here rather than duplicating the
  call.

The fuller sectioned redesign of this panel (`$ identity` / `$ samaritan`
/ `$ account` / `$ debug`) is task 4.6 and builds on this correctness
fix.

## Verify (owner)

1. Sign in. → Floating button shows `// <your handle>`; profile panel
   `$ stack` shows your handle + `<uuid8> · signed in`.
2. Open the runner-identity editor, submit a new handle. → Status flips to
   `pending` immediately (no reload).
3. Sign out. → Button shows `// runner_xxxxxx`; session row `guest ·
   offline`.

## Files

- `apps/web/src/ProfileIcon.tsx`
