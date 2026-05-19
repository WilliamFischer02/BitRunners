// Shop framework for the Data Scrape mini-game.
//
// Three item kinds:
//   clothing — head/chest/legs, 3 rarities (escalating features)
//   pet      — floating code-sparks etc.; priced well above clothing
//   upgrade  — raises a rate (e.g. bits per SCRAPE); repeatable to maxLevel
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
import {
  type EquipSlot,
  getEconomy,
  getUpgradeLevel,
  ownsItem,
  purchaseItem,
  purchaseUpgrade,
} from './economy.js';

export type Rarity = 'normal' | 'rare' | 'ultra';
export type ItemKind = 'clothing' | 'pet' | 'upgrade';

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
  upgradeKey?: string;
  maxLevel?: number;
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
  {
    id: 'upg.scrape',
    name: 'scrape tuning',
    blurb: '+1 bit per SCRAPE per level',
    kind: 'upgrade',
    cost: 40,
    upgradeKey: 'scrape',
    maxLevel: 8,
  },
  {
    id: 'upg.tabulate',
    name: 'tabulate cache',
    blurb: 'faster refining (effect wired in a later pass)',
    kind: 'upgrade',
    cost: 120,
    upgradeKey: 'tabulate',
    maxLevel: 4,
  },
  {
    id: 'token.proxy_wallet',
    name: 'proxy wallet',
    blurb: 'unlocks Token-priced goods',
    kind: 'upgrade',
    cost: 1,
    locked: true,
    lockReason: 'no valid wallet — proxy-wallet unlock is planned (lore 003/007)',
  },
];

const BY_ID = new Map<string, ShopItem>(SHOP_CATALOG.map((i) => [i.id, i]));

export function getShopItem(id: string): ShopItem | undefined {
  return BY_ID.get(id);
}

function upgradeCost(item: ShopItem): number {
  // Placeholder scaling: cost rises with current level.
  const level = item.upgradeKey ? getUpgradeLevel(item.upgradeKey) : 0;
  return item.cost * (level + 1);
}

export function priceOf(item: ShopItem): number {
  return item.kind === 'upgrade' && item.upgradeKey ? upgradeCost(item) : item.cost;
}

export function isOwned(item: ShopItem): boolean {
  return ownsItem(item.id);
}

export function evaluate(item: ShopItem): BuyResult {
  if (item.locked) return { ok: false, reason: item.lockReason ?? 'locked' };
  if (item.kind === 'upgrade') {
    if (!item.upgradeKey || item.maxLevel === undefined) {
      return { ok: false, reason: 'invalid' };
    }
    if (getUpgradeLevel(item.upgradeKey) >= item.maxLevel) {
      return { ok: false, reason: 'maxed' };
    }
    if (getEconomy().credits < priceOf(item)) {
      return { ok: false, reason: 'insufficient credits' };
    }
    return { ok: true };
  }
  if (ownsItem(item.id)) return { ok: false, reason: 'owned' };
  if (getEconomy().credits < item.cost) {
    return { ok: false, reason: 'insufficient credits' };
  }
  return { ok: true };
}

export function buy(item: ShopItem): boolean {
  if (!evaluate(item).ok) return false;
  if (item.kind === 'upgrade' && item.upgradeKey && item.maxLevel !== undefined) {
    return purchaseUpgrade(item.upgradeKey, priceOf(item), item.maxLevel).ok;
  }
  return purchaseItem(item.id, item.cost).ok;
}
