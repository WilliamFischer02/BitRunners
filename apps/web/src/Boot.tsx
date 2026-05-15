import { useEffect, useRef, useState } from 'react';

interface BootProps {
  onSelect(className: string): void;
}

const BOOT_LINES: { text: string; pause: number }[] = [
  { text: '$ init bitrunners.v0.20', pause: 90 },
  { text: '$ probing cloud-env.central ............. ok', pause: 110 },
  { text: '$ negotiating handshake with server-env.space ... ok', pause: 110 },
  { text: '$ scanning network for upstream session id', pause: 200 },
  { text: '!! no user_id detected ............... ', pause: 480 },
  { text: '$ loading class registry [bit_spekter,*]', pause: 180 },
];

const CHAR_DELAY_MS = 7;
const LINE_DELAY_MS = 35;
const CHAR_DELAY_FAST_MS = 1;
const LINE_DELAY_FAST_MS = 12;

interface ClassDef {
  id: string;
  name: string;
  flavor: string;
  available: boolean;
}

const CLASSES: ClassDef[] = [
  {
    id: 'bit_spekter',
    name: 'bit_spekter',
    flavor: 'controlled exploit · no valid wallet',
    available: true,
  },
  {
    id: 'terminal_runner',
    name: 'terminal_runner',
    flavor: 'personified data cluster · self-bootstrapped',
    available: false,
  },
  {
    id: 'server_speaker',
    name: 'server_speaker',
    flavor: 'blessed init · wearable sensitivity',
    available: false,
  },
  {
    id: 'data_miner',
    name: 'data_miner',
    flavor: 'rehab program · passive labor',
    available: false,
  },
  {
    id: 'hash_kicker',
    name: 'hash_kicker',
    flavor: 'thrill-uploaded · the Company body',
    available: false,
  },
  {
    id: 'web_puller',
    name: 'web_puller',
    flavor: 'Admin-blessed · hall monitor',
    available: false,
  },
];

type Stage = 'scroll' | 'select';

export function Boot({ onSelect }: BootProps): JSX.Element {
  const [stage, setStage] = useState<Stage>('scroll');
  const [lines, setLines] = useState<string[]>(['']);
  const [done, setDone] = useState(false);

  const lineIdxRef = useRef(0);
  const charIdxRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heldRef = useRef(false);

  useEffect(() => {
    if (stage !== 'scroll') return;
    const setHeld = (v: boolean) => () => {
      heldRef.current = v;
    };
    const down = setHeld(true);
    const up = setHeld(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('mousedown', down);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchend', up, { passive: true });
    window.addEventListener('touchcancel', up, { passive: true });
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('mousedown', down);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchstart', down);
      window.removeEventListener('touchend', up);
      window.removeEventListener('touchcancel', up);
    };
  }, [stage]);

  useEffect(() => {
    if (stage !== 'scroll') return;

    const tick = (): void => {
      const lineIdx = lineIdxRef.current;
      const charIdx = charIdxRef.current;
      if (lineIdx >= BOOT_LINES.length) {
        setDone(true);
        timerRef.current = setTimeout(() => setStage('select'), 260);
        return;
      }
      const def = BOOT_LINES[lineIdx];
      if (!def) {
        setDone(true);
        timerRef.current = setTimeout(() => setStage('select'), 260);
        return;
      }
      if (charIdx < def.text.length) {
        const head = def.text.slice(0, charIdx + 1);
        setLines((prev) => {
          const copy = prev.slice();
          copy[lineIdx] = head;
          return copy;
        });
        charIdxRef.current = charIdx + 1;
        const delay = heldRef.current ? CHAR_DELAY_FAST_MS : CHAR_DELAY_MS;
        timerRef.current = setTimeout(tick, delay);
        return;
      }
      lineIdxRef.current = lineIdx + 1;
      charIdxRef.current = 0;
      setLines((prev) => [...prev, '']);
      const linePause = heldRef.current ? LINE_DELAY_FAST_MS : def.pause + LINE_DELAY_MS;
      timerRef.current = setTimeout(tick, linePause);
    };

    timerRef.current = setTimeout(tick, 140);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [stage]);

  if (stage === 'scroll') {
    return (
      <div className="boot-screen">
        <div className="boot-grid-bg" aria-hidden="true" />
        <div className="boot-scroll">
          <div className="boot-banner">cloud-env.central · bootstrap</div>
          {lines.map((l, i) => (
            <div key={`l-${i}-${l.length}`} className="boot-line">
              {l}
              {i === lines.length - 1 && !done && <span className="boot-caret">▌</span>}
            </div>
          ))}
          {done && (
            <div className="boot-line boot-line--cue">
              {'>'} select stack <span className="boot-caret">▌</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="boot-screen">
      <div className="boot-grid-bg" aria-hidden="true" />
      <div className="boot-select-pane">
        <div className="boot-banner">class registry · select stack</div>
        <div className="boot-select-prompt">
          {'> '}choose your stack <span className="boot-caret">▌</span>
        </div>
        <div className="boot-grid">
          {CLASSES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={
                c.available ? 'boot-tile boot-tile--active' : 'boot-tile boot-tile--locked'
              }
              disabled={!c.available}
              onClick={() => c.available && onSelect(c.id)}
              title={c.available ? '' : 'not yet developed'}
            >
              <div className="boot-tile-name">{c.name}</div>
              <div className="boot-tile-flavor">{c.flavor}</div>
              <div className="boot-tile-status">{c.available ? '[ available ]' : '[ locked ]'}</div>
            </button>
          ))}
        </div>
        <div className="boot-footnote">
          ─── only bit_spekter loads. other stacks come online in later releases.
        </div>
      </div>
    </div>
  );
}
