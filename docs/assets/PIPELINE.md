# 3D asset pipeline (mega-batch 3 · P6)

How external 3D models (.glb) get into BitRunners. Everything renders
through the ASCII post-process, so models need silhouettes more than
textures — grayscale low-poly reads best (see `docs/references/05`).

## Owner drop-folder workflow

1. Source a model. Policy: **CC0 only** (Kenney.nl, Quaternius, CC0
   Sketchfab). Prefer `.glb` (single binary file); convert `.gltf`+bin
   with any exporter if needed.
2. Drop it at:

   ```
   apps/web/public/assets/models/<pack>/<name>.glb
   ```

   `<pack>` = source collection (e.g. `kenney-city`, `quaternius-props`),
   `<name>` = lowercase snake_case. Files under `public/` deploy as-is
   to Cloudflare Pages — no bundling, fetched on demand.
3. Add a row to `docs/assets/CREDITS.md` (asset, source URL, license,
   what it's used for). **Every file needs a row.**
4. Register it in `apps/web/src/assets-registry.ts` — one entry in
   `ASSET_MANIFEST` (id `<pack>/<name>`, path, credit).
5. Eyeball it in-game with the dev flag:

   ```
   https://localhost:5173/?asset=<pack>/<name>
   ```

   The model spawns a few units in front of the runner, rendered
   through the full ASCII pipeline. If it reads as mush, it needs
   fewer/bolder shapes — resolution won't save it.

## Code path

- `assets-registry.ts` exports `loadModel(id)`:
  - lazy-imports `GLTFLoader` from `three/addons` (part of the
    existing `three` dependency — **not** a new package) so the loader
    code stays out of the entry bundle until first use;
  - caches the decoded template per id (one fetch + parse ever);
  - returns a **clone** per call, so multiple placements are cheap.
    Clones share geometry/materials with the template —
    `disposeAsset(id)` frees them all at once; don't dispose a clone's
    innards individually.
- Nothing imports the registry today except the `?asset=` dev viewer,
  so shipping models is additive and cannot regress the scene.

## Size budget

Pages serves these statically (free tier), but players fetch them:
target **< 500 KB per .glb**, hard-stop at 1 MB without owner sign-off.
The ASCII pass destroys texture detail — strip textures before export
when possible; material color + silhouette is all that survives.
