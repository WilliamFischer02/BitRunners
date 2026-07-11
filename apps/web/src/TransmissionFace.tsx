import { useEffect, useRef } from 'react';
import {
  FACE_FRAMES,
  FACE_FRAME_MS,
  FACE_GLITCH_MS,
  FACE_ROVE,
  glitchFrame,
} from './transmission-face.js';

// Fixed overlay card showing The Admin's dissolving ASCII face while the
// admin dialogue is mounted. Fully imperative: frames are swapped by writing
// `textContent` on a <pre> ref — zero React re-renders per frame (perf house
// rule: no per-frame state). Decoupled from AdminDialogue via the
// `bitrunners:admin-typing` CustomEvent ({ detail: { typing: boolean } }).
export function TransmissionFace(): JSX.Element {
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const pre = preRef.current;
    if (!pre) return;

    const staticOnly =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    pre.textContent = FACE_FRAMES[0] ?? '';
    if (staticOnly) return; // reduced-motion: calm F0, always

    let timer: number | null = null;
    let roveIdx = 0;
    let lastGlitch = 0;

    const stop = (): void => {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
      pre.textContent = FACE_FRAMES[0] ?? ''; // settle to rest
    };

    const start = (): void => {
      if (timer !== null) return;
      roveIdx = 0;
      lastGlitch = performance.now();
      timer = window.setInterval(() => {
        roveIdx = (roveIdx + 1) % FACE_ROVE.length;
        let frame = FACE_FRAMES[FACE_ROVE[roveIdx] ?? 0] ?? '';
        const now = performance.now();
        if (now - lastGlitch >= FACE_GLITCH_MS) {
          lastGlitch = now;
          frame = glitchFrame(frame, (Math.random() * 24) | 0, 2 + ((Math.random() * 4) | 0));
        }
        pre.textContent = frame;
      }, FACE_FRAME_MS);
    };

    const onTyping = (e: Event): void => {
      const typing = Boolean((e as CustomEvent<{ typing: boolean }>).detail?.typing);
      if (typing) start();
      else stop();
    };

    window.addEventListener('bitrunners:admin-typing', onTyping);
    return () => {
      window.removeEventListener('bitrunners:admin-typing', onTyping);
      if (timer !== null) window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="transmission-face" aria-hidden="true">
      <div className="transmission-face-head">{'// transmission'}</div>
      <pre className="transmission-face-pre" ref={preRef} />
    </div>
  );
}
