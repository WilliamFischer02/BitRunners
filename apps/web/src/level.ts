// Runner level — derived from the number of earned badges (mega-batch 4.10).
//
// Default formula (flagged STOP-AND-ASK in the devlog): level = number of
// owned badges, capped at LEVEL_CAP. 1 badge → Lv 1, 20+ badges → Lv 20.
// Kept as a single pure function so a future curve is a one-line swap.
//
// The badge count is read from Supabase on sign-in and re-read whenever a new
// badge arrives (the realtime monitor in badge-notifications.ts fires
// BADGE_EARNED_EVENT). Guests are level 0.

import { BADGE_EARNED_EVENT } from './badge-notifications.js';
import { fetchMyBadges, subscribeAuth } from './supabase.js';

export const LEVEL_CAP = 20;
const EVENT = 'bitrunners:level-changed';

/** level = owned badge count, clamped to [0, LEVEL_CAP]. */
export function levelFromBadgeCount(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(LEVEL_CAP, Math.floor(n));
}

let level = 0;

export function getLevel(): number {
  return level;
}

function set(n: number): void {
  const next = levelFromBadgeCount(n);
  if (next === level) return;
  level = next;
  try {
    window.dispatchEvent(new CustomEvent<number>(EVENT, { detail: level }));
  } catch {
    // non-DOM env — ignore
  }
}

export function subscribeLevel(cb: (n: number) => void): () => void {
  const handler = (e: Event): void => cb((e as CustomEvent<number>).detail ?? level);
  window.addEventListener(EVENT, handler);
  cb(level);
  return () => window.removeEventListener(EVENT, handler);
}

async function refresh(): Promise<void> {
  try {
    const badges = await fetchMyBadges();
    set(badges ? badges.length : 0);
  } catch {
    // network/RPC failure — keep the last known level
  }
}

let started = false;
export function startLevel(): void {
  if (started) return;
  started = true;
  subscribeAuth((snap) => {
    if (snap.status === 'authenticated') void refresh();
    else set(0);
  });
  window.addEventListener(BADGE_EARNED_EVENT, () => void refresh());
}
