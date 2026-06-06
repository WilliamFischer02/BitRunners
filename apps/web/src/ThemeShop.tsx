// Sub-Phase E: Theme color shop.
// Renders inside the Scrape panel "themes" tab.
// Guests see the list but all buy/equip controls are gated behind sign-in.

import { useEffect, useState } from 'react';
import { addCredits, addTokens, getEconomy, spendCredits, spendTokens } from './economy.js';
import { getIdentity, setEquippedThemeLocal, subscribeIdentity } from './profile.js';
import { type OwnedTheme, equipTheme, fetchMyOwnedThemes, purchaseTheme } from './supabase.js';
import { DEFAULT_THEME_KEY, THEME_CATALOG, type ThemeEntry } from './themes.js';

function factionLabel(entry: ThemeEntry): string {
  if (!entry.factionGate) return '';
  const faction = entry.factionGate === 'corporate' ? 'Corporate' : 'BitRunner';
  return ` · req. ${faction} Samaritan ≥ ${entry.factionMin ?? 30}`;
}

function priceLabel(entry: ThemeEntry): string {
  if (entry.price === 0) return 'free';
  const unit = entry.currency === 'tokens' ? 'tk' : 'cr';
  return `${entry.price} ${unit}`;
}

export function ThemeView(): JSX.Element {
  const [identity, setIdentity] = useState(() => getIdentity());
  const [ownedKeys, setOwnedKeys] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => subscribeIdentity(setIdentity), []);

  useEffect(() => {
    if (!identity.signedIn) return;
    void fetchMyOwnedThemes().then((rows) => {
      if (rows) setOwnedKeys(rows.map((r: OwnedTheme) => r.themeKey));
    });
  }, [identity.signedIn]);

  const isOwned = (key: string): boolean => key === DEFAULT_THEME_KEY || ownedKeys.includes(key);

  const isEquipped = (key: string): boolean =>
    key === (identity.equippedTheme || DEFAULT_THEME_KEY);

  function factionBlocked(entry: ThemeEntry): boolean {
    if (!entry.factionGate) return false;
    const score =
      entry.factionGate === 'corporate' ? identity.samaritanCorporate : identity.samaritanBitrunner;
    return score < (entry.factionMin ?? 30);
  }

  async function handleBuy(entry: ThemeEntry): Promise<void> {
    if (busy) return;
    setErr(null);

    if (entry.price > 0) {
      const eco = getEconomy();
      if (entry.currency === 'tokens' && eco.tokens < entry.price) {
        setErr(`insufficient tokens (need ${entry.price}, have ${eco.tokens})`);
        return;
      }
      if (entry.currency === 'credits' && eco.credits < entry.price) {
        setErr(`insufficient credits (need ${entry.price}, have ${eco.credits})`);
        return;
      }
    }

    setBusy(entry.key);
    try {
      if (entry.price > 0) {
        const deducted =
          entry.currency === 'tokens' ? spendTokens(entry.price) : spendCredits(entry.price);
        if (!deducted) {
          setErr('insufficient balance');
          return;
        }
      }

      const { error } = await purchaseTheme(entry.key);
      if (error) {
        if (entry.price > 0) {
          if (entry.currency === 'tokens') addTokens(entry.price);
          else addCredits(entry.price);
        }
        setErr(error);
        return;
      }

      setOwnedKeys((prev) => [...prev, entry.key]);
    } finally {
      setBusy(null);
    }
  }

  async function handleEquip(key: string): Promise<void> {
    if (busy) return;
    setErr(null);
    setBusy(key);
    try {
      const { error } = await equipTheme(key === DEFAULT_THEME_KEY ? null : key);
      if (error) {
        setErr(error);
        return;
      }
      setEquippedThemeLocal(key === DEFAULT_THEME_KEY ? '' : key);
    } finally {
      setBusy(null);
    }
  }

  if (!identity.signedIn) {
    return (
      <section className="panel-section">
        <div className="panel-section-title">$ themes · ASCII tint</div>
        <div className="panel-stub">─── sign in to unlock themes.</div>
        {THEME_CATALOG.map((entry) => (
          <div className="theme-row is-locked" key={entry.key}>
            <div className="theme-row-main">
              <span className="theme-row-name">{entry.name}</span>
              <span className="theme-row-blurb">{entry.blurb}</span>
            </div>
            <span className="theme-row-price">{priceLabel(entry)}</span>
          </div>
        ))}
      </section>
    );
  }

  return (
    <section className="panel-section">
      <div className="panel-section-title">$ themes · ASCII tint</div>
      {err && <div className="panel-stub theme-err">─── {err}</div>}
      <div className="panel-stub">
        themes change your ASCII glyph tints. personal — remotes see your runner, not your tints.
      </div>
      <div className="theme-list">
        {THEME_CATALOG.map((entry) => {
          const owned = isOwned(entry.key);
          const equipped = isEquipped(entry.key);
          const blocked = factionBlocked(entry);
          const isBusy = busy === entry.key;

          let actionLabel: string;
          if (isBusy) actionLabel = '[ … ]';
          else if (equipped) actionLabel = '[ equipped ]';
          else if (owned) actionLabel = '[ equip ]';
          else if (blocked) actionLabel = '[ locked ]';
          else actionLabel = `[ buy · ${priceLabel(entry)} ]`;

          const actionEnabled = !isBusy && !equipped && !blocked;

          return (
            <div
              className={[
                'theme-row',
                owned ? 'is-owned' : '',
                equipped ? 'is-equipped' : '',
                blocked ? 'is-locked' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              key={entry.key}
            >
              <div className="theme-row-main">
                <span className="theme-row-name">{entry.name}</span>
                <span className="theme-row-blurb">
                  {entry.blurb}
                  {factionLabel(entry)}
                </span>
              </div>
              <div className="theme-row-actions">
                <span className="theme-row-price">{owned ? '✓' : priceLabel(entry)}</span>
                <button
                  type="button"
                  className={actionEnabled ? 'shop-buy is-ready' : 'shop-buy'}
                  disabled={!actionEnabled}
                  onClick={() => {
                    if (owned) void handleEquip(entry.key);
                    else void handleBuy(entry);
                  }}
                >
                  {actionLabel}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="panel-stub">
        ─── tint values are first-pass drafts · owner review pending.
      </div>
    </section>
  );
}
