import { useEffect, useRef, useState } from 'react';
import { completeTutorial, isTutorialDone } from './economy.js';

interface Step {
  title: string;
  body: string;
}

// First-play walkthrough (devlog 0043). Guided, advance-on-[next], skippable.
// The obelisk encounter (or [finish]) is the finale that grants server_speaker.
const STEPS: Step[] = [
  {
    title: 'welcome, runner',
    body: 'you booted into the cloud as a bit_spekter. a quick tour of the basics — you can [skip] anytime.',
  },
  {
    title: 'your inventory',
    body: 'the ▦ button in the centre of the emote wheel (bottom-right) opens your inventory. clothing and pets you own live there; tap one to equip it.',
  },
  {
    title: 'the shop',
    body: 'the $ button on the right rail opens the shop. spend Credits on clothing and pets. (Tokens stay locked — no wallet yet.)',
  },
  {
    title: 'data scrape',
    body: 'open // data scrape on the right rail. tap SCRAPE for bits, TABULATE up the ladder (bits→strings→serials→passcodes), then CALCULATE a passcode into Credits via the Admin or the Company. passcodes also buy upgrades in the skill tree.',
  },
  {
    title: 'moving around',
    body: 'move with WASD / arrow keys, or the on-screen joystick on touch. roam the platform.',
  },
  {
    title: 'points of interest',
    body: 'find SAMM (the vending machine) to gamble Credits — and the tall obelisk, where something is watching. head to the obelisk to finish.',
  },
];

export function Tutorial(): JSX.Element | null {
  const [active, setActive] = useState(() => !isTutorialDone());
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<'steps' | 'reward'>('steps');

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

  if (!active) return null;

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
            onClick={() => setActive(false)}
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
  );
}
