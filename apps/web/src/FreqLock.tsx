import { useCallback, useEffect, useRef, useState } from 'react';
import { addCredits } from './economy.js';

// freq_lock — a 4-lane rhythm minigame (mega-batch 4.13).
//
// Glyphs fall down 4 lanes; tap the matching lane key (or the lane itself on
// touch) when a glyph reaches the hit-line. 60-second procedurally-generated
// pattern (no audio file — purely visual + tick timing). Score converts to
// Credits at the end: 1 credit / 10 points, capped at 100 credits/run.
//
// STOP-AND-ASK (devlog 0101): mechanics weren't specified — chose a Guitar-
// Hero-lite scheme (perfect/good windows, combo, miss = combo break). Easy to
// retune via the constants block below.

const LANES = 4;
const LANE_GLYPHS = ['◀', '▼', '▲', '▶'];
// Per-lane keys (lowercased). Arrow keys map to the same lanes as a fallback.
const LANE_KEYS = ['d', 'f', 'j', 'k'];
const ARROW_KEYS = ['arrowleft', 'arrowdown', 'arrowup', 'arrowright'];

const SONG_MS = 60_000;
const LEAD_IN_MS = 2_200; // first note delay
const TRAVEL_MS = 1_500; // time a glyph takes to fall to the hit-line
const HIT_WINDOW_MS = 140; // |Δ| ≤ this = hit
const PERFECT_WINDOW_MS = 60;
const NOTE_GAP_MIN = 460;
const NOTE_GAP_MAX = 860;

const POINTS_PERFECT = 100;
const POINTS_GOOD = 50;
const CREDITS_PER_POINT = 1 / 10;
const CREDITS_CAP = 100;

interface Note {
  id: number;
  lane: number;
  hitTime: number; // ms from song start
  state: 'pending' | 'hit' | 'missed';
}

type Phase = 'ready' | 'playing' | 'done';

function buildChart(): Note[] {
  const notes: Note[] = [];
  let t = LEAD_IN_MS;
  let id = 0;
  while (t < SONG_MS - 500) {
    notes.push({ id: id++, lane: Math.floor(Math.random() * LANES), hitTime: t, state: 'pending' });
    t += NOTE_GAP_MIN + Math.random() * (NOTE_GAP_MAX - NOTE_GAP_MIN);
  }
  return notes;
}

export function FreqLock({ onClose }: { onClose(): void }): JSX.Element {
  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [hits, setHits] = useState(0);
  const [judgement, setJudgement] = useState<string>('');
  // Drives the per-frame re-render while playing.
  const [songMs, setSongMs] = useState(0);

  const notesRef = useRef<Note[]>([]);
  const startRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const scoreRef = useRef(0);
  const hitsRef = useRef(0);
  const comboRef = useRef(0);
  const phaseRef = useRef<Phase>('ready');
  phaseRef.current = phase;

  const finish = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const credits = Math.min(CREDITS_CAP, Math.floor(scoreRef.current * CREDITS_PER_POINT));
    if (credits > 0) addCredits(credits);
    setPhase('done');
  }, []);

  const start = useCallback(() => {
    notesRef.current = buildChart();
    scoreRef.current = 0;
    hitsRef.current = 0;
    comboRef.current = 0;
    setScore(0);
    setHits(0);
    setCombo(0);
    setJudgement('');
    startRef.current = performance.now();
    setPhase('playing');

    const loop = (): void => {
      const now = performance.now() - startRef.current;
      setSongMs(now);
      // Auto-miss notes that fell past the window.
      for (const n of notesRef.current) {
        if (n.state === 'pending' && now - n.hitTime > HIT_WINDOW_MS) {
          n.state = 'missed';
          comboRef.current = 0;
          setCombo(0);
        }
      }
      if (now >= SONG_MS) {
        finish();
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [finish]);

  const tapLane = useCallback((lane: number) => {
    if (phaseRef.current !== 'playing') return;
    const now = performance.now() - startRef.current;
    // Nearest pending note in this lane within the window.
    let best: Note | null = null;
    let bestDelta = HIT_WINDOW_MS + 1;
    for (const n of notesRef.current) {
      if (n.state !== 'pending' || n.lane !== lane) continue;
      const d = Math.abs(now - n.hitTime);
      if (d < bestDelta) {
        bestDelta = d;
        best = n;
      }
    }
    if (!best || bestDelta > HIT_WINDOW_MS) {
      comboRef.current = 0;
      setCombo(0);
      setJudgement('miss');
      return;
    }
    best.state = 'hit';
    const perfect = bestDelta <= PERFECT_WINDOW_MS;
    scoreRef.current += perfect ? POINTS_PERFECT : POINTS_GOOD;
    hitsRef.current += 1;
    comboRef.current += 1;
    setScore(scoreRef.current);
    setHits(hitsRef.current);
    setCombo(comboRef.current);
    setJudgement(perfect ? 'perfect' : 'good');
  }, []);

  // Keyboard input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const k = e.key.toLowerCase();
      if (k === 'escape') {
        onClose();
        return;
      }
      const lane = LANE_KEYS.indexOf(k);
      const alt = ARROW_KEYS.indexOf(k);
      const target = lane >= 0 ? lane : alt;
      if (target >= 0) {
        e.preventDefault();
        tapLane(target);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tapLane, onClose]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const timeLeft = Math.max(0, Math.ceil((SONG_MS - songMs) / 1000));
  const credits = Math.min(CREDITS_CAP, Math.floor(score * CREDITS_PER_POINT));

  return (
    <div className="freqlock-back">
      <div className="freqlock">
        <header className="freqlock-head">
          <span className="freqlock-title">{'// freq_lock'}</span>
          <span className="freqlock-stat">score {score}</span>
          <span className="freqlock-stat">combo {combo}</span>
          <span className="freqlock-stat">{phase === 'playing' ? `${timeLeft}s` : ''}</span>
          <button type="button" className="panel-close" onClick={onClose} aria-label="close">
            ✕
          </button>
        </header>

        {phase === 'ready' && (
          <div className="freqlock-overlay">
            <div className="freqlock-overlay-title">lock the signal</div>
            <div className="freqlock-overlay-sub">
              tap the lane ( D F J K / arrows / touch ) as each glyph hits the line.
              <br />
              60 seconds · 1 credit per 10 points · max {CREDITS_CAP} credits.
            </div>
            <button type="button" className="freqlock-btn" onClick={start}>
              [ start ]
            </button>
          </div>
        )}

        {phase === 'done' && (
          <div className="freqlock-overlay">
            <div className="freqlock-overlay-title">signal locked</div>
            <div className="freqlock-overlay-sub">
              score {score} · {hits} hits
              <br />
              earned <span className="freqlock-credits">{credits}</span> credits
              {credits >= CREDITS_CAP ? ' (max)' : ''}
            </div>
            <div className="freqlock-overlay-row">
              <button type="button" className="freqlock-btn" onClick={start}>
                [ again ]
              </button>
              <button type="button" className="freqlock-btn" onClick={onClose}>
                [ done ]
              </button>
            </div>
          </div>
        )}

        <div className="freqlock-track">
          {Array.from({ length: LANES }, (_, lane) => lane).map((lane) => (
            <button
              type="button"
              key={`lane-${lane}`}
              className="freqlock-lane"
              onPointerDown={(e) => {
                e.preventDefault();
                tapLane(lane);
              }}
              aria-label={`lane ${lane + 1}`}
            >
              {phase === 'playing' &&
                notesRef.current
                  .filter(
                    (n) =>
                      n.lane === lane &&
                      n.state === 'pending' &&
                      n.hitTime - songMs <= TRAVEL_MS &&
                      n.hitTime - songMs > -HIT_WINDOW_MS,
                  )
                  .map((n) => {
                    const pct = (1 - (n.hitTime - songMs) / TRAVEL_MS) * 100;
                    return (
                      <span
                        key={n.id}
                        className="freqlock-note"
                        style={{ top: `${Math.min(100, pct)}%` }}
                      >
                        {LANE_GLYPHS[lane]}
                      </span>
                    );
                  })}
              <span className="freqlock-hit-glyph">{LANE_GLYPHS[lane]}</span>
            </button>
          ))}
          <div className="freqlock-hitline" aria-hidden="true" />
        </div>

        <div className="freqlock-judge" data-j={judgement}>
          {phase === 'playing' ? judgement : ''}
        </div>
      </div>
    </div>
  );
}

export default FreqLock;
