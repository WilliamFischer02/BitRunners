# 0150 — 3D asset pipeline (P6)

Prereq plumbing for P7's visual pass and P8 (RAMHATTAN): a documented
way for the owner to drop CC0 .glb models into the game.

## Pieces

- `docs/assets/PIPELINE.md` — the owner workflow: drop
  `apps/web/public/assets/models/<pack>/<name>.glb`, add a
  `CREDITS.md` row, register one `ASSET_MANIFEST` entry, eyeball via
  `?asset=<pack>/<name>`. Size budget < 500 KB/model (hard-stop 1 MB),
  strip textures — only silhouette + material color survive the ASCII
  pass.
- `apps/web/src/assets-registry.ts` — typed manifest (empty until the
  first drop) + `loadModel(id)`:
  - **GLTFLoader from `three/addons`** — part of the existing `three`
    0.170 dependency (exports `./addons/*`), *not* a new package.
    Dynamically imported, so the decoder is its own lazy chunk fetched
    on first use only.
  - one decode per id (cached template promise); each call returns a
    clone (shared geometry/materials, fresh transforms);
  - `disposeAsset(id)` frees geometry + materials — documented gotcha:
    clones share the template's GPU resources, so dispose kills all
    placements at once.
- `scene.ts` dev viewer: `?asset=<id>` drops the model at (0, 0, 4) in
  front of spawn. The registry import itself is dynamic, so **zero
  bytes** land in the entry/Game chunks unless the flag is used —
  entry-budget check unaffected (verified: build green, no size
  movement).

## Why nothing imports it yet

Same isolation posture as appearance.ts (devlog 0147): the registry
exists, is exercised by the dev flag, and P7/P8 wire real usage later.
Shipping it standalone can't regress the scene.

## Owner verify

No .glb files exist yet, so: `?asset=anything` logs
`[bitrunners] asset viewer: unknown asset id` and the game runs
normally. After the first drop + manifest entry, the same flag shows
the model through the ASCII pipeline.
