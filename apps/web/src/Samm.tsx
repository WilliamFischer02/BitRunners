import { useEffect, useRef, useState } from 'react';
import { getLine } from './dialogue.js';
import { type EconomyState, getEconomy, subscribeEconomy } from './economy.js';
import { BET_TIERS, type GambleResult, canBet, gamble, minBet } from './samm.js';

const REDUCED_MOTION =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

const SPIN_GLYPHS = ['◆', '▣', '✦', '¤', '⌬', '◇'];
const randGlyph = (): string => SPIN_GLYPHS[Math.floor(Math.random() * SPIN_GLYPHS.length)] ?? '◆';

/** World-triggered SAMM: a walk-up prompt (when in range) that opens the
 *  betting terminal. `inRange` is driven by the scene's proximity event. */
export function Samm({ inRange }: { inRange: boolean }): JSX.Element | null {
  const [open, setOpen] = useState(false);

  // Walking away closes the terminal.
  useEffect(() => {
    if (!inRange) setOpen(false);
  }, [inRange]);

  if (open) return <SammPanel onClose={() => setOpen(false)} />;
  if (inRange) {
    return (
      <button type="button" className="samm-prompt" onClick={() => setOpen(true)}>
        <span className="samm-prompt-glyph">▣</span> use SAMM
      </button>
    );
  }
  return null;
}

function SammPanel({ onClose }: { onClose(): void }): JSX.Element {
  const [eco, setEco] = useState<EconomyState>(() => ({ ...getEconomy() }));
  const [bet, setBet] = useState<number>(minBet());
  const [result, setResult] = useState<GambleResult | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels] = useState<[string, string, string]>(['◆', '◆', '◆']);
  const [msg, setMsg] = useState<string>(getLine('samm.greeting'));
  const spinRef = useRef<number | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => subscribeEconomy(() => setEco({ ...getEconomy() })), []);

  useEffect(() => {
    const ids = timers.current;
    const spin = spinRef;
    return () => {
      for (const t of ids) window.clearTimeout(t);
      if (spin.current !== null) window.clearInterval(spin.current);
    };
  }, []);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onPull = (): void => {
    if (spinning) return;
    if (!canBet(bet)) {
      setMsg(getLine('samm.insufficient'));
      return;
    }
    const r = gamble(bet);
    if (!r) {
      setMsg(getLine('samm.insufficient'));
      return;
    }
    setResult(null);
    if (REDUCED_MOTION) {
      setReels(r.reels);
      setResult(r);
      setMsg(getLine(r.quipKey));
      return;
    }
    setSpinning(true);
    setMsg('PROCESSING YOUR CONTRIBUTION…');
    spinRef.current = window.setInterval(() => {
      setReels([randGlyph(), randGlyph(), randGlyph()]);
    }, 80);
    const id = window.setTimeout(() => {
      if (spinRef.current !== null) {
        window.clearInterval(spinRef.current);
        spinRef.current = null;
      }
      setReels(r.reels);
      setResult(r);
      setMsg(getLine(r.quipKey));
      setSpinning(false);
    }, 720);
    timers.current.push(id);
  };

  const resultClass =
    result?.kind === 'lose' ? 'samm-result--lose' : result ? 'samm-result--win' : '';

  return (
    <div className="panel-backdrop" onMouseDown={onClose}>
      <dialog
        open
        className="panel samm-panel"
        aria-modal="true"
        aria-labelledby="samm-dialog-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="panel-header">
          <span className="panel-title" id="samm-dialog-title">
            {'// SAMM'}
          </span>
          <button type="button" className="panel-close" onClick={onClose}>
            ✕
          </button>
        </header>

        <section className="panel-section samm-stage">
          <div className="samm-sub">state authored money machine</div>
          <div className={`samm-reels ${spinning ? 'is-spinning' : ''}`}>
            {reels.map((g, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed 3-reel display
              <span className="samm-reel" key={`reel-${i}`}>
                {g}
              </span>
            ))}
          </div>
          {result && (
            <div className={`samm-result ${resultClass}`}>
              {result.kind === 'lose' && 'no payout'}
              {result.kind === 'credits' && `+${result.payout} credits`}
              {result.kind === 'item' && `prize: ${result.itemName}`}
              {result.kind === 'token' && `+${result.lockedTokens} token (locked)`}
            </div>
          )}
          <div className="samm-quip" aria-live="polite" aria-atomic="true">
            {msg}
          </div>
        </section>

        <section className="panel-section">
          <div className="panel-section-title">$ place a bet · credits</div>
          <div className="samm-bets">
            {BET_TIERS.map((t) => (
              <button
                type="button"
                key={t}
                className={bet === t ? 'samm-bet is-on' : 'samm-bet'}
                disabled={spinning || getEconomy().credits < t}
                aria-label={`bet ${t} credits`}
                aria-pressed={bet === t}
                onClick={() => setBet(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={!spinning && canBet(bet) ? 'samm-pull is-ready' : 'samm-pull'}
            disabled={spinning || !canBet(bet)}
            aria-label={spinning ? 'pulling…' : `pull — bet ${bet} credits`}
            onClick={onPull}
          >
            {spinning ? '…' : `[ PULL · ${bet} ]`}
          </button>
          <div className="panel-row samm-locked">
            <span className="panel-key">bet tokens</span>
            <span className="panel-val">no wallet — proxy-wallet planned</span>
          </div>
        </section>

        <section className="panel-section samm-wallet">
          <div className="scrape-hud-row scrape-hud--currency">
            <span className="scrape-hud-glyph">▣</span>
            <span className="scrape-hud-name">credits</span>
            <span className="scrape-hud-bar" />
            <span className="scrape-hud-val">{eco.credits}</span>
          </div>
          <div className="scrape-hud-row scrape-hud--locked">
            <span className="scrape-hud-glyph">⌷</span>
            <span className="scrape-hud-name">tokens (locked)</span>
            <span className="scrape-hud-bar">no wallet</span>
            <span className="scrape-hud-val">{eco.lockedTokens}</span>
          </div>
        </section>

        <footer className="panel-footer">
          the State thanks you · press [esc] or step away to close
        </footer>
      </dialog>
    </div>
  );
}
