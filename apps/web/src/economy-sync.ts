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

/**
 * Heuristic "how much has this blob accomplished" score, used to decide which
 * of local vs remote to keep on load. Keying on lifetimeScrapes ALONE (the old
 * rule) lost the progress of a guest who only played the minigames — they earn
 * credits / items / emotes but never scrape, so lifetimeScrapes stays 0 and a
 * fresh (empty) account row tied at 0 and clobbered them on signup. This folds
 * in every earning dimension so a guest with ANY progress out-scores an empty
 * account and is pushed up instead of wiped. Cumulative/monotonic counters are
 * weighted heaviest; credits/tokens fluctuate but still count so pure-minigame
 * progress registers. Not a security measure — the blob stays client-authored.
 */
function progressScore(s: Partial<EconomyState>): number {
  const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const len = (v: unknown): number => (Array.isArray(v) ? v.length : 0);
  return (
    n(s.lifetimeScrapes) +
    n(s.lifetimePasscodes) * 8 +
    n(s.lifetimeAuras) * 64 +
    n(s.prestiges) * 500 +
    n(s.credits) +
    n(s.tokens) * 100 +
    len(s.owned) * 50 +
    len(s.ownedEmotes) * 50 +
    len(s.unlocks) * 25 +
    n(s.repCorporate) +
    n(s.repBitrunner) +
    (s.circuitFirstClear ? 100 : 0)
  );
}

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
    // Merge on a broad progressScore (clock-independent), NOT updatedAt and NOT
    // lifetimeScrapes alone. One rule fixes every clobber:
    //  * shared-device (devlog 0093): a poorer/other-account local blob carries
    //    a recent updatedAt; keying on progress stops it overwriting a richer
    //    remote account (remote scores higher → adopt remote).
    //  * guest→signup (devlog 0112/0123): a guest's real progress out-scores a
    //    fresh/empty account row and is pushed up instead of clobbered. This now
    //    covers minigame-only guests (credits/items but lifetimeScrapes 0), who
    //    the old lifetimeScrapes-only tie WIPED on signup.
    const localScore = progressScore(getEconomy());
    const remoteScore = hasRemote ? progressScore(remote) : -1;
    if (hasRemote && remoteScore >= localScore) {
      importProgress(remote); // account has >= progress (or new device) → adopt it
      emitSynced();
    } else {
      await saveNow(uid); // no remote (first save) or local is more progressed
    }
    // Apply grants WHILE `loading` is still true so the addCredits/addTokens
    // calls don't trigger the debounce listener. The saveNow inside
    // applyPendingGrants is the single authoritative flush.
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
    await adoptRemote(uid);
    return;
  }
  emitSynced();
}

/** Re-fetch the account's blob and adopt it locally. Used when the server
 *  rejects a save as stale/clobber so the device converges on the real state
 *  instead of fighting it. Guards `loading` so the import doesn't echo back
 *  into another save. */
async function adoptRemote(uid: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { data } = await sb.from(TABLE).select('blob').eq('user_id', uid).maybeSingle();
  const remote = data?.blob as Partial<EconomyState> | undefined;
  if (!remote || remote.v !== 1) return;
  const wasLoading = loading;
  loading = true;
  importProgress(remote);
  loading = wasLoading;
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
