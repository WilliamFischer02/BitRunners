import { useEffect, useRef, useState } from 'react';
import { completeTutorial, isTutorialDone } from './economy.js';
import { type AuthSnapshot, subscribeAuth } from './supabase.js';

interface Step {
  title: string;
  body: string;
  /** Optional CSS selector for the HUD element this step is teaching. */
  target?: string;
}

// First-play walkthrough (devlog 0043). Guided, advance-on-[next], skippable.
// Each step optionally targets a HUD element — when set, a dashed pulsing ring
// is drawn around it so the body copy actually points at the thing it talks
// about (devlog 0058). The obelisk encounter (or [finish]) is the finale that
// grants server_speaker. Guests see an account-link CTA after the reward.
const STEPS: Step[] = [
  {
    title: 'welcome, runner',
    body: 'you booted into the cloud as a bit_spekter. a quick tour of the basics — you can [skip] anytime.',
  },
  {
    title: 'your inventory',
    body: 'the ▦ button in the centre of the emote wheel (bottom-right) opens your inventory. clothing and pets you own live there; tap one to equip it.',
    target: '.emote-center',
  },
  {
    title: 'the shop',
    body: 'the $ button on the right rail opens the shop. spend Credits on clothing and pets.',
    target: '.shop-launch',
  },
  {
    title: 'data scrape',
    body: 'open // data scrape on the right rail. tap SCRAPE for bits, TABULATE up the ladder (bits→strings→serials→passcodes), then CALCULATE a passcode into Credits via the Admin or the Company. passcodes also buy upgrades in the skill tree.',
    target: '.scrape-launch',
  },
  {
    title: 'moving around',
    body: 'move with WASD / arrow keys, or the on-screen joystick on touch. roam the platform.',
    target: '.hint',
  },
  {
    title: 'points of interest',
    body: 'find SAMM (the vending machine) to gamble Credits — and the tall obelisk, where something is watching. head to the obelisk to finish.',
  },
];

type Phase = 'steps' | 'reward' | 'cta';

/**
 * Pulsing dashed ring drawn around a HUD element. Re-reads the target's
 * bounding rect on resize / scroll / target-resize, plus a one-shot retry in
 * case the element wasn't mounted yet when the step changed.
 */
function TutorialHighlight({ target }: { target: string }): JSX.Element | null {
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
      className="tutorial-highlight"
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

export function Tutorial(): JSX.Element | null {
  const [active, setActive] = useState(() => !isTutorialDone());
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<Phase>('steps');
  const [auth, setAuth] = useState<AuthSnapshot>({ status: 'guest' });

  const activeRef = useRef(active);
  activeRef.current = active;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // Reaching the obelisk (Admin encounter) is the finale → grant the reward.
  useEffect(() => {
    const onAdmin = (): void => {
      if (activeRef.current && phaseRef.current === 'steps') {
        completeTutorial();
        setPhase('reward');
      }
    };
    window.addEventListener('bitrunners:admin-encounter', onAdmin);
    return () => window.removeEventListener('bitrunners:admin-encounter', onAdmin);
  }, []);

  // Track auth so we only show the "make account" CTA to guests.
  useEffect(() => subscribeAuth(setAuth), []);

  if (!active) return null;

  if (phase === 'cta') {
    return (
      <section className="tutorial-card tutorial-card--cta" aria-label="tutorial · save progress">
        <div className="tutorial-title">save your progress</div>
        <div className="tutorial-body">
          you're playing as a <b>guest</b> — your tokens, credits, outfits and unlocks live in this
          browser only. make a free account to keep them across sessions and devices.
        </div>
        <div className="tutorial-actions">
          <button
            type="button"
            className="tutorial-btn"
            onClick={() => setActive(false)}
            title="dismiss — your progress stays local"
          >
            [ continue without ]
          </button>
          <button
            type="button"
            className="tutorial-btn tutorial-btn--primary"
            onClick={() => {
              try {
                window.dispatchEvent(new CustomEvent('bitrunners:open-profile'));
              } catch {
                // non-DOM env — ignore
              }
              setActive(false);
            }}
          >
            [ make account ]
          </button>
        </div>
      </section>
    );
  }

  const dismissReward = (): void => {
    // Authenticated players skip the CTA. Guests get the one-shot prompt.
    if (auth.status === 'guest') setPhase('cta');
    else setActive(false);
  };

  if (phase === 'reward') {
    return (
      <section className="tutorial-card tutorial-card--reward" aria-label="tutorial reward">
        <div className="tutorial-title">a new stack</div>
        <div className="tutorial-body">
          the Admin reshaped your code. you've earned <b>server_speaker</b> — choose it at your next
          login.
        </div>
        <div className="tutorial-actions">
          <button
            type="button"
            className="tutorial-btn tutorial-btn--primary"
            onClick={dismissReward}
          >
            [ done ]
          </button>
        </div>
      </section>
    );
  }

  const s = STEPS[step];
  if (!s) return null;
  const last = step >= STEPS.length - 1;
  const finish = (): void => {
    completeTutorial();
    setPhase('reward');
  };

  return (
    <>
      {s.target && <TutorialHighlight target={s.target} />}
      <section className="tutorial-card" aria-label="tutorial">
        <div className="tutorial-step">
          tutorial · {step + 1}/{STEPS.length}
        </div>
        <div className="tutorial-title">{s.title}</div>
        <div className="tutorial-body">{s.body}</div>
        <div className="tutorial-actions">
          <button type="button" className="tutorial-btn" onClick={() => setActive(false)}>
            [ skip ]
          </button>
          {last ? (
            <button type="button" className="tutorial-btn tutorial-btn--primary" onClick={finish}>
              [ finish ]
            </button>
          ) : (
            <button
              type="button"
              className="tutorial-btn tutorial-btn--primary"
              onClick={() => setStep((i) => i + 1)}
            >
              [ next ▸ ]
            </button>
          )}
        </div>
      </section>
    </>
  );
}
