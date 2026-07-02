import { useEffect, useState } from 'react';
import { hasGreedProtocol, subscribeEconomy } from './economy.js';
import { subscribeAuth } from './supabase.js';

// Corporate Greed Protocol (data-scraper tree capstone, 5,000,000 passcodes):
// a persistent gold inner-edge glow on the whole game, shown only while signed
// in (the flag rides the account-synced economy blob). Pointer-events off.

export function GreedGlow(): JSX.Element | null {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let signedIn = false;
    const recompute = (): void => setShow(signedIn && hasGreedProtocol());
    const unsubEco = subscribeEconomy(recompute);
    const unsubAuth = subscribeAuth((snap) => {
      signedIn = snap.status === 'authenticated';
      recompute();
    });
    recompute();
    return () => {
      unsubEco();
      unsubAuth();
    };
  }, []);

  if (!show) return null;
  return <div className="greed-glow" aria-hidden="true" />;
}
