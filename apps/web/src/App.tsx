import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Boot } from './Boot.js';
import { ConstructionGate } from './ConstructionGate.js';
import { TitleScreen } from './TitleScreen.js';
import { BootDissolve } from './transitions/BootDissolve.js';

const Board = lazy(() => import('./Board.js').then((m) => ({ default: m.Board })));
const BoardsLanding = lazy(() =>
  import('./BoardsLanding.js').then((m) => ({ default: m.BoardsLanding })),
);
const AuthCallback = lazy(() =>
  import('./AuthCallback.js').then((m) => ({ default: m.AuthCallback })),
);
// The whole game surface (three.js scene + every in-game panel) is a lazy
// chunk so the title screen paints without paying for it. Prefetched in the
// background as soon as the Shell mounts (perf pass P1, devlog 0139).
const Game = lazy(() => import('./Game.js').then((m) => ({ default: m.Game })));

const BOARD_HASH_PREFIX = '#board/';
const BOARD_HOSTNAME = 'write.bitrunners.app';
const AUTH_VERIFIED_HASH = '#auth/verified';
const AUTH_RECOVERY_HASH = '#auth/recovery';

type RoutedSurface =
  | { kind: 'board'; slug: string }
  | { kind: 'boards-landing' }
  | { kind: 'auth-verified' }
  | { kind: 'auth-recovery' }
  | null;

function readRoute(): RoutedSurface {
  const hash = window.location.hash;
  if (hash.startsWith(BOARD_HASH_PREFIX)) {
    const slug = hash.slice(BOARD_HASH_PREFIX.length).trim();
    return slug.length > 0 ? { kind: 'board', slug } : null;
  }
  // write.bitrunners.app → writer portal. /<slug> opens that board; bare /
  // shows the boards-landing list with an "+ add board" button.
  if (window.location.hostname === BOARD_HOSTNAME) {
    const slug = window.location.pathname.replace(/^\/+/, '').replace(/\/.*$/, '').trim();
    if (slug.length > 0) return { kind: 'board', slug };
    return { kind: 'boards-landing' };
  }
  // Supabase appends its own params after the route — match by prefix.
  if (hash.startsWith(AUTH_VERIFIED_HASH)) return { kind: 'auth-verified' };
  if (hash.startsWith(AUTH_RECOVERY_HASH)) return { kind: 'auth-recovery' };
  return null;
}

type Phase = 'title' | 'boot' | 'transition' | 'game';

export function App(): JSX.Element {
  const [route, setRoute] = useState<RoutedSurface>(() => readRoute());

  useEffect(() => {
    const onHash = (): void => setRoute(readRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  let content: JSX.Element;
  if (route?.kind === 'board') {
    content = (
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
        <Board slug={route.slug} />
      </Suspense>
    );
  } else if (route?.kind === 'boards-landing') {
    content = (
      <Suspense
        fallback={
          <div className="board">
            <header className="board-header">
              <span className="board-title">bitrunners · writer portal</span>
              <span className="board-status">loading…</span>
            </header>
          </div>
        }
      >
        <BoardsLanding />
      </Suspense>
    );
  } else if (route?.kind === 'auth-verified') {
    content = (
      <Suspense fallback={null}>
        <AuthCallback route="verified" />
      </Suspense>
    );
  } else if (route?.kind === 'auth-recovery') {
    content = (
      <Suspense fallback={null}>
        <AuthCallback route="recovery" />
      </Suspense>
    );
  } else {
    content = <Shell />;
  }

  return (
    <>
      <ConstructionGate>{content}</ConstructionGate>
      {/* Global CRT / VHS overlay — scanlines + a slow rolling band over
          EVERY surface (title, boot, game, menus, board). Click-through,
          composited, ~zero cost. Devlog 0135. */}
      <div className="crt-overlay" aria-hidden="true" />
    </>
  );
}

function Shell(): JSX.Element {
  const [phase, setPhase] = useState<Phase>('title');
  const [chosenClass, setChosenClass] = useState<string>('bit_spekter');
  const [reselect, setReselect] = useState(false);

  // Warm the Game chunk (scene + panels + subsystem starts) while the player
  // reads the title screen, so class-select → game has no chunk-fetch stall.
  useEffect(() => {
    void import('./Game.js');
  }, []);

  const onSelect = useCallback((className: string) => {
    setChosenClass(className);
    setPhase('transition');
  }, []);

  const onTransitionDone = useCallback(() => {
    setPhase('game');
  }, []);

  // In-game "change runner" → back to the class-select grid (skip the scroll).
  useEffect(() => {
    const onChange = (): void => {
      setReselect(true);
      setPhase('boot');
    };
    window.addEventListener('bitrunners:change-runner', onChange);
    return () => window.removeEventListener('bitrunners:change-runner', onChange);
  }, []);

  return (
    <>
      {phase === 'title' && <TitleScreen onLink={() => setPhase('boot')} />}
      {phase === 'boot' && <Boot onSelect={onSelect} startAtSelect={reselect} />}
      {phase === 'transition' && (
        <>
          {/* BootDissolve stays outside Suspense so the dissolve covers any
              residual chunk fetch instead of waiting behind it. */}
          <Suspense fallback={null}>
            <Game className={chosenClass} />
          </Suspense>
          <BootDissolve onDone={onTransitionDone} />
        </>
      )}
      {phase === 'game' && (
        <Suspense fallback={null}>
          <Game className={chosenClass} />
        </Suspense>
      )}
    </>
  );
}
