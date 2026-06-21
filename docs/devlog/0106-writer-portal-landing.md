# 0106 — Writer portal landing at write.bitrunners.app/

## TL;DR

- `write.bitrunners.app/` no longer falls through to the game shell — it
  renders a `BoardsLanding` surface listing every board in the KV
  namespace plus an `+ add board` button.
- `+ add board` mints a 16-char URL-safe random slug
  (`crypto.getRandomValues` → base64) and navigates to `/{slug}`. The
  board is created lazily on first save by the existing PUT handler.
- Direct slug nav unchanged: `write.bitrunners.app/<slug>` still opens
  that board with no detour.
- New Pages Function `functions/api/board/index.ts` exposes
  `GET /api/board` → `{ slugs: string[], complete: boolean }`. Capped
  at the first 1000 entries; pagination deferred until we need it.

## What got added

- `functions/api/board/index.ts` — listing endpoint. Reads
  `env.BOARD.list({ limit: 1000 })`, returns names + a `complete`
  boolean so the client can warn if there are more boards than shown.
- `apps/web/src/BoardsLanding.tsx` — landing component. Fetches the
  list on mount, renders rows as `<a href="/{slug}">` so right-click
  open-in-new-tab works. Add button uses `crypto.getRandomValues(12)`
  and url-safe base64 to mint slugs that match the API's
  `MIN_SLUG_LENGTH = 16` + `[A-Za-z0-9_-]+` rule.
- `apps/web/src/App.tsx` — new `{ kind: 'boards-landing' }` route
  surface returned when on `write.bitrunners.app` with empty
  pathname. Lazy chunk to keep the main bundle slim.
- `apps/web/src/style.css` — `.boards-landing*` classes mirroring the
  existing `.board*` terminal aesthetic.

## Privacy / trade-off

The slug-as-secret model is intentionally relaxed by this change.
Before: knowing a slug was the only way to read or edit a board.
After: anyone visiting `write.bitrunners.app/` can enumerate every
slug and edit it.

Owner chose the public-list model after the trade-off was flagged.
Acceptable today because boards are intended to be a shared writers'
portal, not private workspaces. If individual boards ever need to be
private, the right next step is a per-board `visibility` flag stored
alongside the content in KV (or a follow-up auth-gated model — see
the asked-and-rejected option in the original prompt).

## What I didn't do

- **Titles / excerpts in the list.** Would require parsing each
  board's markdown for an H1 or storing a `title` field on save.
  Skipped — slug-only is enough for v1; nothing in the API stores
  titles separately yet.
- **Last-modified timestamps.** Would require recording metadata on
  PUT. Cheap to add later, not needed for the v1 list.
- **Pagination.** The endpoint returns up to 1000 keys with a
  `complete` flag. We'll wire cursor pagination when we cross 500
  boards.
- **Rename / delete affordances.** Out of scope. Today: create new,
  navigate to existing, edit. Trash can comes later.
