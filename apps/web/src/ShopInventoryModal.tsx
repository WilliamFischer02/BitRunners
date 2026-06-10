import { useEffect, useRef, useState } from 'react';
import { InventoryView, ShopView } from './ScrapeMenu.js';
import { type EconomyState, getEconomy, subscribeEconomy } from './economy.js';

// Shop + Inventory unified 2-tab modal (PR 80 of the polish push).
//
// One launcher for both surfaces. Tab order: inventory → shop. Driven by
// the 'bitrunners:open-shop-inventory' event so callers (Protocols
// cartridge, emote-wheel inventory button, future linker chips) don't
// have to know how the modal is mounted.
//
// The actual views live in ScrapeMenu.tsx (re-exported here) so we keep
// one source of truth for the row/grid markup. ScrapeMenu's own tab nav
// no longer surfaces shop/inv — those views are reachable only through
// this modal.

const OPEN_EVENT = 'bitrunners:open-shop-inventory';
export type ShopInvTab = 'inventory' | 'shop';

export function openShopInventory(tab: ShopInvTab = 'inventory'): void {
  try {
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { tab } }));
  } catch {
    // non-DOM env — ignore
  }
}

export function ShopInventoryModal(): JSX.Element | null {
  const [open, setOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<ShopInvTab>('inventory');

  useEffect(() => {
    const onOpen = (e: Event): void => {
      const t = (e as CustomEvent<{ tab?: ShopInvTab }>).detail?.tab;
      setInitialTab(t ?? 'inventory');
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  if (!open) return null;
  return <ShopInvPanel initialTab={initialTab} onClose={() => setOpen(false)} />;
}

function ShopInvPanel({
  initialTab,
  onClose,
}: {
  initialTab: ShopInvTab;
  onClose(): void;
}): JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [tab, setTab] = useState<ShopInvTab>(initialTab);
  const [eco, setEco] = useState<EconomyState>(() => ({ ...getEconomy() }));

  useEffect(() => subscribeEconomy(() => setEco({ ...getEconomy() })), []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = document.activeElement as HTMLElement | null;
    dialog.showModal();
    const onCancel = (e: Event): void => {
      e.preventDefault();
      onCloseRef.current();
    };
    dialog.addEventListener('cancel', onCancel);
    return () => {
      dialog.removeEventListener('cancel', onCancel);
      trigger?.focus();
    };
  }, []);

  const title = tab === 'shop' ? '// shop' : '// inventory';

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop close is pointer-only; keyboard close goes through the native cancel event in useEffect
    <dialog
      ref={dialogRef}
      className="panel"
      aria-modal="true"
      aria-labelledby="shopinv-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header className="panel-header">
        <span className="panel-title" id="shopinv-dialog-title">
          {title}
        </span>
        <div className="shopinv-tabs" role="tablist" aria-label="shop and inventory tabs">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'inventory'}
            className={tab === 'inventory' ? 'shopinv-tab is-on' : 'shopinv-tab'}
            onClick={() => setTab('inventory')}
          >
            inventory
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'shop'}
            className={tab === 'shop' ? 'shopinv-tab is-on' : 'shopinv-tab'}
            onClick={() => setTab('shop')}
          >
            shop
          </button>
          <button type="button" className="panel-close" onClick={onClose}>
            ✕
          </button>
        </div>
      </header>

      {tab === 'inventory' ? <InventoryView /> : <ShopView eco={eco} />}

      <footer className="panel-footer">
        cosmetics + currency · scrape progress lives in the data_scrape protocol
      </footer>
    </dialog>
  );
}
