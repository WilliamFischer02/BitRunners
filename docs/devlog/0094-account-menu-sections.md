# 0094 — Account/runner menu reorganization (mega-batch 4.6)

**Date:** 2026-06-16
**Branch:** `claude/mega-batch-2026-06-16`
**Type:** P2 visual redesign · CSS/markup only (Pages-only deploy)

## Change

Reorganized the profile/runner panel (`ProfileIcon.tsx` → `ProfilePanel`)
from an ad-hoc section order into the clear functional taxonomy the brief
specified, reusing the existing `.panel` / `.panel-section` /
`.panel-section-title` / `.panel-row` styling (no new CSS):

- **`$ identity`** — handle (live `display_name`), class, equipped badge,
  equipped theme, and the *change runner* switch. (Was `$ stack`.)
- **`$ samaritan`** — corporate / bitrunner scores. (Was
  `$ samaritan status`, moved up next to identity.)
- **`$ account`** — unchanged `AccountSection` (email, signed-in status,
  sign-out, or the auth form for guests).
- **`$ economy`** — credits, tokens, items owned.
- **`$ settings`**, **`$ room`** — unchanged.
- **`$ debug`** (new, bottom) — truncated user UUID, session state, joined
  room id, and server host (parsed from `VITE_SERVER_URL`).

The handle reflects the most-recent approved display name via the identity
store wired up in 4.2. Stale footer copy ("placeholder until account system
lands") removed.

## Verify (owner)

Open the profile panel signed-in and signed-out. Sections should read as
distinct groups with `$ ` headers; `$ identity` shows your handle + class +
badge + theme; `$ debug` shows your uuid8, room id, and server host.

## Files

- `apps/web/src/ProfileIcon.tsx`
