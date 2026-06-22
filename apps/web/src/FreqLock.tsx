import { useCallback, useEffect, useRef, useState } from 'react';
import { addCredits } from './economy.js';

// freq_lock — 3-track signal disturbance minigame (devlog 0109 rewrite).
//
// Three "audio tracks" recede toward a vanishing point. Each is normally a
// straight beam of light. Disturbances — bright bumps that deflect the
// beam — spawn at the horizon and travel toward the player. When a
// disturbance enters the hit zone at the bottom, tap the matching lane
// (J / K / L on keyboard, or touch the pad) to lock the signal.
//
// Defaults are tuned for "you can read it from a glance" — wider hit
// window than the prior DDR-style minigame because reading deflection
// takes longer than reading a falling glyph. STOP-AND-ASK on feel.

const LANES = 3;
const LANE_KEYS = ['j', 'k', 'l'];
const LANE_LABELS = ['L', 'C', 'R'];

const SONG_MS = 60_000;
const LEAD_IN_MS = 2_400;
const TRAVEL_MS = 2_600;
const HIT_WINDOW_MS = 220;
const PERFECT_WINDOW_MS = 80;
const NOTE_GAP_MIN = 720;
const NOTE_GAP_MAX = 1_400;

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
      // Auto-miss disturbances that fell past the hit window.
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
    // Nearest pending disturbance in this lane within the window.
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

  // Keyboard input. J / K / L for the three lanes; A / S / D as an alt for
  // left-handed players; arrows still work (left / down / right → L / C / R).
  useEffect(() => {
    const altKeys = ['a', 's', 'd'];
    const arrowMap: Record<string, number> = {
      arrowleft: 0,
      arrowdown: 1,
      arrowright: 2,
    };
    const onKey = (e: KeyboardEvent): void => {
      const k = e.key.toLowerCase();
      if (k === 'escape') {
        onClose();
        return;
      }
      const lane = LANE_KEYS.indexOf(k);
      const alt = altKeys.indexOf(k);
      const arrow = arrowMap[k];
      const target = lane >= 0 ? lane : alt >= 0 ? alt : arrow;
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
              three audio tracks recede into the cloud. when a disturbance bends a track,
              <br />
              tap the matching lane ( J K L / A S D / arrows / touch ) before it passes you.
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

        <div className="freqlock-stage" aria-hidden={phase !== 'playing'}>
          <div className="freqlock-floor">
            {Array.from({ length: LANES }, (_, lane) => lane).map((lane) => (
              <div key={`track-${lane}`} className="freqlock-track">
                <div className="freqlock-beam" aria-hidden="true" />
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
                      // 0 at horizon, 1 at the hit-line.
                      const pos = Math.min(1, 1 - (n.hitTime - songMs) / TRAVEL_MS);
                      return (
                        <div
                          key={n.id}
                          className="freqlock-disturb"
                          style={{ top: `${(pos * 100).toFixed(2)}%` }}
                        />
                      );
                    })}
              </div>
            ))}
          </div>

          <div className="freqlock-hit-row">
            {LANE_KEYS.map((key, lane) => (
              <button
                type="button"
                key={key}
                className="freqlock-hit"
                onPointerDown={(e) => {
                  e.preventDefault();
                  tapLane(lane);
                }}
                aria-label={`tap ${LANE_LABELS[lane]} lane`}
              >
                <span className="freqlock-hit-key">{key.toUpperCase()}</span>
                <span className="freqlock-hit-label">{LANE_LABELS[lane]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="freqlock-judge" data-j={judgement}>
          {phase === 'playing' ? judgement : ''}
        </div>
      </div>
    </div>
  );
}

export default FreqLock;
