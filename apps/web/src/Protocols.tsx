import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PROTOCOLS,
  PROTOCOLS_LAUNCH_EVENT,
  type ProtocolEntry,
  openProtocols,
} from './protocols-registry.js';

// Protocols carousel — a Nintendo-DS-style cartridge picker (mega-batch 4.14).
//
// Stage 1 (scaffold): cartridge cards on a drag-scrollable rail (pointer +
//   touch), snapping to the nearest cartridge on release. The centred
//   cartridge is scaled up + lifted so it reads as the focus.
// Stage 2 (visual): worn-tape / peeled-label cartridge art via CSS gradients
//   + an inline CC0 SVG fractal-noise texture (no external asset). Each
//   protocol gets a colour band + a 3-letter glyph code.
// Stage 3 (drop): selecting a cartridge plays an eased descent into a slot,
//   a stepped "click-in", then launches the protocol. prefers-reduced-motion
//   skips the animation and launches immediately.
//
// FEEL is a STOP-AND-ASK default (devlog 0102): descent 600ms
// cubic-bezier(0.5,0,0.7,1), click-in 80ms steps(4), slot offset ~62px.

const CART_W = 150; // cartridge box width incl. inner margin (px); drives snap
const DROP_MS = 700; // total descent + click-in before launch

const REDUCED_MOTION =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

/** 3-letter cartridge code from the protocol label. */
function code(label: string): string {
  return (label.replace(/[^a-z]/gi, '').slice(0, 3) || '???').toUpperCase();
}

export function Protocols(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [dragDelta, setDragDelta] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dropping, setDropping] = useState<ProtocolEntry | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; idx: number } | null>(null);
  const dropTimer = useRef<number | null>(null);
  const len = PROTOCOLS.length;

  useEffect(() => {
    const onOpen = (): void => setOpen((v) => !v);
    window.addEventListener(PROTOCOLS_LAUNCH_EVENT, onOpen);
    return () => window.removeEventListener(PROTOCOLS_LAUNCH_EVENT, onOpen);
  }, []);

  useEffect(
    () => () => {
      if (dropTimer.current !== null) window.clearTimeout(dropTimer.current);
    },
    [],
  );

  const clampIdx = useCallback((i: number) => Math.max(0, Math.min(len - 1, i)), [len]);

  // The cartridge currently nearest the centre (accounts for an in-progress
  // drag) — drives the focus scaling.
  const focused = clampIdx(idx - Math.round(dragDelta / CART_W));

  const insert = useCallback(
    (entry: ProtocolEntry) => {
      if (!entry.available || dropping) return;
      if (REDUCED_MOTION) {
        entry.launch();
        setOpen(false);
        return;
      }
      setDropping(entry);
      dropTimer.current = window.setTimeout(() => {
        entry.launch();
        setOpen(false);
        setDropping(null);
      }, DROP_MS);
    },
    [dropping],
  );

  // Keyboard navigation while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (dropping) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIdx((i) => clampIdx(i - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setIdx((i) => clampIdx(i + 1));
      } else if (e.key === 'Escape') {
        setOpen(false);
      } else if (e.key === 'Enter' || e.key === ' ') {
        const entry = PROTOCOLS[idx];
        if (entry?.available) {
          e.preventDefault();
          insert(entry);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, idx, dropping, clampIdx, insert]);

  // Pointer drag (mouse + touch via Pointer Events).
  const onPointerDown = (e: React.PointerEvent): void => {
    if (dropping) return;
    dragStart.current = { x: e.clientX, idx };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent): void => {
    if (!dragStart.current) return;
    setDragDelta(e.clientX - dragStart.current.x);
  };
  const endDrag = (e: React.PointerEvent): void => {
    if (!dragStart.current) return;
    const moved = e.clientX - dragStart.current.x;
    const next = clampIdx(dragStart.current.idx - Math.round(moved / CART_W));
    dragStart.current = null;
    setDragging(false);
    setDragDelta(0);
    setIdx(next);
    // A tap (negligible movement) on the centred cartridge inserts it.
    if (Math.abs(moved) < 6 && next === focused) {
      const entry = PROTOCOLS[next];
      if (entry?.available) insert(entry);
    }
  };

  const trackStyle = {
    transform: `translateX(${-idx * CART_W + dragDelta}px)`,
    transition: dragging ? 'none' : 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
  };

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
        <span className="protocols-launch-cap">PROTOCOLS</span>
        <span className="protocols-launch-banner" aria-hidden="true">
          (Minigames)
        </span>
      </button>
      {open && (
        <div className="protocols-carousel" aria-label="protocols carousel">
          <div className="protocols-head">
            <span className="protocols-title">{'// protocols'}</span>
            <span className="protocols-sub">
              {focused + 1} / {len}
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
          <div
            className={`protocols-rail${dragging ? ' is-dragging' : ''}`}
            ref={railRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <div className="protocols-track" style={trackStyle}>
              {PROTOCOLS.map((entry, i) => {
                const isFocus = i === focused;
                const isDrop = dropping?.key === entry.key;
                const cls = [
                  'protocol-cartridge',
                  `cart-tint--${entry.tint}`,
                  isFocus ? 'is-focused' : '',
                  entry.available ? '' : 'is-locked',
                  isDrop ? 'is-dropping' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <div key={entry.key} className="protocol-cartridge-cell">
                    <div className={cls} aria-label={`${entry.label} cartridge`}>
                      <span className="cart-noise" aria-hidden="true" />
                      <span className="cart-band">
                        <span className="cart-code">{code(entry.label)}</span>
                      </span>
                      <span className="cart-label">{entry.label}</span>
                      <span className="cart-flavor">{entry.flavor}</span>
                      {entry.available ? (
                        isFocus && <span className="cart-insert">[ insert ]</span>
                      ) : (
                        <span className="cart-lock">{'// LOCKED'}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="protocols-slot" aria-hidden="true" />
          </div>
          <div className="protocols-foot">─── drag to browse · tap the centre cartridge ───</div>
        </div>
      )}
    </>
  );
}
