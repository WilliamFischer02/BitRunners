import { useEffect, useState } from 'react';
import { type EconomyState, fmtCompact, getEconomy, subscribeEconomy } from './economy.js';

// Persistent currency pill mounted at the top-center of the canvas-host.
// Always visible while in-game so the player can track credits / tokens
// / chatter without re-opening the profile or scrape panels.
//
// Self-hides via CSS at very narrow viewport widths so it doesn't fight
// the joystick / launcher row, but on phone-portrait it remains a small
// horizontal strip at the top. The protocols carousel + every modal
// surface render above its z-index so the pill is overlaid (not behind)
// when a menu is open.

// chatter lands with the Tether Hop economy field (Phase 3, PR #72). Until
// that's on main, read defensively so this HUD ships without depending on it.
function readChatter(eco: EconomyState): number | null {
  const v = (eco as unknown as { chatter?: unknown }).chatter;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

const fmt = fmtCompact;

export function CreditsHud(): JSX.Element {
  // Primitive state per currency (not a cloned blob) so React's Object.is
  // bailout skips the re-render when an economy event didn't change what this
  // always-mounted HUD shows (perf pass, devlog 0138).
  const [credits, setCredits] = useState<number>(() => getEconomy().credits);
  const [tokens, setTokens] = useState<number>(() => getEconomy().tokens);
  const [chatter, setChatter] = useState<number | null>(() => readChatter(getEconomy()));

  useEffect(
    () =>
      subscribeEconomy(() => {
        const eco = getEconomy();
        setCredits(eco.credits);
        setTokens(eco.tokens);
        setChatter(readChatter(eco));
      }),
    [],
  );

  return (
    <output className="credits-hud" aria-label="player currencies">
      <span className="credits-hud-cell" title="credits">
        <span className="credits-hud-glyph credits-hud-glyph--credits">¢</span>
        <span className="credits-hud-val">{fmt(credits)}</span>
      </span>
      <span className="credits-hud-cell" title="tokens">
        <span className="credits-hud-glyph credits-hud-glyph--tokens">◈</span>
        <span className="credits-hud-val">{fmt(tokens)}</span>
      </span>
      {chatter !== null && (
        <span className="credits-hud-cell" title="chatter">
          <span className="credits-hud-glyph credits-hud-glyph--chatter">≋</span>
          <span className="credits-hud-val">{fmt(chatter)}</span>
        </span>
      )}
    </output>
  );
}
