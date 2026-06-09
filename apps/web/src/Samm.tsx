import { useEffect, useRef, useState } from 'react';
import { getLine } from './dialogue.js';
import { type EconomyState, getEconomy, subscribeEconomy } from './economy.js';
import { type BetCurrency, type GambleResult, betTiers, canBet, gamble, minBet } from './samm.js';
import { openWithDissolve } from './transitions/dialog-dissolve.js';

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
  const [currency, setCurrency] = useState<BetCurrency>('credits');
  const [bet, setBet] = useState<number>(minBet('credits'));

  const switchCurrency = (c: BetCurrency): void => {
    setCurrency(c);
    setBet(minBet(c));
  };
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

  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Open as a true modal: native focus trap + Escape via cancel event.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = document.activeElement as HTMLElement | null;
    openWithDissolve(dialog);
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

  const onPull = (): void => {
    if (spinning) return;
    if (!canBet(bet, currency)) {
      setMsg(getLine('samm.insufficient'));
      return;
    }
    const r = gamble(bet, currency);
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
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop-click is pointer-only; keyboard close is handled by the native cancel event (Escape) wired in the useEffect above
    <dialog
      ref={dialogRef}
      className="panel samm-panel"
      aria-modal="true"
      aria-labelledby="samm-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
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
            {result.kind === 'credits' && `+${result.payout} ${currency}`}
            {result.kind === 'item' && `prize: ${result.itemName}`}
            {result.kind === 'token' && `+${result.tokens} token`}
          </div>
        )}
        <div className="samm-quip" aria-live="polite" aria-atomic="true">
          {msg}
        </div>
      </section>

      <section className="panel-section">
        <div className="panel-section-title">$ place a bet</div>
        <div className="samm-cur">
          <button
            type="button"
            className={currency === 'credits' ? 'samm-cur-btn is-on' : 'samm-cur-btn'}
            disabled={spinning}
            onClick={() => switchCurrency('credits')}
          >
            credits
          </button>
          <button
            type="button"
            className={currency === 'tokens' ? 'samm-cur-btn is-on' : 'samm-cur-btn'}
            disabled={spinning}
            onClick={() => switchCurrency('tokens')}
          >
            tokens
          </button>
        </div>
        <div className="samm-bets">
          {betTiers(currency).map((t) => (
            <button
              type="button"
              key={t}
              className={bet === t ? 'samm-bet is-on' : 'samm-bet'}
              disabled={spinning || (currency === 'tokens' ? eco.tokens : eco.credits) < t}
              aria-label={`bet ${t} ${currency}`}
              aria-pressed={bet === t}
              onClick={() => setBet(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={!spinning && canBet(bet, currency) ? 'samm-pull is-ready' : 'samm-pull'}
          disabled={spinning || !canBet(bet, currency)}
          aria-label={spinning ? 'pulling…' : `pull — bet ${bet} ${currency}`}
          onClick={onPull}
        >
          {spinning ? '…' : `[ PULL · ${bet} ${currency} ]`}
        </button>
      </section>

      <section className="panel-section samm-wallet">
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
      </section>

      <footer className="panel-footer">
        the State thanks you · press [esc] or step away to close
      </footer>
    </dialog>
  );
}
