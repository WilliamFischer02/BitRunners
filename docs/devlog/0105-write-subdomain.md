# 0105 — `write.bitrunners.app` subdomain for the writer board

## TL;DR

- `write.bitrunners.app` now lives as a second custom domain on the
  bitrunners Cloudflare Pages project (added in the dashboard — no
  code on the DNS side).
- `apps/web/src/App.tsx` `readRoute()` learned a hostname-based board
  route: on `write.bitrunners.app`, the first pathname segment is
  treated as the slug. `write.bitrunners.app/<slug>` → board.
- `apps/web/public/_redirects` already had the SPA catch-all
  (`/* /index.html 200`), so deep paths under the new subdomain don't
  404.

## URLs

| URL | Resolves to |
| --- | --- |
| `https://bitrunners.app/` | Game shell (unchanged) |
| `https://bitrunners.app/#board/<slug>` | Board (unchanged) |
| `https://write.bitrunners.app/<slug>` | Board (new) |
| `https://write.bitrunners.app/` | Game shell (fallback — see below) |

Slug rules unchanged: ≥16 chars, `[A-Za-z0-9_-]+`, enforced by the
Pages Function at `functions/api/board/[slug].ts`. Anything after the
first `/` is dropped client-side before the API hit.

## Why this approach (and what I didn't do)

- **Same SPA bundle, two hostnames.** No second deploy, no second KV
  binding, no router rewrite. The Cloudflare Pages project handles
  both domains identically; only the SPA's `readRoute()` cares about
  which hostname it loaded on. This keeps cost flat (custom domains
  are unmetered on the Pages free tier).
- **No landing page on `/`.** Hitting `write.bitrunners.app/` with no
  slug falls through to the game shell. That's acceptable — anyone
  reaching the writer subdomain already has a slug from their editor.
  A dedicated landing card was out of scope.
- **No `write--<branch>.bitrunners.pages.dev` handling.** Branch
  previews still load the game shell at `/` and the board at
  `#board/<slug>`; the hostname check is intentionally exact-match
  on prod.

## Follow-ups

- If we later want `write.bitrunners.app/` to show a primer page
  instead of the game, swap the fallback in `readRoute()` to return a
  new `{ kind: 'writer-landing' }` surface and render a small intro
  component.
- Consider a `write.bitrunners.app/new` endpoint that mints a fresh
  slug and redirects. Cheap; punt until a writer asks for it.
