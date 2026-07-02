import { useCallback, useEffect, useState } from 'react';
import {
  type EconomyMetric,
  type LeaderRow,
  type LeaderboardGame,
  fetchEconomyLeaderboard,
  fetchMinigameLeaderboard,
} from './leaderboard-api.js';

// Leaderboard UI (mega-batch 2, owner-requested). `LeaderboardList` is the
// inline top-N board shown on a minigame's end screen; `LeaderboardModal` is
// the tabbed board (total passcodes / credits) opened from the data-scrape
// panel. Both read via leaderboard.ts, which no-ops gracefully until the owner
// applies migration 0017 — in that case we show a friendly empty state.

type FetchState = 'loading' | 'ready' | 'empty';

function useRows(fetcher: () => Promise<LeaderRow[] | null>): {
  rows: LeaderRow[];
  state: FetchState;
} {
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [state, setState] = useState<FetchState>('loading');
  // Callers pass a useCallback-memoized fetcher, so this re-runs only when the
  // query (game / metric) actually changes.
  useEffect(() => {
    let live = true;
    setState('loading');
    void fetcher().then((r) => {
      if (!live) return;
      if (r && r.length > 0) {
        setRows(r);
        setState('ready');
      } else {
        setRows([]);
        setState('empty');
      }
    });
    return () => {
      live = false;
    };
  }, [fetcher]);
  return { rows, state };
}

function Rows({
  rows,
  state,
  unit,
}: {
  rows: LeaderRow[];
  state: FetchState;
  unit?: string;
}): JSX.Element {
  if (state === 'loading') return <div className="lb-empty">loading…</div>;
  if (state === 'empty') {
    return (
      <div className="lb-empty">
        no ranked runs yet — sign in and play to claim a spot. (leaderboards go live once the owner
        enables them.)
      </div>
    );
  }
  return (
    <ol className="lb-list">
      {rows.map((r) => (
        <li className="lb-row" key={`${r.rank}-${r.name}`}>
          <span className="lb-rank">{r.rank}</span>
          <span className="lb-name">{r.name}</span>
          <span className="lb-val">
            {r.value.toLocaleString()}
            {unit ? ` ${unit}` : ''}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Inline board for a minigame end screen. */
export function LeaderboardList({
  game,
  myValue,
}: {
  game: LeaderboardGame;
  myValue?: number;
}): JSX.Element {
  const fetcher = useCallback(() => fetchMinigameLeaderboard(game, 10), [game]);
  const { rows, state } = useRows(fetcher);
  return (
    <div className="lb">
      <div className="lb-head">
        <span className="lb-title">{'// leaderboard'}</span>
        {typeof myValue === 'number' && <span className="lb-you">you · {myValue}</span>}
      </div>
      <Rows rows={rows} state={state} />
    </div>
  );
}

const METRICS: { key: EconomyMetric; label: string; unit: string }[] = [
  { key: 'passcodes', label: 'total passcodes', unit: '#' },
  { key: 'credits', label: 'credits', unit: '¢' },
];

/** Tabbed board opened from the data-scrape panel (passcodes / credits). */
export function LeaderboardModal({ onClose }: { onClose(): void }): JSX.Element {
  const [metric, setMetric] = useState<EconomyMetric>('passcodes');
  const unit = METRICS.find((m) => m.key === metric)?.unit;
  const fetcher = useCallback(() => fetchEconomyLeaderboard(metric, 10), [metric]);
  const { rows, state } = useRows(fetcher);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="panel-backdrop" onMouseDown={onClose}>
      <dialog
        open
        className="panel lb-modal"
        aria-modal="true"
        aria-label="leaderboards"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="panel-header">
          <span className="panel-title">{'// leaderboards'}</span>
          <button type="button" className="panel-close" onClick={onClose} aria-label="close">
            close ✕
          </button>
        </header>
        <section className="panel-section">
          <div className="lb-tabs">
            {METRICS.map((m) => (
              <button
                type="button"
                key={m.key}
                className={metric === m.key ? 'lb-tab is-on' : 'lb-tab'}
                onClick={() => setMetric(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <Rows rows={rows} state={state} unit={unit} />
        </section>
        <footer className="panel-footer">press [esc] or click outside to close</footer>
      </dialog>
    </div>
  );
}
