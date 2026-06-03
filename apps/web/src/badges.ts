// Badge catalog. Two parallel ladders (Corporate / BitRunner), 10 tiers each.
// Canon: docs/lore/010-badges-and-tiers.md.
//
// Keys: 'corp:<tier>' and 'br:<tier>'. The server enforces this shape via
// isValidBadgeKey() in @bitrunners/shared and the CHECK constraint on
// earned_badges.badge_key in supabase/migrations/0007.

export type BadgeFaction = 'corp' | 'br';
export type BadgeTier =
  | 'wood'
  | 'stone'
  | 'bronze'
  | 'steel'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'diamond'
  | 'obsidian'
  | 'aether';

export interface BadgeMeta {
  key: string;
  faction: BadgeFaction;
  tier: BadgeTier;
  tierIndex: number; // 1..10 — used to compute "earned at +10 * tierIndex Samaritan"
  glyph: string;
  label: string;
  tint: string;
}

export const BADGE_TIERS: BadgeTier[] = [
  'wood',
  'stone',
  'bronze',
  'steel',
  'silver',
  'gold',
  'platinum',
  'diamond',
  'obsidian',
  'aether',
];

// Glyph picks (single-char where possible, two-char fallback) per docs/lore/010.
const TIER_GLYPHS: Record<BadgeTier, string> = {
  wood: '□', // □
  stone: '▣', // ▣
  bronze: '◆', // ◆
  steel: '▰', // ▰
  silver: '▲', // ▲
  gold: '★', // ★
  platinum: '✦', // ✦
  diamond: '♦', // ♦
  obsidian: '◆', // ◆ rendered darker
  aether: '✺', // ✺
};

const CORP_TINT = '#ff9450';
const BR_TINT = '#b07cff';
const OBSIDIAN_TINT_CORP = '#7a4520'; // darker corp for obsidian visual cue
const OBSIDIAN_TINT_BR = '#5a3c80';

function tintFor(faction: BadgeFaction, tier: BadgeTier): string {
  if (tier === 'obsidian') return faction === 'corp' ? OBSIDIAN_TINT_CORP : OBSIDIAN_TINT_BR;
  return faction === 'corp' ? CORP_TINT : BR_TINT;
}

export const BADGES: Record<string, BadgeMeta> = (() => {
  const out: Record<string, BadgeMeta> = {};
  for (const faction of ['corp', 'br'] as const) {
    BADGE_TIERS.forEach((tier, i) => {
      const key = `${faction}:${tier}`;
      out[key] = {
        key,
        faction,
        tier,
        tierIndex: i + 1,
        glyph: TIER_GLYPHS[tier],
        label: tier,
        tint: tintFor(faction, tier),
      };
    });
  }
  return out;
})();

export function getBadge(key: string): BadgeMeta | null {
  return BADGES[key] ?? null;
}

// Tier earned at +10 × tierIndex Samaritan. Used by client-side optimistic
// "next badge progress" display and by the server-side award_pending_badges()
// trigger that materializes earned_badges rows. The server-side number IS
// authoritative.
export function tierForSamaritan(samaritan: number): BadgeTier | null {
  const t = Math.min(10, Math.floor(samaritan / 10));
  if (t <= 0) return null;
  return BADGE_TIERS[t - 1] ?? null;
}

export function badgeKeyFor(faction: BadgeFaction, tier: BadgeTier): string {
  return `${faction}:${tier}`;
}
