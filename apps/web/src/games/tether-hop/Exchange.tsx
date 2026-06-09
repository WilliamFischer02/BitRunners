import { useState } from 'react';
import { addCredits, spendChatter } from '../../economy.js';

// Chatter exchange UI. Trades captured chatter for credits at a fixed rate.
// Faction choice is flavor-only in v1 (no Samaritan award yet — that lands
// when the Admin / Company NPCs ship in Sub-Phase F's follow-up). Future
// versions will route through the same complete_mission style SECURITY
// DEFINER RPC the missions use.
//
// Rate: 1 chatter = 5 credits, regardless of faction. Placeholder — owner
// can tune in docs/lore/017-tether-hop-and-chatter.md.

const CREDITS_PER_CHATTER = 5;

type Faction = 'admin' | 'company';

interface ExchangeProps {
  chatter: number;
  onBack(): void;
}

export function Exchange({ chatter, onBack }: ExchangeProps): JSX.Element {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const exchange = (faction: Faction): void => {
    if (busy || chatter <= 0) return;
    setBusy(true);
    const credits = chatter * CREDITS_PER_CHATTER;
    const ok = spendChatter(chatter);
    if (ok) {
      addCredits(credits);
      setMsg(
        faction === 'admin'
          ? `the admin nods. +${credits} credits routed via cloud channel.`
          : `the company files the chatter. +${credits} credits posted to your ledger.`,
      );
    } else {
      setMsg('! exchange failed — chatter balance changed.');
    }
    setBusy(false);
  };

  return (
    <section className="panel-section tether-section">
      <div className="panel-section-title">$ exchange chatter</div>
      <div className="panel-stub">
        ─── trade your captured chatter for credits. each faction pays the same rate (
        {CREDITS_PER_CHATTER} credits per chatter) but the flavor differs.
      </div>
      <div className="exchange-row">
        <span className="exchange-key">on hand</span>
        <b className="exchange-val">{chatter} chatter</b>
        <span className="exchange-key">payout</span>
        <b className="exchange-val">{chatter * CREDITS_PER_CHATTER} credits</b>
      </div>
      <div className="exchange-actions">
        <button
          type="button"
          className="mission-choice-btn mission-choice-btn--br"
          disabled={busy || chatter <= 0}
          onClick={() => exchange('admin')}
        >
          <span className="mission-choice-label">{'// route via The Admin'}</span>
          <span className="mission-choice-meta">cloud channel</span>
        </button>
        <button
          type="button"
          className="mission-choice-btn mission-choice-btn--corp"
          disabled={busy || chatter <= 0}
          onClick={() => exchange('company')}
        >
          <span className="mission-choice-label">{'// file with The Company'}</span>
          <span className="mission-choice-meta">corporate ledger</span>
        </button>
      </div>
      {msg && <div className="exchange-msg">{msg}</div>}
      <div className="tether-actions">
        <button type="button" className="panel-toggle" onClick={onBack}>
          [ back ]
        </button>
      </div>
    </section>
  );
}
