// Account sync for the device-local economy. Bridges economy.ts ⇄ Supabase so a
// signed-in player's whole EconomyState (bits/strings/serials/passcodes,
// credits, lockedTokens, owned, upgrades, inventory, equipped, unlocks,
// tutorialDone) persists across sessions/devices. This is the ONLY place the
// economy meets the network, keeping economy.ts itself isolated.
//
// Account SYNC, not server-AUTHORITATIVE: the client writes its own blob
// (own-row RLS, migration 0002). Fine for saving a player's own progress;
// trading needs stricter server validation (p2p-trading-epic.md P1).
import {
  type EconomyState,
  exportProgress,
  getEconomy,
  importProgress,
  subscribeEconomy,
} from './economy.js';
import { getSupabase, subscribeAuth } from './supabase.js';

const SAVE_DEBOUNCE_MS = 1500;
const TABLE = 'player_economy';

let userId: string | null = null;
let saveTimer: number | null = null;
let loading = false;

// Lets the account UI confirm progress is persisting (continuity check).
function emitSynced(): void {
  try {
    window.dispatchEvent(new CustomEvent('bitrunners:economy-synced'));
  } catch {
    // non-DOM env — ignore
  }
}

async function loadFromAccount(uid: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  loading = true;
  try {
    const { data, error } = await sb.from(TABLE).select('blob').eq('user_id', uid).maybeSingle();
    if (error) {
      console.warn('[bitrunners] economy load failed:', error.message);
      return;
    }
    const remote = data?.blob as Partial<EconomyState> | undefined;
    const remoteUpdated = typeof remote?.updatedAt === 'number' ? remote.updatedAt : -1;
    if (remote && remoteUpdated >= getEconomy().updatedAt) {
      importProgress(remote); // account is newer (or local never saved) → adopt it
      emitSynced();
    } else {
      await saveNow(uid); // local is newer / server empty → push it up
    }
  } finally {
    loading = false;
  }
}

async function saveNow(uid: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb
    .from(TABLE)
    .upsert({ user_id: uid, blob: exportProgress(), updated_at: new Date().toISOString() });
  if (error) {
    console.warn('[bitrunners] economy save failed:', error.message);
    return;
  }
  emitSynced();
}

/**
 * Wire economy persistence to the signed-in account. Call once at app start.
 * No-op when auth isn't configured (subscribeAuth reports guest).
 */
export function initEconomySync(): void {
  subscribeAuth((snap) => {
    if (snap.status === 'authenticated' && snap.user) {
      userId = snap.user.id;
      void loadFromAccount(userId);
    } else {
      userId = null;
    }
  });

  subscribeEconomy(() => {
    // `loading` guards the importProgress→event echo from bouncing back up.
    if (!userId || loading) return;
    if (saveTimer !== null) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      if (userId) void saveNow(userId);
    }, SAVE_DEBOUNCE_MS);
  });
}
