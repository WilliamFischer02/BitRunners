import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { AccountNudge } from './AccountNudge.js';
import { AdminDialogue } from './AdminDialogue.js';
import { BadgeToast } from './BadgeToast.js';
import { BadgesModal } from './BadgesModal.js';
import { CreditsHud } from './CreditsHud.js';
import { EmoteWheel } from './EmoteWheel.js';
import { GreedGlow } from './GreedGlow.js';
import { Landmarks } from './Landmarks.js';
import { MissionDialogue } from './MissionDialogue.js';
import { Objectives } from './Objectives.js';
import { ProfileIcon } from './ProfileIcon.js';
import { Protocols } from './Protocols.js';
import { Samm } from './Samm.js';
import { ScrapeMenu } from './ScrapeMenu.js';
import { ShopInventoryModal, openShopInventory } from './ShopInventoryModal.js';
import { Starmap } from './Starmap.js';
import { TetherChat } from './TetherChat.js';
import { TransmissionFace } from './TransmissionFace.js';
import { Tutorial } from './Tutorial.js';
import { UsernameEditor } from './UsernameEditor.js';
import { startAccountNudge } from './account-nudge.js';
import { startBadgeMonitor } from './badge-notifications.js';
import { startLevel } from './level.js';
import { startMissionServerLoad } from './mission-server-load.js';
import { startMissionSync } from './mission-sync.js';
import { startIdentity } from './profile.js';
import {
  CIRCUIT_PATCH_OPEN_EVENT,
  CORE_RUN_OPEN_EVENT,
  FREQ_LOCK_OPEN_EVENT,
} from './protocols-registry.js';
import { type SceneControls, startScene } from './scene.js';
import { startSignupGrant } from './signup-grant.js';
import { getMyRole, subscribeAuth } from './supabase.js';
import { startVisibilityWatcher } from './visibility.js';

// Boot the identity + badge-notification + visibility + signup-grant +
// mission-sync subsystems once. Each is idempotent. These run when the Game
// chunk loads (prefetched from the title screen) — the writer-portal and auth
// routes never pay for them (perf pass P1, devlog 0139).
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

// freq_lock rhythm minigame — lazy chunk, loaded on first launch (4.13).
const FreqLock = lazy(() => import('./FreqLock.js'));
// circuit_patch routing minigame — lazy chunk (mega-batch 2 · 4.4).
const CircuitPatch = lazy(() => import('./CircuitPatch.js'));
// core_run shrinking-maze minigame overlay — lazy chunk (mega-batch 2 · 4.5).
const CoreRun = lazy(() => import('./CoreRun.js'));
// Admin console — heavy panel (dialogue editor, user table, grants). Only
// admins ever see it, so non-admins never download the chunk (perf pass P1).
const AdminConsole = lazy(() =>
  import('./AdminConsole.js').then((m) => ({ default: m.AdminConsole })),
);

/** Mounts AdminConsole only after auth confirms an admin role, so the chunk
 *  is never fetched for regular players. Server-side RLS is the real gate. */
function AdminGate(): JSX.Element | null {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    // Role only changes with the user — skip refetch on same-uid auth events
    // (token refresh / focus re-auth).
    let lastUid: string | null | undefined;
    return subscribeAuth((snap) => {
      const uid = snap.user?.id ?? null;
      if (uid === lastUid) return;
      lastUid = uid;
      void getMyRole().then((r) => setIsAdmin(r === 'admin'));
    });
  }, []);
  if (!isAdmin) return null;
  return (
    <Suspense fallback={null}>
      <AdminConsole />
    </Suspense>
  );
}

interface GameProps {
  className: string;
}

interface GrantDetail {
  credits: number;
  tokens: number;
}

export function Game({ className }: GameProps): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<SceneControls | null>(null);
  const [adminDialogueOpen, setAdminDialogueOpen] = useState(false);
  const [sammInRange, setSammInRange] = useState(false);
  const [grantToast, setGrantToast] = useState<GrantDetail | null>(null);
  const [freqLockOpen, setFreqLockOpen] = useState(false);
  const [circuitOpen, setCircuitOpen] = useState(false);
  const [coreRunOpen, setCoreRunOpen] = useState(false);
  const grantDismissRef = useRef<number | null>(null);

  useEffect(() => {
    const onOpen = (): void => setFreqLockOpen(true);
    window.addEventListener(FREQ_LOCK_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(FREQ_LOCK_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    const onOpen = (): void => setCircuitOpen(true);
    window.addEventListener(CIRCUIT_PATCH_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(CIRCUIT_PATCH_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    const onOpen = (): void => setCoreRunOpen(true);
    window.addEventListener(CORE_RUN_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(CORE_RUN_OPEN_EVENT, onOpen);
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
      {circuitOpen && (
        <Suspense fallback={null}>
          <CircuitPatch onClose={() => setCircuitOpen(false)} />
        </Suspense>
      )}
      {coreRunOpen && (
        <Suspense fallback={null}>
          <CoreRun onClose={() => setCoreRunOpen(false)} />
        </Suspense>
      )}
      <Samm inRange={sammInRange} />
      <AccountNudge />
      <GreedGlow />
      <Landmarks />
      <Tutorial />
      <Starmap />
      <AdminGate />
      <UsernameEditor />
      <BadgesModal />
      <TetherChat />
      <BadgeToast />
      <MissionDialogue />
      {adminDialogueOpen && <TransmissionFace />}
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
