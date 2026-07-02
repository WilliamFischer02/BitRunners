import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LeaderboardList } from './Leaderboard.js';
import { nudgeAccount } from './account-nudge.js';
import {
  type Board,
  CIRCUIT_LEVELS,
  type Edge,
  type Level,
  type PieceKind,
  type PlacedPiece,
  cellAt,
  connectors,
  isSolved,
  kindOf,
  makeBoard,
  pieceForKind,
  setCell,
} from './circuit-core.js';
import {
  addCredits,
  advanceCircuitLevel,
  getCircuitLevel,
  hasClearedCircuit,
  markCircuitCleared,
} from './economy.js';
import { submitMinigameScore } from './leaderboard-api.js';

// circuit_patch — circuit-routing puzzle (mega-batch 2 · 4.4). Route POWER
// (thick amber) and DATA (thin cyan) from their border inlets to the opposite
// outlets at the same time. All board logic lives in circuit-core.ts (pure,
// unit-tested); this shell owns rendering, palette state, and the reward.

const CELL = 60; // px, must feed both the inline layout and the wire CSS
const GAP = 6;
const PAD = 24; // room for the border port stubs
const PULSE_MS = 900; // "circuit live" flourish before the reward screen

const REWARD_FIRST = 100;
const REWARD_REPEAT = 20;
// Leaderboard score = seconds under par (faster solve → higher). Server clamps
// to 300 (see migration 0017).
const CIRCUIT_PAR_S = 300;

const PALETTE_ORDER: readonly PieceKind[] = [
  'power_straight',
  'power_elbow',
  'cross_bridge',
  'data_elbow',
  'data_straight',
];

const KIND_LABEL: Record<PieceKind, string> = {
  power_straight: 'pwr │',
  power_elbow: 'pwr └',
  cross_bridge: 'bridge',
  data_elbow: 'dat └',
  data_straight: 'dat │',
};

const EDGE_NAME = ['n', 'e', 's', 'w'] as const;

const LEVEL_COUNT = CIRCUIT_LEVELS.length;

function clampLevel(i: number): number {
  return Math.min(LEVEL_COUNT - 1, Math.max(0, Math.floor(i)));
}

/** Stopwatch readout: m:ss (e.g. 0:07, 4:59). */
function fmtClock(totalS: number): string {
  const m = Math.floor(totalS / 60);
  const s = totalS % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const REDUCED_MOTION =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

function cellLeft(x: number): number {
  return PAD + x * (CELL + GAP);
}
function cellTop(y: number): number {
  return PAD + y * (CELL + GAP);
}

/** Wire segments for a placed piece (center → each connected edge). */
function Wires({ piece }: { piece: PlacedPiece }): JSX.Element {
  const conns = connectors(piece);
  return (
    <>
      {([0, 1, 2, 3] as Edge[]).map((e) => {
        const ch = conns[e];
        if (!ch) return null;
        return (
          <span
            key={e}
            className={`circ-wire circ-wire--${ch} circ-wire--${EDGE_NAME[e]}`}
            aria-hidden="true"
          />
        );
      })}
      <span className="circ-node" aria-hidden="true" />
    </>
  );
}

export function CircuitPatch({ onClose }: { onClose(): void }): JSX.Element {
  // Resume at the level the runner left off on (persisted via economy).
  const [levelIdx, setLevelIdx] = useState(() => clampLevel(getCircuitLevel()));
  const level = CIRCUIT_LEVELS[levelIdx] as Level;
  const boardW = PAD * 2 + level.w * CELL + (level.w - 1) * GAP;
  const boardH = PAD * 2 + level.h * CELL + (level.h - 1) * GAP;

  const fixedKeys = useMemo(() => new Set(level.fixed.map((f) => `${f.x},${f.y}`)), [level.fixed]);
  const isFixed = useCallback((x: number, y: number) => fixedKeys.has(`${x},${y}`), [fixedKeys]);

  const [board, setBoard] = useState<Board>(() => makeBoard(level));
  const [remaining, setRemaining] = useState<Record<PieceKind, number>>(() => ({
    ...level.inventory,
  }));
  const [selected, setSelected] = useState<PieceKind | null>(null);
  const [phase, setPhase] = useState<'play' | 'live' | 'won'>('play');
  const [reward, setReward] = useState(0);
  const [lbScore, setLbScore] = useState(0);
  const [elapsedS, setElapsedS] = useState(0);

  const pressTimer = useRef<number | null>(null);
  const longFired = useRef(false);
  const liveTimer = useRef<number | null>(null);
  const startRef = useRef(performance.now());

  useEffect(
    () => () => {
      if (pressTimer.current !== null) window.clearTimeout(pressTimer.current);
      if (liveTimer.current !== null) window.clearTimeout(liveTimer.current);
    },
    [],
  );

  // Stopwatch: live m:ss readout while playing; freezes on win, cleaned up on
  // unmount by the effect teardown.
  useEffect(() => {
    if (phase !== 'play') return;
    const id = window.setInterval(() => {
      setElapsedS(Math.floor((performance.now() - startRef.current) / 1000));
    }, 500);
    return () => window.clearInterval(id);
  }, [phase]);

  const win = useCallback(() => {
    const first = !hasClearedCircuit();
    const amount = first ? REWARD_FIRST : REWARD_REPEAT;
    addCredits(amount);
    markCircuitCleared();
    // Persist level progress so the next session resumes further. Only a win
    // on the frontier level advances — replaying an earlier level via
    // [ again ] must not skip the runner ahead.
    if (levelIdx >= getCircuitLevel()) advanceCircuitLevel();
    nudgeAccount('minigame');
    setReward(amount);
    // Leaderboard: seconds under par (faster = higher). Best-effort submit.
    const solveS = (performance.now() - startRef.current) / 1000;
    const score = Math.max(0, Math.round(CIRCUIT_PAR_S - solveS));
    setLbScore(score);
    void submitMinigameScore('circuit_patch', score);
    setPhase('live');
    const reveal = (): void => setPhase('won');
    if (REDUCED_MOTION) reveal();
    else liveTimer.current = window.setTimeout(reveal, PULSE_MS);
  }, [levelIdx]);

  // Apply a board mutation, then run the win check on the result.
  const commit = useCallback(
    (next: Board) => {
      setBoard(next);
      if (isSolved(level, next)) win();
    },
    [level, win],
  );

  const place = useCallback(
    (x: number, y: number) => {
      if (phase !== 'play' || !selected) return;
      if (cellAt(board, x, y) || isFixed(x, y)) return;
      if ((remaining[selected] ?? 0) <= 0) return;
      const left = (remaining[selected] ?? 0) - 1;
      setRemaining((r) => ({ ...r, [selected]: left }));
      if (left <= 0) setSelected(null);
      commit(setCell(board, x, y, pieceForKind(selected)));
    },
    [phase, selected, board, remaining, isFixed, commit],
  );

  const rotate = useCallback(
    (x: number, y: number) => {
      if (phase !== 'play') return;
      const p = cellAt(board, x, y);
      if (!p || isFixed(x, y)) return;
      commit(setCell(board, x, y, { ...p, rot: ((p.rot + 1) % 4) as Edge }));
    },
    [phase, board, isFixed, commit],
  );

  const removeAt = useCallback(
    (x: number, y: number) => {
      if (phase !== 'play') return;
      const p = cellAt(board, x, y);
      if (!p || isFixed(x, y)) return;
      const kind = kindOf(p);
      setRemaining((r) => ({ ...r, [kind]: (r[kind] ?? 0) + 1 }));
      setBoard(setCell(board, x, y, null)); // removal never completes a circuit
    },
    [phase, board, isFixed],
  );

  const onCellPointerDown = (x: number, y: number): void => {
    longFired.current = false;
    if (phase !== 'play' || !cellAt(board, x, y) || isFixed(x, y)) return;
    pressTimer.current = window.setTimeout(() => {
      longFired.current = true;
      removeAt(x, y);
    }, 450);
  };
  const clearPress = (): void => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };
  const onCellClick = (x: number, y: number): void => {
    clearPress();
    if (longFired.current) {
      longFired.current = false;
      return;
    }
    if (cellAt(board, x, y)) rotate(x, y);
    else place(x, y);
  };

  // (Re)start on level `idx`: fresh board (with fixed pieces), fresh palette,
  // and a reset stopwatch. Used by [ again ], [ next level ], and nothing else.
  const loadLevel = useCallback((idx: number) => {
    const nextIdx = clampLevel(idx);
    const nextLevel = CIRCUIT_LEVELS[nextIdx] as Level;
    if (liveTimer.current !== null) window.clearTimeout(liveTimer.current);
    setLevelIdx(nextIdx);
    setBoard(makeBoard(nextLevel));
    setRemaining({ ...nextLevel.inventory });
    setSelected(null);
    setReward(0);
    setElapsedS(0);
    startRef.current = performance.now();
    setPhase('play');
  }, []);

  const restart = useCallback(() => loadLevel(levelIdx), [loadLevel, levelIdx]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="circ-back">
      <div className="circ">
        <header className="circ-head">
          <span className="circ-title">{'// circuit_patch'}</span>
          <span className="circ-sub">
            level {levelIdx + 1} / {LEVEL_COUNT} · route ⚡ power + ⌁ data · {fmtClock(elapsedS)}
          </span>
          <button type="button" className="panel-close" onClick={onClose} aria-label="close">
            ✕
          </button>
        </header>

        <div
          className={`circ-board${phase !== 'play' ? ' is-live' : ''}`}
          style={{ width: boardW, height: boardH }}
        >
          {/* border ports */}
          {level.ports.map((p) => {
            const cx = cellLeft(p.x);
            const cy = cellTop(p.y);
            const style: React.CSSProperties = {};
            if (p.edge === 0) {
              style.left = cx + CELL / 2 - 6;
              style.top = cy - PAD + 4;
            } else if (p.edge === 2) {
              style.left = cx + CELL / 2 - 6;
              style.top = cy + CELL + 2;
            } else if (p.edge === 1) {
              style.left = cx + CELL + 2;
              style.top = cy + CELL / 2 - 6;
            } else {
              style.left = cx - PAD + 4;
              style.top = cy + CELL / 2 - 6;
            }
            return (
              <div
                key={`${p.channel}-${p.role}`}
                className={`circ-port circ-port--${p.channel} circ-port--${p.role}`}
                style={style}
                title={`${p.channel} ${p.role}`}
              >
                {p.role === 'inlet' ? 'in' : 'out'}
              </div>
            );
          })}
          {/* cells */}
          {board.map((row, y) =>
            row.map((piece, x) => {
              const fixed = isFixed(x, y);
              const cls = ['circ-cell', piece ? 'is-filled' : 'is-empty', fixed ? 'is-fixed' : '']
                .filter(Boolean)
                .join(' ');
              return (
                <button
                  type="button"
                  // biome-ignore lint/suspicious/noArrayIndexKey: board grid is fixed-size and positional
                  key={`${x}-${y}`}
                  className={cls}
                  style={{ left: cellLeft(x), top: cellTop(y), width: CELL, height: CELL }}
                  onClick={() => onCellClick(x, y)}
                  onPointerDown={() => onCellPointerDown(x, y)}
                  onPointerUp={clearPress}
                  onPointerLeave={clearPress}
                  onPointerCancel={clearPress}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    removeAt(x, y);
                  }}
                  aria-label={`cell ${x},${y}${piece ? ` — ${kindOf(piece)}` : ' — empty'}`}
                >
                  {piece && <Wires piece={piece} />}
                </button>
              );
            }),
          )}
        </div>

        <div className="circ-palette" aria-label="piece palette">
          {PALETTE_ORDER.map((kind) => {
            const count = remaining[kind] ?? 0;
            const isSel = selected === kind;
            return (
              <button
                type="button"
                key={kind}
                className={`circ-piece${isSel ? ' is-selected' : ''}${count <= 0 ? ' is-empty' : ''}`}
                disabled={count <= 0 || phase !== 'play'}
                onClick={() => setSelected((s) => (s === kind ? null : kind))}
                aria-pressed={isSel}
              >
                <span className="circ-piece-preview">
                  <Wires piece={pieceForKind(kind)} />
                </span>
                <span className="circ-piece-label">{KIND_LABEL[kind]}</span>
                <span className="circ-piece-count">×{count}</span>
              </button>
            );
          })}
        </div>

        <div className="circ-foot">
          ─── tap a piece, tap a cell to place · tap placed to rotate · long-press / right-click to
          remove ───
        </div>

        {phase === 'won' && (
          <div className="circ-overlay">
            <div className="circ-overlay-title">circuit live</div>
            <div className="circ-overlay-sub">
              both flows locked · earned <span className="circ-credits">{reward}</span> credits
              {reward === REWARD_FIRST ? ' (first clear!)' : ''}
            </div>
            <LeaderboardList game="circuit_patch" myValue={lbScore} />
            <div className="circ-overlay-row">
              {levelIdx < LEVEL_COUNT - 1 && (
                <button type="button" className="circ-btn" onClick={() => loadLevel(levelIdx + 1)}>
                  [ next level ]
                </button>
              )}
              <button type="button" className="circ-btn" onClick={restart}>
                [ again ]
              </button>
              <button type="button" className="circ-btn" onClick={onClose}>
                [ done ]
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CircuitPatch;
