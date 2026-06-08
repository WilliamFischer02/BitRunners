import { useCallback, useEffect, useRef, useState } from 'react';
import { type EconomyState, addChatter, getEconomy, subscribeEconomy } from '../../economy.js';
import { TETHER_HOP_OPEN_EVENT } from '../../protocols-registry.js';
import { Exchange } from './Exchange.js';
import { type TetherHopHandle, runTetherHop } from './game.js';

// Tether Hop protocol panel. Opens via bitrunners:open-tether-hop event
// (dispatched by the Protocols carousel). Three views:
//   - 'ready'   — "boot the protocol?" splash + chatter balance
//   - 'running' — canvas with the active game
//   - 'result'  — captured / missed totals + "again" / "exchange" buttons
//
// The game itself lives in ./game.ts (pure 2D canvas, no three.js). Capture
// counts get appended to the device-local economy.chatter at run end via
// addChatter().

type View = 'ready' | 'running' | 'result' | 'exchange';

interface RunResult {
  captured: number;
  missed: number;
  durationMs: number;
}

export function TetherHop(): JSX.Element | null {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<TetherHopHandle | null>(null);
  const [view, setView] = useState<View>('ready');
  const [result, setResult] = useState<RunResult | null>(null);
  const [live, setLive] = useState({ captured: 0, missed: 0 });
  const [eco, setEco] = useState<EconomyState>(() => ({ ...getEconomy() }));

  // Open / close lifecycle.
  useEffect(() => {
    const onOpen = (): void => {
      setOpen(true);
      setView('ready');
      setResult(null);
      setLive({ captured: 0, missed: 0 });
    };
    window.addEventListener(TETHER_HOP_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(TETHER_HOP_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => subscribeEconomy(() => setEco({ ...getEconomy() })), []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;
    const trigger = document.activeElement as HTMLElement | null;
    dialog.showModal();
    const onCancel = (e: Event): void => {
      e.preventDefault();
      setOpen(false);
    };
    dialog.addEventListener('cancel', onCancel);
    return () => {
      dialog.removeEventListener('cancel', onCancel);
      trigger?.focus();
    };
  }, [open]);

  // Cancel any in-flight game when the panel closes.
  useEffect(() => {
    if (open) return;
    handleRef.current?.cancel();
    handleRef.current = null;
  }, [open]);

  const startRun = useCallback(() => {
    setView('running');
    setResult(null);
    setLive({ captured: 0, missed: 0 });
    // The canvas re-renders when view flips to 'running', so wait one frame
    // for it to mount before binding the run.
    requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) {
        setView('ready');
        return;
      }
      handleRef.current = runTetherHop(
        canvas,
        (r) => {
          handleRef.current = null;
          if (r.captured > 0) addChatter(r.captured);
          setResult(r);
          setView('result');
        },
        {
          onTick: (captured, missed) => {
            setLive({ captured, missed });
          },
        },
      );
    });
  }, []);

  const abort = useCallback(() => {
    // cancel() invokes the same onEnd path as a natural run end, so the
    // player keeps any chatter they captured before aborting. The result
    // view renders next.
    handleRef.current?.cancel();
    handleRef.current = null;
  }, []);

  if (!open) return null;

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop close is pointer-only; keyboard close goes through native cancel event in useEffect
    <dialog
      ref={dialogRef}
      className="panel tether-panel"
      aria-modal="true"
      aria-labelledby="tether-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <header className="panel-header">
        <span className="panel-title" id="tether-title">
          {'// tether_hop'}
        </span>
        <button type="button" className="panel-close" onClick={() => setOpen(false)}>
          ✕
        </button>
      </header>

      {view === 'ready' && (
        <section className="panel-section tether-section">
          <div className="panel-section-title">$ tether_hop · capture chatter</div>
          <div className="panel-stub">
            ─── three channels carry chatter past your terminal. tap a channel as the disturbance
            crosses the strike line. captured chatter exchanges to the Admin or the Company.
          </div>
          <div className="tether-stats">
            <span className="tether-stat">
              chatter on hand: <b>{eco.chatter}</b>
            </span>
            <span className="tether-stat">
              credits: <b>{eco.credits}</b>
            </span>
          </div>
          <div className="tether-actions">
            <button
              type="button"
              className="panel-toggle is-on tether-start"
              onClick={() => startRun()}
            >
              [ boot protocol ]
            </button>
            {eco.chatter > 0 && (
              <button
                type="button"
                className="panel-toggle tether-exchange-btn"
                onClick={() => setView('exchange')}
              >
                [ exchange chatter ]
              </button>
            )}
          </div>
        </section>
      )}

      {view === 'running' && (
        <section className="panel-section tether-section">
          <div className="tether-hud">
            <span className="tether-stat">
              <span className="tether-pill tether-pill--hit">●</span> {live.captured}
            </span>
            <span className="tether-stat">
              <span className="tether-pill tether-pill--miss">○</span> {live.missed}
            </span>
            <button type="button" className="panel-toggle" onClick={abort}>
              [ abort ]
            </button>
          </div>
          <canvas ref={canvasRef} className="tether-canvas" aria-label="tether hop play area" />
        </section>
      )}

      {view === 'result' && result && (
        <section className="panel-section tether-section">
          <div className="panel-section-title">$ run complete</div>
          <div className="tether-result">
            <div className="tether-result-row">
              <span>captured</span>
              <b className="tether-result-hit">{result.captured}</b>
            </div>
            <div className="tether-result-row">
              <span>missed</span>
              <b className="tether-result-miss">{result.missed}</b>
            </div>
            <div className="tether-result-row tether-result-total">
              <span>chatter on hand</span>
              <b>{eco.chatter}</b>
            </div>
          </div>
          <div className="tether-actions">
            <button
              type="button"
              className="panel-toggle is-on tether-start"
              onClick={() => startRun()}
            >
              [ again ]
            </button>
            {eco.chatter > 0 && (
              <button
                type="button"
                className="panel-toggle tether-exchange-btn"
                onClick={() => setView('exchange')}
              >
                [ exchange chatter ]
              </button>
            )}
          </div>
        </section>
      )}

      {view === 'exchange' && (
        <Exchange chatter={eco.chatter} onBack={() => setView(result ? 'result' : 'ready')} />
      )}

      <footer className="panel-footer">
        tap a channel as the waveform crosses the strike line to capture chatter.
      </footer>
    </dialog>
  );
}
