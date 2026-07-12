import { useEffect, useRef, useState } from 'react';
import { completeTutorial, isTutorialDone } from './economy.js';
import { type AuthSnapshot, subscribeAuth } from './supabase.js';

interface Step {
  title: string;
  body: string;
  /** Optional CSS selector for the HUD element this step is teaching. */
  target?: string;
}

// First-play walkthrough. Guided, advance-on-[next], skippable.
//
// Tour covers the post-cartridge-carousel HUD (devlog 0102): protocols
// launcher, credits HUD, spectrum navigator, emote wheel + inventory,
// profile chip, movement, and the obelisk finale.
//
// Logged-in users skip the tour entirely — see the auth gate at the top of
// the Tutorial component. The obelisk encounter (or [finish]) is the finale
// that grants server_speaker; guests who reach it see the reward UI plus an
// account-link CTA.
const STEPS: Step[] = [
  {
    title: 'welcome, runner',
    body: 'you booted into the cloud as a bit_spekter. a quick tour of the HUD — you can [skip] anytime.',
  },
  {
    title: 'moving around',
    body: 'WASD or arrow keys to roam; touch devices get a thumbstick. the cloud is a wrapping platform — keep walking and you come back around.',
    target: '.hint',
  },
  {
    title: '// protocols',
    body: 'tap the ⌬ PROTOCOLS button — it unfolds into the cartridge rack: data_scrape, objectives, shop, freq_lock, circuit_patch, core_run. scroll (or ↑/↓) and tap a cartridge to insert it. want to chat? just tap another runner out in the world.',
    target: '.protocols-launch',
  },
  {
    title: 'data_scrape',
    body: 'data_scrape is how you mine the cloud: SCRAPE bits → TABULATE them up the ladder (bits → strings → serials → passcodes) → CALCULATE a passcode into ¢ credits at the Admin or the Company. passcodes also buy upgrades in the skill tree.',
    target: '.protocols-launch',
  },
  {
    title: 'credits + tokens',
    body: 'the top strip tracks ¢ credits (currency for shop cosmetics and SAMM gambling) and ◈ tokens (collectible scraps from missions and Admin grants). both follow your account once you sign in.',
    target: '.credits-hud',
  },
  {
    title: 'spectrum navigator',
    body: 'the minimap in the top-right is the spectrum navigator. tap it to maximise — compass N/E/S/W, live x/z readout, plus pins for SAMM, the Admin, and your current OBJ checkpoint.',
    target: '.starmap',
  },
  {
    title: 'emotes + inventory',
    body: 'the wheel in the bottom-right fires emotes. four cardinal slots are yours to swap — open inventory via the centre ▦ to pick from owned emotes, equip outfits, and switch themes. the shop and inventory are siblings of the same modal.',
    target: '.emote-center',
  },
  {
    title: 'your handle',
    body: 'the profile chip in the top-left is your runner. tap it to set a display name and link a free account. signing in keeps your tokens, credits, outfits, badges, and level across devices.',
    target: '.profile',
  },
  {
    title: 'levels + missions',
    body: 'open objectives from the protocols rack to see active missions. completing them earns badges; each badge bumps your Lv chip (cap Lv 20) which other runners can see on your nametag.',
    target: '.protocols-launch',
  },
  {
    title: 'one more thing — the obelisk',
    body: 'find SAMM (the vending machine) to gamble credits, or freq_lock to chase a rhythm-based credit haul. then head for the tall obelisk in the distance — something is watching from inside. that ends the tour.',
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

/**
 * Synchronous heuristic: does the browser already hold a Supabase session?
 * Used to suppress the tutorial flash on initial render for returning
 * logged-in users (`subscribeAuth` is async, so a brief flicker would
 * otherwise appear before auth state resolves). Reads the supabase-js v2
 * storage key shape — degrades gracefully to a flash if the convention
 * changes.
 */
function hasPersistedSession(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('sb-') && k.endsWith('-auth-token')) return true;
    }
  } catch {
    // private mode / quota error — assume guest
  }
  return false;
}

export function Tutorial(): JSX.Element | null {
  const [active, setActive] = useState(() => !isTutorialDone() && !hasPersistedSession());
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

  // Auth gate. Logged-in users skip the tour entirely — silently mark the
  // tutorial done (which also grants server_speaker, the same unlock guests
  // earn by walking through) so signed-in users aren't worse off.
  useEffect(
    () =>
      subscribeAuth((next) => {
        setAuth(next);
        if (next.status !== 'guest') {
          if (!isTutorialDone()) completeTutorial();
          setActive(false);
        }
      }),
    [],
  );

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
