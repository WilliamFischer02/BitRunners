// Signup-grant — awards a small starter package the first time a given
// Supabase account is seen on this device. Per-account flag stored in
// localStorage keyed by user id, so the grant fires exactly once per
// (account, device) pair even if the user signs out and back in.
//
// Idempotent: a duplicate call is a no-op. Safe to subscribe at module
// load (App.tsx wires it up alongside startIdentity / startBadgeMonitor).

import { addCredits, addTokens } from './economy.js';
import { subscribeAuth } from './supabase.js';

const FLAG_KEY = 'bitrunners.signup-grant.v1';
const SIGNUP_CREDITS = 250;
const SIGNUP_TOKENS = 2;

interface ClaimedMap {
  [userId: string]: number; // timestamp of claim
}

function readClaims(): ClaimedMap {
  try {
    const raw = localStorage.getItem(FLAG_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as ClaimedMap) : {};
  } catch {
    return {};
  }
}

function persistClaims(claims: ClaimedMap): void {
  try {
    localStorage.setItem(FLAG_KEY, JSON.stringify(claims));
  } catch {
    // storage unavailable — claim resets next load, harmless
  }
}

let started = false;
export function startSignupGrant(): void {
  if (started) return;
  started = true;
  subscribeAuth((snap) => {
    if (snap.status !== 'authenticated') return;
    const uid = snap.user?.id;
    if (!uid) return;
    const claims = readClaims();
    if (claims[uid]) return;
    addCredits(SIGNUP_CREDITS);
    addTokens(SIGNUP_TOKENS);
    claims[uid] = Date.now();
    persistClaims(claims);
    try {
      window.dispatchEvent(
        new CustomEvent('bitrunners:signup-grant', {
          detail: { credits: SIGNUP_CREDITS, tokens: SIGNUP_TOKENS },
        }),
      );
    } catch {
      // non-DOM env — ignore
    }
  });
}
