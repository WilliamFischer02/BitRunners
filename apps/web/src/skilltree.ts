// Skill tree for the Data Scrape mini-game — the PASSCODE sink.
//
// Three paths (a video-game skill tree, not the shop):
//   1 · scrape depth   — linear, cheap, many levels: +1 bit / SCRAPE / level
//   2 · persistent kit  — unique unlocks, escalating cost (hold-to-scrape,
//                          bulk tabulate I–III, hands-free auto-scrape)
//   3 · conversion alchemy — slow, expensive long game: +1 Credit per passcode
//                          at the Admin/Company trade. The locked 8x ladder is
//                          NEVER touched (canon); only a finished passcode's
//                          VALUE rises, so shop prices can stay fixed.
//
// Unlocks once the player has ever minted one passcode (economy.isTreeUnlocked).
// ALL balance numbers live here — single tunable source. They are a deliberate
// first pass: early game is meant to feel steep, Path 3 is the multi-session
// long game. Tune freely; nothing else depends on the magnitudes.
//
// Isolated: imports only economy.js. No scene/network/server coupling.
import { getEconomy, getUpgradeLevel, isTreeUnlocked, purchaseTreeNode } from './economy.js';

export type PathId = 1 | 2 | 3 | 4;

export interface SkillPath {
  path: PathId;
  title: string;
  blurb: string;
}

export interface SkillNode {
  id: string;
  path: PathId;
  name: string;
  blurb: string;
  upgradeKey: string;
  maxLevel: number;
  /** Passcode cost to buy the next level, given the current (pre-buy) level. */
  costFor(level: number): number;
  /** Short per-level effect, for the node row. */
  effect: string;
}

export interface BuyResult {
  ok: boolean;
  reason?: string;
}

export const SKILL_PATHS: readonly SkillPath[] = [
  { path: 1, title: 'scrape depth', blurb: 'raw bits per tap' },
  { path: 2, title: 'persistent kit', blurb: 'one-off unlocks' },
  { path: 3, title: 'conversion alchemy', blurb: 'passcodes worth more' },
  { path: 4, title: 'autonomous swarm', blurb: 'bots walk the ladder' },
];

export const SKILL_NODES: readonly SkillNode[] = [
  {
    id: 't.scrape',
    path: 1,
    name: 'deeper scrape',
    blurb: 'pull more bits from every tap',
    upgradeKey: 'scrape',
    maxLevel: 30,
    costFor: (level) => 1 + Math.floor(level / 2),
    effect: '+1 bit / SCRAPE',
  },
  {
    id: 't.hold',
    path: 2,
    name: 'sustained pull',
    blurb: 'hold SCRAPE to repeat while held',
    upgradeKey: 'hold',
    maxLevel: 1,
    costFor: () => 3,
    effect: 'hold-to-scrape',
  },
  {
    id: 't.tabulate',
    path: 2,
    name: 'tabulate cache',
    blurb: 'bulk "tabulate all" — reach grows one tier per level',
    upgradeKey: 'tabulate',
    maxLevel: 3,
    costFor: (level) => [6, 12, 20][level] ?? 20,
    effect: '+1 ladder tier batched',
  },
  {
    id: 't.yield',
    path: 3,
    name: 'data appreciation',
    blurb: 'a finished passcode is worth more Credits at the trade',
    upgradeKey: 'yield',
    maxLevel: 30,
    costFor: (level) => 3 + level * 2,
    effect: '+1 Credit / passcode',
  },
  {
    id: 't.greed',
    path: 3,
    name: 'corporate greed protocol',
    blurb: 'the ultimate flex — a persistent inner-edge glow on your account',
    upgradeKey: 'greed',
    maxLevel: 1,
    costFor: () => 5_000_000,
    effect: 'account edge glow',
  },
  // Path 4 — the auto-tapper (4 speed tiers) + per-rung converter bots. Bots
  // tick while the scrape panel is open and obey the on/off toggle.
  {
    id: 't.autotap',
    path: 4,
    name: 'auto-tapper',
    blurb: 'a bot taps SCRAPE for you — 4 tiers: slow · medium · fast · hold-down',
    upgradeKey: 'autotap',
    maxLevel: 4,
    costFor: (level) => [25, 60, 140, 400][level] ?? 400,
    effect: 'faster auto-tap each tier',
  },
  {
    id: 't.bot.bits',
    path: 4,
    name: 'bits converter',
    blurb: 'a bot tabulates bits → strings on its own',
    upgradeKey: 'bot_bits',
    maxLevel: 1,
    costFor: () => 30,
    effect: 'bot: bits→strings',
  },
  {
    id: 't.bot.strings',
    path: 4,
    name: 'strings converter',
    blurb: 'a bot tabulates strings → serials on its own',
    upgradeKey: 'bot_strings',
    maxLevel: 1,
    costFor: () => 50,
    effect: 'bot: strings→serials',
  },
  {
    id: 't.bot.serials',
    path: 4,
    name: 'serials converter',
    blurb: 'a bot tabulates serials → passcodes on its own',
    upgradeKey: 'bot_serials',
    maxLevel: 1,
    costFor: () => 80,
    effect: 'bot: serials→passcodes',
  },
  {
    id: 't.bot.passcodes',
    path: 4,
    name: 'passcode condenser',
    blurb: 'a bot folds passcodes → auras (post-passcode tier)',
    upgradeKey: 'bot_passcodes',
    maxLevel: 1,
    costFor: () => 140,
    effect: 'bot: passcodes→auras',
  },
  {
    id: 't.supercomputer',
    path: 4,
    name: 'buy supercomputer',
    blurb: 'the big one — auto-holds every conversion for a constant scrape→passcode flow',
    upgradeKey: 'supercomputer',
    maxLevel: 1,
    costFor: () => 2000,
    effect: 'auto-holds all conversions',
  },
];

export function nodeLevel(node: SkillNode): number {
  return getUpgradeLevel(node.upgradeKey);
}

export function isNodeMaxed(node: SkillNode): boolean {
  return nodeLevel(node) >= node.maxLevel;
}

/** Passcode cost of the NEXT level, or null if already maxed. */
export function nodeCost(node: SkillNode): number | null {
  const level = nodeLevel(node);
  if (level >= node.maxLevel) return null;
  return node.costFor(level);
}

export function evaluateNode(node: SkillNode): BuyResult {
  if (!isTreeUnlocked()) {
    return { ok: false, reason: 'mint a passcode to unlock' };
  }
  const level = nodeLevel(node);
  if (level >= node.maxLevel) return { ok: false, reason: 'maxed' };
  const cost = node.costFor(level);
  if (getEconomy().passcodes < cost) {
    return { ok: false, reason: `need ${cost} pc` };
  }
  return { ok: true };
}

/** Prestige eligibility half the economy module can't see: every tree node
 *  except Corporate Greed Protocol must be maxed. Blocks the instant
 *  re-prestige loop (prestige wipes the tree, so this stays false until the
 *  runner genuinely rebuilds). */
export function prestigeTreeComplete(): boolean {
  return SKILL_NODES.every((n) => n.id === 't.greed' || isNodeMaxed(n));
}

export function buyNode(node: SkillNode): boolean {
  const ev = evaluateNode(node);
  if (!ev.ok) return false;
  const cost = node.costFor(nodeLevel(node));
  return purchaseTreeNode(node.upgradeKey, cost, node.maxLevel).ok;
}
