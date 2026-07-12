import { useEffect, useRef, useState } from 'react';
import type { View } from './ScrapeMenu.js';
import {
  type EconomyState,
  STEP,
  isScrapeTutorialSeen,
  markScrapeTutorialSeen,
} from './economy.js';

// data_scrape guided tour (devlog 0148). Mounted inside the scrape panel;
// six steps, and the "do it" steps advance on the ACTION itself (scrape
// fired, tabulate minted a string, tree tab opened) rather than on [next].
// Skippable at every step; both finish and skip set the account-synced
// `scrapeTutorialSeen` flag so the tour runs exactly once per account.
//
// Veteran gate: a blob with real ladder progress (any passcode ever, or
// 100+ lifetime scrapes) predates this tour — silently mark it seen instead
// of lecturing an existing player about the button they've hit 5000 times.

interface TourStep {
  title: string;
  body: string;
  /** CSS selector highlighted while the step is active. */
  target?: string;
  /** Label when the step advances by button instead of by action. */
  nextLabel?: string;
  /** Shown under the body on action-advance steps. */
  waitHint?: string;
}

const TOUR: TourStep[] = [
  {
    title: '// data_scrape',
    body: 'this cartridge is how you mine the cloud: SCRAPE raw bits, TABULATE them up the ladder, CALCULATE the result into credits. quick hands-on tour — [skip] anytime.',
    nextLabel: '[ start ▸ ]',
  },
  {
    title: 'scrape',
    body: 'hit the big SCRAPE button. every press tears loose a few bits from the substrate.',
    target: '.scrape-btn',
    waitHint: '▸ press SCRAPE to continue',
  },
  {
    title: 'tabulate',
    body: `bits are worthless raw. bank ${STEP} bits, then hit the first [ ${STEP} → 1 ] to press them into a string. the ladder repeats: bits → strings → serials → passcodes.`,
    target: '.scrape-mini',
    waitHint: `▸ tabulate ${STEP} bits into a string to continue`,
  },
  {
    title: 'calculate',
    body: 'passcodes are the payout tier: trade them to the Company (recycle) or the Admin (destroy) for ¢ credits + samaritan reputation. auras sit above passcodes and pay even more.',
    nextLabel: '[ next ▸ ]',
  },
  {
    title: 'the skill tree',
    body: 'open the tree tab up top. tree nodes spend passcodes to make every future scrape stronger.',
    target: '.scrape-headbtns .scrape-tabbtn:nth-of-type(2)',
    waitHint: '▸ open the tree tab to continue',
  },
  {
    title: 'spend passcodes here',
    body: 'each node costs passcodes and levels up your yield — more bits per scrape, auto-tappers, bots. mint your first passcode and this page unlocks. that ends the tour.',
    target: '.tree-node',
    nextLabel: '[ got it ]',
  },
];

/** Same pulsing-ring pattern as Tutorial.tsx's TutorialHighlight, but with a
 *  higher-z class so the ring clears the panel backdrop (z 50). */
function TourHighlight({ target }: { target: string }): JSX.Element | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    let cancelled = false;
    const update = (): void => {
      if (cancelled) return;
      const el = document.querySelector(target);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    const el = document.querySelector(target);
    const observer = el ? new ResizeObserver(update) : null;
    if (el && observer) observer.observe(el);
    const retry = window.setTimeout(update, 220);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      observer?.disconnect();
      window.clearTimeout(retry);
    };
  }, [target]);
  if (!rect) return null;
  const pad = 6;
  return (
    <div
      className="scrape-tutorial-highlight"
      aria-hidden="true"
      style={{
        top: `${rect.top - pad}px`,
        left: `${rect.left - pad}px`,
        width: `${rect.width + pad * 2}px`,
        height: `${rect.height + pad * 2}px`,
      }}
    />
  );
}

export function ScrapeTutorial({
  eco,
  view,
}: { eco: EconomyState; view: View }): JSX.Element | null {
  const [active, setActive] = useState(() => {
    if (isScrapeTutorialSeen()) return false;
    // Veteran gate — see file header.
    if (eco.lifetimePasscodes >= 1 || eco.lifetimeScrapes >= 100) {
      markScrapeTutorialSeen();
      return false;
    }
    return true;
  });
  const [step, setStep] = useState(0);

  // Baselines for the action-advance steps, captured when the step changes.
  const baseRef = useRef({ scrapes: 0, strings: 0 });
  // biome-ignore lint/correctness/useExhaustiveDependencies: capture eco at step entry only
  useEffect(() => {
    baseRef.current = { scrapes: eco.lifetimeScrapes, strings: eco.strings };
  }, [step]);

  // Action-advance: watch the economy/view for the current step's condition.
  useEffect(() => {
    if (!active) return;
    const b = baseRef.current;
    const done =
      (step === 1 && eco.lifetimeScrapes > b.scrapes) ||
      (step === 2 && eco.strings > b.strings) ||
      (step === 4 && view === 'tree');
    if (done) setStep((i) => i + 1);
  }, [active, step, eco, view]);

  if (!active) return null;
  const s = TOUR[step];
  if (!s) return null;
  const last = step >= TOUR.length - 1;

  const dismiss = (): void => {
    markScrapeTutorialSeen();
    setActive(false);
  };

  return (
    <>
      {s.target && <TourHighlight target={s.target} />}
      <section className="tutorial-card scrape-tutorial" aria-label="data_scrape tutorial">
        <div className="tutorial-step">
          data_scrape · {step + 1}/{TOUR.length}
        </div>
        <div className="tutorial-title">{s.title}</div>
        <div className="tutorial-body">{s.body}</div>
        {s.waitHint && <div className="scrape-tutorial-wait">{s.waitHint}</div>}
        <div className="tutorial-actions">
          <button type="button" className="tutorial-btn" onClick={dismiss}>
            [ skip ]
          </button>
          {s.nextLabel &&
            (last ? (
              <button
                type="button"
                className="tutorial-btn tutorial-btn--primary"
                onClick={dismiss}
              >
                {s.nextLabel}
              </button>
            ) : (
              <button
                type="button"
                className="tutorial-btn tutorial-btn--primary"
                onClick={() => setStep((i) => i + 1)}
              >
                {s.nextLabel}
              </button>
            ))}
        </div>
      </section>
    </>
  );
}
