import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { AccountNudge } from './AccountNudge.js';
import { AdminConsole } from './AdminConsole.js';
import { AdminDialogue } from './AdminDialogue.js';
import { AuthCallback } from './AuthCallback.js';
import { BadgeToast } from './BadgeToast.js';
import { BadgesModal } from './BadgesModal.js';
import { Boot } from './Boot.js';
import { ConstructionGate } from './ConstructionGate.js';
import { CreditsHud } from './CreditsHud.js';
import { EmoteWheel } from './EmoteWheel.js';
import { MissionDialogue } from './MissionDialogue.js';
import { Objectives } from './Objectives.js';
import { ProfileIcon } from './ProfileIcon.js';
import { Protocols } from './Protocols.js';
import { Samm } from './Samm.js';
import { ScrapeMenu } from './ScrapeMenu.js';
import { ShopInventoryModal, openShopInventory } from './ShopInventoryModal.js';
import { Starmap } from './Starmap.js';
import { TetherChat } from './TetherChat.js';
import { Tutorial } from './Tutorial.js';
import { UsernameEditor } from './UsernameEditor.js';
import { startAccountNudge } from './account-nudge.js';
import { startBadgeMonitor } from './badge-notifications.js';
import { startLevel } from './level.js';
import { startMissionServerLoad } from './mission-server-load.js';
import { startMissionSync } from './mission-sync.js';
import { startIdentity } from './profile.js';
import { FREQ_LOCK_OPEN_EVENT } from './protocols-registry.js';
import { type SceneControls, startScene } from './scene.js';
import { startSignupGrant } from './signup-grant.js';
import { BootDissolve } from './transitions/BootDissolve.js';
import { startVisibilityWatcher } from './visibility.js';

// Boot the identity + badge-notification + visibility + signup-grant +
// mission-sync subsystems once. Each is idempotent.
startIdentity();
startBadgeMonitor();
startVisibilityWatcher();
startSignupGrant();
startLevel();
// Account-needed nudge: watches auth so nudgeAccount() knows guest vs signed-in
// and wires the badge-earned trigger. Idempotent.
startAccountNudge();
startMissionSync();
// Reads server-side mission progress on sign-in and rebuilds local state
// from it (server is the source of truth — must start after mission-sync so
// the local write path is already listening).
startMissionServerLoad();

const Board = lazy(() => import('./Board.js').then((m) => ({ default: m.Board })));
const BoardsLanding = lazy(() =>
  import('./BoardsLanding.js').then((m) => ({ default: m.BoardsLanding })),
);
// freq_lock rhythm minigame — lazy chunk, loaded on first launch (4.13).
const FreqLock = lazy(() => import('./FreqLock.js'));

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

type Phase = 'boot' | 'transition' | 'game';

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
    content = <AuthCallback route="verified" />;
  } else if (route?.kind === 'auth-recovery') {
    content = <AuthCallback route="recovery" />;
  } else {
    content = <Shell />;
  }

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
  const [freqLockOpen, setFreqLockOpen] = useState(false);
  const grantDismissRef = useRef<number | null>(null);

  useEffect(() => {
    const onOpen = (): void => setFreqLockOpen(true);
    window.addEventListener(FREQ_LOCK_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(FREQ_LOCK_OPEN_EVENT, onOpen);
  }, []);

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

  const onEmote = useCallback((glyph: string) => {
    controlsRef.current?.triggerEmote(glyph);
  }, []);

  return (
    <div ref={hostRef} className="canvas-host">
      <div className="hint">{className} · arrows / wasd / stick</div>
      <CreditsHud />
      <ProfileIcon className={className} />
      <Protocols />
      <ScrapeMenu />
      <ShopInventoryModal />
      <Objectives />
      <EmoteWheel onEmote={onEmote} onInventory={() => openShopInventory('inventory')} />
      {freqLockOpen && (
        <Suspense fallback={null}>
          <FreqLock onClose={() => setFreqLockOpen(false)} />
        </Suspense>
      )}
      <Samm inRange={sammInRange} />
      <AccountNudge />
      <Tutorial />
      <Starmap />
      <AdminConsole />
      <UsernameEditor />
      <BadgesModal />
      <TetherChat />
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
