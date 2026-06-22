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
  addCredits,
  addTokens,
  exportProgress,
  getEconomy,
  importProgress,
  subscribeEconomy,
} from './economy.js';
import { claimEconomyGrants, getSupabase, saveEconomy, subscribeAuth } from './supabase.js';

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
    const hasRemote = !!remote && remote.v === 1;
    const remoteScrapes = typeof remote?.lifetimeScrapes === 'number' ? remote.lifetimeScrapes : -1;
    // Merge on lifetimeScrapes (monotonic, clock-independent), NOT updatedAt:
    // importProgress re-stamps updatedAt=now, and a shared-device localStorage
    // can hold another/older account's blob with a recent timestamp. Adopting
    // the account whenever it has >= lifetime progress stops a poorer local
    // state from being pushed up over a richer account (the clobber bug).
    if (hasRemote && remoteScrapes >= getEconomy().lifetimeScrapes) {
      importProgress(remote); // account has >= progress (or new device) → adopt it
      emitSynced();
    } else {
      await saveNow(uid); // no remote (first save) or local is strictly more progressed
    const remoteUpdated = typeof remote?.updatedAt === 'number' ? remote.updatedAt : -1;
    // Strict `>` so a tie favours LOCAL. Fixes the guest→signup clobber
    // (devlog 0112): a fresh account row created at sign-up carries
    // updated_at = NOW(), which usually ties or beats the in-memory guest
    // state's updatedAt and clobbered hours of offline scrape progress.
    // On a real tie, the guest who's been playing wins; the server-fresh
    // empty blob loses.
    if (remote && remoteUpdated > getEconomy().updatedAt) {
      importProgress(remote); // account is newer → adopt it
      emitSynced();
    } else {
      await saveNow(uid); // local is newer / server empty or tied → push it up
    }
    // Apply grants WHILE `loading` is still true so the addCredits/addTokens
    // calls don't trigger the debounce listener. The explicit saveNow at the
    // end of applyPendingGrants is the single authoritative flush.
    await applyPendingGrants(uid);
  } finally {
    loading = false;
  }
}

/**
 * Claim any admin-issued grants (migration 0006) and fold them into the local
 * balance. The server claim is exactly-once/atomic; we then push the new balance
 * straight up so a second device sees it even before the debounced save.
 */
async function applyPendingGrants(uid: string): Promise<void> {
  const grant = await claimEconomyGrants();
  if (!grant || (grant.credits <= 0 && grant.tokens <= 0)) return;
  if (grant.credits > 0) addCredits(grant.credits);
  if (grant.tokens > 0) addTokens(grant.tokens);
  await saveNow(uid);
  try {
    window.dispatchEvent(new CustomEvent('bitrunners:grant-received', { detail: grant }));
  } catch {
    // non-DOM env — ignore
  }
}

async function saveNow(uid: string): Promise<void> {
  const result = await saveEconomy(uid, exportProgress());
  if (!result) return; // network / unconfigured — keep local, retry on next change
  if (!result.accepted) {
    // Server rejected this write as stale / a clobber (fewer lifetimeScrapes).
    // Adopt the authoritative remote so the device converges on the real state
    // instead of repeatedly trying to push a lower one up.
    console.warn('[bitrunners] economy save rejected:', result.reason, '— reloading remote');
    await loadFromAccount(uid);
    return;
  }
  emitSynced();
}

/**
 * Synchronously cancel any pending debounced save and flush state now.
 * Called from beforeunload / visibilitychange so progress isn't lost when the
 * tab closes / is backgrounded inside the 1500 ms debounce window.
 */
function flushPendingSave(): void {
  if (saveTimer !== null) {
    window.clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (userId) void saveNow(userId);
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

  // Don't lose progress if the tab closes inside the debounce window.
  // visibilitychange catches tab-backgrounded / phone-locked / app-switched;
  // beforeunload catches the actual unload. Browsers may not finish the
  // fetch on unload, but visibilitychange fires earlier on most mobile and
  // desktop flows so the save has a chance to land.
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', flushPendingSave);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushPendingSave();
      });
    }
  }
}
