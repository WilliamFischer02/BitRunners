// Shop framework for the Data Scrape mini-game.
//
// Cosmetics only — Credits-priced:
//   clothing — head/chest/legs, 3 rarities (escalating features)
//   pet      — floating code-sparks etc.; priced well above clothing
//
// Rate upgrades used to live here as a third kind; they now live in the
// passcode-priced skill tree (skilltree.ts). Keeping the two currencies
// separate keeps progression coherent: Credits buy looks, passcodes buy power.
//
// Rarity escalation (mechanical, not lore): normal = recolor only · rare =
// + a visual effect · ultra = + effect + texture + colour effect. Visual
// descriptors are DATA ONLY — the character render reads them later via
// appearance.ts (isolated seam); nothing is drawn here yet.
//
// The catalog is SCAFFOLD/PLACEHOLDER. Real items, names, rarity vocabulary
// and any lore are an open owner Q&A — see docs/design/clicker-minigame.md §14
// and docs/lore/007. Token-priced goods stay hard-locked (canon: bit_spekter
// has no Server-Space wallet). Isolated: no scene/network/server imports.
import { type EquipSlot, getEconomy, hasFreeSlot, ownsItem, purchaseItem } from './economy.js';

export type Rarity = 'normal' | 'rare' | 'ultra';
export type ItemKind = 'clothing' | 'pet';

export interface ClothingVisual {
  palette: string;
  effect?: string;
  texture?: string;
}

export interface ShopItem {
  id: string;
  name: string;
  blurb: string;
  kind: ItemKind;
  cost: number;
  rarity?: Rarity;
  slot?: EquipSlot;
  visual?: ClothingVisual;
  // Canon hook: a Token-priced cosmetic can ship hard-locked (bit_spekter has
  // no Server-Space wallet; proxy-wallet planned, lore 003/007).
  locked?: boolean;
  lockReason?: string;
}

export interface BuyResult {
  ok: boolean;
  reason?: string;
}

// Placeholder catalog. Not final content or lore. Costs are balancing
// placeholders; pets are intentionally far pricier than clothing.
export const SHOP_CATALOG: ShopItem[] = [
  {
    id: 'cloth.head.norm_visor',
    name: 'plain visor',
    blurb: 'head · recolour only',
    kind: 'clothing',
    cost: 24,
    rarity: 'normal',
    slot: 'head',
    visual: { palette: 'slate' },
  },
  {
    id: 'cloth.chest.rare_weave',
    name: 'pulse weave',
    blurb: 'chest · adds a visual effect',
    kind: 'clothing',
    cost: 96,
    rarity: 'rare',
    slot: 'chest',
    visual: { palette: 'viridian', effect: 'pulse' },
  },
  {
    id: 'cloth.legs.ultra_circuit',
    name: 'circuit greaves',
    blurb: 'legs · effect + texture + colour shift',
    kind: 'clothing',
    cost: 320,
    rarity: 'ultra',
    slot: 'legs',
    visual: { palette: 'aurora', effect: 'arc', texture: 'circuit' },
  },
  {
    id: 'pet.spark',
    name: 'code spark',
    blurb: 'a small floating spark of code · follows you',
    kind: 'pet',
    cost: 900,
    rarity: 'rare',
    slot: 'pet',
    visual: { palette: 'ember', effect: 'flicker' },
  },
  {
    id: 'pet.mote_ultra',
    name: 'aether mote',
    blurb: 'a drifting ultra mote · effect + texture + colour',
    kind: 'pet',
    cost: 2400,
    rarity: 'ultra',
    slot: 'pet',
    visual: { palette: 'aurora', effect: 'orbit', texture: 'glyph' },
  },
];

const BY_ID = new Map<string, ShopItem>(SHOP_CATALOG.map((i) => [i.id, i]));

export function getShopItem(id: string): ShopItem | undefined {
  return BY_ID.get(id);
}

export function priceOf(item: ShopItem): number {
  return item.cost;
}

export function isOwned(item: ShopItem): boolean {
  return ownsItem(item.id);
}

export function evaluate(item: ShopItem): BuyResult {
  if (item.locked) return { ok: false, reason: item.lockReason ?? 'locked' };
  if (ownsItem(item.id)) return { ok: false, reason: 'owned' };
  if (getEconomy().credits < item.cost) {
    return { ok: false, reason: 'insufficient credits' };
  }
  if (!hasFreeSlot()) return { ok: false, reason: 'inventory full' };
  return { ok: true };
}

export function buy(item: ShopItem): boolean {
  if (!evaluate(item).ok) return false;
  return purchaseItem(item.id, item.cost).ok;
}
