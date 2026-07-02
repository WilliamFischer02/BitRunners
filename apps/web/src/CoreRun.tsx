import { useCallback, useEffect, useRef, useState } from 'react';
import { nudgeAccount } from './account-nudge.js';
import { addCredits } from './economy.js';

// core_run — shrinking-maze minigame overlay (mega-batch 2 · 4.5). The maze
// itself lives in the three.js scene (scene.ts maze mode); this component is a
// thin driver: it starts/aborts the run via window events and shows the ready
// / HUD / victory / fail screens. The scene reports progress back the same way.
//
// While a run is active the overlay is a small top HUD with pointer-events off
// so the player keeps steering the rig with the normal controls.

const REWARD_BASE = 40;
const REWARD_CAP = 100; // 40 base + 1/sec remaining, capped

type Phase = 'ready' | 'running' | 'confirm' | 'won' | 'fail';

export function CoreRun({ onClose }: { onClose(): void }): JSX.Element {
  const [phase, setPhase] = useState<Phase>('ready');
  const [timeLeft, setTimeLeft] = useState(90);
  const [rings, setRings] = useState(0);
  const [reward, setReward] = useState(0);
  const phaseRef = useRef<Phase>('ready');
  phaseRef.current = phase;

  const enter = useCallback(() => {
    setTimeLeft(90);
    setRings(0);
    setReward(0);
    setPhase('running');
    window.dispatchEvent(new CustomEvent('bitrunners:core-run-enter'));
  }, []);

  const abort = useCallback(() => {
    window.dispatchEvent(new CustomEvent('bitrunners:core-run-abort'));
    onClose();
  }, [onClose]);

  useEffect(() => {
    const onTick = (e: Event): void => {
      const d = (e as CustomEvent<{ timeLeft: number; rings: number }>).detail;
      if (!d) return;
      setTimeLeft(d.timeLeft);
      setRings(d.rings);
    };
    const onWin = (e: Event): void => {
      if (phaseRef.current !== 'running') return;
      const secondsLeft = (e as CustomEvent<{ secondsLeft: number }>).detail?.secondsLeft ?? 0;
      const amount = Math.min(REWARD_CAP, REWARD_BASE + Math.max(0, secondsLeft));
      addCredits(amount);
      nudgeAccount('minigame');
      setReward(amount);
      setPhase('won');
    };
    const onFail = (): void => {
      if (phaseRef.current === 'running') setPhase('fail');
    };
    window.addEventListener('bitrunners:maze-tick', onTick);
    window.addEventListener('bitrunners:maze-win', onWin);
    window.addEventListener('bitrunners:maze-fail', onFail);
    return () => {
      window.removeEventListener('bitrunners:maze-tick', onTick);
      window.removeEventListener('bitrunners:maze-win', onWin);
      window.removeEventListener('bitrunners:maze-fail', onFail);
    };
  }, []);

  // ESC: on the ready screen closes; mid-run pops the abort confirm.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      const p = phaseRef.current;
      if (p === 'ready') onClose();
      else if (p === 'running') setPhase('confirm');
      else if (p === 'confirm') setPhase('running');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Safety: if the run ends for any reason and the overlay is still open in a
  // running state, don't strand the player — the scene exit event closes us out
  // of the HUD if we somehow missed win/fail.
  useEffect(() => {
    const onExit = (): void => {
      if (phaseRef.current === 'running' || phaseRef.current === 'confirm') {
        // A win/fail event normally arrives right after; give it a beat, then
        // fall back to closing so we never hang on the HUD.
        window.setTimeout(() => {
          if (phaseRef.current === 'running' || phaseRef.current === 'confirm') onClose();
        }, 50);
      }
    };
    window.addEventListener('bitrunners:maze-abort', onExit);
    return () => window.removeEventListener('bitrunners:maze-abort', onExit);
  }, [onClose]);

  if (phase === 'running' || phase === 'confirm') {
    const low = timeLeft <= 15;
    return (
      <div className="corerun-hud-wrap">
        <div className={`corerun-hud${low ? ' is-low' : ''}`}>
          <span className="corerun-hud-title">{'// core_run'}</span>
          <span className="corerun-hud-timer">{timeLeft}s</span>
          {rings > 0 && <span className="corerun-hud-rings">data loss ▓{rings}</span>}
          <button
            type="button"
            className="corerun-hud-abort"
            onClick={() => setPhase('confirm')}
            aria-label="abort run"
          >
            abort
          </button>
        </div>
        {phase === 'confirm' && (
          <div className="corerun-back">
            <div className="corerun-panel">
              <div className="corerun-title">abort run?</div>
              <div className="corerun-body">you'll leave the maze with no reward.</div>
              <div className="corerun-row">
                <button type="button" className="corerun-btn" onClick={abort}>
                  [ abort ]
                </button>
                <button type="button" className="corerun-btn" onClick={() => setPhase('running')}>
                  [ keep going ]
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="corerun-back">
      <div className="corerun-panel">
        {phase === 'ready' && (
          <>
            <div className="corerun-title">core_run</div>
            <div className="corerun-body">
              you're dropped at the edge of a data maze. reach the glowing core at the center before
              the clock runs out.
              <br />
              <br />
              after 30s the outer rings dissolve into raw data — get caught in one and the run ends.
              <br />
              <br />
              90 seconds · 40 credits + 1 per second left · max {REWARD_CAP}.
            </div>
            <div className="corerun-row">
              <button type="button" className="corerun-btn corerun-btn--go" onClick={enter}>
                [ enter maze ]
              </button>
              <button type="button" className="corerun-btn" onClick={onClose}>
                [ cancel ]
              </button>
            </div>
          </>
        )}
        {phase === 'won' && (
          <>
            <div className="corerun-title corerun-title--win">core reached</div>
            <div className="corerun-body">
              earned <span className="corerun-credits">{reward}</span> credits
              {reward >= REWARD_CAP ? ' (max)' : ''}
            </div>
            <div className="corerun-row">
              <button type="button" className="corerun-btn corerun-btn--go" onClick={enter}>
                [ again ]
              </button>
              <button type="button" className="corerun-btn" onClick={onClose}>
                [ done ]
              </button>
            </div>
          </>
        )}
        {phase === 'fail' && (
          <>
            <div className="corerun-title corerun-title--fail">run lost</div>
            <div className="corerun-body">the data caught up with you. no reward this time.</div>
            <div className="corerun-row">
              <button type="button" className="corerun-btn corerun-btn--go" onClick={enter}>
                [ again ]
              </button>
              <button type="button" className="corerun-btn" onClick={onClose}>
                [ done ]
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default CoreRun;
