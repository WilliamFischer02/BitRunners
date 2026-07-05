// Data Scrape economy — pure model + device-local persistence.
// Design: docs/design/clicker-minigame.md · Lore: docs/lore/007-data-economy.md
//
// Device-local only (no IP, no server, no PII). One versioned blob so the
// account-link seam (exportProgress / importProgress) stays a single call —
// inventory, outfits, pets and upgrades all ride it. Catalog/eligibility live
// in shop.ts; appearance resolution in appearance.ts. This module is the only
// place state is mutated + persisted. No scene/network/server coupling.

export const ECONOMY_STORAGE_KEY = 'bitrunners.economy.v1';
export const ECONOMY_EVENT = 'bitrunners:economy-changed';
export const APPEARANCE_EVENT = 'bitrunners:appearance-changed';

export const STEP = 8;
export const CREDITS_PER_PASSCODE = 4;
// Credits minted per aura at the calculate-trade (post-passcode tier, PR 82).
// Aura = 8 passcodes; selling one back as Credits returns more than
// selling 8 individual passcodes — the post-passcode tier is a long-game
// payoff, not strictly equivalent.
export const CREDITS_PER_AURA = 48;
// Proxy-wallet exchange rate: Credits to buy one Token (one-way). Tunable.
export const CREDITS_PER_TOKEN = 100;
export const INVENTORY_SLOTS = 16;
// Prestige payout: tokens awarded per prestige = base + lifetimePasscodes /
// divisor. Same formula across prestiges so the curve stays predictable.
export const PRESTIGE_TOKEN_BASE = 1;
export const PRESTIGE_TOKEN_DIVISOR = 30;
// Permanent scrape-yield buff per prestige tier (additive +bits/scrape).
export const PRESTIGE_BUFF_PER_LEVEL = 1;
// Bot tick interval — single timer drives all auto-converter bots so the
// scrape panel doesn't have to spawn one timer per upgrade. Tunable here.
export const BOT_TICK_MS = 1100;

export type RefinableTier = 'bits' | 'strings' | 'serials';
export type Faction = 'admin' | 'company';
export type EquipSlot = 'head' | 'chest' | 'legs' | 'pet';

export const EQUIP_SLOTS: readonly EquipSlot[] = ['head', 'chest', 'legs', 'pet'];

export interface Equipped {
  head: string | null;
  chest: string | null;
  legs: string | null;
  pet: string | null;
}

export interface EconomyState {
  v: 1;
  bits: number;
  strings: number;
  serials: number;
  passcodes: number;
  // Post-passcode tier introduced by PR 82. Same 8× ladder ratio so the
  // canon scrape rhythm doesn't break.
  auras: number;
  credits: number;
  repCorporate: number;
  repBitrunner: number;
  lifetimeScrapes: number;
  // Cumulative passcodes ever minted (never decremented when spent in the
  // skill tree). Gates the tree: "after reaching 1 passcode created".
  lifetimePasscodes: number;
  // Cumulative auras ever minted. Gates the post-passcode trade flow.
  lifetimeAuras: number;
  // Prestige tier reached so far (PR 82). +1 each time the player burns
  // their scrape progress for tokens via the clean-slate trade.
  prestiges: number;
  // Accumulated permanent +bits/scrape from prestiging. Each prestige adds an
  // aura-scaled amount (prestigeBuffGain), so it's no longer just prestiges×1.
  // Old blobs seed this from the legacy `prestiges * PRESTIGE_BUFF_PER_LEVEL`.
  prestigeBuff: number;
  // Spendable Tokens (premium currency). The proxy-wallet unlock (lore 009)
  // made these real; legacy `lockedTokens` blobs are folded in on load.
  tokens: number;
  // First-play tutorial + unlocked classes (device-local; migrates with the
  // account later). Completing the tutorial unlocks server_speaker.
  tutorialDone: boolean;
  unlocks: string[];
  owned: string[];
  upgrades: Record<string, number>;
  slots: (string | null)[];
  equipped: Equipped;
  appearanceHidden: boolean;
  // Emote loadout (mega-batch 4.12). `ownedEmotes` holds purchased PREMIUM
  // emote ids only — the 10 base emotes are always available (resolved via the
  // catalog in emotes.ts, which this module stays decoupled from). `emoteLoadout`
  // is the 4-slot equipped set (catalog ids; null = empty slot). Both ride the
  // account-synced blob, so no separate migration is needed.
  ownedEmotes: string[];
  emoteLoadout: (string | null)[];
  // circuit_patch minigame (mega-batch 2 · 4.4). True once the runner has ever
  // solved the puzzle — gates the first-clear (100 cr) vs repeat (20 cr)
  // reward. Additive + defaulted so old blobs load clean.
  circuitFirstClear: boolean;
  // circuit_patch level progress: index (0–9) of the level the runner resumes
  // on next session. Wins on the frontier level advance it. Additive.
  circuitLevel: number;
  updatedAt: number;
}

export const EMOTE_LOADOUT_SLOTS = 4;
// Default equipped emotes for a fresh runner — mirrors emotes.ts
// DEFAULT_EMOTE_LOADOUT (kept inline so economy stays catalog-agnostic).
const DEFAULT_LOADOUT: readonly (string | null)[] = ['wave', 'happy', 'think', 'tired'];

const NEXT_TIER: Record<RefinableTier, 'strings' | 'serials' | 'passcodes'> = {
  bits: 'strings',
  strings: 'serials',
  serials: 'passcodes',
};

/** Post-passcode tier (PR 82) — 8 passcodes → 1 aura. Same ratio as the
 *  classic ladder so the canon "8× costs" rule isn't broken. Kept separate
 *  from RefinableTier so the public tabulate() API doesn't change shape;
 *  auras have their own action + UI row. */
export const PASSCODE_AURA_STEP = STEP;

function emptySlots(): (string | null)[] {
  return Array.from({ length: INVENTORY_SLOTS }, () => null);
}

function defaultState(): EconomyState {
  return {
    v: 1,
    bits: 0,
    strings: 0,
    serials: 0,
    passcodes: 0,
    auras: 0,
    credits: 0,
    repCorporate: 0,
    repBitrunner: 0,
    lifetimeScrapes: 0,
    lifetimePasscodes: 0,
    lifetimeAuras: 0,
    prestiges: 0,
    prestigeBuff: 0,
    tokens: 0,
    tutorialDone: false,
    unlocks: [],
    owned: [],
    upgrades: {},
    slots: emptySlots(),
    equipped: { head: null, chest: null, legs: null, pet: null },
    appearanceHidden: false,
    ownedEmotes: [],
    emoteLoadout: [...DEFAULT_LOADOUT],
    circuitFirstClear: false,
    circuitLevel: 0,
    updatedAt: 0,
  };
}

function normLoadout(v: unknown): (string | null)[] {
  const base: (string | null)[] = [...DEFAULT_LOADOUT];
  if (!Array.isArray(v)) return base;
  for (let i = 0; i < EMOTE_LOADOUT_SLOTS; i++) {
    const cell = v[i];
    base[i] = typeof cell === 'string' ? cell : cell === null ? null : (base[i] ?? null);
  }
  return base;
}

function isEconomyState(x: unknown): x is EconomyState {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  if (o.v !== 1) return false;
  const numeric = [
    'bits',
    'strings',
    'serials',
    'passcodes',
    'credits',
    'repCorporate',
    'repBitrunner',
    'lifetimeScrapes',
    'updatedAt',
  ] as const;
  return numeric.every((k) => typeof o[k] === 'number' && Number.isFinite(o[k]));
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function numRecord(v: unknown): Record<string, number> {
  if (typeof v !== 'object' || v === null) return {};
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === 'number' && Number.isFinite(val)) out[k] = val;
  }
  return out;
}

function normSlots(v: unknown): (string | null)[] {
  const base = emptySlots();
  if (!Array.isArray(v)) return base;
  for (let i = 0; i < INVENTORY_SLOTS; i++) {
    const cell = v[i];
    base[i] = typeof cell === 'string' ? cell : null;
  }
  return base;
}

function normEquipped(v: unknown): Equipped {
  const e: Equipped = { head: null, chest: null, legs: null, pet: null };
  if (typeof v !== 'object' || v === null) return e;
  const o = v as Record<string, unknown>;
  for (const s of EQUIP_SLOTS) {
    const val = o[s];
    if (typeof val === 'string') e[s] = val;
  }
  return e;
}

function fin(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function normalize(parsed: EconomyState): EconomyState {
  const p = parsed as unknown as Record<string, unknown>;
  const prestiges = fin(p.prestiges);
  const upgrades = numRecord(p.upgrades);
  // Grandfather the retired auto-scrape upgrades (`auto`, `bot_scrape`) into the
  // new 4-tier `autotap` node so players who bought them keep an auto-tapper.
  const legacyAuto = (upgrades.auto ?? 0) >= 1 || (upgrades.bot_scrape ?? 0) >= 1;
  if (legacyAuto) upgrades.autotap = Math.max(upgrades.autotap ?? 0, 1);
  return {
    ...defaultState(),
    ...parsed,
    // Additive field: old v1 blobs predate it. Seed from current passcodes so
    // a player who already minted some isn't locked out of the skill tree.
    lifetimePasscodes: Math.max(fin(p.lifetimePasscodes), fin(p.passcodes)),
    // PR 82 fields are additive too — default to 0 / current values.
    auras: fin(p.auras),
    lifetimeAuras: Math.max(fin(p.lifetimeAuras), fin(p.auras)),
    prestiges,
    // Seed the accumulated buff from the legacy prestiges×1 formula so existing
    // players keep exactly the buff they had; future prestiges add aura-scaled.
    prestigeBuff: Math.max(fin(p.prestigeBuff), prestiges * PRESTIGE_BUFF_PER_LEVEL),
    tokens: fin(p.tokens) + fin(p.lockedTokens),
    tutorialDone: p.tutorialDone === true,
    unlocks: strArray(p.unlocks),
    owned: strArray(p.owned),
    upgrades,
    slots: normSlots(p.slots),
    equipped: normEquipped(p.equipped),
    appearanceHidden: p.appearanceHidden === true,
    ownedEmotes: strArray(p.ownedEmotes),
    emoteLoadout: normLoadout(p.emoteLoadout),
    circuitFirstClear: p.circuitFirstClear === true,
    // Clamp to the valid level range (0–9) so a corrupt blob can't strand the
    // player past the last level.
    circuitLevel: Math.min(9, Math.max(0, Math.floor(fin(p.circuitLevel)))),
  };
}

function load(): EconomyState {
  try {
    const raw = localStorage.getItem(ECONOMY_STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed: unknown = JSON.parse(raw);
    // Additive + backward-compatible: older v1 blobs predate inventory fields.
    return isEconomyState(parsed) ? normalize(parsed) : defaultState();
  } catch {
    return defaultState();
  }
}

let state: EconomyState = load();

function persist(appearanceChanged = false): void {
  state.updatedAt = Date.now();
  try {
    localStorage.setItem(ECONOMY_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable (private mode / quota) — keep in-memory state
  }
  try {
    window.dispatchEvent(new CustomEvent(ECONOMY_EVENT));
    if (appearanceChanged) window.dispatchEvent(new CustomEvent(APPEARANCE_EVENT));
  } catch {
    // non-DOM env — ignore
  }
}

export function getEconomy(): Readonly<EconomyState> {
  return state;
}

export function subscribeEconomy(cb: () => void): () => void {
  const handler = (): void => cb();
  window.addEventListener(ECONOMY_EVENT, handler);
  return () => window.removeEventListener(ECONOMY_EVENT, handler);
}

/**
 * Appearance-only seam. scene.ts can subscribe to this LATER to re-render the
 * character when equipped clothing/pets change. Nothing consumes it today —
 * isolation from the render pipeline is deliberate (decisions log).
 */
export function subscribeAppearance(cb: () => void): () => void {
  const handler = (): void => cb();
  window.addEventListener(APPEARANCE_EVENT, handler);
  return () => window.removeEventListener(APPEARANCE_EVENT, handler);
}

/** Path 1 (scrape depth): bits minted per SCRAPE = 1 + level + accumulated
 *  prestige buff (each prestige adds an aura-scaled amount — see prestigeReset). */
export function scrapeYield(): number {
  return 1 + (state.upgrades.scrape ?? 0) + state.prestigeBuff;
}

/** Calculate the credits awarded for trading one aura (PR 82). Scales with
 *  the same yield upgrade as passcodes so late-game investments matter at
 *  both tiers. */
export function creditsPerAura(): number {
  return CREDITS_PER_AURA + (state.upgrades.yield ?? 0) * STEP;
}

/**
 * Path 3 (conversion alchemy): Credits minted per passcode at the Admin/
 * Company trade. The locked 8x ladder (STEP) is NEVER touched — only the
 * value of a finished passcode rises, so canon stays intact and shop prices
 * can stay fixed while late-game purchasing power grows.
 */
export function creditsPerPasscode(): number {
  return CREDITS_PER_PASSCODE + (state.upgrades.yield ?? 0);
}

/** Path 2 unlock: hold the SCRAPE button to auto-repeat while held. */
export function hasHoldScrape(): boolean {
  return (state.upgrades.hold ?? 0) >= 1;
}

/** Path 4 converter bots. Each is a single-level unlock — once bought, the bot
 *  ticks once per BOT_TICK_MS while the scrape panel is open + bots are enabled.
 *  The scrape panel owns the timer so bots pause when the panel closes
 *  (active-panel automation, not true background workers). The SCRAPE-tapping
 *  bot is now the 4-tier `autoTapLevel`; the Supercomputer capstone drives all
 *  of these at once (see hasSupercomputer). */
export function hasBotBitsTab(): boolean {
  return (state.upgrades.bot_bits ?? 0) >= 1;
}
export function hasBotStringsTab(): boolean {
  return (state.upgrades.bot_strings ?? 0) >= 1;
}
export function hasBotSerialsTab(): boolean {
  return (state.upgrades.bot_serials ?? 0) >= 1;
}
export function hasBotPasscodesTab(): boolean {
  return (state.upgrades.bot_passcodes ?? 0) >= 1;
}

/**
 * Path 4 auto-tapper level (0–4): 0 none, 1 slow, 2 medium, 3 fast, 4 hold-down
 * (continuous). Replaces the retired single-level `auto`/`bot_scrape` unlocks;
 * the scrape panel maps the level to a tap interval.
 */
export function autoTapLevel(): number {
  return Math.min(state.upgrades.autotap ?? 0, 4);
}

/** "Buy Supercomputer" capstone: auto-holds every conversion button for a
 *  constant scrape→passcode flow (drives all converter bots at once). */
export function hasSupercomputer(): boolean {
  return (state.upgrades.supercomputer ?? 0) >= 1;
}

/** "Corporate Greed Protocol" capstone: a persistent inner-edge screen glow
 *  while signed in. Cosmetic only. */
export function hasGreedProtocol(): boolean {
  return (state.upgrades.greed ?? 0) >= 1;
}

/** The skill tree unlocks once the player has ever minted a passcode. */
export function isTreeUnlocked(): boolean {
  return state.lifetimePasscodes >= 1;
}

/** SCRAPE — one click yields scrapeYield() bits (raised by the scrape upgrade). */
export function scrape(): void {
  const gain = scrapeYield();
  state = { ...state, bits: state.bits + gain, lifetimeScrapes: state.lifetimeScrapes + 1 };
  persist();
}

export function canTabulate(from: RefinableTier): boolean {
  return state[from] >= STEP;
}

export function tabulate(from: RefinableTier): boolean {
  if (state[from] < STEP) return false;
  const to = NEXT_TIER[from];
  const next = { ...state };
  next[from] -= STEP;
  next[to] += 1;
  if (to === 'passcodes') next.lifetimePasscodes += 1;
  state = next;
  persist();
  return true;
}

/** How many ladder tiers the tabulate-cache upgrade unlocks for bulk convert. */
export function tabulateReach(): number {
  return Math.min(state.upgrades.tabulate ?? 0, 3);
}

export function canTabulateAll(): boolean {
  const reach = tabulateReach();
  if (reach < 1) return false;
  const tiers: RefinableTier[] = (['bits', 'strings', 'serials'] as const).slice(0, reach);
  return tiers.some((t) => state[t] >= STEP);
}

/**
 * TABULATE ALL — cascading bulk refine, unlocked/extended by the tabulate-cache
 * upgrade (reach = level, capped at 3 tiers). Preserves the locked 8× ratio
 * exactly (it just batches the same step); persists once.
 */
export function tabulateAll(): boolean {
  const reach = tabulateReach();
  if (reach < 1) return false;
  const tiers: RefinableTier[] = (['bits', 'strings', 'serials'] as const).slice(0, reach);
  const next = { ...state };
  const startPasscodes = next.passcodes;
  let any = false;
  let changed = true;
  let guard = 0;
  while (changed && guard < 64) {
    changed = false;
    guard++;
    for (const from of tiers) {
      const conv = Math.floor(next[from] / STEP);
      if (conv > 0) {
        next[from] -= conv * STEP;
        next[NEXT_TIER[from]] += conv;
        any = true;
        changed = true;
      }
    }
  }
  if (!any) return false;
  const minted = next.passcodes - startPasscodes;
  if (minted > 0) next.lifetimePasscodes += minted;
  state = next;
  persist();
  return true;
}

export function canCalculate(): boolean {
  return state.passcodes >= 1;
}

export function calculate(faction: Faction): boolean {
  if (state.passcodes < 1) return false;
  const next = { ...state };
  next.passcodes -= 1;
  next.credits += creditsPerPasscode();
  if (faction === 'company') next.repCorporate += 1;
  else next.repBitrunner += 1;
  state = next;
  persist();
  try {
    window.dispatchEvent(new CustomEvent('bitrunners:reputation-earned', { detail: { faction } }));
  } catch {
    // non-DOM env — ignore
  }
  return true;
}

/** Post-passcode tier (PR 82): refine 8 passcodes → 1 aura. Auras can be
 *  traded for a larger credit payout via calculateAura, or held to seed the
 *  prestige reward. */
export function canTabulateAura(): boolean {
  return state.passcodes >= PASSCODE_AURA_STEP;
}

export function tabulateAura(): boolean {
  if (state.passcodes < PASSCODE_AURA_STEP) return false;
  state = {
    ...state,
    passcodes: state.passcodes - PASSCODE_AURA_STEP,
    auras: state.auras + 1,
    lifetimeAuras: state.lifetimeAuras + 1,
  };
  persist();
  return true;
}

export function canCalculateAura(): boolean {
  return state.auras >= 1;
}

export function calculateAura(faction: Faction): boolean {
  if (state.auras < 1) return false;
  const next = { ...state };
  next.auras -= 1;
  next.credits += creditsPerAura();
  if (faction === 'company') next.repCorporate += 2;
  else next.repBitrunner += 2;
  state = next;
  persist();
  try {
    window.dispatchEvent(new CustomEvent('bitrunners:reputation-earned', { detail: { faction } }));
  } catch {
    // non-DOM env — ignore
  }
  return true;
}

/** Prestige unlocks once the runner has minted at least one aura. */
export function isPrestigeUnlocked(): boolean {
  return state.lifetimeAuras >= 1;
}

/** Computes the token payout for a prestige reset given the current state.
 *  Surfaced separately so the UI can preview the trade. */
export function prestigeTokenPayout(): number {
  return PRESTIGE_TOKEN_BASE + Math.floor(state.lifetimePasscodes / PRESTIGE_TOKEN_DIVISOR);
}

/** Permanent +bits/scrape a prestige will grant, scaled by accrued
 *  (lifetime) auras. Gradual sqrt curve: ~10 auras → +1, ~5000 → +20; min +1.
 *  Surfaced so the prestige panel can preview it. */
export function prestigeBuffGain(): number {
  return Math.max(1, Math.round(Math.sqrt(state.lifetimeAuras) * 0.28));
}

/** Prestige reset: burn the scrape buffers + skill-tree levels for tokens
 *  and a permanent, aura-scaled scrape-yield buff (prestigeBuffGain). Owned
 *  items, equipped slots, reputation, badges, lifetime stats, the prestige
 *  count, and the two permanent capstones (Supercomputer, Corporate Greed
 *  Protocol) are preserved. One-way; idempotent (a no-progress re-prestige
 *  still awards the base payout + at least +1 buff). */
export function prestigeReset(): boolean {
  if (!isPrestigeUnlocked()) return false;
  const payout = prestigeTokenPayout();
  // Keep the expensive permanent capstones through the wipe.
  const keptUpgrades: Record<string, number> = {};
  if ((state.upgrades.supercomputer ?? 0) >= 1)
    keptUpgrades.supercomputer = state.upgrades.supercomputer as number;
  if ((state.upgrades.greed ?? 0) >= 1) keptUpgrades.greed = state.upgrades.greed as number;
  state = {
    ...state,
    bits: 0,
    strings: 0,
    serials: 0,
    passcodes: 0,
    auras: 0,
    credits: 0,
    upgrades: keptUpgrades,
    tokens: state.tokens + payout,
    prestiges: state.prestiges + 1,
    prestigeBuff: state.prestigeBuff + prestigeBuffGain(),
  };
  persist();
  try {
    window.dispatchEvent(
      new CustomEvent('bitrunners:prestige-reset', {
        detail: { payout, level: state.prestiges },
      }),
    );
  } catch {
    // non-DOM env — ignore
  }
  return true;
}

export function isTutorialDone(): boolean {
  return state.tutorialDone;
}

export function getUnlocks(): readonly string[] {
  return state.unlocks;
}

export function isClassUnlocked(id: string): boolean {
  return state.unlocks.includes(id);
}

/** Mark the first-play tutorial complete and grant the server_speaker class. */
export function completeTutorial(): void {
  if (state.tutorialDone && state.unlocks.includes('server_speaker')) return;
  const unlocks = state.unlocks.includes('server_speaker')
    ? state.unlocks
    : [...state.unlocks, 'server_speaker'];
  state = { ...state, tutorialDone: true, unlocks };
  persist();
}

export function getOwned(): readonly string[] {
  return state.owned;
}

export function ownsItem(id: string): boolean {
  return state.owned.includes(id);
}

export function getSlots(): readonly (string | null)[] {
  return state.slots;
}

export function hasFreeSlot(): boolean {
  return state.slots.some((c) => c === null);
}

export function getEquipped(): Readonly<Equipped> {
  return state.equipped;
}

export function isAppearanceHidden(): boolean {
  return state.appearanceHidden;
}

export function getUpgradeLevel(key: string): number {
  return state.upgrades[key] ?? 0;
}

export interface MutResult {
  ok: boolean;
  reason?: string;
}

/** Buy a one-time inventory item (clothing/pet) with Credits or Tokens.
 *  Atomic; needs a free slot. */
export function purchaseItem(
  id: string,
  cost: number,
  currency: 'credits' | 'tokens' = 'credits',
): MutResult {
  if (cost < 0) return { ok: false, reason: 'invalid' };
  if (state.owned.includes(id)) return { ok: false, reason: 'owned' };
  const balance = currency === 'tokens' ? state.tokens : state.credits;
  if (balance < cost) {
    return {
      ok: false,
      reason: currency === 'tokens' ? 'insufficient tokens' : 'insufficient credits',
    };
  }
  const slots = state.slots.slice();
  const idx = slots.findIndex((c) => c === null);
  if (idx < 0) return { ok: false, reason: 'inventory full' };
  slots[idx] = id;
  const wallet =
    currency === 'tokens' ? { tokens: state.tokens - cost } : { credits: state.credits - cost };
  state = { ...state, ...wallet, owned: [...state.owned, id], slots };
  persist();
  return { ok: true };
}

// ── Emote loadout (mega-batch 4.12) ───────────────────────────────────────
// Owned tracks PREMIUM purchases only; base emotes are always available
// (the catalog in emotes.ts knows which are base). Loadout is 4 catalog ids.

export function getOwnedEmotes(): readonly string[] {
  return state.ownedEmotes;
}

export function ownsPremiumEmote(id: string): boolean {
  return state.ownedEmotes.includes(id);
}

/** Buy a premium emote with Credits. Atomic; no inventory slot needed. */
export function purchaseEmote(id: string, cost: number): MutResult {
  if (cost < 0) return { ok: false, reason: 'invalid' };
  if (state.ownedEmotes.includes(id)) return { ok: false, reason: 'owned' };
  if (state.credits < cost) return { ok: false, reason: 'insufficient credits' };
  state = { ...state, credits: state.credits - cost, ownedEmotes: [...state.ownedEmotes, id] };
  persist();
  return { ok: true };
}

export function getEmoteLoadout(): readonly (string | null)[] {
  return state.emoteLoadout;
}

/** Set emote loadout slot `i` to a catalog id (or null to clear). */
export function setEmoteSlot(i: number, id: string | null): void {
  if (i < 0 || i >= EMOTE_LOADOUT_SLOTS) return;
  const next = state.emoteLoadout.slice();
  next[i] = id;
  state = { ...state, emoteLoadout: next };
  persist();
}

/** Spend Credits (SAMM bet, etc.). False if the balance is insufficient. */
export function spendCredits(amount: number): boolean {
  if (!Number.isFinite(amount) || amount <= 0) return false;
  if (state.credits < amount) return false;
  state = { ...state, credits: state.credits - amount };
  persist();
  return true;
}

/** Award Credits (SAMM payout, etc.). */
export function addCredits(amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) return;
  state = { ...state, credits: state.credits + amount };
  persist();
}

/** circuit_patch (4.4): has the runner ever solved the puzzle? Gates the
 *  first-clear vs repeat reward. */
export function hasClearedCircuit(): boolean {
  return state.circuitFirstClear;
}

/** Mark the circuit_patch puzzle as cleared at least once (idempotent). */
export function markCircuitCleared(): void {
  if (state.circuitFirstClear) return;
  state = { ...state, circuitFirstClear: true };
  persist();
}

/** circuit_patch: index (0–9) of the level the runner resumes on. */
export function getCircuitLevel(): number {
  return state.circuitLevel;
}

/** Advance circuit_patch progress to the next level (caps at index 9, the
 *  last of the 10 levels). Idempotent at the cap. */
export function advanceCircuitLevel(): void {
  const next = Math.min(9, state.circuitLevel + 1);
  if (next === state.circuitLevel) return;
  state = { ...state, circuitLevel: next };
  persist();
}

/** Award spendable Tokens (SAMM token prize, exchange). */
export function addTokens(amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) return;
  state = { ...state, tokens: state.tokens + amount };
  persist();
}

/** Fold admin-granted scrape-ladder units into the buffer (migration 0018
 *  remediation grants). Negative / non-finite components are ignored. */
export function addUnits(units: {
  bits: number;
  strings: number;
  serials: number;
  passcodes: number;
}): void {
  const add = (v: number): number => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  const bits = add(units.bits);
  const strings = add(units.strings);
  const serials = add(units.serials);
  const passcodes = add(units.passcodes);
  if (bits + strings + serials + passcodes === 0) return;
  state = {
    ...state,
    bits: state.bits + bits,
    strings: state.strings + strings,
    serials: state.serials + serials,
    passcodes: state.passcodes + passcodes,
  };
  persist();
}

/** Spend Tokens (token bet / token-priced item). False if insufficient. */
export function spendTokens(amount: number): boolean {
  if (!Number.isFinite(amount) || amount <= 0) return false;
  if (state.tokens < amount) return false;
  state = { ...state, tokens: state.tokens - amount };
  persist();
  return true;
}

/** Proxy-wallet exchange: buy `qty` Tokens with Credits (one-way; lore 009). */
export function exchangeCreditsForTokens(qty: number): MutResult {
  if (!Number.isInteger(qty) || qty <= 0) return { ok: false, reason: 'invalid' };
  const cost = qty * CREDITS_PER_TOKEN;
  if (state.credits < cost) return { ok: false, reason: 'insufficient credits' };
  state = { ...state, credits: state.credits - cost, tokens: state.tokens + qty };
  persist();
  return { ok: true };
}

/** Grant an inventory item for free (e.g. a SAMM prize). Needs a free slot. */
export function grantItem(id: string): MutResult {
  if (state.owned.includes(id)) return { ok: false, reason: 'owned' };
  const slots = state.slots.slice();
  const idx = slots.findIndex((c) => c === null);
  if (idx < 0) return { ok: false, reason: 'inventory full' };
  slots[idx] = id;
  state = { ...state, owned: [...state.owned, id], slots };
  persist();
  return { ok: true };
}

/**
 * Buy one level of a skill-tree node. Spends PASSCODES (not Credits — the tree
 * is the passcode sink; Credits stay the shop currency). lifetimePasscodes is
 * cumulative and is NOT decremented, so spending never re-locks the tree.
 */
export function purchaseTreeNode(key: string, cost: number, maxLevel: number): MutResult {
  if (cost < 0) return { ok: false, reason: 'invalid' };
  if (!isTreeUnlocked()) return { ok: false, reason: 'locked' };
  const level = state.upgrades[key] ?? 0;
  if (level >= maxLevel) return { ok: false, reason: 'maxed' };
  if (state.passcodes < cost) return { ok: false, reason: 'need passcodes' };
  state = {
    ...state,
    passcodes: state.passcodes - cost,
    upgrades: { ...state.upgrades, [key]: level + 1 },
  };
  persist();
  return { ok: true };
}

/** Equip (or clear, with null) a slot. `id` must be owned. Fires appearance. */
export function equip(slot: EquipSlot, id: string | null): boolean {
  if (id !== null && !state.owned.includes(id)) return false;
  const equipped: Equipped = { ...state.equipped };
  equipped[slot] = id;
  state = { ...state, equipped };
  persist(true);
  return true;
}

export function setAppearanceHidden(hidden: boolean): void {
  state = { ...state, appearanceHidden: hidden };
  persist(true);
}

/**
 * Account-link seam. The future Supabase layer calls exportProgress() to push
 * the blob to the user row, and importProgress() on login to restore. Single
 * source — inventory/outfits/pets/upgrades all ride this one blob. The
 * migration trigger itself lands when auth lands (see SERVICES.md §6).
 */
export function exportProgress(): EconomyState {
  return JSON.parse(JSON.stringify(state)) as EconomyState;
}

export function importProgress(data: unknown): boolean {
  if (!isEconomyState(data)) return false;
  state = normalize(data);
  persist(true);
  return true;
}

export async function migrateEconomyToAccount(): Promise<void> {
  // Seam stub — device-local is the only persistence today.
  void exportProgress();
}
