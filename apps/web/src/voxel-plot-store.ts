// data_base — plot persistence (P7 Stage B).
//
// Owns THE working grid: one stable Uint8Array identity for the whole app.
// The scene's PlotArena keeps a reference to it, so remote adoption copies
// INTO the same buffer (set()) and fires PLOT_RELOADED_EVENT — the arena
// just remeshes, no re-wiring. Mirrors economy-sync.ts's shape (subscribeAuth
// + uid-guarded one load per account + debounced saves + hidden/unload
// flush), scaled down to a single row.
//
// Persistence tiers:
//   guest        → localStorage only ('bitrunners.voxelplot.v1', the
//                  voxel-core envelope). First edit fires the account nudge.
//   signed in    → localStorage AND save_voxel_plot RPC (migration 0019).
//                  Until the owner applies 0019 the RPC fails quietly and
//                  the client degrades to local-only — no errors surface.
//
// Adopt-vs-push on sign-in: the DENSER build wins (countBlocks), tie →
// remote (the account is the cross-device truth). Same spirit as
// economy-sync's progressScore, with block count as the plot's only
// meaningful progress metric.

import { nudgeAccount } from './account-nudge.js';
import { getSupabase, subscribeAuth } from './supabase.js';
import {
  PLOT_FORMAT_VERSION,
  countBlocks,
  createEmptyPlot,
  decodePlotBlob,
  encodePlotBlob,
} from './voxel-core.js';

const STORAGE_KEY = 'bitrunners.voxelplot.v1';
const SAVE_DEBOUNCE_MS = 3000;

/** Fired after a remote plot was copied into the working grid in place. */
export const PLOT_RELOADED_EVENT = 'bitrunners:plot-reloaded';

let blocks: Uint8Array | null = null;
let userId: string | null = null;
let loadedUid: string | null = null;
let saveTimer: number | null = null;
let dirty = false;
let started = false;

function loadLocal(): Uint8Array | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return decodePlotBlob(JSON.parse(raw));
  } catch {
    return null; // corrupt/absent → fresh pad
  }
}

function writeLocal(): void {
  if (!blocks) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(encodePlotBlob(blocks)));
  } catch {
    // quota/unavailable — the in-memory grid still stands for the session
  }
}

/** The working grid (lazy: localStorage or a fresh pad). Stable identity —
 *  callers may hold the reference across reloads/adoptions. */
export function getPlotBlocks(): Uint8Array {
  if (!blocks) blocks = loadLocal() ?? createEmptyPlot();
  return blocks;
}

async function saveRemote(): Promise<void> {
  const sb = getSupabase();
  if (!sb || !blocks || !userId) return;
  try {
    await sb.rpc('save_voxel_plot', {
      p_blob: encodePlotBlob(blocks),
      p_version: PLOT_FORMAT_VERSION,
    });
  } catch {
    // offline / migration 0019 not applied — local copy stands, next edit retries
  }
}

/** Fetch ANY user's plot (Stage C visits render the host's build). Null on
 *  any failure — missing row, unapplied migration, malformed blob. */
export async function fetchPlotBlob(uid: string): Promise<Uint8Array | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb.rpc('get_voxel_plot', { p_user: uid });
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== 'object') return null;
    return decodePlotBlob((row as Record<string, unknown>).blob);
  } catch {
    return null;
  }
}

function flushSave(): void {
  if (saveTimer !== null) {
    window.clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (!dirty || !blocks) return;
  dirty = false;
  writeLocal();
  void saveRemote();
}

/** Call after every successful voxel edit. Debounces the save 3 s behind the
 *  last edit; nudges guests toward an account on their first edit. */
export function notePlotEdited(): void {
  if (!blocks) return;
  dirty = true;
  if (!userId) nudgeAccount('plot');
  if (saveTimer !== null) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(flushSave, SAVE_DEBOUNCE_MS);
}

/** Immediate save of any pending edits (plot exit, tab hide, unload). */
export function flushPlotSave(): void {
  flushSave();
}

async function adoptOrPush(): Promise<void> {
  const uid = userId;
  if (!uid) return;
  const remote = await fetchPlotBlob(uid);
  if (userId !== uid) return; // signed out / switched mid-fetch
  const local = getPlotBlocks();
  if (remote && countBlocks(remote) >= countBlocks(local)) {
    local.set(remote); // in place — the arena's reference stays valid
    writeLocal();
    try {
      window.dispatchEvent(new CustomEvent(PLOT_RELOADED_EVENT));
    } catch {
      // non-DOM env — ignore
    }
  } else if (countBlocks(local) > 0) {
    // Local build outranks the account row (or none exists) — push it up.
    dirty = true;
    flushSave();
  }
}

/** Wire auth + flush hooks. Idempotent; the scene calls it when the plot
 *  mode initializes (players who never open data_base still get their
 *  local build pushed up on sign-in once they DO open it). */
export function initVoxelPlotSync(): void {
  if (started) return;
  started = true;
  try {
    subscribeAuth((snap) => {
      if (snap.status === 'authenticated' && snap.user) {
        userId = snap.user.id;
        // TOKEN_REFRESHED re-reports the same user — load once per uid.
        if (loadedUid !== userId) {
          loadedUid = userId;
          void adoptOrPush();
        }
      } else {
        userId = null;
        loadedUid = null;
      }
    });
  } catch {
    // auth unconfigured — guest/local-only forever
  }
  try {
    window.addEventListener('beforeunload', flushSave);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushSave();
    });
  } catch {
    // non-DOM env — ignore
  }
}
