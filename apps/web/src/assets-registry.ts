// 3D asset registry (mega-batch 3 · P6, docs/assets/PIPELINE.md).
//
// Typed manifest of .glb models dropped by the owner under
// apps/web/public/assets/models/<pack>/<name>.glb, plus a lazy loader.
// GLTFLoader comes from three/addons (part of the existing `three`
// dependency, NOT a new package) and is dynamically imported so the
// decoder never lands in the entry bundle — this module has zero
// importers today except the `?asset=` dev viewer in scene.ts.

import type { Group, Material, Mesh } from 'three';

export interface AssetEntry {
  /** Manifest id — `<pack>/<name>`, matches the file layout. */
  id: string;
  /** Public URL (served statically by Cloudflare Pages). */
  path: string;
  /** Human hint — must match a row in docs/assets/CREDITS.md. */
  credit: string;
}

// Empty until the owner drops the first .glb (PIPELINE.md step 2-4).
// Example entry:
//   { id: 'kenney-city/building_a', path: '/assets/models/kenney-city/building_a.glb',
//     credit: 'Kenney City Kit (CC0)' },
export const ASSET_MANIFEST: readonly AssetEntry[] = [];

export function getAssetEntry(id: string): AssetEntry | null {
  return ASSET_MANIFEST.find((e) => e.id === id) ?? null;
}

// One decode per id, ever. The cached value is the TEMPLATE scene;
// loadModel hands out clones that share its geometry/materials.
const templates = new Map<string, Promise<Group>>();

/**
 * Load a manifest model by id. Returns a fresh clone per call (cheap:
 * shared geometry/materials, new transforms). Throws for unknown ids or
 * missing files — callers decide whether that's fatal (dev viewer just
 * warns).
 */
export async function loadModel(id: string): Promise<Group> {
  const entry = getAssetEntry(id);
  if (!entry) throw new Error(`[assets] unknown asset id: ${id}`);
  let p = templates.get(id);
  if (!p) {
    p = (async () => {
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const gltf = await new GLTFLoader().loadAsync(entry.path);
      return gltf.scene;
    })();
    templates.set(id, p);
  }
  const template = await p;
  return template.clone(true);
}

/**
 * Free the GPU resources behind an id. Because clones share the
 * template's geometry/materials, this kills EVERY placed clone of the
 * asset — remove them from the scene first.
 */
export async function disposeAsset(id: string): Promise<void> {
  const p = templates.get(id);
  if (!p) return;
  templates.delete(id);
  const template = await p.catch(() => null);
  if (!template) return;
  template.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    const m = mesh.material as Material | Material[];
    if (Array.isArray(m)) for (const mat of m) mat.dispose();
    else m.dispose();
  });
}
