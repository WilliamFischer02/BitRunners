# 0018 — Three tracks: code splitting, Stage B v0.2 normals, Phase 1/2 server scaffold

**Date:** 2026-05-10

Owner asked to proceed with the three queued items. All three land in this commit.

## #3 — Per-route code splitting

`apps/web/src/App.tsx` now uses `React.lazy` + `Suspense` for the `Board` component:

```ts
const Board = lazy(() => import('./Board.js').then((m) => ({ default: m.Board })));
```

Vite picks this up automatically — Rollup emits a separate chunk for everything the Board pulls in (Tiptap, prosemirror, tiptap-markdown). The game route no longer downloads any of that JS.

Bundle change:

| Route | Before | After |
|---|---|---|
| Game (`/`) | 830 kB (full) | **645 kB** (main chunk only) |
| Board (`/#board/...`) | 830 kB (single chunk) | 645 kB main + 441 kB lazy chunk on first visit |

First load of the game URL is now ~22 % lighter. Tiptap loads on demand for the board route, then caches.

Suspense fallback shows the board's chrome (header + status) with "loading editor…" while the chunk fetches — looks intentional rather than like a flash of nothing.

## #2 — Stage B v0.2: directional half-blocks at silhouettes

**Gated behind `?normals=on`**. Off by default until the owner verifies it on mobile.

### Pipeline

When the flag is on, scene.ts allocates a second `WebGLRenderTarget` (plain RGBA, mobile-safe — same pattern as the character mask) and renders the scene each frame with `MeshNormalMaterial` as `scene.overrideMaterial`. The result captures **per-pixel surface normals** in RGB (with `(0.5, 0.5, 1)` = facing camera).

This second render target is bound into the ASCII pass as `tNormals`. The shader gets two new uniforms — `tNormals` and `uHasNormals` — plus a third sampler `tEdgeGlyphs` bound to a tiny 6-glyph atlas: `' ▀ ▄ ▌ ▐ █'` (space, top half, bottom half, left half, right half, full block).

### Shader logic

At silhouette cells (where the luminance gradient threshold fires), instead of always picking `█`:

```glsl
if (isEdge && uHasNormals > 0.5) {
  vec3 n = texture2D(tNormals, cellCenterUv).rgb * 2.0 - 1.0;
  float ax = abs(n.x);
  float ay = abs(n.y);
  float dirIdx;
  if (ay > ax) {
    dirIdx = n.y > 0.0 ? 1.0 : 2.0;   // ▀ or ▄
  } else {
    dirIdx = n.x > 0.0 ? 4.0 : 3.0;   // ▐ or ▌
  }
  // sample edge atlas at dirIdx, output that glyph
}
```

So a silhouette where the surface normal points **up-and-out** picks `▀`; the bottom edge picks `▄`; vertical edges pick `▌` or `▐`. Effect: character outlines now use directional glyphs that follow surface orientation rather than uniform solid blocks — closer to the reference ASCII portrait look.

When `?normals=on` is absent, the placeholder texture keeps `uHasNormals = 0` and the existing solid-block silhouette path runs unchanged.

### Cost

One extra `MeshNormalMaterial` render pass per frame. On the test machine, FPS holds 60 with and without the flag. If owner's iPhone reports a drop after `?normals=on`, we lower the normals target resolution or cap it to character-only meshes.

## #1 — Phase 1 OPS deferred item: Fastify health-check server + Fly config

This is the deploy-pipeline rehearsal called out in `docs/devlog/0004-roadmap-revised.md` Phase 1 OPS. Real Colyseus + Lucia + Neon + Upstash come in Phase 2 proper.

### `apps/server`

- `package.json`: real deps now — `fastify@^5.2.0`, dev `tsx@^4.19.2`, `@types/node@^22.10.0`
- `tsconfig.json`: switched to NodeNext resolution, real `outDir: dist`, `verbatimModuleSyntax: false` (Node's CJS/ESM interop with type-only imports is fussier than the bundler resolution we use in the web client)
- `src/index.ts`: Fastify server listening on `PORT` env (default 8080), `HOST` env (default `0.0.0.0`). Routes:
  - `GET /health` → `{ ok, uptimeMs, protocol, tickHz }`
  - `GET /` → service info
- Graceful shutdown on `SIGINT` / `SIGTERM`

The server imports `PROTOCOL_VERSION` from `@bitrunners/shared` and `TICK_HZ` from `@bitrunners/game-core` to keep the source-of-truth constants in one place.

### `apps/server/Dockerfile`

Multi-stage: `node:22-alpine` builder installs pnpm via corepack, restores only the server's dep tree (`--filter @bitrunners/server...`), builds, then `pnpm deploy --prod` strips dev deps to a `/out` dir. Runtime stage copies just `node_modules` + `dist`. Final image ~150 MB.

`HEALTHCHECK` baked in (uses wget against `/health`) so docker/Fly health-check both see the same signal.

### `fly.toml` (repo root)

- App name: `bitrunners-server`
- Region: `sea` (Seattle — closest Fly region to Oregon-hosted Neon and Upstash)
- VM: 256 MB / 1 shared CPU
- `auto_stop_machines = "stop"`, `min_machines_running = 0` — scale-to-zero per the cost posture in `CLAUDE.md`
- HTTP service with `/health` polling

### What's deferred

- **Actual Fly deploy** — owner provides a Fly API token, I add a Fly GitHub Action to deploy on main pushes. Until then, the server scaffold is ready but not live.
- **Colyseus + the sphere room** — Phase 2 proper. Server stays at health-check-only for now.
- **Lucia auth, Neon Postgres, Upstash Redis** — Phase 2.

## New dependencies (per the working agreement)

| Package | Version | Why |
|---|---|---|
| `fastify` | ^5.2.0 | HTTP framework for `apps/server` |
| `tsx` | ^4.19.2 | TypeScript runner for `apps/server` dev mode |
| `@types/node` | ^22.10.0 | Node 22 type definitions |

## Build

- 30 files lint-clean
- Typecheck green across all 5 workspaces
- Bundle: web split into 645 + 441 kB (gzipped 175 + 148 kB); server builds to `apps/server/dist/index.js` (~5 kB tsc output, fastify pulled at runtime)

## Files added / changed

- `apps/web/src/App.tsx` — lazy Board route
- `packages/ascii/src/ascii-pass.ts` — `tNormals`, `tEdgeGlyphs`, `uHasNormals` uniforms; directional-glyph branch at silhouettes
- `apps/web/src/scene.ts` — edge atlas, optional normals render pass, `?normals=on` URL flag parse
- `apps/server/package.json` — Fastify deps
- `apps/server/tsconfig.json` — Node ESM emit config
- `apps/server/src/index.ts` — Fastify server with `/health` route
- `apps/server/Dockerfile` — multi-stage build
- `fly.toml` — Fly app config

## What's next

1. Owner provides a **Fly API token** → I add a GitHub Action to auto-deploy `apps/server` on `main` pushes, completing the Phase 1 OPS exit criterion.
2. **Colyseus + sphere room** (Phase 2 proper) — the server gets a real room runtime with player-state schema. Client connects.
3. **Lucia + Neon** (Phase 2) — magic-link auth wired through.
4. Owner toggles `?normals=on` on iPhone and reports whether it looks better or breaks anything.
