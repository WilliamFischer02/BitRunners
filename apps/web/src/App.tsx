import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { AdminConsole } from './AdminConsole.js';
import { AdminDialogue } from './AdminDialogue.js';
import { BadgeToast } from './BadgeToast.js';
import { Boot } from './Boot.js';
import { ConstructionGate } from './ConstructionGate.js';
import { CreditsHud } from './CreditsHud.js';
import { EMOTE_GLYPHS, type EmoteId, EmoteWheel } from './EmoteWheel.js';
import { MissionDialogue } from './MissionDialogue.js';
import { Objectives } from './Objectives.js';
import { ProfileIcon } from './ProfileIcon.js';
import { Protocols } from './Protocols.js';
import { Samm } from './Samm.js';
import { ScrapeMenu, openScrape } from './ScrapeMenu.js';
import { Starmap } from './Starmap.js';
import { Tutorial } from './Tutorial.js';
import { UsernameEditor } from './UsernameEditor.js';
import { startBadgeMonitor } from './badge-notifications.js';
import { startIdentity } from './profile.js';
import { type SceneControls, startScene } from './scene.js';
import { BootDissolve } from './transitions/BootDissolve.js';
import { startVisibilityWatcher } from './visibility.js';

// Boot the identity + badge-notification + visibility subsystems once. Idempotent.
startIdentity();
startBadgeMonitor();
startVisibilityWatcher();

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

  const content = slug ? (
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
  ) : (
    <Shell />
  );

  return <ConstructionGate>{content}</ConstructionGate>;
}

function Shell(): JSX.Element {
  const [phase, setPhase] = useState<Phase>('boot');
  const [chosenClass, setChosenClass] = useState<string>('bit_spekter');
  const [reselect, setReselect] = useState(false);

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
      {phase === 'boot' && <Boot onSelect={onSelect} startAtSelect={reselect} />}
      {phase === 'transition' && (
        <>
          <Game className={chosenClass} />
          <BootDissolve onDone={onTransitionDone} />
        </>
      )}
      {phase === 'game' && <Game className={chosenClass} />}
    </>
  );
}

interface GameProps {
  className: string;
}

interface GrantDetail {
  credits: number;
  tokens: number;
}

function Game({ className }: GameProps): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<SceneControls | null>(null);
  const [adminDialogueOpen, setAdminDialogueOpen] = useState(false);
  const [sammInRange, setSammInRange] = useState(false);
  const [grantToast, setGrantToast] = useState<GrantDetail | null>(null);
  const grantDismissRef = useRef<number | null>(null);

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
    const onSammRange = (e: Event): void => {
      setSammInRange((e as CustomEvent<{ inRange?: boolean }>).detail?.inRange ?? false);
    };
    window.addEventListener('bitrunners:samm-range', onSammRange);
    return () => {
      window.removeEventListener('bitrunners:admin-encounter', onEncounter);
      window.removeEventListener('bitrunners:samm-range', onSammRange);
    };
  }, []);

  useEffect(() => {
    const onGrant = (e: Event): void => {
      const d = (e as CustomEvent<GrantDetail>).detail;
      if (!d || (d.credits <= 0 && d.tokens <= 0)) return;
      setGrantToast(d);
      if (grantDismissRef.current !== null) window.clearTimeout(grantDismissRef.current);
      grantDismissRef.current = window.setTimeout(() => setGrantToast(null), 4500);
    };
    window.addEventListener('bitrunners:grant-received', onGrant);
    return () => window.removeEventListener('bitrunners:grant-received', onGrant);
  }, []);

  const onEmote = useCallback((id: EmoteId) => {
    controlsRef.current?.triggerEmote(EMOTE_GLYPHS[id]);
  }, []);

  return (
    <div ref={hostRef} className="canvas-host">
      <div className="hint">{className} · arrows / wasd / stick</div>
      <CreditsHud />
      <ProfileIcon className={className} />
      <Protocols />
      <ScrapeMenu />
      <Objectives />
      <EmoteWheel onEmote={onEmote} onInventory={() => openScrape('inventory')} />
      <Samm inRange={sammInRange} />
      <Tutorial />
      <Starmap />
      <AdminConsole />
      <UsernameEditor />
      <BadgeToast />
      <MissionDialogue />
      {adminDialogueOpen && <AdminDialogue onClose={() => setAdminDialogueOpen(false)} />}
      {grantToast && (
        <output className="grant-toast">
          {grantToast.credits > 0 && (
            <span className="grant-toast-amount">+{grantToast.credits.toLocaleString()}¢</span>
          )}
          {grantToast.tokens > 0 && (
            <span className="grant-toast-amount">+{grantToast.tokens.toLocaleString()}◈</span>
          )}
          <span className="grant-toast-label">admin grant received</span>
        </output>
      )}
    </div>
  );
}
