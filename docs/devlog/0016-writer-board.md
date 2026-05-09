# 0016 — Hidden writer board with KV-backed editor

**Date:** 2026-05-09

Owner asked for a hidden URL on the live site that loads the writer primer in a basic text editor, with edits saved server-side so the owner and a writer collaborator can iterate together.

## Architecture

- **Hidden URL via hash routing**: `bitrunners.app/#board/<slug>`. Hash isn't sent to the server, so the SPA's existing `_redirects` rule still works, no Pages routing changes. The slug is the bearer token — anyone with the URL can read and write. Security model: long random slug = unguessable.
- **Storage**: Cloudflare KV namespace `bitrunners-board` (id `38395cc6954e4735a2b2d8fb0c37cbcc`, created via the Cloudflare MCP). Free tier covers thousands of saves/day.
- **API**: Cloudflare Pages Functions at `functions/api/board/[slug].ts`. GET reads from KV, PUT writes. Auto-discovered by Pages from the repo-root `functions/` directory; deploys with the Pages build, no separate Wrangler step.
- **Editor**: a React component in `apps/web/src/Board.tsx`. Plain `<textarea>` (no fancy editor lib — keeps the bundle small). Debounced auto-save 2.5 s after idle, plus a manual `save` button and a `download .md` button. First-load fetches `/PRIMER-FOR-WRITERS.md` (copied into `apps/web/public/`) when KV returns empty so the writer starts with the canonical primer rather than a blank page.

## Slug

The board lives at `#board/epSBiUiUwax33cIOM9-jtGgt`. 24 base64url chars, generated from `crypto.randomBytes(18)` — about 144 bits of entropy. Cannot reasonably be guessed; can only be reached via the URL itself.

If owner wants to rotate the slug later: just generate a new one and visit it. Old slug's content stays in KV until manually deleted.

## API contract

```
GET  /api/board/:slug           → 200 (markdown body, may be empty) | 404 (bad slug) | 503 (KV not bound)
PUT  /api/board/:slug           → 200 ({ ok: true, savedAt, bytes }) | 413 (>512 KB) | 503
OPTIONS /api/board/:slug        → 204
```

Slug validation: 16+ chars, `[A-Za-z0-9_-]+` only. Anything else returns 404 — keeps the KV from being polluted by drive-by probes.

Body size cap: 512 KB. Generous for a markdown doc.

`cache-control: no-store` on every response so freshly-saved edits show up immediately on the collaborator's reload.

## Editor UX

- **Header bar**: title, live status (`Loaded` / `Editing…` / `Saving…` / `Saved 14:23:01` / failure messages), `save` button, `download .md` button
- **Body**: full-screen `textarea` with terminal-green caret, dark background, monospace font. `tab-size: 2` so tabs render reasonable width.
- **Footer**: char count + auto-save reminder
- **Auto-save**: 2.5 s debounce after the last keystroke. Manual save button bypasses the debounce.
- **First-load priming**: if KV returns empty, the editor fetches `/PRIMER-FOR-WRITERS.md` and pre-fills the textarea, then marks dirty so the auto-save commits it on next idle. Writer starts with the canonical primer, not a blank page.

## One step the owner needs to do — bind KV in Pages dashboard

I created the KV namespace via MCP but I cannot bind it to the Pages project from here — that requires dashboard access. The Pages Function checks for the binding at request time and returns a clear `503` message if it's missing, with instructions for the owner.

To bind:

1. Cloudflare dashboard → Pages → bitrunners project → **Settings** → **Functions**
2. Scroll to **KV namespace bindings**
3. Click **Add binding**
4. **Variable name**: `BOARD` (this exact string — the function reads `env.BOARD`)
5. **KV namespace**: select `bitrunners-board` from the dropdown
6. Save → trigger a redeploy (push any small change, or hit "Retry deployment" on the latest deploy)

Until that step, visiting the board URL shows the message *"KV binding missing — owner must wire it in Pages dashboard"* in the editor's status bar.

## What I deliberately did not build

- **Realtime collab (operational transforms / CRDTs)**: too much for one round. Last write wins. If owner and writer edit simultaneously without coordinating, one will overwrite the other. For an async brainstorming board this is fine; tell the writer to refresh before editing.
- **Auth / per-user history**: there's no auth at all — slug is the only access. KV stores a single value per slug; no diffs/history kept.
- **Markdown preview pane**: textarea-only. Writer can copy-paste output to a markdown viewer if they want a render.
- **Multiple boards** at different slugs: technically supported by the API (any 16+ char slug works), but only the one is documented. Owner can spin up additional ones by visiting new random URLs.

## Build

- 30 files lint clean
- Build green; bundle 643.27 → 660.76 kB (+17 kB for the React Board component + auto-save logic)

## Files added / changed

- `functions/api/board/[slug].ts` — Pages Function (new)
- `apps/web/src/Board.tsx` — editor component (new)
- `apps/web/src/App.tsx` — hash-router decision between Game and Board
- `apps/web/src/style.css` — board UI styles
- `apps/web/public/PRIMER-FOR-WRITERS.md` — copy of the primer for the client to seed the editor on first load

## URL to share with the writer

After the KV binding is wired:

```
https://bitrunners.app/#board/epSBiUiUwax33cIOM9-jtGgt
```

Anyone with that URL can read and edit. Don't share publicly.
