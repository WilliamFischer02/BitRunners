import { useEffect, useRef, useState } from 'react';
import {
  EQUIP_SLOTS,
  type EconomyState,
  type EquipSlot,
  type Faction,
  type RefinableTier,
  STEP,
  calculate,
  canCalculate,
  canTabulate,
  equip,
  getEconomy,
  isAppearanceHidden,
  scrape,
  scrapeYield,
  setAppearanceHidden,
  subscribeEconomy,
  tabulate,
} from './economy.js';
import {
  SHOP_CATALOG,
  type ShopItem,
  buy,
  evaluate,
  getShopItem,
  isOwned,
  priceOf,
} from './shop.js';

type Verb = 'SCRAPE' | 'TABULATING' | 'CALCULATING';
type View = 'scrape' | 'shop' | 'inventory';

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

const SHOP_GROUPS: { kind: ShopItem['kind']; title: string }[] = [
  { kind: 'clothing', title: '$ clothing' },
  { kind: 'pet', title: '$ pets' },
  { kind: 'upgrade', title: '$ upgrades' },
];

function ladderBar(have: number): string {
  const mod = have % STEP;
  const filled = have > 0 && mod === 0 ? STEP : mod;
  return '█'.repeat(filled) + '░'.repeat(STEP - filled);
}

function rarityClass(item: ShopItem): string {
  return item.rarity ? `rar-${item.rarity}` : '';
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
      <div className="panel-section-title">$ buffer · +{scrapeYield()}/scrape</div>
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

function ShopRow({ item }: { item: ShopItem }): JSX.Element {
  const ev = evaluate(item);
  const owned = item.kind !== 'upgrade' && isOwned(item);
  const disabled = !ev.ok;
  const price = `${priceOf(item)} cr`;
  const label = item.locked
    ? '[ locked ]'
    : owned
      ? '[ owned ]'
      : ev.reason === 'maxed'
        ? '[ maxed ]'
        : `[ ${price} ]`;
  return (
    <div className={`shop-item ${owned ? 'is-owned' : ''}`}>
      <div className="shop-item-main">
        <span className="shop-item-name">
          {item.rarity && <span className={`rar-badge ${rarityClass(item)}`}>{item.rarity}</span>}
          {item.name}
        </span>
        <span className="shop-item-blurb">{item.blurb}</span>
        {!owned && !ev.ok && ev.reason && <span className="shop-item-note">─── {ev.reason}</span>}
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
}

function ShopView({ credits }: { credits: number }): JSX.Element {
  return (
    <section className="panel-section">
      <div className="panel-section-title">$ shop · trade credits</div>
      <div className="shop-credits">credits available · {credits}</div>
      {SHOP_GROUPS.map((g) => {
        const items = SHOP_CATALOG.filter((i) => i.kind === g.kind && !i.locked);
        if (items.length === 0) return null;
        return (
          <div className="shop-group" key={g.kind}>
            <div className="shop-group-title">{g.title}</div>
            <div className="shop-list">
              {items.map((item) => (
                <ShopRow item={item} key={item.id} />
              ))}
            </div>
          </div>
        );
      })}
      <div className="panel-stub">
        ─── scaffold catalog. real rewards + lore pending owner Q&amp;A.
      </div>
    </section>
  );
}

function InventoryView(): JSX.Element {
  const slots = getEconomy().slots;
  const equipped = getEconomy().equipped;
  const hidden = isAppearanceHidden();

  const onSlotClick = (id: string | null): void => {
    if (!id) return;
    const item = getShopItem(id);
    if (!item || !item.slot) return;
    const slot = item.slot;
    equip(slot, equipped[slot] === id ? null : id);
  };

  return (
    <section className="panel-section">
      <div className="panel-section-title">$ inventory · {slots.length} slots</div>
      <div className="inv-grid">
        {slots.map((cell, i) => {
          const item = cell ? getShopItem(cell) : undefined;
          const eqSlot = item?.slot;
          const isEq = eqSlot != null && cell !== null && equipped[eqSlot] === cell;
          const cls = ['inv-slot'];
          if (item) cls.push('is-filled', rarityClass(item));
          if (isEq) cls.push('is-equipped');
          return (
            <button
              type="button"
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length slot grid
              key={`slot-${i}`}
              className={cls.join(' ')}
              disabled={!cell}
              title={item ? item.name : 'empty'}
              onClick={() => onSlotClick(cell)}
            >
              {item ? item.name.slice(0, 10) : '·'}
              {isEq && <span className="inv-eq">E</span>}
            </button>
          );
        })}
      </div>
      <div className="inv-equip">
        {EQUIP_SLOTS.map((s) => {
          const eid = equipped[s];
          return (
            <div className="inv-equip-row" key={s}>
              <span className="panel-key">{s}</span>
              <span className="panel-val">{eid ? (getShopItem(eid)?.name ?? eid) : '─'}</span>
              <button
                type="button"
                className={eid ? 'scrape-mini is-ready' : 'scrape-mini'}
                disabled={!eid}
                onClick={() => {
                  equip(s, null);
                }}
              >
                [ unequip ]
              </button>
            </div>
          );
        })}
      </div>
      <div className="panel-row">
        <span className="panel-key">show cosmetics</span>
        <button
          type="button"
          className={hidden ? 'panel-toggle' : 'panel-toggle is-on'}
          onClick={() => setAppearanceHidden(!hidden)}
        >
          {hidden ? '[ hidden ]' : '[ shown ]'}
        </button>
      </div>
      <div className="panel-stub">
        ─── equipped look feeds appearance.ts; the 3D render reads it in a later pass.
      </div>
    </section>
  );
}

function ScrapePanel({ onClose }: ScrapePanelProps): JSX.Element {
  const [eco, setEco] = useState<EconomyState>(() => ({ ...getEconomy() }));
  const [verb, setVerb] = useState<Verb>('SCRAPE');
  const [pressed, setPressed] = useState(false);
  const [view, setView] = useState<View>('scrape');
  const timers = useRef<number[]>([]);

  useEffect(() => subscribeEconomy(() => setEco({ ...getEconomy() })), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Polish: track every transient timer so an unmount mid-flash can't setState
  // on a dead component.
  useEffect(() => {
    const ids = timers.current;
    return () => {
      for (const t of ids) window.clearTimeout(t);
    };
  }, []);

  const after = (ms: number, fn: () => void): void => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  };

  const flash = (v: Exclude<Verb, 'SCRAPE'>): void => {
    setVerb(v);
    after(260, () => setVerb('SCRAPE'));
  };

  const onScrape = (): void => {
    scrape();
    setPressed(true);
    after(140, () => setPressed(false));
  };
  const onTabulate = (from: RefinableTier): void => {
    if (tabulate(from)) flash('TABULATING');
  };
  const onTrade = (faction: Faction): void => {
    if (calculate(faction)) flash('CALCULATING');
  };
  const tradeReady = canCalculate();

  const nav = (target: View, text: string): JSX.Element => (
    <button
      type="button"
      className={view === target ? 'scrape-tabbtn is-on' : 'scrape-tabbtn'}
      onClick={() => setView(target)}
    >
      {text}
    </button>
  );

  return (
    <div className="panel-backdrop" onMouseDown={onClose}>
      <div className="panel scrape-panel scrape-panel--in" onMouseDown={(e) => e.stopPropagation()}>
        <header className="panel-header">
          <span className="panel-title">
            {view === 'shop' ? '// shop' : view === 'inventory' ? '// inventory' : '// data scrape'}
          </span>
          <div className="scrape-headbtns">
            {nav('scrape', 'scrape')}
            {nav('shop', 'shop')}
            {nav('inventory', 'inv')}
            <button type="button" className="panel-close" onClick={onClose}>
              ✕
            </button>
          </div>
        </header>

        {view === 'scrape' && (
          <>
            <section className="panel-section scrape-stage">
              <button
                type="button"
                className={pressed ? 'scrape-btn is-pressed' : 'scrape-btn'}
                onClick={onScrape}
              >
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
        )}

        {view === 'shop' && <ShopView credits={eco.credits} />}
        {view === 'inventory' && <InventoryView />}

        <footer className="panel-footer">
          press [esc] or click outside to close · progress saved on this device
        </footer>
      </div>
    </div>
  );
}
