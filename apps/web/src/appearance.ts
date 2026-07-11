// Appearance seam — resolves equipped clothing/pet into a render-ready
// descriptor, WITHOUT touching the render code.
//
// This is the deliberate isolation boundary (owner decision + decisions log):
// scene.ts will LATER do `import { getEquippedAppearance, subscribeAppearance }
// from './appearance.js'` and re-skin the bit_spekter rig. Nothing imports it
// today, so the mini-game still cannot regress Phase-2 multiplayer/render.
// When that wiring lands it reads only this descriptor — no economy/shop
// internals leak into scene.ts.
import { type EquipSlot, getEquipped, isAppearanceHidden, subscribeAppearance } from './economy.js';
import { type Rarity, getShopItem } from './shop.js';

export interface SlotAppearance {
  itemId: string;
  rarity: Rarity;
  palette: string;
  /** rare+ : non-null. */
  effect: string | null;
  /** ultra : non-null. */
  texture: string | null;
}

export type EquippedAppearance = Record<EquipSlot, SlotAppearance | null>;

const SLOTS: readonly EquipSlot[] = ['head', 'chest', 'legs', 'pet'];

export function getEquippedAppearance(): EquippedAppearance {
  const out: EquippedAppearance = { head: null, chest: null, legs: null, pet: null };
  if (isAppearanceHidden()) return out;
  const eq = getEquipped();
  for (const slot of SLOTS) {
    const id = eq[slot];
    if (!id) continue;
    const item = getShopItem(id);
    if (!item || !item.rarity) continue;
    out[slot] = {
      itemId: id,
      rarity: item.rarity,
      palette: item.visual?.palette ?? 'default',
      effect: item.visual?.effect ?? null,
      texture: item.visual?.texture ?? null,
    };
  }
  return out;
}

/**
 * Resolve a WIRE-SUPPLIED item id into a render descriptor for a remote
 * runner. Never trust the wire: the id must exist in the shop catalog, be a
 * rarity-bearing cosmetic, and match the slot it arrived on — anything else
 * renders the base shell (`null`). Same descriptor shape the local rig uses,
 * so scene.ts re-uses one applySkin path for local + remote.
 */
export function resolveSlotAppearance(itemId: string, slot: EquipSlot): SlotAppearance | null {
  if (!itemId) return null;
  const item = getShopItem(itemId);
  if (!item || !item.rarity || item.slot !== slot) return null;
  return {
    itemId,
    rarity: item.rarity,
    palette: item.visual?.palette ?? 'default',
    effect: item.visual?.effect ?? null,
    texture: item.visual?.texture ?? null,
  };
}

export { subscribeAppearance };
