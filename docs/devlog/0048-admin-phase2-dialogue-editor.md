# 0048 — Admin console phase 2: dialogue editor

**Date:** 2026-05-25
**Branch:** `claude/bitrunners-collaboration-EcqBv`

Second admin phase (after the under-construction switch): the owner can edit
scripted NPC dialogue and save it for all players.

## What shipped

- **`supabase/migrations/0004_dialogue.sql`** (new — **owner runs it**): a
  `dialogue(key, lines JSONB, updated_at)` table. RLS: **world-readable**
  (dialogue is player-facing), **admin-write only** (via `is_admin()` from
  migration 0003). Admin-authored text is exempt from the no-free-text rule
  (owner-only).
- **`dialogue.ts`** (new registry + loader): 12 editable entries with in-code
  defaults — the Admin encounter (opening + 4 emote replies) and SAMM
  (greeting, insufficient, and the 5 outcome quips). `getLines()` / `getLine()`
  return the admin **override if present, else the default**, so the table only
  stores what's been edited. `initDialogue()` fetches overrides once at startup;
  `listDialogue()` / `saveDialogue()` are the admin-editor hooks.
- **Wiring:** `AdminDialogue.tsx` reads `getLines('admin.*')`; `samm.ts` now
  returns a **`quipKey`** instead of quip text (so it stays network-isolated),
  and `Samm.tsx` resolves the text via `getLine()`. Defaults match the previous
  hardcoded copy exactly → zero behaviour change until an override is saved.
- **Admin editor:** the `⚙ admin` panel gained a **`$ dialogue`** section —
  pick an entry, edit lines (one per row) in a textarea, save. Writes go through
  the admin-gated RLS.
- `main.tsx` calls `initDialogue()` at startup.

## Security / isolation

Dialogue writes are **server-enforced** (admin RLS), not client-trusted —
consistent with the phase-1 model. `samm.ts` keeps its "economy-only import"
isolation (it emits a key, never imports the dialogue/network layer). `dialogue.ts`
is the only new module that touches Supabase.

## Owner action

Run **`supabase/migrations/0004_dialogue.sql`** in the Supabase SQL editor.
(Requires migration 0003 + your `role='admin'` already done.)

## Honest status

- Gates green: `pnpm lint` clean (53 files), `pnpm typecheck` 8/8,
  `pnpm build` 5/5.
- **Not verifiable headless** — verify live: with your admin account, the
  `$ dialogue` editor lists entries, editing + saving sticks across reload, and
  the new text shows in the Admin encounter / SAMM for a normal account.
  Overrides load at startup, so an edit appears for other players on their next
  load (not mid-session live).
- Client + manual migration → **Pages-only deploy, no Fly.**
- Next admin phases: **user table + token/credit grants** (needs admin-read RLS
  + auth.users email access via a view/function + server-authoritative economy
  for grants), then **activity stats** (session logging + chart).

## Files

`apps/web/src/dialogue.ts` (new), `AdminConsole.tsx` (dialogue editor),
`AdminDialogue.tsx` + `samm.ts` + `Samm.tsx` (read from registry),
`apps/web/src/main.tsx` (init), `apps/web/src/style.css`,
`supabase/migrations/0004_dialogue.sql` (new), this devlog,
`.claude/decisions.md`, `.claude/handoff.md`.
