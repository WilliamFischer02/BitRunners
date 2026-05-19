// Data Scrape economy — pure model + device-local persistence.
// Design: docs/design/clicker-minigame.md · Lore: docs/lore/007-data-economy.md
//
// Device-local only (no IP, no server, no PII). Versioned blob so account
// migration (when Supabase auth lands) is a clean seam — see migrate stub.

export const ECONOMY_STORAGE_KEY = 'bitrunners.economy.v1';
export const ECONOMY_EVENT = 'bitrunners:economy-changed';

// Uniform ladder ratio (locked owner decision): 8 bits = 1 string, etc.
export const STEP = 8;
// Credits paid per passcode traded. Design number; balancing is a follow-up.
export const CREDITS_PER_PASSCODE = 4;

export type RefinableTier = 'bits' | 'strings' | 'serials';
export type Faction = 'admin' | 'company';

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
  updatedAt: number;
}

const NEXT_TIER: Record<RefinableTier, 'strings' | 'serials' | 'passcodes'> = {
  bits: 'strings',
  strings: 'serials',
  serials: 'passcodes',
};

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
    updatedAt: 0,
  };
}

function isEconomyState(x: unknown): x is EconomyState {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  if (o.v !== 1) return false;
  const numeric: (keyof EconomyState)[] = [
    'bits',
    'strings',
    'serials',
    'passcodes',
    'credits',
    'repCorporate',
    'repBitrunner',
    'lifetimeScrapes',
    'updatedAt',
  ];
  return numeric.every((k) => typeof o[k] === 'number' && Number.isFinite(o[k]));
}

function load(): EconomyState {
  try {
    const raw = localStorage.getItem(ECONOMY_STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed: unknown = JSON.parse(raw);
    return isEconomyState(parsed) ? parsed : defaultState();
  } catch {
    return defaultState();
  }
}

let state: EconomyState = load();

function persist(): void {
  state.updatedAt = Date.now();
  try {
    localStorage.setItem(ECONOMY_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable (private mode / quota) — keep in-memory state
  }
  try {
    window.dispatchEvent(new CustomEvent(ECONOMY_EVENT));
  } catch {
    // non-DOM env — ignore
  }
}

export function getEconomy(): Readonly<EconomyState> {
  return state;
}

/** Subscribe to any economy change. Mirrors the settings-changed pattern. */
export function subscribeEconomy(cb: () => void): () => void {
  const handler = (): void => cb();
  window.addEventListener(ECONOMY_EVENT, handler);
  return () => window.removeEventListener(ECONOMY_EVENT, handler);
}

/** SCRAPE — one manual click yields one bit. */
export function scrape(): void {
  state = { ...state, bits: state.bits + 1, lifetimeScrapes: state.lifetimeScrapes + 1 };
  persist();
}

export function canTabulate(from: RefinableTier): boolean {
  return state[from] >= STEP;
}

/** TABULATING — refine STEP of a tier into 1 of the next. */
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

/**
 * CALCULATING — trade 1 passcode for Credits with The Admin (destroys it,
 * privacy) or The Company (recycles it). +1 on the matching Samaritan track.
 *
 * Reputation reward curve is deliberately NOT implemented here — it's an open
 * owner Q&A (faction-reward model). We store the raw count and emit an intent
 * so the reward layer can plug in later without touching this module.
 */
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

/**
 * Account-migration seam. When Supabase auth lands, push `state` to the user
 * row and mark migrated (see docs/setup/SERVICES.md §6, design §6). Intentional
 * stub — device-local is the only persistence today.
 */
export async function migrateEconomyToAccount(): Promise<void> {
  void getEconomy();
}
