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
// and docs/lore/007. Token-priced premium items are now buyable via the proxy
// wallet (lore 009). Isolated: no scene/network/server imports.
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
  // Currency the item is priced in (default Credits). Token items are premium.
  currency?: 'credits' | 'tokens';
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
    id: 'cloth.head.norm_cap',
    name: 'mesh cap',
    blurb: 'head · recolour only',
    kind: 'clothing',
    cost: 30,
    rarity: 'normal',
    slot: 'head',
    visual: { palette: 'ember' },
  },
  {
    id: 'cloth.chest.norm_plate',
    name: 'static plate',
    blurb: 'chest · recolour only',
    kind: 'clothing',
    cost: 36,
    rarity: 'normal',
    slot: 'chest',
    visual: { palette: 'slate' },
  },
  {
    id: 'cloth.legs.rare_guards',
    name: 'scan guards',
    blurb: 'legs · adds a visual effect',
    kind: 'clothing',
    cost: 130,
    rarity: 'rare',
    slot: 'legs',
    visual: { palette: 'viridian', effect: 'scan' },
  },
  {
    id: 'pet.byte_pup',
    name: 'byte pup',
    blurb: 'starter pet · a skittish data-pup',
    kind: 'pet',
    cost: 120,
    rarity: 'normal',
    slot: 'pet',
    visual: { palette: 'viridian' },
  },
  {
    id: 'pet.glint_drone',
    name: 'glint drone',
    blurb: 'starter pet · a hovering maintenance glint',
    kind: 'pet',
    cost: 180,
    rarity: 'normal',
    slot: 'pet',
    visual: { palette: 'ember' },
  },
  {
    id: 'pet.null_kit',
    name: 'null kitten',
    blurb: 'starter pet · a flickering null-kitten',
    kind: 'pet',
    cost: 280,
    rarity: 'rare',
    slot: 'pet',
    visual: { palette: 'aurora', effect: 'flicker' },
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
  {
    id: 'cloth.head.token_crown',
    name: 'aurora crown',
    blurb: 'head · premium · token-priced',
    kind: 'clothing',
    cost: 3,
    currency: 'tokens',
    rarity: 'ultra',
    slot: 'head',
    visual: { palette: 'aurora', effect: 'halo', texture: 'glyph' },
  },
  {
    id: 'pet.token_seraph',
    name: 'data seraph',
    blurb: 'premium pet · token-priced · a radiant escort',
    kind: 'pet',
    cost: 8,
    currency: 'tokens',
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

export function currencyOf(item: ShopItem): 'credits' | 'tokens' {
  return item.currency ?? 'credits';
}

export function isOwned(item: ShopItem): boolean {
  return ownsItem(item.id);
}

export function evaluate(item: ShopItem): BuyResult {
  if (item.locked) return { ok: false, reason: item.lockReason ?? 'locked' };
  if (ownsItem(item.id)) return { ok: false, reason: 'owned' };
  const cur = currencyOf(item);
  const bal = cur === 'tokens' ? getEconomy().tokens : getEconomy().credits;
  if (bal < item.cost) {
    return { ok: false, reason: cur === 'tokens' ? 'insufficient tokens' : 'insufficient credits' };
  }
  if (!hasFreeSlot()) return { ok: false, reason: 'inventory full' };
  return { ok: true };
}

export function buy(item: ShopItem): boolean {
  if (!evaluate(item).ok) return false;
  return purchaseItem(item.id, item.cost, currencyOf(item)).ok;
}
