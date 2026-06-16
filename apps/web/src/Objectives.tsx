import { useEffect, useRef, useState } from 'react';
import {
  type MissionProgressLocal,
  getProgress,
  subscribeProgress,
} from './mission-progress-local.js';
import {
  type ActiveMissionSnap,
  MISSIONS,
  getActiveMission,
  subscribeMissionChanges,
} from './missions.js';
import { OBJECTIVES_OPEN_EVENT } from './protocols-registry.js';

// Objectives cartridge content panel. Lists active and completed missions
// from missions.ts. Completed missions are read from the persistent
// progress store (mission-progress-local), which the server reconciles on
// sign-in — so a completed objective stays marked complete forever and is
// never re-locked when a new objective becomes active.
//
// V1 is read-only — abandoning / restarting a mission is a future RPC.

export function Objectives(): JSX.Element | null {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [snap, setSnap] = useState<ActiveMissionSnap | null>(getActiveMission());
  const [progress, setProgressState] = useState<Readonly<MissionProgressLocal>>(getProgress());

  useEffect(() => {
    const onOpen = (): void => setOpen(true);
    window.addEventListener(OBJECTIVES_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OBJECTIVES_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => subscribeMissionChanges(setSnap), []);
  useEffect(() => subscribeProgress(setProgressState), []);

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

  if (!open) return null;

  const activeKey = snap?.mission.key ?? null;
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop close is pointer-only; keyboard close goes through the native cancel event in useEffect
    <dialog
      ref={dialogRef}
      className="panel objectives-panel"
      aria-modal="true"
      aria-labelledby="objectives-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <header className="panel-header">
        <span className="panel-title" id="objectives-title">
          {'// objectives'}
        </span>
        <button type="button" className="panel-close" onClick={() => setOpen(false)}>
          ✕
        </button>
      </header>

      <section className="panel-section">
        <div className="panel-section-title">$ active routes</div>
        {MISSIONS.map((m) => {
          const total = m.checkpoints.length;
          const isCompleted = progress.completed.includes(m.key);
          const isActive = !isCompleted && m.key === activeKey;
          // Completed missions persist as complete regardless of which
          // mission is currently active — that is the whole bug fix.
          const state = isCompleted
            ? 'complete'
            : isActive
              ? (snap?.state ?? 'inactive')
              : 'inactive';
          const next = isCompleted ? total : isActive ? (snap?.nextIdx ?? 0) : 0;
          const choice = isCompleted
            ? (progress.factions[m.key] ?? null)
            : isActive
              ? (snap?.factionChoice ?? null)
              : null;
          const cls = `objective-card${isActive ? ' is-active' : ''}${
            state === 'complete' ? ' is-complete' : ''
          }`;
          return (
            <div key={m.key} className={cls}>
              <div className="objective-card-head">
                <span className="objective-card-title">{m.title}</span>
                <span className="objective-card-state">
                  {state === 'complete'
                    ? '✓ complete'
                    : state === 'final'
                      ? '! final'
                      : isActive
                        ? '· active'
                        : '· locked'}
                </span>
              </div>
              <div className="objective-card-progress">
                {Array.from({ length: total }, (_, i) => i).map((i) => {
                  const pipCls = `objective-pip${i < next ? ' is-done' : ''}${
                    i === next && isActive && state !== 'complete' ? ' is-next' : ''
                  }`;
                  return (
                    <span key={i} className={pipCls}>
                      {i < next ? '●' : i === next && isActive ? '◉' : '○'}
                    </span>
                  );
                })}
                <span className="objective-card-count">
                  {Math.min(next, total)} / {total}
                </span>
              </div>
              <div className="objective-card-flavor">
                {state === 'complete' && choice === 'bitrunner'
                  ? `route logged to the admin. // bitrunner samaritan +${m.reward}`
                  : state === 'complete' && choice === 'corporate'
                    ? `transaction filed with the company. // corp samaritan +${m.reward}`
                    : state === 'complete'
                      ? 'route resolved.'
                      : isActive
                        ? 'walk the next pin on the minimap.'
                        : 'available after current route resolves.'}
              </div>
            </div>
          );
        })}
        {MISSIONS.length === 0 && <div className="panel-stub">─── no objectives queued.</div>}
      </section>

      <footer className="panel-footer">
        objectives advance as you reach checkpoints in-world.
      </footer>
    </dialog>
  );
}
