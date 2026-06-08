import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PROTOCOLS,
  PROTOCOLS_LAUNCH_EVENT,
  type ProtocolEntry,
  openProtocols,
} from './protocols-registry.js';

// Protocols carousel — replaces the standalone `data scrape` launcher.
// Sits in the HUD launch row beside the profile icon. Clicking opens a
// small floating cartridge carousel; left/right arrows + keyboard ←/→
// cycle focus; clicking the focused cartridge launches it (which
// dispatches the per-protocol open event the relevant content panel
// listens for) and dismisses the carousel.
//
// V1: cartridges are launchers, not inline hosts. The Scrape cartridge
// opens the existing ScrapeMenu modal; the Objectives cartridge opens
// the Objectives modal. Phase 3 will add Tether Hop as another
// cartridge (also a launcher, since Tether Hop is a full-canvas game).

export function Protocols(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOpen = (): void => setOpen((v) => !v);
    window.addEventListener(PROTOCOLS_LAUNCH_EVENT, onOpen);
    return () => window.removeEventListener(PROTOCOLS_LAUNCH_EVENT, onOpen);
  }, []);

  // Keyboard navigation only while the carousel is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIdx((i) => (i - 1 + PROTOCOLS.length) % PROTOCOLS.length);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setIdx((i) => (i + 1) % PROTOCOLS.length);
      } else if (e.key === 'Escape') {
        setOpen(false);
      } else if (e.key === 'Enter' || e.key === ' ') {
        // Insert the focused cartridge.
        const entry = PROTOCOLS[idx];
        if (entry?.available) {
          e.preventDefault();
          entry.launch();
          setOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, idx]);

  // Touch swipe: horizontal swipe on the rail cycles cartridges.
  useEffect(() => {
    if (!open) return;
    const el = containerRef.current;
    if (!el) return;
    let startX = 0;
    let startY = 0;
    let tracking = false;
    const onStart = (e: TouchEvent): void => {
      const t = e.touches[0];
      if (!t) return;
      startX = t.clientX;
      startY = t.clientY;
      tracking = true;
    };
    const onEnd = (e: TouchEvent): void => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) {
          setIdx((i) => (i + 1) % PROTOCOLS.length);
        } else {
          setIdx((i) => (i - 1 + PROTOCOLS.length) % PROTOCOLS.length);
        }
      }
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchend', onEnd);
    };
  }, [open]);

  const insert = useCallback((entry: ProtocolEntry) => {
    if (!entry.available) return;
    entry.launch();
    setOpen(false);
  }, []);

  return (
    <>
      <button
        type="button"
        className="protocols-launch"
        onClick={() => openProtocols()}
        title="open protocols"
        aria-label="open protocols"
        aria-expanded={open}
      >
        <span className="protocols-launch-glyph">⌬</span>
        <span className="protocols-launch-cap">protocols</span>
      </button>
      {open && (
        <div className="protocols-carousel" ref={containerRef} aria-label="protocols carousel">
          <div className="protocols-head">
            <span className="protocols-title">{'// protocols'}</span>
            <span className="protocols-sub">
              ← {idx + 1} / {PROTOCOLS.length} →
            </span>
            <button
              type="button"
              className="protocols-close"
              onClick={() => setOpen(false)}
              aria-label="close protocols"
            >
              ✕
            </button>
          </div>
          <div className="protocols-rail">
            {PROTOCOLS.map((entry, i) => {
              const focused = i === idx;
              const cls = `protocol-cartridge${focused ? ' is-focused' : ''} cart-tint--${
                entry.tint
              }${entry.available ? '' : ' is-locked'}`;
              return (
                <button
                  key={entry.key}
                  type="button"
                  className={cls}
                  onClick={() => {
                    if (focused) {
                      insert(entry);
                    } else {
                      setIdx(i);
                    }
                  }}
                  aria-label={`${entry.label} cartridge${focused ? ' (focused)' : ''}`}
                >
                  <span className="cart-glyph">{entry.glyph}</span>
                  <span className="cart-label">{entry.label}</span>
                  <span className="cart-flavor">{entry.flavor}</span>
                  {focused && entry.available && <span className="cart-insert">[ INSERT ]</span>}
                  {!entry.available && <span className="cart-lock">{'// LOCKED'}</span>}
                </button>
              );
            })}
          </div>
          <div className="protocols-foot">
            ─── ← / → to browse · tap focused cartridge to insert ───
          </div>
        </div>
      )}
    </>
  );
}
