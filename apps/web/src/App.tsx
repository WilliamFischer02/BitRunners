import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { AdminDialogue } from './AdminDialogue.js';
import { Boot } from './Boot.js';
import { EMOTE_GLYPHS, type EmoteId, EmoteWheel } from './EmoteWheel.js';
import { ProfileIcon } from './ProfileIcon.js';
import { TransitionRain } from './TransitionRain.js';
import { type SceneControls, startScene } from './scene.js';

const Board = lazy(() => import('./Board.js').then((m) => ({ default: m.Board })));

const BOARD_HASH_PREFIX = '#board/';

function readSlug(): string | null {
  const hash = window.location.hash;
  if (!hash.startsWith(BOARD_HASH_PREFIX)) return null;
  const slug = hash.slice(BOARD_HASH_PREFIX.length).trim();
  return slug.length > 0 ? slug : null;
}

type Phase = 'boot' | 'transition' | 'game';

export function App(): JSX.Element {
  const [slug, setSlug] = useState<string | null>(() => readSlug());

  useEffect(() => {
    const onHash = (): void => setSlug(readSlug());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (slug) {
    return (
      <Suspense
        fallback={
          <div className="board">
            <header className="board-header">
              <span className="board-title">bitrunners · writer board</span>
              <span className="board-status">loading editor…</span>
            </header>
          </div>
        }
      >
        <Board slug={slug} />
      </Suspense>
    );
  }

  return <Shell />;
}

function Shell(): JSX.Element {
  const [phase, setPhase] = useState<Phase>('boot');
  const [chosenClass, setChosenClass] = useState<string>('bit_spekter');

  const onSelect = useCallback((className: string) => {
    setChosenClass(className);
    setPhase('transition');
  }, []);

  const onTransitionDone = useCallback(() => {
    setPhase('game');
  }, []);

  return (
    <>
      {phase === 'boot' && <Boot onSelect={onSelect} />}
      {phase === 'transition' && (
        <>
          <Game className={chosenClass} />
          <TransitionRain onDone={onTransitionDone} />
        </>
      )}
      {phase === 'game' && <Game className={chosenClass} />}
    </>
  );
}

interface GameProps {
  className: string;
}

function Game({ className }: GameProps): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<SceneControls | null>(null);
  const [adminDialogueOpen, setAdminDialogueOpen] = useState(false);

  useEffect(() => {
    if (!hostRef.current) return;
    const controls = startScene(hostRef.current, className);
    controlsRef.current = controls;
    return () => {
      controlsRef.current = null;
      controls.dispose();
    };
  }, [className]);

  useEffect(() => {
    const onEncounter = (): void => setAdminDialogueOpen(true);
    window.addEventListener('bitrunners:admin-encounter', onEncounter);
    return () => window.removeEventListener('bitrunners:admin-encounter', onEncounter);
  }, []);

  const onEmote = useCallback((id: EmoteId) => {
    controlsRef.current?.triggerEmote(EMOTE_GLYPHS[id]);
  }, []);

  return (
    <div ref={hostRef} className="canvas-host">
      <div className="hint">{className} · arrows / wasd / stick</div>
      <ProfileIcon className={className} />
      <EmoteWheel onEmote={onEmote} />
      {adminDialogueOpen && <AdminDialogue onClose={() => setAdminDialogueOpen(false)} />}
    </div>
  );
}
