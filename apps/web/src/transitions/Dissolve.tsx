import { useEffect, useRef } from 'react';
import { type DissolveOptions, playDissolve } from './dissolve.js';

interface DissolveProps {
  /** Whether the wrapped content should be visible. */
  in: boolean;
  /** Called when the *out* animation finishes (mount/unmount window). */
  onExited?(): void;
  /** Forwarded to playDissolve. */
  options?: DissolveOptions;
  children: React.ReactNode;
}

/**
 * Wrapper that orchestrates the ASCII pixel-crush dissolve around a
 * React subtree. The first mount plays an "in" dissolve; flipping
 * `in` from true→false plays an "out" dissolve and calls `onExited`
 * when it finishes (the caller can then unmount).
 *
 * The wrapped element is always present in the DOM while a dissolve is
 * playing — the parent controls actual mount/unmount via `onExited`.
 */
export function Dissolve({ in: isIn, onExited, options, children }: DissolveProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const playedOnce = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (isIn) {
      // Don't replay the "in" dissolve if we already played one.
      if (playedOnce.current) return;
      playedOnce.current = true;
      const anim = playDissolve(el, 'in', options);
      return () => anim.cancel();
    }
    // Out dissolve.
    const anim = playDissolve(el, 'out', options, () => onExited?.());
    return () => anim.cancel();
  }, [isIn, onExited, options]);

  return (
    <div ref={ref} className="dissolve-wrapper">
      {children}
    </div>
  );
}
