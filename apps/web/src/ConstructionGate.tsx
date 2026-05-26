import { type ReactNode, useEffect, useState } from 'react';
import { UnderConstruction } from './UnderConstruction.js';
import { fetchUnderConstruction, getMyRole, subscribeAuth } from './supabase.js';

/**
 * Top-level gate: when the under-construction flag is on, everyone EXCEPT
 * dev/admin accounts sees the construction page (live-testing for marked
 * accounts). Re-evaluates when auth resolves (role depends on the user).
 * Fails OPEN — any fetch error leaves the app visible, never locks everyone out.
 */
export function ConstructionGate({ children }: { children: ReactNode }): JSX.Element {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const unsub = subscribeAuth(() => {
      void (async () => {
        const [on, role] = await Promise.all([fetchUnderConstruction(), getMyRole()]);
        if (cancelled) return;
        setBlocked(on && role !== 'admin' && role !== 'dev');
      })();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  if (blocked) return <UnderConstruction />;
  return <>{children}</>;
}
