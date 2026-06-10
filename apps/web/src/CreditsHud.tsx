import { useEffect, useState } from 'react';
import { type EconomyState, getEconomy, subscribeEconomy } from './economy.js';

// Persistent currency pill mounted at the top-center of the canvas-host.
// Always visible while in-game so the player can track credits / tokens
// / chatter without re-opening the profile or scrape panels.
//
// Self-hides via CSS at very narrow viewport widths so it doesn't fight
// the joystick / launcher row, but on phone-portrait it remains a small
// horizontal strip at the top. The protocols carousel + every modal
// surface render above its z-index so the pill is overlaid (not behind)
// when a menu is open.

function hasChatter(eco: EconomyState): boolean {
  const v = (eco as unknown as { chatter?: unknown }).chatter;
  return typeof v === 'number' && Number.isFinite(v);
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '0';
  if (n < 1000) return String(Math.floor(n));
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

export function CreditsHud(): JSX.Element {
  const [eco, setEco] = useState<EconomyState>(() => ({ ...getEconomy() }));

  useEffect(() => subscribeEconomy(() => setEco({ ...getEconomy() })), []);

  return (
    <output className="credits-hud" aria-label="player currencies">
      <span className="credits-hud-cell" title="credits">
        <span className="credits-hud-glyph credits-hud-glyph--credits">¢</span>
        <span className="credits-hud-val">{fmt(eco.credits)}</span>
      </span>
      <span className="credits-hud-cell" title="tokens">
        <span className="credits-hud-glyph credits-hud-glyph--tokens">◈</span>
        <span className="credits-hud-val">{fmt(eco.tokens)}</span>
      </span>
      {/* chatter field lands with the Tether Hop economy field (Phase 3,
          PR #72). Until that's on main, read defensively so this HUD ships
          without depending on it. */}
      {hasChatter(eco) && (
        <span className="credits-hud-cell" title="chatter">
          <span className="credits-hud-glyph credits-hud-glyph--chatter">≋</span>
          <span className="credits-hud-val">
            {fmt((eco as unknown as { chatter: number }).chatter)}
          </span>
        </span>
      )}
    </output>
  );
}
