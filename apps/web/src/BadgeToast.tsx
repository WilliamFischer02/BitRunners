// In-world badge-earned notification.
// Listens for 'bitrunners:badge-earned' events and renders a queued stack of
// terminal-style toasts. Each toast auto-dismisses after 4 s.

import { useEffect, useRef, useState } from 'react';
import { BADGE_EARNED_EVENT, type BadgeEarnedDetail } from './badge-notifications.js';
import { getBadge } from './badges.js';

interface ToastItem {
  id: number;
  badgeKey: string;
  earnedAt: string;
}

let nextId = 0;

export function BadgeToast(): JSX.Element | null {
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    const onBadge = (e: Event): void => {
      const d = (e as CustomEvent<BadgeEarnedDetail>).detail;
      if (!d?.badgeKey) return;
      const id = nextId;
      nextId += 1;
      const item: ToastItem = { id, badgeKey: d.badgeKey, earnedAt: d.earnedAt };
      setQueue((q) => [...q, item]);
      const tid = window.setTimeout(() => {
        setQueue((q) => q.filter((x) => x.id !== item.id));
        timersRef.current.delete(item.id);
      }, 4000);
      timersRef.current.set(item.id, tid);
    };
    window.addEventListener(BADGE_EARNED_EVENT, onBadge);
    return () => {
      window.removeEventListener(BADGE_EARNED_EVENT, onBadge);
      for (const tid of timersRef.current.values()) window.clearTimeout(tid);
      timersRef.current.clear();
    };
  }, []);

  if (queue.length === 0) return null;

  return (
    <div className="badge-toast-stack" aria-live="polite" aria-atomic="false">
      {queue.map((item) => {
        const badge = getBadge(item.badgeKey);
        if (!badge) return null;
        return (
          <output key={item.id} className="badge-toast">
            <span className="badge-toast-glyph" style={{ color: badge.tint }}>
              {badge.glyph}
            </span>
            <span className="badge-toast-body">
              <span className="badge-toast-tier">{badge.label}</span>
              <span className="badge-toast-faction">
                {badge.faction === 'corp' ? 'corporate' : 'bitrunner'} samaritan
              </span>
            </span>
            <span className="badge-toast-label">badge unlocked</span>
          </output>
        );
      })}
    </div>
  );
}
