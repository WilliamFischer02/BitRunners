// ASCII pixel-crush dissolve helper (Phase 4).
//
// Replaces the project's fade / translate menu animations with a unified
// dithered-glyph crossfade. Paints an overlay canvas in front of the
// transitioning element; a Bayer-style mask reveals (or hides) the
// element through a field of randomly-cycling block / shade glyphs.
//
// Pure helper module — no React. The React wrapper in ./Dissolve.tsx
// orchestrates mount/unmount around it.
//
// Honors prefers-reduced-motion: in reduced-motion mode the helper
// snaps to the end state with zero animation.

const RAIN_CHARS = '01░▒▓█·:-=+*#%▌▐▀▄';

export type DissolveDir = 'in' | 'out';

export interface DissolveOptions {
  /** Total animation duration in ms. Default 320. */
  durationMs?: number;
  /** Glyph cell size in CSS px. Default 12. */
  cell?: number;
  /** Foreground glyph color. Default the ASCII fg. */
  color?: string;
  /** Backdrop color drawn behind the glyphs. Use null for transparent. */
  background?: string | null;
  /**
   * Element to append the overlay canvas to. Defaults to document.body.
   * Pass the `<dialog>` element itself when the host is a native dialog
   * (top-layer) so the canvas is in the same top-layer stacking context
   * and renders above the dialog's content.
   */
  mountTarget?: HTMLElement;
}

interface ActiveAnimation {
  cancel(): void;
}

function prefersReducedMotion(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  } catch {
    return false;
  }
}

/**
 * Plays a dissolve animation on `host`. Mounts a fixed-position overlay
 * canvas at the host's screen rect, paints the dither field across the
 * duration, then cleans up. Returns an `ActiveAnimation` for cancel.
 *
 * The host element itself is NOT modified — the overlay just sits on
 * top. Callers should set the host's visibility before/after as needed
 * (the React wrapper does this).
 */
export function playDissolve(
  host: HTMLElement,
  dir: DissolveDir,
  opts: DissolveOptions = {},
  onDone?: () => void,
): ActiveAnimation {
  const duration = Math.max(0, opts.durationMs ?? 320);
  if (prefersReducedMotion() || duration === 0) {
    onDone?.();
    return { cancel() {} };
  }

  const cell = Math.max(4, opts.cell ?? 12);
  const color = opts.color ?? '#c0ffd6';
  const bg = opts.background ?? null;

  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '1000';
  (opts.mountTarget ?? document.body).appendChild(canvas);

  const rawCtx = canvas.getContext('2d');
  if (!rawCtx) {
    canvas.remove();
    onDone?.();
    return { cancel() {} };
  }
  const ctx: CanvasRenderingContext2D = rawCtx;

  const rect = host.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  canvas.style.left = `${rect.left}px`;
  canvas.style.top = `${rect.top}px`;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const cols = Math.max(1, Math.ceil(w / cell));
  const rows = Math.max(1, Math.ceil(h / cell));
  // Per-cell threshold in [0, 1]. Cells with smaller thresholds turn
  // opaque earlier in the animation (for 'in') or transparent later
  // (for 'out'). Use a Bayer-like pattern so the wipe reads as ordered.
  const thresholds = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = ((c & 3) + 4 * ((r & 3) ^ (c & 3))) / 24.0 + Math.random() * 0.06 - 0.03;
      thresholds[r * cols + c] = Math.max(0, Math.min(1, v));
    }
  }
  // Per-cell glyph index, re-rolled each frame so the field shimmers.
  const glyphs = new Uint8Array(cols * rows);
  for (let i = 0; i < glyphs.length; i++) {
    glyphs[i] = Math.floor(Math.random() * RAIN_CHARS.length);
  }

  ctx.font = `${cell}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  ctx.textBaseline = 'top';

  let raf = 0;
  let cancelled = false;
  const start = performance.now();

  function tick(now: number): void {
    if (cancelled) return;
    const elapsed = now - start;
    const t = Math.min(1, elapsed / duration);
    const progress = dir === 'in' ? 1 - t : t; // 'in' wipes thresholds DOWN, 'out' wipes UP

    if (bg) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.clearRect(0, 0, w, h);
    }
    ctx.fillStyle = color;

    // Re-roll a fraction of the glyphs each frame for the "static" feel.
    const stride = Math.max(1, Math.floor(glyphs.length / 12));
    for (let i = Math.floor(Math.random() * stride); i < glyphs.length; i += stride) {
      glyphs[i] = Math.floor(Math.random() * RAIN_CHARS.length);
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const th = thresholds[idx] ?? 1;
        // Cell is "covered" when threshold < progress (for out) / >
        // progress (for in).
        const covered = dir === 'out' ? th < progress : th > progress;
        if (!covered) continue;
        const gi = glyphs[idx] ?? 0;
        const ch = RAIN_CHARS[gi] ?? '·';
        ctx.fillText(ch, c * cell, r * cell);
      }
    }

    if (t >= 1) {
      cleanup();
      onDone?.();
      return;
    }
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  function cleanup(): void {
    cancelled = true;
    cancelAnimationFrame(raf);
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }

  return {
    cancel(): void {
      if (cancelled) return;
      cleanup();
      onDone?.();
    },
  };
}
