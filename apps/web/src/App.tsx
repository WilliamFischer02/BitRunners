import { useEffect, useRef, useState } from 'react';
import { Board } from './Board.js';
import { startScene } from './scene.js';

const BOARD_HASH_PREFIX = '#board/';

function readSlug(): string | null {
  const hash = window.location.hash;
  if (!hash.startsWith(BOARD_HASH_PREFIX)) return null;
  const slug = hash.slice(BOARD_HASH_PREFIX.length).trim();
  return slug.length > 0 ? slug : null;
}

export function App(): JSX.Element {
  const [slug, setSlug] = useState<string | null>(() => readSlug());

  useEffect(() => {
    const onHash = (): void => setSlug(readSlug());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (slug) {
    return <Board slug={slug} />;
  }

  return <Game />;
}

function Game(): JSX.Element {
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
