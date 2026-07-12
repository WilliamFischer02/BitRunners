import { useEffect, useRef, useState } from 'react';
import { getLines } from './dialogue.js';
import { RAMHATTAN_SHARD_EVENT, type RamhattanShardDetail } from './ramhattan.js';

// RAMHATTAN shopkeeper + shard toast (P8 first slice). Self-contained: the
// scene fires 'bitrunners:ramhattan-keeper-range' (SAMM pattern) and the
// shard-pickup event; this renders a walk-up prompt, a terminal-panel
// dialogue (lines from the dialogue registry — admin-editable), and a
// pickup toast. The actual SHOP is next-batch scope (docs/design/
// ramhattan.md); v1 the keeper just talks.

export function RamhattanKeeper(): JSX.Element | null {
  const [inRange, setInRange] = useState(false);
  const [open, setOpen] = useState(false);
  const [shardToast, setShardToast] = useState<RamhattanShardDetail | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    const onRange = (e: Event): void => {
      const near = (e as CustomEvent<{ inRange?: boolean }>).detail?.inRange ?? false;
      setInRange(near);
      if (!near) setOpen(false); // walking away closes the panel
    };
    const onShard = (e: Event): void => {
      const d = (e as CustomEvent<RamhattanShardDetail>).detail;
      if (!d) return;
      setShardToast(d);
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setShardToast(null), 4500);
    };
    window.addEventListener('bitrunners:ramhattan-keeper-range', onRange);
    window.addEventListener(RAMHATTAN_SHARD_EVENT, onShard);
    return () => {
      window.removeEventListener('bitrunners:ramhattan-keeper-range', onRange);
      window.removeEventListener(RAMHATTAN_SHARD_EVENT, onShard);
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    };
  }, []);

  return (
    <>
      {shardToast && (
        <output className="grant-toast">
          <span className="grant-toast-amount">+{shardToast.credits.toLocaleString()}¢</span>
          <span className="grant-toast-label">
            data shard secured · {shardToast.found}/{shardToast.total}
          </span>
        </output>
      )}
      {open && (
        <div className="panel-backdrop" onMouseDown={() => setOpen(false)}>
          <dialog
            open
            className="panel"
            aria-label="RAMHATTAN keeper"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header className="panel-header">
              <span className="panel-title">{'// ramhattan · keeper'}</span>
              <button
                type="button"
                className="panel-close"
                onClick={() => setOpen(false)}
                aria-label="close"
              >
                ✕
              </button>
            </header>
            <section className="panel-section">
              {getLines('ramhattan.keeper.greeting').map((line) => (
                <div key={line} className="panel-stub">
                  {line}
                </div>
              ))}
            </section>
            <footer className="panel-footer">─── shop opens a future sync ───</footer>
          </dialog>
        </div>
      )}
      {!open && inRange && (
        <button type="button" className="samm-prompt" onClick={() => setOpen(true)}>
          <span className="samm-prompt-glyph">⌂</span> talk to the keeper
        </button>
      )}
    </>
  );
}
