import { useEffect, useRef } from 'react';
import { startScene } from './scene.js';

export function App(): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hostRef.current) return;
    return startScene(hostRef.current);
  }, []);
  return (
    <div ref={hostRef} className="canvas-host">
      <div className="hint">bit_spekter · arrows / wasd / stick</div>
    </div>
  );
}
