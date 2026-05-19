// Shop framework for the Data Scrape mini-game.
//
// Trade Credits for one-time rewards. Token-priced goods exist in the model
// but are LOCKED — canon: bit_spekter has no Server-Space wallet; a proxy
// wallet is planned (lore 003 / 007). The clicker never mints Tokens.
//
// The catalog below is SCAFFOLD/PLACEHOLDER. The real reward set (and any
// lore it implies) needs owner Q&A — see docs/design/clicker-minigame.md §13.
// Isolated: no imports to/from scene/network/server.
import { getEconomy, ownsItem, purchaseWithCredits } from './economy.js';

export type ShopCurrency = 'credits' | 'tokens';
export type ShopCategory = 'cosmetic' | 'flair' | 'utility';

export interface ShopItem {
  id: string;
  name: string;
  blurb: string;
  category: ShopCategory;
  currency: ShopCurrency;
  cost: number;
  locked?: boolean;
  lockReason?: string;
}

export interface BuyResult {
  ok: boolean;
  reason?: string;
}

// Placeholder catalog — intentionally minimal. Not final game content or lore.
// Owning a cosmetic here only records ownership; wiring the visual effect is a
// later pass.
export const SHOP_CATALOG: ShopItem[] = [
  {
    id: 'flair.scanline',
    name: 'scanline flair',
    blurb: 'faint CRT scanline accent on your tag · cosmetic',
    category: 'flair',
    currency: 'credits',
    cost: 16,
  },
  {
    id: 'cosmetic.glyph_trail',
    name: 'glyph trail',
    blurb: 'sparse ascii trail accent · cosmetic',
    category: 'cosmetic',
    currency: 'credits',
    cost: 64,
  },
  {
    id: 'token.proxy_wallet',
    name: 'proxy wallet',
    blurb: 'unlocks Token-priced goods',
    category: 'utility',
    currency: 'tokens',
    cost: 1,
    locked: true,
    lockReason: 'no valid wallet — proxy-wallet unlock is planned (lore 003/007)',
  },
];

export function isOwned(item: ShopItem): boolean {
  return ownsItem(item.id);
}

export function evaluate(item: ShopItem): BuyResult {
  if (item.locked || item.currency === 'tokens') {
    return { ok: false, reason: item.lockReason ?? 'locked' };
  }
  if (ownsItem(item.id)) return { ok: false, reason: 'owned' };
  if (getEconomy().credits < item.cost) {
    return { ok: false, reason: 'insufficient credits' };
  }
  return { ok: true };
}

export function buy(item: ShopItem): boolean {
  if (!evaluate(item).ok) return false;
  return purchaseWithCredits(item.id, item.cost);
}
