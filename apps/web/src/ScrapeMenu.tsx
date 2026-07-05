import { useEffect, useRef, useState } from 'react';
import { EmoticonSubmission } from './EmoticonSubmission.js';
import { LeaderboardModal } from './Leaderboard.js';
import { ThemeView } from './ThemeShop.js';
import { nudgeAccount } from './account-nudge.js';
import {
  BOT_TICK_MS,
  CREDITS_PER_TOKEN,
  EMOTE_LOADOUT_SLOTS,
  EQUIP_SLOTS,
  type EconomyState,
  type Faction,
  type RefinableTier,
  STEP,
  autoTapLevel,
  calculate,
  calculateAura,
  canCalculate,
  canCalculateAura,
  canTabulate,
  canTabulateAll,
  canTabulateAura,
  creditsPerAura,
  creditsPerPasscode,
  equip,
  exchangeCreditsForTokens,
  getEconomy,
  getEmoteLoadout,
  getEquipped,
  getOwnedEmotes,
  hasBotBitsTab,
  hasBotPasscodesTab,
  hasBotSerialsTab,
  hasBotStringsTab,
  hasHoldScrape,
  hasSupercomputer,
  isAppearanceHidden,
  isPrestigeUnlocked,
  isTreeUnlocked,
  ownsPremiumEmote,
  prestigeBuffGain,
  prestigeReset,
  prestigeTokenPayout,
  purchaseEmote,
  scrape,
  scrapeYield,
  setAppearanceHidden,
  setEmoteSlot,
  subscribeEconomy,
  tabulate,
  tabulateAll,
  tabulateAura,
  tabulateReach,
} from './economy.js';
import { BASE_EMOTE_IDS, PREMIUM_EMOTES, getEmote } from './emotes.js';
import {
  SHOP_CATALOG,
  type ShopItem,
  buy,
  currencyOf,
  evaluate,
  getShopItem,
  glyphFor,
  isOwned,
  priceOf,
} from './shop.js';
import {
  SKILL_NODES,
  SKILL_PATHS,
  type SkillNode,
  buyNode,
  evaluateNode,
  isNodeMaxed,
  nodeCost,
  nodeLevel,
} from './skilltree.js';

type Verb = 'SCRAPE' | 'TABULATING' | 'CALCULATING';
// Shop and Inventory are now their own modal (PR 80). The remaining
// sub-views stay inside the data-scrape panel.
export type View = 'scrape' | 'tree' | 'shop' | 'inventory' | 'themes' | 'emoticons';

const SCRAPE_OPEN_EVENT = 'bitrunners:open-scrape';

/** Open the Data Scrape panel at a given view from anywhere (shop launcher,
 *  emote-wheel inventory button). Event bus keeps callers decoupled. */
export function openScrape(view: View): void {
  try {
    window.dispatchEvent(new CustomEvent(SCRAPE_OPEN_EVENT, { detail: { view } }));
  } catch {
    // non-DOM env — ignore
  }
}

const REDUCED_MOTION =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

const HOLD_MS = 110;
// Auto-tapper tap interval by tier: [off, slow, medium, fast, hold-down].
// The Supercomputer capstone forces the top (continuous) tier.
const AUTO_TAP_MS = [0, 900, 500, 220, 90] as const;
const BOTS_KEY = 'bitrunners.settings.bots';
// Per-bot enable map (device-local, like the master). Additive on top of the
// master toggle: a bot runs only when master && its own flag && unlocked.
const BOTS_SEL_KEY = 'bitrunners.settings.bots-sel';

type BotKey = 'tapper' | 'bits' | 'strings' | 'serials' | 'passcodes';
type BotSelection = Record<BotKey, boolean>;

const DEFAULT_BOT_SEL: BotSelection = {
  tapper: true,
  bits: true,
  strings: true,
  serials: true,
  passcodes: true,
};

function loadBotSelection(): BotSelection {
  try {
    const raw = localStorage.getItem(BOTS_SEL_KEY);
    if (!raw) return { ...DEFAULT_BOT_SEL };
    const parsed = JSON.parse(raw) as Partial<Record<BotKey, unknown>>;
    const out = { ...DEFAULT_BOT_SEL };
    for (const k of Object.keys(out) as BotKey[]) {
      if (typeof parsed[k] === 'boolean') out[k] = parsed[k] as boolean;
    }
    return out;
  } catch {
    return { ...DEFAULT_BOT_SEL };
  }
}

function saveBotSelection(sel: BotSelection): void {
  try {
    localStorage.setItem(BOTS_SEL_KEY, JSON.stringify(sel));
  } catch {
    // storage unavailable — keep in-memory
  }
}

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
];

function ladderBar(have: number): string {
  const mod = have % STEP;
  const filled = have > 0 && mod === 0 ? STEP : mod;
  return '█'.repeat(filled) + '░'.repeat(STEP - filled);
}

function rarityClass(item: ShopItem): string {
  return item.rarity ? `rar-${item.rarity}` : '';
}

// ScrapeMenu is now a panel-only component: the launcher row's Protocols
// cartridge dispatches `bitrunners:open-scrape` (via the protocols-registry
// `launchScrape` helper) which opens this panel. The old `scrape-launch` and
// `shop-launch` buttons are gone — Shop, Themes, Inventory, Emoticons are
// all sub-views inside this panel, reached via openScrape('shop') etc.
export function ScrapeMenu(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [initialView, setInitialView] = useState<View>('scrape');

  useEffect(() => {
    const onOpen = (e: Event): void => {
      const v = (e as CustomEvent<{ view?: View }>).detail?.view;
      setInitialView(v ?? 'scrape');
      setOpen(true);
    };
    window.addEventListener(SCRAPE_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(SCRAPE_OPEN_EVENT, onOpen);
  }, []);

  if (!open) return <></>;
  return <ScrapePanel initialView={initialView} onClose={() => setOpen(false)} />;
}

interface ScrapePanelProps {
  initialView: View;
  onClose(): void;
}

function DataHud({ eco, auto }: { eco: EconomyState; auto: boolean }): JSX.Element {
  return (
    <section className="panel-section scrape-hud">
      <div className="panel-section-title">
        $ buffer · +{scrapeYield()}/scrape
        {auto && <span className="scrape-auto-tag"> · auto ▶</span>}
      </div>
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
        <span className="scrape-hud-bar">{ladderBar(eco.passcodes)}</span>
        <span className="scrape-hud-val">{eco.passcodes}</span>
      </div>
      <div className="scrape-hud-row scrape-hud--aura">
        <span className="scrape-hud-glyph">✺</span>
        <span className="scrape-hud-name">auras</span>
        <span className="scrape-hud-bar">{'▒'.repeat(Math.min(eco.auras, STEP))}</span>
        <span className="scrape-hud-val">{eco.auras}</span>
      </div>
      <div className="scrape-hud-div">────────────────</div>
      <div className="scrape-hud-row scrape-hud--currency">
        <span className="scrape-hud-glyph">▣</span>
        <span className="scrape-hud-name">credits</span>
        <span className="scrape-hud-bar" />
        <span className="scrape-hud-val">{eco.credits}</span>
      </div>
      <div className="scrape-hud-row scrape-hud--currency">
        <span className="scrape-hud-glyph">⬢</span>
        <span className="scrape-hud-name">tokens</span>
        <span className="scrape-hud-bar" />
        <span className="scrape-hud-val">{eco.tokens}</span>
      </div>
      <div className="scrape-hud-stat">lifetime scrapes · {eco.lifetimeScrapes}</div>
    </section>
  );
}

function ShopRow({ item }: { item: ShopItem }): JSX.Element {
  const ev = evaluate(item);
  const owned = isOwned(item);
  const equippedHere = item.slot ? getEquipped()[item.slot] === item.id : false;
  const disabled = !ev.ok;
  const label = item.locked
    ? '[ locked ]'
    : owned
      ? equippedHere
        ? '[ equipped ]'
        : '[ owned ]'
      : `[ ${priceOf(item)} ${currencyOf(item) === 'tokens' ? 'tk' : 'cr'} ]`;
  return (
    <div className={`shop-item ${rarityClass(item)} ${owned ? 'is-owned' : ''}`}>
      <div className="shop-item-main">
        <span className="shop-item-name">
          <span className="shop-item-glyph" aria-hidden="true">
            {glyphFor(item)}
          </span>
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
          if (buy(item)) nudgeAccount('shop');
        }}
      >
        {label}
      </button>
    </div>
  );
}

// Shop is a tabbed hub (mega-batch 4.8): outfits / emotes / themes /
// upgrades. The selected tab persists to sessionStorage so re-opening the
// shop lands on the same section.
export type ShopTab = 'outfits' | 'emotes' | 'themes' | 'upgrades';
const SHOP_TAB_KEY = 'bitrunners.shop.tab';
const SHOP_TABS: { id: ShopTab; label: string }[] = [
  { id: 'outfits', label: '// outfits' },
  { id: 'emotes', label: '// emotes' },
  { id: 'themes', label: '// themes' },
  { id: 'upgrades', label: '// upgrades' },
];

function readShopTab(): ShopTab {
  try {
    const v = sessionStorage.getItem(SHOP_TAB_KEY);
    if (v === 'outfits' || v === 'emotes' || v === 'themes' || v === 'upgrades') return v;
  } catch {
    // sessionStorage unavailable — fall through to default
  }
  return 'outfits';
}

function OutfitsTab({ eco }: { eco: EconomyState }): JSX.Element {
  return (
    <section className="panel-section">
      <div className="panel-section-title">$ outfits · credits &amp; tokens</div>
      <div className="shop-credits">
        credits · {eco.credits} · tokens · {eco.tokens}
      </div>
      <div className="panel-row">
        <span className="panel-key">buy tokens · {CREDITS_PER_TOKEN} cr each</span>
        <span className="shop-exchange">
          <button
            type="button"
            className={eco.credits >= CREDITS_PER_TOKEN ? 'scrape-mini is-ready' : 'scrape-mini'}
            disabled={eco.credits < CREDITS_PER_TOKEN}
            onClick={() => {
              if (exchangeCreditsForTokens(1).ok) nudgeAccount('shop');
            }}
          >
            [ +1 ]
          </button>
          <button
            type="button"
            className={
              eco.credits >= CREDITS_PER_TOKEN * 5 ? 'scrape-mini is-ready' : 'scrape-mini'
            }
            disabled={eco.credits < CREDITS_PER_TOKEN * 5}
            onClick={() => {
              if (exchangeCreditsForTokens(5).ok) nudgeAccount('shop');
            }}
          >
            [ +5 ]
          </button>
        </span>
      </div>
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
    </section>
  );
}

function EmotesTab({ eco }: { eco: EconomyState }): JSX.Element {
  return (
    <section className="panel-section">
      <div className="panel-section-title">$ emotes · cooler pack</div>
      <div className="shop-credits">credits · {eco.credits}</div>
      <div className="shop-list">
        {PREMIUM_EMOTES.map((e) => {
          const owned = ownsPremiumEmote(e.id);
          const canBuy = !owned && eco.credits >= e.price;
          return (
            <div className={`shop-item ${owned ? 'is-owned' : ''}`} key={e.id}>
              <div className="shop-item-main">
                <span className="shop-item-name">
                  <span className="shop-item-glyph" aria-hidden="true">
                    {e.glyph}
                  </span>
                  {e.label}
                </span>
                <span className="shop-item-blurb">emote · {e.glyph}</span>
              </div>
              <button
                type="button"
                className={canBuy ? 'shop-buy is-ready' : 'shop-buy'}
                disabled={!canBuy}
                onClick={() => {
                  if (purchaseEmote(e.id, e.price).ok) nudgeAccount('shop');
                }}
              >
                {owned ? '[ owned ]' : `[ ${e.price} cr ]`}
              </button>
            </div>
          );
        })}
      </div>
      <div className="panel-stub">
        ─── equip purchased emotes in the inventory's $ emote slots. price is a placeholder pending
        owner tuning.
      </div>
    </section>
  );
}

export function ShopView({ eco }: { eco: EconomyState }): JSX.Element {
  const [tab, setTab] = useState<ShopTab>(readShopTab);

  const pick = (t: ShopTab): void => {
    setTab(t);
    try {
      sessionStorage.setItem(SHOP_TAB_KEY, t);
    } catch {
      // sessionStorage unavailable — selection just won't persist
    }
  };

  return (
    <>
      <div className="shop-tabs" role="tablist" aria-label="shop sections">
        {SHOP_TABS.map((t) => (
          <button
            type="button"
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'scrape-tabbtn is-on' : 'scrape-tabbtn'}
            onClick={() => pick(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'outfits' && <OutfitsTab eco={eco} />}
      {tab === 'emotes' && <EmotesTab eco={eco} />}
      {tab === 'themes' && <ThemeView />}
      {tab === 'upgrades' && <TreeView eco={eco} />}
    </>
  );
}

function TreeNodeRow({ node }: { node: SkillNode }): JSX.Element {
  const level = nodeLevel(node);
  const maxed = isNodeMaxed(node);
  const cost = nodeCost(node);
  const ev = evaluateNode(node);
  const disabled = !ev.ok;
  const label = maxed ? '[ maxed ]' : cost !== null ? `[ ${cost} pc ]` : '[ — ]';
  return (
    <div className={`tree-node ${maxed ? 'is-maxed' : ''} ${level > 0 ? 'is-active' : ''}`}>
      <div className="tree-node-main">
        <span className="tree-node-name">{node.name}</span>
        <span className="tree-node-blurb">{node.blurb}</span>
        <span className="tree-node-meta">
          {node.effect} · lvl {level}/{node.maxLevel}
          {!maxed && !ev.ok && ev.reason ? ` · ${ev.reason}` : ''}
        </span>
      </div>
      <button
        type="button"
        className={disabled ? 'shop-buy' : 'shop-buy is-ready'}
        disabled={disabled}
        onClick={() => {
          buyNode(node);
        }}
      >
        {label}
      </button>
    </div>
  );
}

function TreeView({ eco }: { eco: EconomyState }): JSX.Element {
  const unlocked = isTreeUnlocked();
  return (
    <section className="panel-section">
      <div className="panel-section-title">$ skill tree · spend passcodes</div>
      <div className="shop-credits">
        passcodes available · {eco.passcodes} · lifetime · {eco.lifetimePasscodes}
      </div>
      {!unlocked && (
        <div className="panel-stub">─── locked. mint your first passcode to open the tree.</div>
      )}
      <div className={`skill-tree ${unlocked ? '' : 'is-locked'}`}>
        {SKILL_PATHS.map((p) => (
          <div className={`tree-col tree-col--${p.path}`} key={p.path}>
            <div className="tree-col-head">
              <span className="tree-col-title">{p.title}</span>
              <span className="tree-col-blurb">{p.blurb}</span>
            </div>
            <div className="tree-col-body">
              {SKILL_NODES.filter((n) => n.path === p.path).map((n) => (
                <TreeNodeRow node={n} key={n.id} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="panel-stub">
        ─── passcodes also trade to Credits via the Admin/Company. balance is first-pass + tunable.
      </div>
    </section>
  );
}

function EmoteSlotsSection(): JSX.Element {
  const [, force] = useState(0);
  useEffect(() => subscribeEconomy(() => force((n) => n + 1)), []);
  const [picker, setPicker] = useState<number | null>(null);
  const loadout = getEmoteLoadout();
  const ownedIds = [...BASE_EMOTE_IDS, ...getOwnedEmotes()];

  return (
    <section className="panel-section">
      <div className="panel-section-title">$ emote slots</div>
      <div className="emote-slots">
        {Array.from({ length: EMOTE_LOADOUT_SLOTS }, (_, i) => i).map((i) => {
          const id = loadout[i];
          const def = id ? getEmote(id) : undefined;
          return (
            <button
              type="button"
              key={`eslot-${i}`}
              className={`emote-slot ${picker === i ? 'is-active' : ''}`}
              onClick={() => setPicker(picker === i ? null : i)}
            >
              <span className="emote-slot-glyph">{def?.glyph ?? '·'}</span>
              <span className="emote-slot-label">{def?.label ?? 'empty'}</span>
            </button>
          );
        })}
      </div>
      {picker !== null && (
        <div className="emote-picker">
          <div className="panel-stub">─── pick an emote for slot {picker + 1}</div>
          <div className="emote-picker-grid">
            <button
              type="button"
              className="emote-pick"
              onClick={() => {
                setEmoteSlot(picker, null);
                setPicker(null);
                nudgeAccount('emote');
              }}
            >
              <span className="emote-slot-glyph">·</span>
              <span className="emote-slot-label">clear</span>
            </button>
            {ownedIds.map((id) => {
              const def = getEmote(id);
              if (!def) return null;
              return (
                <button
                  type="button"
                  key={id}
                  className="emote-pick"
                  onClick={() => {
                    setEmoteSlot(picker, id);
                    setPicker(null);
                    nudgeAccount('emote');
                  }}
                >
                  <span className="emote-slot-glyph">{def.glyph}</span>
                  <span className="emote-slot-label">{def.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="panel-stub">
        ─── these 4 emotes fill the wheel's main directions. buy more in the shop's emotes tab.
      </div>
    </section>
  );
}

export function InventoryView(): JSX.Element {
  const slots = getEconomy().slots;
  const equipped = getEconomy().equipped;
  const hidden = isAppearanceHidden();
  const empty = slots.every((c) => c === null);

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
      {empty && <div className="panel-stub">─── empty. buy clothing or a pet in the shop.</div>}
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
              {item ? (
                <>
                  <span className="inv-slot-glyph" aria-hidden="true">
                    {glyphFor(item)}
                  </span>
                  <span className="inv-slot-name">{item.name.slice(0, 10)}</span>
                </>
              ) : (
                '·'
              )}
              {isEq && <span className="inv-eq">E</span>}
            </button>
          );
        })}
      </div>
      <div className="inv-equip">
        {EQUIP_SLOTS.map((s) => {
          const eid = equipped[s];
          const eitem = eid ? getShopItem(eid) : undefined;
          return (
            <div className="inv-equip-row" key={s}>
              <span className="panel-key">{s}</span>
              <span className="panel-val">
                {eitem && (
                  <span className="inv-equip-glyph" aria-hidden="true">
                    {glyphFor(eitem)}{' '}
                  </span>
                )}
                {eid ? (eitem?.name ?? eid) : '─'}
              </span>
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
        ─── tap a slot to equip it. equipped clothing + pets appear on your runner in the 3D scene.
      </div>
      <EmoteSlotsSection />
    </section>
  );
}

const AUTO_TAP_TIER_LABEL = ['off', 'slow', 'medium', 'fast', 'hold-down'];

function BotsStatus({
  botsOn,
  onToggle,
  sel,
  onToggleBot,
}: {
  botsOn: boolean;
  onToggle(): void;
  sel: BotSelection;
  onToggleBot(key: BotKey): void;
}): JSX.Element | null {
  // Reflects the active automation. Re-renders on economy updates since buying
  // a node in the tree flips its flag.
  const [, force] = useState(0);
  useEffect(() => subscribeEconomy(() => force((n) => n + 1)), []);

  const sc = hasSupercomputer();
  const tap = sc ? 4 : autoTapLevel();
  const bots: { key: BotKey; unlocked: boolean; label: string }[] = [
    { key: 'tapper', unlocked: tap > 0, label: `auto-tapper · ${AUTO_TAP_TIER_LABEL[tap]}` },
    { key: 'bits', unlocked: sc || hasBotBitsTab(), label: 'bits → strings' },
    { key: 'strings', unlocked: sc || hasBotStringsTab(), label: 'strings → serials' },
    { key: 'serials', unlocked: sc || hasBotSerialsTab(), label: 'serials → passcodes' },
    { key: 'passcodes', unlocked: sc || hasBotPasscodesTab(), label: 'passcodes → auras' },
  ];
  const unlocked = bots.filter((b) => b.unlocked);
  if (unlocked.length === 0 && !sc) return null;

  return (
    <section className="panel-section scrape-bots">
      <div className="panel-row">
        <span className="panel-section-title">$ bots{sc ? ' · SUPERCOMPUTER' : ''}</span>
        <button
          type="button"
          className={botsOn ? 'panel-toggle is-on' : 'panel-toggle'}
          onClick={onToggle}
          aria-pressed={botsOn}
          aria-label="all bots master switch"
        >
          {botsOn ? '[ all on ]' : '[ all off ]'}
        </button>
      </div>
      {unlocked.map((b) => {
        const running = botsOn && sel[b.key];
        return (
          <div className="panel-row" key={b.key}>
            <span className="panel-key">{b.label}</span>
            <span className="scrape-hud-val">{running ? '▶' : '⏸'}</span>
            <button
              type="button"
              className={sel[b.key] ? 'panel-toggle is-on' : 'panel-toggle'}
              onClick={() => onToggleBot(b.key)}
              aria-pressed={sel[b.key]}
              aria-label={`toggle ${b.label}`}
            >
              {sel[b.key] ? '[ on ]' : '[ off ]'}
            </button>
          </div>
        );
      })}
      <div className="panel-stub">
        ─── each bot has its own switch; the master pauses everything at once. bots tick every{' '}
        {BOT_TICK_MS}ms and pause when this panel is closed.
      </div>
    </section>
  );
}

function ScrapePanel({ initialView, onClose }: ScrapePanelProps): JSX.Element {
  const [eco, setEco] = useState<EconomyState>(() => ({ ...getEconomy() }));
  const [verb, setVerb] = useState<Verb>('SCRAPE');
  const [pressed, setPressed] = useState(false);
  const [holding, setHolding] = useState(false);
  const [gain, setGain] = useState<{ n: number; k: number } | null>(null);
  const [view, setView] = useState<View>(initialView);
  const [closing, setClosing] = useState(false);
  const [lbOpen, setLbOpen] = useState(false);
  const [botsOn, setBotsOn] = useState<boolean>(() => {
    try {
      return localStorage.getItem(BOTS_KEY) !== 'false';
    } catch {
      return true;
    }
  });
  const botsOnRef = useRef(botsOn);
  botsOnRef.current = botsOn;
  const toggleBots = (): void => {
    setBotsOn((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(BOTS_KEY, String(next));
      } catch {
        // storage unavailable — keep in-memory
      }
      return next;
    });
  };
  // Per-bot selection (e.g. run the ladder bots but keep passcodes→auras
  // paused). Persisted per device alongside the master.
  const [botSel, setBotSel] = useState<BotSelection>(loadBotSelection);
  const botSelRef = useRef(botSel);
  botSelRef.current = botSel;
  const toggleBot = (key: BotKey): void => {
    setBotSel((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveBotSelection(next);
      return next;
    });
  };
  const timers = useRef<number[]>([]);
  const holdTimer = useRef<number | null>(null);

  useEffect(() => subscribeEconomy(() => setEco({ ...getEconomy() })), []);

  // Track every transient timer so an unmount mid-animation can't setState on
  // a dead component.
  useEffect(() => {
    const ids = timers.current;
    const hold = holdTimer;
    return () => {
      for (const t of ids) window.clearTimeout(t);
      if (hold.current !== null) window.clearInterval(hold.current);
    };
  }, []);

  const after = (ms: number, fn: () => void): void => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  };

  const requestClose = (): void => {
    if (REDUCED_MOTION) {
      onClose();
      return;
    }
    setClosing(true);
    after(240, onClose);
  };
  const closeRef = useRef(requestClose);
  closeRef.current = requestClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const flash = (v: Exclude<Verb, 'SCRAPE'>): void => {
    setVerb(v);
    after(260, () => setVerb('SCRAPE'));
  };

  // Supercomputer ladder drain: carry the scrape cadence through the whole
  // ladder so passcodes rise in proportion to bits, at whatever speed the
  // player scrapes (tap / hold / auto-tap). Each rung converts 8→1, so the
  // flow factors down by 8 per level — the SPIRIT is max-speed conversion up
  // to passcodes (devlog 0131). Bounded while-loops clear any backlog a tick
  // can create; per-bot switches still gate each rung. Auras stay on the
  // slower BOT_TICK_MS loop (they're a spend decision, not part of the flow).
  const scLadderDrain = (): void => {
    if (!hasSupercomputer() || !botsOnRef.current) return;
    const sel = botSelRef.current;
    for (let i = 0; sel.bits && canTabulate('bits') && i < 64; i++) tabulate('bits');
    for (let i = 0; sel.strings && canTabulate('strings') && i < 64; i++) tabulate('strings');
    for (let i = 0; sel.serials && canTabulate('serials') && i < 64; i++) tabulate('serials');
  };

  const doScrape = (pop: boolean): void => {
    const g = scrapeYield();
    scrape();
    scLadderDrain();
    if (pop) {
      setPressed(true);
      after(140, () => setPressed(false));
    }
    setGain((p) => ({ n: g, k: (p?.k ?? 0) + 1 }));
  };
  // Latest-closure ref so interval ticks (hold/auto) never go stale and the
  // effect needs no changing deps — same pattern as closeRef above.
  const scrapeRef = useRef(doScrape);
  scrapeRef.current = doScrape;

  const stopHold = (): void => {
    if (holdTimer.current !== null) {
      window.clearInterval(holdTimer.current);
      holdTimer.current = null;
      setHolding(false);
    }
  };

  // Hold-to-scrape (Path 2 unlock): press-and-hold repeats while held. A quick
  // tap is handled by onClick, so a fast tap stays a single scrape.
  const onScrapeDown = (): void => {
    if (!hasHoldScrape() || holdTimer.current !== null) return;
    setHolding(true);
    holdTimer.current = window.setInterval(() => scrapeRef.current(false), HOLD_MS);
  };

  // Auto-tapper (Path 4): taps SCRAPE at a tier-dependent interval while the
  // panel is open + bots enabled. The Supercomputer capstone forces the top
  // (continuous) tier. Interval recomputed when the tier or the toggle changes.
  const autoTier = hasSupercomputer() ? 4 : autoTapLevel();
  const tapMs = AUTO_TAP_MS[autoTier] ?? 0;
  // drives the scrape-button "is-auto" glow
  const autoOn = botsOn && botSel.tapper && tapMs > 0;
  useEffect(() => {
    if (!botsOn || !botSel.tapper || tapMs <= 0) return;
    const id = window.setInterval(() => {
      if (botsOnRef.current && botSelRef.current.tapper) scrapeRef.current(false);
    }, tapMs);
    return () => window.clearInterval(id);
  }, [botsOn, botSel.tapper, tapMs]);

  // Auto-converter bots (Path 4). One shared interval walks the
  // bits→strings→serials→passcodes→auras ladder once per tick. Each upgrade
  // flag gates one rung. Obeys the master toggle AND each bot's own switch,
  // and pauses when the panel closes (active-panel automation).
  //
  // Supercomputer accounts mostly ride scLadderDrain (conversion at scrape
  // cadence); this loop remains their fallback so an existing stock still
  // converts while scraping is paused (tapper off), and it stays the ONLY
  // driver of passcodes→auras. The old sc-driven scrape here is gone — the
  // forced tier-4 auto-tapper already scrapes continuously.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!botsOnRef.current) return;
      const sel = botSelRef.current;
      const sc = hasSupercomputer();
      if (sel.bits && (sc || hasBotBitsTab())) tabulate('bits');
      if (sel.strings && (sc || hasBotStringsTab())) tabulate('strings');
      if (sel.serials && (sc || hasBotSerialsTab())) tabulate('serials');
      if (sel.passcodes && (sc || hasBotPasscodesTab())) tabulateAura();
    }, BOT_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const onTabulate = (from: RefinableTier): void => {
    if (tabulate(from)) flash('TABULATING');
  };
  const onTabulateAura = (): void => {
    if (tabulateAura()) flash('TABULATING');
  };
  const onTabulateAll = (): void => {
    if (tabulateAll()) flash('TABULATING');
  };
  const onTrade = (faction: Faction): void => {
    if (calculate(faction)) flash('CALCULATING');
  };
  const onTradeAura = (faction: Faction): void => {
    if (calculateAura(faction)) flash('CALCULATING');
  };
  const tradeReady = canCalculate();
  const tradeAuraReady = canCalculateAura();
  const showAll = tabulateReach() >= 1;
  const auraReady = canTabulateAura();
  const prestigeOn = isPrestigeUnlocked();

  const VIEW_LABELS: Record<View, string> = {
    scrape: 'scrape',
    tree: 'skill tree',
    shop: 'shop',
    themes: 'themes',
    inventory: 'inventory',
    emoticons: 'emoticron',
  };

  const nav = (target: View, text: string): JSX.Element => (
    <button
      type="button"
      className={view === target ? 'scrape-tabbtn is-on' : 'scrape-tabbtn'}
      aria-pressed={view === target}
      aria-label={VIEW_LABELS[target]}
      onClick={() => setView(target)}
    >
      {text}
    </button>
  );

  const titles: Record<View, string> = {
    scrape: '// data scrape',
    tree: '// skill tree',
    shop: '// shop',
    inventory: '// inventory',
    themes: '// themes',
    emoticons: '// emoticron',
  };

  return (
    <div className="panel-backdrop" onMouseDown={requestClose}>
      <dialog
        open
        className={`panel scrape-panel ${closing ? 'scrape-panel--out' : 'scrape-panel--in'}`}
        aria-modal="true"
        aria-labelledby="scrape-dialog-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="panel-header">
          <span className="panel-title" id="scrape-dialog-title">
            {titles[view]}
          </span>
          <div className="scrape-headbtns">
            {nav('scrape', 'scrape')}
            {nav('tree', 'tree')}
            {nav('themes', 'theme')}
            {nav('emoticons', 'emote')}
            <button type="button" className="panel-close" onClick={requestClose}>
              ✕
            </button>
          </div>
        </header>

        {view === 'scrape' && (
          <>
            <section className="panel-section scrape-stage">
              <div
                className={[
                  'scrape-glow',
                  holding ? 'is-holding' : '',
                  autoOn ? 'is-auto' : '',
                  pressed ? 'is-on' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-hidden="true"
              />
              <button
                type="button"
                className={pressed ? 'scrape-btn is-pressed' : 'scrape-btn'}
                onClick={() => doScrape(true)}
                onPointerDown={onScrapeDown}
                onPointerUp={stopHold}
                onPointerLeave={stopHold}
                onPointerCancel={stopHold}
              >
                <span className="scrape-btn-face">{verb}</span>
              </button>
              {hasHoldScrape() && <span className="scrape-hint">hold to repeat</span>}
              {gain && (
                <span key={gain.k} className="scrape-gain">
                  +{gain.n}
                </span>
              )}
            </section>

            <DataHud eco={eco} auto={autoOn} />
            <div className="scrape-lb-row">
              <button type="button" className="panel-action" onClick={() => setLbOpen(true)}>
                [ leaderboards ]
              </button>
            </div>

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
              {showAll && (
                <div className="panel-row">
                  <span className="panel-key">tabulate all · cache</span>
                  <button
                    type="button"
                    className={canTabulateAll() ? 'scrape-mini is-ready' : 'scrape-mini'}
                    disabled={!canTabulateAll()}
                    onClick={onTabulateAll}
                  >
                    [ all ]
                  </button>
                </div>
              )}
              <div className="panel-row">
                <span className="panel-key">passcodes → aura</span>
                <button
                  type="button"
                  className={auraReady ? 'scrape-mini is-ready' : 'scrape-mini'}
                  disabled={!auraReady}
                  onClick={onTabulateAura}
                >
                  {`[ ${STEP} → 1 ]`}
                </button>
              </div>
            </section>

            <section className="panel-section">
              <div className="panel-section-title">
                $ calculate · trade passcode · +{creditsPerPasscode()} cr each
              </div>
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

            <section className="panel-section">
              <div className="panel-section-title">
                $ calculate · trade aura · +{creditsPerAura()} cr each
              </div>
              <div className="panel-row">
                <span className="panel-key">the company · recycle</span>
                <button
                  type="button"
                  className={tradeAuraReady ? 'scrape-mini is-ready' : 'scrape-mini'}
                  disabled={!tradeAuraReady}
                  onClick={() => onTradeAura('company')}
                >
                  [ trade ]
                </button>
              </div>
              <div className="panel-row">
                <span className="panel-key">the admin · destroy</span>
                <button
                  type="button"
                  className={tradeAuraReady ? 'scrape-mini is-ready' : 'scrape-mini'}
                  disabled={!tradeAuraReady}
                  onClick={() => onTradeAura('admin')}
                >
                  [ trade ]
                </button>
              </div>
              <div className="panel-stub">
                ─── aura trades grant +2 samaritan to the chosen faction (vs +1 for passcodes).
              </div>
            </section>

            {prestigeOn && (
              <section className="panel-section scrape-prestige">
                <div className="panel-section-title">$ prestige · clean slate</div>
                <div className="panel-stub">
                  ─── trade your scrape buffers + skill levels for tokens. cosmetics, equipped
                  items, reputation, badges, and the Supercomputer / Corporate Greed capstones stay.
                  the permanent scrape buff each prestige grants scales with your accrued auras.
                </div>
                <div className="panel-row">
                  <span className="panel-key">current buff · tier {eco.prestiges}</span>
                  <span className="scrape-hud-val">+{eco.prestigeBuff} bits / SCRAPE</span>
                </div>
                <div className="panel-row">
                  <span className="panel-key">this prestige adds</span>
                  <span className="scrape-hud-val">+{prestigeBuffGain()} bits / SCRAPE</span>
                </div>
                <div className="panel-row">
                  <span className="panel-key">reset payout · {prestigeTokenPayout()} tk</span>
                  <button
                    type="button"
                    className="scrape-mini is-ready"
                    onClick={() => prestigeReset()}
                  >
                    [ trade ]
                  </button>
                </div>
              </section>
            )}

            <BotsStatus
              botsOn={botsOn}
              onToggle={toggleBots}
              sel={botSel}
              onToggleBot={toggleBot}
            />
          </>
        )}

        {view === 'tree' && <TreeView eco={eco} />}
        {view === 'shop' && <ShopView eco={eco} />}
        {view === 'inventory' && <InventoryView />}
        {view === 'themes' && <ThemeView />}
        {view === 'emoticons' && <EmoticonSubmission />}

        <footer className="panel-footer">
          press [esc] or click outside to close · progress saved on this device
        </footer>
      </dialog>
      {lbOpen && <LeaderboardModal onClose={() => setLbOpen(false)} />}
    </div>
  );
}
