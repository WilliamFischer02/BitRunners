// Account-needed nudge (mega-batch 2 · 4.3).
//
// When a GUEST does something whose progress only survives across devices with
// an account, pop a small, dismissable modal that routes to account creation.
// Each trigger fires at most once per session; signed-in users never see it.
//
// This module is the tiny call surface other systems use (`nudgeAccount`) plus
// the wiring for the event-sourced trigger (badge-earned). It only reads auth
// state and dispatches a DOM event — no React and no scene/economy coupling —
// so it is safe to call from any UI or plain module.

import { BADGE_EARNED_EVENT } from './badge-notifications.js';
import { isAuthConfigured, subscribeAuth } from './supabase.js';

export type NudgeReason = 'minigame' | 'shop' | 'mission' | 'badge' | 'emote';

export const ACCOUNT_NUDGE_EVENT = 'bitrunners:account-nudge';

export interface AccountNudgeDetail {
  reason: NudgeReason;
}

let signedIn = false;
let started = false;
const fired = new Set<NudgeReason>();

/**
 * Wire the auth watch + event-sourced triggers. Idempotent; call once at app
 * start (App.tsx) alongside the other start* subsystems.
 */
export function startAccountNudge(): void {
  if (started) return;
  started = true;
  try {
    subscribeAuth((snap) => {
      signedIn = snap.status === 'authenticated';
    });
  } catch {
    // non-DOM / unconfigured — treated as guest
  }
  // Badges are inserted server-side (earned_badges, auth-only), so in practice
  // this only fires for signed-in users and the guard below no-ops it. Wired
  // anyway so the 'badge' trigger has a source the moment local badges exist.
  try {
    window.addEventListener(BADGE_EARNED_EVENT, () => nudgeAccount('badge'));
  } catch {
    // non-DOM env — ignore
  }
}

/**
 * Nudge a guest to make an account. No-op for signed-in users, for a reason
 * already shown this session, or when auth isn't configured (no account to
 * make). Fires `ACCOUNT_NUDGE_EVENT`; the AccountNudge component renders it.
 */
export function nudgeAccount(reason: NudgeReason): void {
  if (!started) startAccountNudge();
  if (signedIn) return;
  if (!isAuthConfigured()) return;
  if (fired.has(reason)) return;
  fired.add(reason);
  try {
    window.dispatchEvent(
      new CustomEvent<AccountNudgeDetail>(ACCOUNT_NUDGE_EVENT, { detail: { reason } }),
    );
  } catch {
    // non-DOM env — ignore
  }
}
