import { useCallback, useEffect, useRef, useState } from 'react';

// Landmark overlays (mega-batch 2 · 4.6). The glitch switch: a walk-up
// interactable in the world. When the runner is in range the scene fires
// `bitrunners:glitch-switch-range`; this shows a prompt, and flipping it plays
// a ~2 s full-screen glitch burst (cosmetic) then cools down for 10 s. The
// pressure-plate vault fires `bitrunners:vault-reset` on a wrong step, which we
// answer with a brief flicker. The vault → void teleport itself is handled by
// the scene; no UI needed there beyond the minimap hiding (Starmap.tsx).

const COOLDOWN_MS = 10_000;
const BURST_MS = 2_000;
const FLICKER_MS = 450;

export function Landmarks(): JSX.Element {
  const [inRange, setInRange] = useState(false);
  const [bursting, setBursting] = useState(false);
  const [flicker, setFlicker] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const onRange = (e: Event): void => {
      setInRange((e as CustomEvent<{ inRange?: boolean }>).detail?.inRange ?? false);
    };
    const onReset = (): void => {
      setFlicker(true);
      timers.current.push(window.setTimeout(() => setFlicker(false), FLICKER_MS));
    };
    window.addEventListener('bitrunners:glitch-switch-range', onRange);
    window.addEventListener('bitrunners:vault-reset', onReset);
    return () => {
      window.removeEventListener('bitrunners:glitch-switch-range', onRange);
      window.removeEventListener('bitrunners:vault-reset', onReset);
      for (const t of timers.current) window.clearTimeout(t);
      timers.current = [];
    };
  }, []);

  const flip = useCallback(() => {
    setCooldown((cd) => {
      if (cd) return cd;
      setBursting(true);
      timers.current.push(window.setTimeout(() => setBursting(false), BURST_MS));
      timers.current.push(window.setTimeout(() => setCooldown(false), COOLDOWN_MS));
      return true;
    });
  }, []);

  // Keyboard [E] flips while in range (mirrors the walk-up + tap pattern).
  useEffect(() => {
    if (!inRange) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key.toLowerCase() === 'e') {
        e.preventDefault();
        flip();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inRange, flip]);

  return (
    <>
      {inRange && (
        <div className="glitch-prompt">
          <button type="button" className="glitch-prompt-btn" onClick={flip} disabled={cooldown}>
            {cooldown ? 'switch recharging…' : 'flip glitch switch [ E ]'}
          </button>
        </div>
      )}
      {bursting && <div className="glitch-burst" aria-hidden="true" />}
      {flicker && <div className="glitch-burst glitch-burst--short" aria-hidden="true" />}
    </>
  );
}
