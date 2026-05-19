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
export const INVENTORY_SLOTS = 16;

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
  credits: number;
  repCorporate: number;
  repBitrunner: number;
  lifetimeScrapes: number;
  owned: string[];
  upgrades: Record<string, number>;
  slots: (string | null)[];
  equipped: Equipped;
  appearanceHidden: boolean;
  updatedAt: number;
}

const NEXT_TIER: Record<RefinableTier, 'strings' | 'serials' | 'passcodes'> = {
  bits: 'strings',
  strings: 'serials',
  serials: 'passcodes',
};

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
    credits: 0,
    repCorporate: 0,
    repBitrunner: 0,
    lifetimeScrapes: 0,
    owned: [],
    upgrades: {},
    slots: emptySlots(),
    equipped: { head: null, chest: null, legs: null, pet: null },
    appearanceHidden: false,
    updatedAt: 0,
  };
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

function normalize(parsed: EconomyState): EconomyState {
  const p = parsed as unknown as Record<string, unknown>;
  return {
    ...defaultState(),
    ...parsed,
    owned: strArray(p.owned),
    upgrades: numRecord(p.upgrades),
    slots: normSlots(p.slots),
    equipped: normEquipped(p.equipped),
    appearanceHidden: p.appearanceHidden === true,
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

export function scrapeYield(): number {
  return 1 + (state.upgrades.scrape ?? 0);
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
  next.credits += CREDITS_PER_PASSCODE;
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

export function getOwned(): readonly string[] {
  return state.owned;
}

export function ownsItem(id: string): boolean {
  return state.owned.includes(id);
}

export function getSlots(): readonly (string | null)[] {
  return state.slots;
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

/** Buy a one-time inventory item (clothing/pet). Atomic; needs a free slot. */
export function purchaseItem(id: string, cost: number): MutResult {
  if (cost < 0) return { ok: false, reason: 'invalid' };
  if (state.owned.includes(id)) return { ok: false, reason: 'owned' };
  if (state.credits < cost) return { ok: false, reason: 'insufficient credits' };
  const slots = state.slots.slice();
  const idx = slots.findIndex((c) => c === null);
  if (idx < 0) return { ok: false, reason: 'inventory full' };
  slots[idx] = id;
  state = { ...state, credits: state.credits - cost, owned: [...state.owned, id], slots };
  persist();
  return { ok: true };
}

/** Buy one level of a rate upgrade (repeatable up to maxLevel). */
export function purchaseUpgrade(key: string, cost: number, maxLevel: number): MutResult {
  if (cost < 0) return { ok: false, reason: 'invalid' };
  const level = state.upgrades[key] ?? 0;
  if (level >= maxLevel) return { ok: false, reason: 'maxed' };
  if (state.credits < cost) return { ok: false, reason: 'insufficient credits' };
  state = {
    ...state,
    credits: state.credits - cost,
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
