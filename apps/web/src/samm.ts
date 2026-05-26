// SAMM — the State Authored Money Machine (lore 008). A government-profit
// gambling terminal: bet Credits for a weighted chance at rewards. Real house
// edge — a pull can lose outright. Credit EV is intentionally < 1× the bet.
//
// Canon: bit_spekter has no Token wallet, so a Token win is recorded as LOCKED
// winnings (economy.addLockedTokens) — shown, never spendable, until the
// proxy-wallet ships. Token *betting* is gated in the UI for the same reason.
//
// ALL odds/payouts live here — single tunable source. Isolated: imports only
// economy.js + shop.js (catalog lookup). No scene/network/server coupling.
import {
  type MutResult,
  addCredits,
  addTokens,
  getEconomy,
  grantItem,
  spendCredits,
  spendTokens,
} from './economy.js';
import { getShopItem } from './shop.js';

export type BetCurrency = 'credits' | 'tokens';
export const BET_TIERS: readonly number[] = [10, 50, 200];
export const TOKEN_BET_TIERS: readonly number[] = [1, 3, 10];

export function betTiers(currency: BetCurrency): readonly number[] {
  return currency === 'tokens' ? TOKEN_BET_TIERS : BET_TIERS;
}

export type OutcomeKind = 'lose' | 'credits' | 'item' | 'token';

interface OutcomeSpec {
  kind: OutcomeKind;
  p: number;
  mult?: number;
}

// Weighted table; probabilities sum to 1. Credit EV ≈ 0.84× bet (house edge),
// plus rare item/Token bonuses. Tune freely — nothing else depends on these.
const TABLE: readonly OutcomeSpec[] = [
  { kind: 'lose', p: 0.4 },
  { kind: 'credits', p: 0.27, mult: 0.5 },
  { kind: 'credits', p: 0.18, mult: 1 },
  { kind: 'credits', p: 0.1, mult: 2 },
  { kind: 'credits', p: 0.035, mult: 5 },
  { kind: 'credits', p: 0.006, mult: 25 },
  { kind: 'item', p: 0.008 },
  { kind: 'token', p: 0.001 },
];

// Placeholder prize pool — cheaper cosmetics + starter pets from the catalog.
const PRIZE_POOL: readonly string[] = [
  'cloth.head.norm_visor',
  'cloth.head.norm_cap',
  'cloth.chest.norm_plate',
  'pet.byte_pup',
  'pet.glint_drone',
];

const REEL = ['◆', '▣', '✦', '¤', '⌬', '◇'];

export interface GambleResult {
  kind: OutcomeKind;
  payout: number;
  itemId: string | null;
  itemName: string | null;
  tokens: number;
  reels: [string, string, string];
  // Dialogue registry key (dialogue.ts) — the UI resolves the actual text, so
  // samm.ts stays network-isolated (no dialogue/supabase import here).
  quipKey: string;
}

export function minBet(currency: BetCurrency = 'credits'): number {
  return betTiers(currency)[0] ?? 1;
}

export function canBet(bet: number, currency: BetCurrency = 'credits'): boolean {
  const bal = currency === 'tokens' ? getEconomy().tokens : getEconomy().credits;
  return bet > 0 && bal >= bet;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

function rollSpec(): OutcomeSpec {
  let r = Math.random();
  for (const spec of TABLE) {
    if (r < spec.p) return spec;
    r -= spec.p;
  }
  return TABLE[0] as OutcomeSpec;
}

function reelsFor(win: boolean): [string, string, string] {
  if (win) {
    const g = pick(REEL);
    return [g, g, g];
  }
  const a = pick(REEL);
  let b = pick(REEL);
  if (b === a) b = REEL[(REEL.indexOf(a) + 1) % REEL.length] as string;
  return [a, b, pick(REEL)];
}

/**
 * Place one bet in `currency`. Spends the bet up front, then applies the rolled
 * outcome (payouts in the same currency). Returns a UI result, or null if the
 * bet can't be afforded.
 */
export function gamble(bet: number, currency: BetCurrency = 'credits'): GambleResult | null {
  if (!canBet(bet, currency)) return null;
  const spend = currency === 'tokens' ? spendTokens : spendCredits;
  if (!spend(bet)) return null;
  const award = currency === 'tokens' ? addTokens : addCredits;
  const spec = rollSpec();

  if (spec.kind === 'credits' && spec.mult) {
    const payout = Math.max(1, Math.floor(bet * spec.mult));
    award(payout);
    return {
      kind: 'credits',
      payout,
      itemId: null,
      itemName: null,
      tokens: 0,
      reels: reelsFor(true),
      quipKey: spec.mult >= 5 ? 'samm.big' : 'samm.small',
    };
  }

  if (spec.kind === 'item') {
    const id = pick(PRIZE_POOL);
    const res: MutResult = grantItem(id);
    if (res.ok) {
      return {
        kind: 'item',
        payout: 0,
        itemId: id,
        itemName: getShopItem(id)?.name ?? id,
        tokens: 0,
        reels: reelsFor(true),
        quipKey: 'samm.item',
      };
    }
    // Already owned / inventory full → consolation payout so the win isn't lost.
    const payout = bet * 2;
    award(payout);
    return {
      kind: 'credits',
      payout,
      itemId: null,
      itemName: null,
      tokens: 0,
      reels: reelsFor(true),
      quipKey: 'samm.small',
    };
  }

  if (spec.kind === 'token') {
    // Token bonus — awards a spendable Token regardless of the bet currency.
    addTokens(1);
    return {
      kind: 'token',
      payout: 0,
      itemId: null,
      itemName: null,
      tokens: 1,
      reels: reelsFor(true),
      quipKey: 'samm.token',
    };
  }

  return {
    kind: 'lose',
    payout: 0,
    itemId: null,
    itemName: null,
    tokens: 0,
    reels: reelsFor(false),
    quipKey: 'samm.lose',
  };
}
