// Single source of truth for the local user's identity payload.
// Owns the cached displayName / equippedBadge / equippedTheme + Samaritan
// snapshot. Emits 'bitrunners:identity-changed' on any mutation so the scene
// label projection, BadgeStrip, and the network 'identity' send can react.
//
// Guest-mode behavior: when Supabase is unconfigured or the user is signed
// out, getIdentity() returns a deterministic per-session 'runner_<6 chars>'
// fallback so the in-world label still shows SOMETHING and the experience
// doesn't dead-end.

import { type IdentitySnapshot, fetchMyIdentity, subscribeAuth } from './supabase.js';

export interface LocalIdentity {
  displayName: string;
  /** True when the user is signed in AND has an approved name. False for
   *  guests, pending names, and the auto-assigned placeholder rendered while
   *  a submitted name awaits review. */
  approved: boolean;
  /** True when the most-recent submission was rejected — surfaced in the
   *  editor so the user can revise. */
  rejected: boolean;
  rejectionNote: string | null;
  equippedBadge: string;
  equippedTheme: string;
  samaritanCorporate: number;
  samaritanBitrunner: number;
  /** Number of earned-but-unacknowledged badge rows. Drives the '!' dot. */
  unacknowledged: number;
  /** True when the user is signed in. Drives guest gating in the editor. */
  signedIn: boolean;
}

const CHANGED_EVENT = 'bitrunners:identity-changed';

function makeGuestName(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let out = 'runner_';
  for (let i = 0; i < 6; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

let cache: LocalIdentity = {
  displayName: makeGuestName(),
  approved: false,
  rejected: false,
  rejectionNote: null,
  equippedBadge: '',
  equippedTheme: '',
  samaritanCorporate: 0,
  samaritanBitrunner: 0,
  unacknowledged: 0,
  signedIn: false,
};

let inflight: Promise<void> | null = null;
let signedIn = false;

function fanout(): void {
  try {
    window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: cache }));
  } catch {
    // non-DOM env — ignore
  }
}

function applySnapshot(snap: IdentitySnapshot | null): void {
  if (!snap) {
    // Signed in but RPC failed (e.g. migration 0007 not yet applied) — keep
    // the guest fallback name rather than blank the label.
    cache = { ...cache, signedIn };
    fanout();
    return;
  }
  const name = snap.displayName?.trim() || makeGuestName();
  const approved = snap.displayNameStatus === 'approved';
  const rejected = snap.displayNameStatus === 'rejected';
  cache = {
    displayName: name,
    approved,
    rejected,
    rejectionNote: rejected ? snap.displayNameNote : null,
    equippedBadge: snap.equippedBadge ?? '',
    equippedTheme: snap.equippedTheme ?? '',
    samaritanCorporate: snap.samaritanCorporate,
    samaritanBitrunner: snap.samaritanBitrunner,
    unacknowledged: snap.unacknowledged,
    signedIn,
  };
  fanout();
}

/** Re-fetches identity from Supabase. Coalesces concurrent calls. */
export async function refreshIdentity(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    if (!signedIn) {
      // Guest: reset to fresh placeholder (only if we don't already have one).
      if (!cache.displayName.startsWith('runner_')) {
        cache = {
          ...cache,
          displayName: makeGuestName(),
          approved: false,
          rejected: false,
          rejectionNote: null,
          signedIn: false,
        };
      } else {
        cache = { ...cache, signedIn: false };
      }
      fanout();
      return;
    }
    const snap = await fetchMyIdentity();
    applySnapshot(snap);
  })();
  try {
    await inflight;
  } finally {
    inflight = null;
  }
}

/** Read the current cached identity. Cheap; safe to call every frame. */
export function getIdentity(): LocalIdentity {
  return cache;
}

/** Subscribe to identity changes. Returns an unsubscribe function. */
export function subscribeIdentity(cb: (id: LocalIdentity) => void): () => void {
  const handler = (e: Event): void => {
    cb((e as CustomEvent<LocalIdentity>).detail ?? cache);
  };
  window.addEventListener(CHANGED_EVENT, handler);
  // Fire once synchronously so subscribers start from current state.
  cb(cache);
  return () => window.removeEventListener(CHANGED_EVENT, handler);
}

/** Optimistic local update — used after a successful equip RPC to flip the
 *  badge glyph immediately without waiting for the next round-trip. */
export function setEquippedBadgeLocal(key: string): void {
  if (cache.equippedBadge === key) return;
  cache = { ...cache, equippedBadge: key };
  fanout();
}

export function setEquippedThemeLocal(key: string): void {
  if (cache.equippedTheme === key) return;
  cache = { ...cache, equippedTheme: key };
  fanout();
}

/** Decrements the unacknowledged counter after a successful acknowledge RPC. */
export function decrementUnacknowledged(): void {
  if (cache.unacknowledged <= 0) return;
  cache = { ...cache, unacknowledged: cache.unacknowledged - 1 };
  fanout();
}

/** Increments the unacknowledged counter when a new badge arrives via Realtime. */
export function incrementUnacknowledged(): void {
  cache = { ...cache, unacknowledged: cache.unacknowledged + 1 };
  fanout();
}

/** Boots the identity subsystem. Subscribes to auth so signed-in/out state
 *  re-fetches automatically. Idempotent. */
let started = false;
export function startIdentity(): void {
  if (started) return;
  started = true;
  subscribeAuth((snap) => {
    const wasSignedIn = signedIn;
    signedIn = snap.status === 'authenticated';
    // Re-fetch whenever auth state flips.
    if (wasSignedIn !== signedIn) {
      void refreshIdentity();
    } else if (signedIn) {
      // Same session but a callback fired — light refresh.
      void refreshIdentity();
    } else {
      fanout();
    }
  });

  // Mission completions mutate samaritan_corporate / samaritan_bitrunner on
  // the server via the complete_mission RPC, but the client's cached
  // identity snapshot only refreshes on auth events. Without this listener
  // the reputation chips stay stale until next sign-in even though badges
  // (which have their own realtime monitor) tick up correctly.
  try {
    window.addEventListener('bitrunners:mission-complete', () => {
      void refreshIdentity();
    });
  } catch {
    // non-DOM env — ignore
  }
}
