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
import { SHOP_CATALOG, type ShopItem, buy, evaluate, isOwned } from './shop.js';

type Verb = 'SCRAPE' | 'TABULATING' | 'CALCULATING';
type View = 'scrape' | 'shop';

const TIER_STEPS: { from: RefinableTier; label: string }[] = [
  { from: 'bits', label: 'bits → string' },
  { from: 'strings', label: 'strings → serial' },
  { from: 'serials', label: 'serials → passcode' },
];

const DATA_ROWS: { key: 'bits' | 'strings' | 'serials'; glyph: string }[] = [
  { key: 'bits', glyph: '·' },
  { key: 'strings', glyph: ':' },
  { key: 'serials', glyph: '=' },
];

function ladderBar(have: number): string {
  const mod = have % STEP;
  const filled = have > 0 && mod === 0 ? STEP : mod;
  return '█'.repeat(filled) + '░'.repeat(STEP - filled);
}

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

function DataHud({ eco }: { eco: EconomyState }): JSX.Element {
  return (
    <section className="panel-section scrape-hud">
      <div className="panel-section-title">$ buffer</div>
      {DATA_ROWS.map((r) => (
        <div className="scrape-hud-row" key={r.key}>
          <span className="scrape-hud-glyph">{r.glyph}</span>
          <span className="scrape-hud-name">{r.key}</span>
          <span className="scrape-hud-bar">{ladderBar(eco[r.key])}</span>
          <span className="scrape-hud-val">{eco[r.key]}</span>
        </div>
      ))}
      <div className="scrape-hud-row scrape-hud--passcode">
        <span className="scrape-hud-glyph">#</span>
        <span className="scrape-hud-name">passcodes</span>
        <span className="scrape-hud-bar">{'▓'.repeat(Math.min(eco.passcodes, STEP))}</span>
        <span className="scrape-hud-val">{eco.passcodes}</span>
      </div>
      <div className="scrape-hud-div">────────────────</div>
      <div className="scrape-hud-row scrape-hud--currency">
        <span className="scrape-hud-glyph">▣</span>
        <span className="scrape-hud-name">credits</span>
        <span className="scrape-hud-bar" />
        <span className="scrape-hud-val">{eco.credits}</span>
      </div>
      <div className="scrape-hud-row scrape-hud--locked">
        <span className="scrape-hud-glyph">⌷</span>
        <span className="scrape-hud-name">tokens</span>
        <span className="scrape-hud-bar">no wallet</span>
        <span className="scrape-hud-val">—</span>
      </div>
      <div className="scrape-hud-stat">lifetime scrapes · {eco.lifetimeScrapes}</div>
    </section>
  );
}

function ShopView({ credits }: { credits: number }): JSX.Element {
  return (
    <section className="panel-section">
      <div className="panel-section-title">$ shop · trade credits</div>
      <div className="shop-credits">credits available · {credits}</div>
      <div className="shop-list">
        {SHOP_CATALOG.map((item: ShopItem) => {
          const owned = isOwned(item);
          const ev = evaluate(item);
          const disabled = owned || !ev.ok;
          const label = owned
            ? '[ owned ]'
            : item.currency === 'tokens'
              ? '[ locked ]'
              : `[ ${item.cost} cr ]`;
          return (
            <div className={owned ? 'shop-item is-owned' : 'shop-item'} key={item.id}>
              <div className="shop-item-main">
                <span className="shop-item-name">{item.name}</span>
                <span className="shop-item-blurb">{item.blurb}</span>
                {!owned && !ev.ok && ev.reason && (
                  <span className="shop-item-note">─── {ev.reason}</span>
                )}
              </div>
              <button
                type="button"
                className={disabled ? 'shop-buy' : 'shop-buy is-ready'}
                disabled={disabled}
                onClick={() => {
                  buy(item);
                }}
              >
                {label}
              </button>
            </div>
          );
        })}
      </div>
      <div className="panel-stub">
        ─── scaffold catalog. real rewards + lore pending owner Q&amp;A.
      </div>
    </section>
  );
}

function ScrapePanel({ onClose }: ScrapePanelProps): JSX.Element {
  const [eco, setEco] = useState<EconomyState>(() => ({ ...getEconomy() }));
  const [verb, setVerb] = useState<Verb>('SCRAPE');
  const [view, setView] = useState<View>('scrape');

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
          <span className="panel-title">{view === 'shop' ? '// shop' : '// data scrape'}</span>
          <div className="scrape-headbtns">
            <button
              type="button"
              className="scrape-tabbtn"
              onClick={() => setView((v) => (v === 'shop' ? 'scrape' : 'shop'))}
            >
              {view === 'shop' ? '‹ back' : 'shop ▸'}
            </button>
            <button type="button" className="panel-close" onClick={onClose}>
              close ✕
            </button>
          </div>
        </header>

        {view === 'scrape' ? (
          <>
            <section className="panel-section scrape-stage">
              <button type="button" className="scrape-btn" onClick={() => scrape()}>
                <span className="scrape-btn-face">{verb}</span>
              </button>
            </section>

            <DataHud eco={eco} />

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
          </>
        ) : (
          <ShopView credits={eco.credits} />
        )}

        <footer className="panel-footer">
          press [esc] or click outside to close · progress saved on this device
        </footer>
      </div>
    </div>
  );
}
