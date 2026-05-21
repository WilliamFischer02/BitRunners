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
  addLockedTokens,
  getEconomy,
  grantItem,
  spendCredits,
} from './economy.js';
import { getShopItem } from './shop.js';

export const BET_TIERS: readonly number[] = [10, 50, 200];

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
  lockedTokens: number;
  reels: [string, string, string];
  quip: string;
}

export const SAMM_GREETING = 'GREETINGS, VALUED PARTICIPANT. THE STATE WELCOMES YOUR CONTRIBUTION.';
export const SAMM_INSUFFICIENT =
  'INSUFFICIENT CREDITS, PARTICIPANT. THE STATE ENCOURAGES THRIFT — THEN RETURN.';

const QUIP = {
  lose: 'A GENEROUS DONATION TO THE PUBLIC COFFERS. THE STATE THANKS YOU MOST WARMLY.',
  small: 'A MODEST DISBURSEMENT, DULY NOTED IN THE LEDGER. CONGRATULATIONS, CITIZEN.',
  big: 'A BANNER DAY FOR PARTICIPANT AND STATE ALIKE. JUBILATION!',
  item: 'A PHYSICAL PRIZE! PLEASE COLLECT IT FROM YOUR ALLOCATION. HOW DELIGHTFUL.',
  token: 'A TOKEN PRIZE! ALAS, NO WALLET ON FILE — IT IS HELD IN TRUST FOR YOU. JOY!',
};

export function minBet(): number {
  return BET_TIERS[0] ?? 10;
}

export function canBet(bet: number): boolean {
  return bet > 0 && getEconomy().credits >= bet;
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
 * Place one bet. Spends `bet` Credits up front, then applies the rolled
 * outcome. Returns a UI result, or null if the bet can't be afforded.
 */
export function gamble(bet: number): GambleResult | null {
  if (!canBet(bet) || !spendCredits(bet)) return null;
  const spec = rollSpec();

  if (spec.kind === 'credits' && spec.mult) {
    const payout = Math.max(1, Math.floor(bet * spec.mult));
    addCredits(payout);
    return {
      kind: 'credits',
      payout,
      itemId: null,
      itemName: null,
      lockedTokens: 0,
      reels: reelsFor(true),
      quip: spec.mult >= 5 ? QUIP.big : QUIP.small,
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
        lockedTokens: 0,
        reels: reelsFor(true),
        quip: QUIP.item,
      };
    }
    // Already owned / inventory full → consolation Credits so the win isn't lost.
    const payout = bet * 2;
    addCredits(payout);
    return {
      kind: 'credits',
      payout,
      itemId: null,
      itemName: null,
      lockedTokens: 0,
      reels: reelsFor(true),
      quip: QUIP.small,
    };
  }

  if (spec.kind === 'token') {
    addLockedTokens(1);
    return {
      kind: 'token',
      payout: 0,
      itemId: null,
      itemName: null,
      lockedTokens: 1,
      reels: reelsFor(true),
      quip: QUIP.token,
    };
  }

  return {
    kind: 'lose',
    payout: 0,
    itemId: null,
    itemName: null,
    lockedTokens: 0,
    reels: reelsFor(false),
    quip: QUIP.lose,
  };
}
