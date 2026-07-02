import { useCallback, useEffect, useRef, useState } from 'react';
import { LeaderboardList } from './Leaderboard.js';
import { nudgeAccount } from './account-nudge.js';
import { addCredits } from './economy.js';
import { submitMinigameScore } from './leaderboard-api.js';

// freq_lock — "tesseract of audio signals" (mega-batch 2 rewrite).
//
// Three signal lanes converge on the runner from three directions: one from
// the top-right (angling down-left), one from the top-left (down-right), and
// one straight up from center-bottom. A waveform blip travels down each lane
// from its far end toward the lane's hit target, swelling from silent to loud.
// Tap the matching lane the instant the waveform reaches the target for max
// points ( J / K / L, or touch the target ). Reading a swelling waveform takes
// a beat, so the hit window is generous. STOP-AND-ASK on feel.

const LANES = 3;
const LANE_KEYS = ['j', 'k', 'l'];
const LANE_LABELS = ['TR', 'C', 'TL'];

// Lane geometry in stage-percent: `far` = spawn (edge), `hit` = tap target.
// Index order matches the keys J/K/L → the three targets cluster low-center
// (the "user"), beams fanning out to top-right, top-center, top-left.
const LANE_GEO: { far: { x: number; y: number }; hit: { x: number; y: number } }[] = [
  { far: { x: 95, y: 6 }, hit: { x: 68, y: 74 } }, // top-right → down-left
  { far: { x: 50, y: 3 }, hit: { x: 50, y: 86 } }, // top-center → straight down
  { far: { x: 5, y: 6 }, hit: { x: 32, y: 74 } }, // top-left → down-right
];

const WAVE_BARS = 9;

const SONG_MS = 60_000;
const LEAD_IN_MS = 2_600;
const TRAVEL_MS = 2_800;
const HIT_WINDOW_MS = 240;
const PERFECT_WINDOW_MS = 90;
const NOTE_GAP_MIN = 760;
const NOTE_GAP_MAX = 1_450;

const POINTS_PERFECT = 100;
const POINTS_GOOD = 50;
const CREDITS_PER_POINT = 1 / 10;
const CREDITS_CAP = 100;

interface Note {
  id: number;
  lane: number;
  hitTime: number; // ms from song start
  state: 'pending' | 'hit' | 'missed';
  bars: number[]; // per-blip faux-waveform bar heights (0..1)
}

type Phase = 'ready' | 'playing' | 'done';

function randomBars(): number[] {
  // A faux, randomly-generated waveform envelope (symmetric-ish, DAW-blip feel).
  const bars: number[] = [];
  for (let i = 0; i < WAVE_BARS; i++) {
    const centered = 1 - Math.abs(i - (WAVE_BARS - 1) / 2) / ((WAVE_BARS - 1) / 2);
    bars.push(0.25 + centered * 0.55 + Math.random() * 0.35);
  }
  return bars;
}

function buildChart(): Note[] {
  const notes: Note[] = [];
  let t = LEAD_IN_MS;
  let id = 0;
  while (t < SONG_MS - 500) {
    notes.push({
      id: id++,
      lane: Math.floor(Math.random() * LANES),
      hitTime: t,
      state: 'pending',
      bars: randomBars(),
    });
    t += NOTE_GAP_MIN + Math.random() * (NOTE_GAP_MAX - NOTE_GAP_MIN);
  }
  return notes;
}

function lerp(a: number, b: number, p: number): number {
  return a + (b - a) * p;
}

export function FreqLock({ onClose }: { onClose(): void }): JSX.Element {
  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [hits, setHits] = useState(0);
  const [judgement, setJudgement] = useState<string>('');
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
    if (credits > 0) {
      addCredits(credits);
      nudgeAccount('minigame');
    }
    void submitMinigameScore('freq_lock', scoreRef.current);
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
    setJudgement(perfect ? 'locked' : 'good');
  }, []);

  useEffect(() => {
    const arrowMap: Record<string, number> = { arrowright: 0, arrowup: 1, arrowleft: 2 };
    const onKey = (e: KeyboardEvent): void => {
      const k = e.key.toLowerCase();
      if (k === 'escape') {
        onClose();
        return;
      }
      const lane = LANE_KEYS.indexOf(k);
      const arrow = arrowMap[k];
      const target = lane >= 0 ? lane : arrow;
      if (target !== undefined && target >= 0) {
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
              three audio signals converge on you from the corners. a waveform swells as it travels
              each lane —
              <br />
              tap the matching lane ( J K L / arrows / touch ) the instant it reaches the target.
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
            <LeaderboardList game="freq_lock" myValue={score} />
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

        <div className="freqlock-tess" aria-hidden={phase !== 'playing'}>
          {/* faint lane beams from each far-end to its target */}
          {LANE_GEO.map((g, lane) => {
            const dx = g.hit.x - g.far.x;
            const dy = g.hit.y - g.far.y;
            const len = Math.hypot(dx, dy);
            const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
            return (
              <div
                key={`beam-${LANE_KEYS[lane]}`}
                className="freqlock-beamline"
                style={{
                  left: `${g.far.x}%`,
                  top: `${g.far.y}%`,
                  width: `${len}%`,
                  transform: `rotate(${ang}deg)`,
                }}
              />
            );
          })}

          {/* travelling waveform blips */}
          {phase === 'playing' &&
            notesRef.current
              .filter(
                (n) =>
                  n.state === 'pending' &&
                  n.hitTime - songMs <= TRAVEL_MS &&
                  n.hitTime - songMs > -HIT_WINDOW_MS,
              )
              .map((n) => {
                const g = LANE_GEO[n.lane];
                if (!g) return null;
                const p = Math.min(1, Math.max(0, 1 - (n.hitTime - songMs) / TRAVEL_MS));
                const env = p ** 0.7; // silent → loud toward the target
                const x = lerp(g.far.x, g.hit.x, p);
                const y = lerp(g.far.y, g.hit.y, p);
                return (
                  <div
                    key={n.id}
                    className={`freqlock-blip freqlock-blip--${LANE_KEYS[n.lane]}`}
                    style={{ left: `${x}%`, top: `${y}%`, opacity: 0.35 + env * 0.65 }}
                  >
                    {n.bars.map((h, i) => (
                      <span
                        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length bar set, positional
                        key={i}
                        className="freqlock-bar"
                        style={{ height: `${Math.max(8, h * env * 100)}%` }}
                      />
                    ))}
                  </div>
                );
              })}

          {/* hit targets */}
          {LANE_GEO.map((g, lane) => (
            <button
              type="button"
              key={`hit-${LANE_KEYS[lane]}`}
              className={`freqlock-target freqlock-target--${LANE_KEYS[lane]}`}
              style={{ left: `${g.hit.x}%`, top: `${g.hit.y}%` }}
              onPointerDown={(e) => {
                e.preventDefault();
                tapLane(lane);
              }}
              aria-label={`lane ${LANE_LABELS[lane]}`}
            >
              <span className="freqlock-target-key">{LANE_KEYS[lane]?.toUpperCase()}</span>
            </button>
          ))}
        </div>

        <div className="freqlock-judge" data-j={judgement}>
          {phase === 'playing' ? judgement : ''}
        </div>
      </div>
    </div>
  );
}

export default FreqLock;
