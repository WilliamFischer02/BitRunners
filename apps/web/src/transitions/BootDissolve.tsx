import { useEffect } from 'react';
import { playDissolve } from './dissolve.js';

// Boot → Game transition. Plays a single ASCII dissolve across the
// entire viewport for ~500 ms, then calls onDone so the parent can
// flip its phase state. Replaces TransitionRain at this seam. The
// rain effect itself is still exported as a stand-alone visual.

interface BootDissolveProps {
  onDone(): void;
  durationMs?: number;
}

export function BootDissolve({ onDone, durationMs = 520 }: BootDissolveProps): JSX.Element {
  useEffect(() => {
    const host = document.body;
    const anim = playDissolve(
      host,
      'out',
      { durationMs, cell: 12, color: '#c0ffd6', background: 'rgba(6, 10, 8, 0.92)' },
      onDone,
    );
    return () => anim.cancel();
  }, [onDone, durationMs]);
  return <></>;
}
