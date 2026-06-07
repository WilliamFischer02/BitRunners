// Supabase Realtime monitor for earned_badges INSERT events.
// When a new row arrives for the signed-in user, dispatches
// 'bitrunners:badge-earned' and increments the unacknowledged counter in
// profile.ts so the '!' dot on the head label lights up immediately.
//
// Lifecycle:
//   Call startBadgeMonitor() once at app start. It subscribes to auth state
//   changes and wires/tears-down the Realtime channel as the user signs in/out.
//   Idempotent.

import type { RealtimeChannel } from '@supabase/supabase-js';
import { incrementUnacknowledged } from './profile.js';
import { getSupabase, subscribeAuth } from './supabase.js';

export const BADGE_EARNED_EVENT = 'bitrunners:badge-earned';

export interface BadgeEarnedDetail {
  badgeKey: string;
  earnedAt: string;
}

let channel: RealtimeChannel | null = null;

function teardown(): void {
  if (channel) {
    const sb = getSupabase();
    if (sb) void sb.removeChannel(channel);
    channel = null;
  }
}

function setup(userId: string): void {
  teardown();
  const sb = getSupabase();
  if (!sb || !userId) return;

  channel = sb
    .channel(`badge-notify-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'earned_badges',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const row = payload.new as { badge_key?: string; earned_at?: string } | null;
        if (!row?.badge_key) return;
        incrementUnacknowledged();
        try {
          window.dispatchEvent(
            new CustomEvent<BadgeEarnedDetail>(BADGE_EARNED_EVENT, {
              detail: { badgeKey: row.badge_key, earnedAt: row.earned_at ?? '' },
            }),
          );
        } catch {
          // non-DOM env — ignore
        }
      },
    )
    .subscribe();
}

let monitorStarted = false;

/** Boots the badge Realtime monitor. Subscribes to auth so the channel is
 *  created on sign-in and removed on sign-out. Idempotent. */
export function startBadgeMonitor(): void {
  if (monitorStarted) return;
  monitorStarted = true;
  subscribeAuth((snap) => {
    if (snap.status === 'authenticated' && snap.user?.id) {
      setup(snap.user.id);
    } else {
      teardown();
    }
  });
}
