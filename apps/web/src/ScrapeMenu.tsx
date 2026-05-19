import { useEffect, useState } from 'react';
import {
  type EconomyState,
  type Faction,
  type RefinableTier,
  STEP,
  calculate,
  canCalculate,
  canTabulate,
  getEconomy,
  scrape,
  subscribeEconomy,
  tabulate,
} from './economy.js';

type Verb = 'SCRAPE' | 'TABULATING' | 'CALCULATING';

const TIER_STEPS: { from: RefinableTier; label: string }[] = [
  { from: 'bits', label: 'bits → string' },
  { from: 'strings', label: 'strings → serial' },
  { from: 'serials', label: 'serials → passcode' },
];

export function ScrapeMenu(): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="scrape-launch"
        onClick={() => setOpen((v) => !v)}
        title="open data scrape"
      >
        <div className="scrape-launch-label">{'// data scrape'}</div>
        <div className="scrape-launch-sub">{'> cookie-clicker'}</div>
      </button>
      {open && <ScrapePanel onClose={() => setOpen(false)} />}
    </>
  );
}

interface ScrapePanelProps {
  onClose(): void;
}

function ScrapePanel({ onClose }: ScrapePanelProps): JSX.Element {
  const [eco, setEco] = useState<EconomyState>(() => ({ ...getEconomy() }));
  const [verb, setVerb] = useState<Verb>('SCRAPE');

  useEffect(() => subscribeEconomy(() => setEco({ ...getEconomy() })), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const flash = (v: Exclude<Verb, 'SCRAPE'>): void => {
    setVerb(v);
    window.setTimeout(() => setVerb('SCRAPE'), 260);
  };

  const onTabulate = (from: RefinableTier): void => {
    if (tabulate(from)) flash('TABULATING');
  };
  const onTrade = (faction: Faction): void => {
    if (calculate(faction)) flash('CALCULATING');
  };
  const tradeReady = canCalculate();

  return (
    <div className="panel-backdrop" onMouseDown={onClose}>
      <div className="panel scrape-panel scrape-panel--in" onMouseDown={(e) => e.stopPropagation()}>
        <header className="panel-header">
          <span className="panel-title">{'// data scrape'}</span>
          <button type="button" className="panel-close" onClick={onClose}>
            close ✕
          </button>
        </header>

        <section className="panel-section scrape-stage">
          <button type="button" className="scrape-btn" onClick={() => scrape()}>
            <span className="scrape-btn-face">{verb}</span>
          </button>
          <div className="scrape-readout">
            <span>bits {eco.bits}</span>
            <span>strings {eco.strings}</span>
            <span>serials {eco.serials}</span>
            <span>passcodes {eco.passcodes}</span>
            <span>credits {eco.credits}</span>
          </div>
        </section>

        <section className="panel-section">
          <div className="panel-section-title">$ tabulate</div>
          {TIER_STEPS.map((t) => {
            const ready = canTabulate(t.from);
            return (
              <div className="panel-row" key={t.from}>
                <span className="panel-key">{t.label}</span>
                <button
                  type="button"
                  className={ready ? 'scrape-mini is-ready' : 'scrape-mini'}
                  disabled={!ready}
                  onClick={() => onTabulate(t.from)}
                >
                  {`[ ${STEP} → 1 ]`}
                </button>
              </div>
            );
          })}
        </section>

        <section className="panel-section">
          <div className="panel-section-title">$ calculate · trade passcode</div>
          <div className="panel-row">
            <span className="panel-key">the company · recycle</span>
            <button
              type="button"
              className={tradeReady ? 'scrape-mini is-ready' : 'scrape-mini'}
              disabled={!tradeReady}
              onClick={() => onTrade('company')}
            >
              [ trade ]
            </button>
          </div>
          <div className="panel-row">
            <span className="panel-key">the admin · destroy</span>
            <button
              type="button"
              className={tradeReady ? 'scrape-mini is-ready' : 'scrape-mini'}
              disabled={!tradeReady}
              onClick={() => onTrade('admin')}
            >
              [ trade ]
            </button>
          </div>
          <div className="panel-stub">
            ─── reputation: corporate {eco.repCorporate} · bitrunner {eco.repBitrunner}. reward
            curve pending faction-reward Q&amp;A.
          </div>
        </section>

        <footer className="panel-footer">
          press [esc] or click outside to close · progress saved on this device
        </footer>
      </div>
    </div>
  );
}
