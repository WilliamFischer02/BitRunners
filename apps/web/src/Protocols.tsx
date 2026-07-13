import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PROTOCOLS,
  PROTOCOLS_LAUNCH_EVENT,
  type ProtocolEntry,
  openProtocols,
} from './protocols-registry.js';

// Protocols rack — the PROTOCOLS button morphs in place (devlog 0156).
//
// The old separate carousel window is gone. Tapping PROTOCOLS keeps the
// SAME element and grows it (CSS height/width transition ~250ms ease) into
// a tall panel anchored at the button's position, below the minimap. The
// cap text + "(Minigames)" banner fade out and a compact VERTICAL cartridge
// rack renders inside the expanded area — the narrow column fits rows far
// better than the old 150px-wide horizontal cards.
//
// Nav: ↑/↓ move focus, enter/space inserts, esc (or the header / ✕)
// contracts back to button form. Touch drags scroll natively (pan-y);
// mouse drag-to-scroll is wired on the list. Insert plays a short click-in
// flash before launching; prefers-reduced-motion skips every animation and
// launches immediately.

const INSERT_MS = 380; // click-in flash before the protocol launches

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
  const [inserting, setInserting] = useState<ProtocolEntry | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const insertTimer = useRef<number | null>(null);
  // Mouse drag-to-scroll bookkeeping (touch scrolls natively via pan-y).
  const dragStart = useRef<{ y: number; top: number } | null>(null);
  const dragMoved = useRef(false);
  const len = PROTOCOLS.length;

  useEffect(() => {
    const onOpen = (): void => setOpen((v) => !v);
    window.addEventListener(PROTOCOLS_LAUNCH_EVENT, onOpen);
    return () => window.removeEventListener(PROTOCOLS_LAUNCH_EVENT, onOpen);
  }, []);

  useEffect(
    () => () => {
      if (insertTimer.current !== null) window.clearTimeout(insertTimer.current);
    },
    [],
  );

  // Move focus into the panel on expand so esc/enter act on the rack.
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  const clampIdx = useCallback((i: number) => Math.max(0, Math.min(len - 1, i)), [len]);

  const insert = useCallback(
    (entry: ProtocolEntry) => {
      if (!entry.available || inserting) return;
      if (REDUCED_MOTION) {
        entry.launch();
        setOpen(false);
        return;
      }
      setInserting(entry);
      insertTimer.current = window.setTimeout(() => {
        entry.launch();
        setOpen(false);
        setInserting(null);
      }, INSERT_MS);
    },
    [inserting],
  );

  // Keyboard navigation while expanded. Capture phase so preventDefault is
  // visible to the scene's window-level space-to-jump listener (which checks
  // e.defaultPrevented before jumping).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (inserting) return;
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIdx((i) => clampIdx(i - 1));
      } else if (e.key === 'ArrowDown') {
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
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, idx, inserting, clampIdx, insert]);

  // Keep the keyboard-focused row in view.
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    const row = list?.children[idx] as HTMLElement | undefined;
    row?.scrollIntoView({ block: 'nearest', behavior: REDUCED_MOTION ? 'auto' : 'smooth' });
  }, [idx, open]);

  // No pointer capture here — capturing on the list would retarget the
  // follow-up click away from the row, killing mouse insertion.
  const onPointerDown = (e: React.PointerEvent): void => {
    if (e.pointerType !== 'mouse' || !listRef.current) return;
    dragStart.current = { y: e.clientY, top: listRef.current.scrollTop };
    dragMoved.current = false;
  };
  const onPointerMove = (e: React.PointerEvent): void => {
    if (!dragStart.current || !listRef.current) return;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dy) > 4) dragMoved.current = true;
    listRef.current.scrollTop = dragStart.current.top - dy;
  };
  const endDrag = (): void => {
    dragStart.current = null;
  };

  return (
    <div className={`protocols-launch${open ? ' is-expanded' : ''}`}>
      {!open && (
        <button
          type="button"
          className="protocols-launch-hit"
          onClick={() => openProtocols()}
          title="open protocols"
          aria-label="open protocols"
          aria-expanded={false}
        />
      )}
      <span className="protocols-launch-glyph" aria-hidden="true">
        ⌬
      </span>
      <span className="protocols-launch-cap" aria-hidden={open}>
        PROTOCOLS
      </span>
      <span className="protocols-launch-banner" aria-hidden="true">
        (Minigames)
      </span>
      {open && (
        <div className="protocols-panel" aria-label="protocols rack">
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: header tap-to-close is pointer sugar; keyboard close routes through esc + the ✕ button */}
          <div className="protocols-head" onClick={() => setOpen(false)} title="close protocols">
            <span className="protocols-title">{'// protocols'}</span>
            <span className="protocols-sub">
              {idx + 1} / {len}
            </span>
            <button
              ref={closeRef}
              type="button"
              className="protocols-close"
              onClick={() => setOpen(false)}
              aria-label="close protocols"
            >
              ✕
            </button>
          </div>
          <div
            className="protolist"
            ref={listRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {PROTOCOLS.map((entry, i) => {
              const cls = [
                'protolist-row',
                `cart-tint--${entry.tint}`,
                i === idx ? 'is-focused' : '',
                entry.available ? '' : 'is-locked',
                inserting?.key === entry.key ? 'is-inserting' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <button
                  key={entry.key}
                  type="button"
                  className={cls}
                  aria-label={`${entry.label} cartridge`}
                  onFocus={() => setIdx(i)}
                  onClick={() => {
                    if (dragMoved.current) return; // drag-scroll release, not a pick
                    setIdx(i);
                    if (entry.available) insert(entry);
                  }}
                >
                  <span className="cart-band protolist-band" aria-hidden="true">
                    <span className="cart-code">{code(entry.label)}</span>
                  </span>
                  <span className="protolist-meta">
                    <span className="protolist-label">{entry.label}</span>
                    <span className="protolist-flavor">{entry.flavor}</span>
                  </span>
                  {!entry.available && <span className="protolist-lock">{'// LOCKED'}</span>}
                </button>
              );
            })}
          </div>
          <div className="protocols-foot">─── ↑/↓ + enter · tap to insert ───</div>
        </div>
      )}
    </div>
  );
}
