// Local mission-progress persistence — device-local store of which
// missions a runner has completed and which they're partway through.
//
// Why: the scene's mission bootstrap used to always set MISSIONS[0] as
// the active mission, which meant every page reload restarted the
// aether-recovery objective from scratch (and, if migration 0011 isn't
// applied server-side, re-handed out the reputation reward each time).
// The server's complete_mission RPC IS idempotent once 0011 ships, but
// the client also needs to NOT re-bootstrap the same mission as 'active'
// once it's complete. This module is the source of truth for client-side
// completion state.
//
// State shape (versioned blob, same pattern as economy.ts):
//   v: 1
//   completed: string[]   — mission keys the runner has marked complete
//   active:    string|null — currently-active mission key (or null)
//   nextIdx:   number     — checkpoint index for the active mission

import type { MissionFaction, MissionState } from './missions.js';

const STORAGE_KEY = 'bitrunners.mission-progress.v1';
const EVENT = 'bitrunners:mission-progress-changed';

export interface MissionProgressLocal {
  v: 1;
  completed: string[];
  active: string | null;
  nextIdx: number;
  /** Server-recorded state for the active mission ('active' | 'final'). */
  activeState: MissionState;
  /** Faction chosen at each completed mission's final dialogue, keyed by
   *  mission key. Additive (older blobs default to {}). Used so the
   *  objectives panel can label past completions even when they are no
   *  longer the active mission. */
  factions: Record<string, MissionFaction>;
}

function defaultState(): MissionProgressLocal {
  return { v: 1, completed: [], active: null, nextIdx: 0, activeState: 'inactive', factions: {} };
}

function isState(x: unknown): x is MissionProgressLocal {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    o.v === 1 && Array.isArray(o.completed) && (typeof o.active === 'string' || o.active === null)
  );
}

function normalizeFactions(x: unknown): Record<string, MissionFaction> {
  if (typeof x !== 'object' || x === null) return {};
  const out: Record<string, MissionFaction> = {};
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
    if (v === 'corporate' || v === 'bitrunner') out[k] = v;
  }
  return out;
}

function load(): MissionProgressLocal {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed: unknown = JSON.parse(raw);
    if (!isState(parsed)) return defaultState();
    // Defensive normalization.
    return {
      v: 1,
      completed: parsed.completed.filter((k): k is string => typeof k === 'string'),
      active: parsed.active,
      nextIdx: Number.isFinite(parsed.nextIdx) ? parsed.nextIdx : 0,
      activeState: (parsed.activeState ?? 'inactive') as MissionState,
      factions: normalizeFactions(parsed.factions),
    };
  } catch {
    return defaultState();
  }
}

let state: MissionProgressLocal = load();

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable — keep in-memory copy only
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: state }));
  } catch {
    // non-DOM env — ignore
  }
}

export function getProgress(): Readonly<MissionProgressLocal> {
  return state;
}

export function isCompleted(key: string): boolean {
  return state.completed.includes(key);
}

export function setActive(
  key: string | null,
  nextIdx = 0,
  missionState: MissionState = 'active',
): void {
  state = { ...state, active: key, nextIdx, activeState: missionState };
  persist();
}

export function advanceActiveIdx(nextIdx: number, missionState: MissionState): void {
  state = { ...state, nextIdx, activeState: missionState };
  persist();
}

export function markCompleted(key: string, faction?: MissionFaction): void {
  const alreadyDone = state.completed.includes(key);
  const factions = faction ? { ...state.factions, [key]: faction } : state.factions;
  if (alreadyDone && factions === state.factions) return;
  state = {
    ...state,
    completed: alreadyDone ? state.completed : [...state.completed, key],
    factions,
    active: null,
    nextIdx: 0,
    activeState: 'complete',
  };
  persist();
}

/** Faction the runner picked when they completed `key`, or null. */
export function factionFor(key: string): MissionFaction | null {
  return state.factions[key] ?? null;
}

/** Overwrite the entire local store from the server's authoritative view.
 *  Server is the source of truth on sign-in (acceptance: a returning player
 *  loads exactly the state they left). Merges nothing — the server snapshot
 *  wins — but tolerates a partial snapshot by keeping it internally
 *  consistent. */
export function reconcileFromServer(snap: {
  completed: string[];
  factions: Record<string, MissionFaction>;
  active: string | null;
  nextIdx: number;
  activeState: MissionState;
}): void {
  state = {
    v: 1,
    completed: [...new Set(snap.completed)],
    factions: { ...snap.factions },
    active: snap.active,
    nextIdx: Number.isFinite(snap.nextIdx) ? snap.nextIdx : 0,
    activeState: snap.activeState,
  };
  persist();
}

export function subscribeProgress(cb: (snap: Readonly<MissionProgressLocal>) => void): () => void {
  const handler = (): void => cb(state);
  window.addEventListener(EVENT, handler);
  // sync fire so subscribers start from current state
  cb(state);
  return () => window.removeEventListener(EVENT, handler);
}
