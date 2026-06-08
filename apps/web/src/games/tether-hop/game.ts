// Tether Hop — pure game logic (Phase 3).
//
// Canon: docs/lore/017-tether-hop-and-chatter.md. Three "data channel"
// bands run from the horizon toward the player's viewport. Waveform
// disturbances scroll down each band at a tempo that gradually
// increases over the course of a run. The player taps the lane when
// a waveform crosses the strike line at the bottom of the play area.
//
// V1 uses a 2D canvas — three lanes are drawn as perspective-faked
// trapezoidal strips with the waveforms as bright pulses moving from
// the far edge to the strike line. The ASCII filter that wraps the
// rest of the game is NOT applied here — the game lives in its own
// modal panel; Phase 4 will share the dissolve engine with the rest of
// the menus but the game's own canvas stays 2D for legibility.
//
// Module is render-agnostic. `runTetherHop(canvas, onEnd)` mounts on
// the supplied canvas, drives RAF, and calls `onEnd(captured)` when
// the run ends (or `cancel()` is invoked).

export interface TetherHopHandle {
  cancel(): void;
}

interface Wave {
  /** Channel index 0..LANES-1. */
  lane: number;
  /** 0 = at the horizon; 1 = crossing the strike line. */
  t: number;
  /** Speed in t-units per second. */
  speed: number;
  /** True once the player has tapped it (captured or missed timing). */
  resolved: boolean;
}

const LANES = 3;
const STRIKE_T = 0.92;
/** Tap window expressed in t-units; ±this around STRIKE_T is a hit. */
const STRIKE_WINDOW = 0.06;

// Tempo curve: base spawn interval (ms) ramps DOWN to a floor as the run
// progresses. Speed ramps UP slightly. The product of (1 / interval) *
// speed is the on-screen wave density; both ramps stay tame so the
// player isn't overwhelmed in the first 30 s.
const RUN_DURATION_MS = 60_000;
const BASE_SPAWN_MS = 1500;
const FLOOR_SPAWN_MS = 480;
const BASE_SPEED = 0.5;
const PEAK_SPEED = 1.05;

interface RunState {
  startedAt: number;
  endsAt: number;
  waves: Wave[];
  captured: number;
  missed: number;
  nextSpawnAt: number;
  /** RAF id; -1 once the run ends. */
  rafId: number;
  /** True after the END animation has played; prevents double-callbacks. */
  ended: boolean;
}

function spawnInterval(elapsed: number): number {
  const k = Math.min(1, elapsed / RUN_DURATION_MS);
  return BASE_SPAWN_MS + (FLOOR_SPAWN_MS - BASE_SPAWN_MS) * k;
}

function speedAt(elapsed: number): number {
  const k = Math.min(1, elapsed / RUN_DURATION_MS);
  return BASE_SPEED + (PEAK_SPEED - BASE_SPEED) * k;
}

/** Convert lane index to a horizontal screen x at the bottom edge. */
function laneStrikeX(lane: number, width: number): number {
  const slot = width / (LANES + 1);
  return slot * (lane + 1);
}

/** Lane vanishing-point x (all lanes converge to a single horizon point
 *  visually centered horizontally and pushed near the top of the canvas). */
function vanishX(width: number): number {
  return width / 2;
}
function vanishY(height: number): number {
  return height * 0.18;
}

/** Convert (lane, t) into screen-space (x, y) using perspective fake. */
function project(lane: number, t: number, w: number, h: number): { x: number; y: number } {
  const vx = vanishX(w);
  const vy = vanishY(h);
  const baseX = laneStrikeX(lane, w);
  const baseY = h - 24;
  // Eased t — pull the marker toward the strike line for the latter half
  // so the waveform "snaps" into legibility for the strike.
  const tt = Math.min(1, Math.max(0, t));
  return {
    x: vx + (baseX - vx) * tt,
    y: vy + (baseY - vy) * tt,
  };
}

interface Theme {
  bg: string;
  fg: string;
  hit: string;
  miss: string;
  /** Lane colors keyed by index. */
  laneColors: string[];
}

const THEME: Theme = {
  bg: '#070a08',
  fg: '#c0ffd6',
  hit: '#6cf0ff',
  miss: '#ff7060',
  laneColors: ['#b07cff', '#93e0b1', '#ff9450'],
};

interface RunResult {
  captured: number;
  missed: number;
  durationMs: number;
}

export function runTetherHop(
  canvas: HTMLCanvasElement,
  onEnd: (result: RunResult) => void,
  options: { onTick?(captured: number, missed: number, t: number): void } = {},
): TetherHopHandle {
  const rawCtx = canvas.getContext('2d');
  if (!rawCtx) {
    onEnd({ captured: 0, missed: 0, durationMs: 0 });
    return { cancel: () => {} };
  }
  // After the early return TS still narrows rawCtx in closures back to the
  // wider null-able type; alias to a const that's typed non-null.
  const ctx: CanvasRenderingContext2D = rawCtx;

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const sizeCanvas = (): { w: number; h: number } => {
    const w = canvas.clientWidth || 320;
    const h = canvas.clientHeight || 240;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    return { w, h };
  };
  let { w, h } = sizeCanvas();
  const ro = new ResizeObserver(() => {
    ({ w, h } = sizeCanvas());
  });
  ro.observe(canvas);

  const start = performance.now();
  const run: RunState = {
    startedAt: start,
    endsAt: start + RUN_DURATION_MS,
    waves: [],
    captured: 0,
    missed: 0,
    nextSpawnAt: start + 400, // brief lead-in
    rafId: -1,
    ended: false,
  };

  function spawn(): void {
    const lane = Math.floor(Math.random() * LANES);
    run.waves.push({
      lane,
      t: 0,
      speed: speedAt(performance.now() - run.startedAt),
      resolved: false,
    });
  }

  function onTap(ev: PointerEvent): void {
    ev.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    // Map x to a lane bucket by closest lane-strike-x.
    let bestLane = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < LANES; i++) {
      const d = Math.abs(x - laneStrikeX(i, w));
      if (d < bestDist) {
        bestDist = d;
        bestLane = i;
      }
    }
    // Find an unresolved wave on that lane closest to the strike line.
    let bestWave: Wave | null = null;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (const wave of run.waves) {
      if (wave.lane !== bestLane || wave.resolved) continue;
      const dt = Math.abs(wave.t - STRIKE_T);
      if (dt < bestDelta) {
        bestDelta = dt;
        bestWave = wave;
      }
    }
    if (bestWave && bestDelta <= STRIKE_WINDOW) {
      bestWave.resolved = true;
      run.captured += 1;
    } else {
      run.missed += 1;
    }
  }

  canvas.addEventListener('pointerdown', onTap);

  function paint(now: number): void {
    const elapsed = now - run.startedAt;
    const dt = 1 / 60; // small constant; we throttle motion by speedAt.

    // Spawn loop.
    while (now >= run.nextSpawnAt && now < run.endsAt) {
      spawn();
      run.nextSpawnAt += spawnInterval(elapsed);
    }

    // Advance waves; resolve missed (off-screen) ones.
    for (const wave of run.waves) {
      if (!wave.resolved) {
        wave.t += wave.speed * dt;
        if (wave.t > 1.0 + STRIKE_WINDOW) {
          wave.resolved = true;
          run.missed += 1;
        }
      }
    }
    // Prune resolved waves that have walked past the bottom.
    if (run.waves.length > 64) {
      // pool guard — never expected in normal play
      run.waves = run.waves.filter((wave) => !(wave.resolved && wave.t > 1.1));
    }

    // ── render ──
    ctx.fillStyle = THEME.bg;
    ctx.fillRect(0, 0, w, h);

    // Lanes as receding lines from horizon to strike-x at bottom.
    ctx.lineWidth = 1.5;
    const vx = vanishX(w);
    const vy = vanishY(h);
    for (let i = 0; i < LANES; i++) {
      const baseX = laneStrikeX(i, w);
      const baseY = h - 16;
      const grad = ctx.createLinearGradient(vx, vy, baseX, baseY);
      grad.addColorStop(0, 'rgba(132, 216, 164, 0.05)');
      grad.addColorStop(1, THEME.laneColors[i] ?? THEME.fg);
      ctx.strokeStyle = grad;
      ctx.beginPath();
      ctx.moveTo(vx, vy);
      ctx.lineTo(baseX, baseY);
      ctx.stroke();
    }

    // Strike line + lane "pads" at the bottom.
    ctx.strokeStyle = 'rgba(192, 255, 214, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const strikeY = h - 24;
    ctx.moveTo(0, strikeY);
    ctx.lineTo(w, strikeY);
    ctx.stroke();

    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < LANES; i++) {
      const cx = laneStrikeX(i, w);
      const pad = h - 12;
      ctx.fillStyle = THEME.laneColors[i] ?? THEME.fg;
      ctx.globalAlpha = 0.45;
      ctx.fillRect(cx - 32, pad - 8, 64, 16);
      ctx.globalAlpha = 1;
      ctx.fillStyle = THEME.fg;
      ctx.fillText(`ch-${i + 1}`, cx, pad);
    }

    // Waves.
    for (const wave of run.waves) {
      if (wave.resolved && wave.t > 1.1) continue;
      const { x, y } = project(wave.lane, wave.t, w, h);
      const tint = THEME.laneColors[wave.lane] ?? THEME.fg;
      const scale = 0.4 + 0.6 * wave.t;
      ctx.strokeStyle = wave.resolved ? 'rgba(192, 255, 214, 0.25)' : tint;
      ctx.lineWidth = 1.5 * scale;
      // Sine-wave pulse symbol — a small wiggle drawn around (x, y).
      ctx.beginPath();
      const samples = 12;
      const widthPx = 26 * scale;
      for (let s = 0; s <= samples; s++) {
        const u = s / samples;
        const px = x - widthPx / 2 + widthPx * u;
        const py = y + Math.sin(u * Math.PI * 2 + elapsed * 0.006) * 6 * scale;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // HUD: time bar + counts
    const tNorm = Math.min(1, elapsed / RUN_DURATION_MS);
    ctx.fillStyle = 'rgba(192, 255, 214, 0.18)';
    ctx.fillRect(8, 8, w - 16, 3);
    ctx.fillStyle = THEME.fg;
    ctx.fillRect(8, 8, (w - 16) * tNorm, 3);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = THEME.hit;
    ctx.fillText(`captured · ${run.captured}`, 8, 18);
    ctx.textAlign = 'right';
    ctx.fillStyle = THEME.miss;
    ctx.fillText(`missed · ${run.missed}`, w - 8, 18);

    options.onTick?.(run.captured, run.missed, tNorm);

    if (now >= run.endsAt) {
      if (!run.ended) {
        run.ended = true;
        cleanup();
        onEnd({
          captured: run.captured,
          missed: run.missed,
          durationMs: now - run.startedAt,
        });
      }
      return;
    }
    run.rafId = requestAnimationFrame(paint);
  }
  run.rafId = requestAnimationFrame(paint);

  function cleanup(): void {
    if (run.rafId !== -1) cancelAnimationFrame(run.rafId);
    run.rafId = -1;
    canvas.removeEventListener('pointerdown', onTap);
    ro.disconnect();
  }

  return {
    cancel(): void {
      if (!run.ended) {
        run.ended = true;
        cleanup();
        onEnd({
          captured: run.captured,
          missed: run.missed,
          durationMs: performance.now() - run.startedAt,
        });
      }
    },
  };
}
