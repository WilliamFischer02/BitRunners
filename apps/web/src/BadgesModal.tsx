import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BADGES, BADGE_TIERS, type BadgeFaction, tierForSamaritan } from './badges.js';
import {
  decrementUnacknowledged,
  getIdentity,
  refreshIdentity,
  setEquippedBadgeLocal,
  subscribeIdentity,
} from './profile.js';
import { type MyBadge, acknowledgeBadge, equipBadge, fetchMyBadges } from './supabase.js';

// Badges modal — extracted from the old UsernameEditor (PR 79). Opens on
// the 'bitrunners:open-badges' event, fired when the runner taps the
// badge slot of their floating name tag. Lets the runner inspect the
// two badge ladders (Corporate / BitRunner) and equip one for display.

const OPEN_EVENT = 'bitrunners:open-badges';

export function BadgesModal(): JSX.Element | null {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = (): void => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  if (!open) return null;
  return <BadgesPanel onClose={() => setOpen(false)} />;
}

function BadgesPanel({ onClose }: { onClose(): void }): JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [id, setId] = useState(getIdentity());
  const [badges, setBadges] = useState<MyBadge[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => subscribeIdentity(setId), []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = document.activeElement as HTMLElement | null;
    dialog.showModal();
    const onCancel = (e: Event): void => {
      e.preventDefault();
      onCloseRef.current();
    };
    dialog.addEventListener('cancel', onCancel);
    return () => {
      dialog.removeEventListener('cancel', onCancel);
      trigger?.focus();
    };
  }, []);

  useEffect(() => {
    if (!id.signedIn) return;
    void fetchMyBadges().then((b) => setBadges(b ?? []));
  }, [id.signedIn]);

  const onEquip = useCallback(
    async (key: string, badgeKeyForAck: string): Promise<void> => {
      if (busy) return;
      setBusy(true);
      setMsg(null);
      setEquippedBadgeLocal(key);
      const res = await equipBadge(key || null);
      if (res.error) {
        setMsg(`! ${res.error}`);
        await refreshIdentity();
      } else if (badgeKeyForAck) {
        const ack = await acknowledgeBadge(badgeKeyForAck);
        if (!ack.error) {
          decrementUnacknowledged();
          void fetchMyBadges().then((b) => setBadges(b ?? []));
        }
      }
      setBusy(false);
    },
    [busy],
  );

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop close is pointer-only; keyboard close goes through the native cancel event in useEffect
    <dialog
      ref={dialogRef}
      className="panel"
      aria-modal="true"
      aria-labelledby="badges-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header className="panel-header">
        <span className="panel-title" id="badges-dialog-title">
          {'// badges'}
        </span>
        <button type="button" className="panel-close" onClick={onClose}>
          ✕
        </button>
      </header>

      {!id.signedIn ? (
        <section className="panel-section">
          <div className="panel-stub">
            ─── sign in to display earned badges next to your handle.
          </div>
          <div className="panel-row">
            <span className="panel-key">account</span>
            <button
              type="button"
              className="panel-toggle is-on"
              onClick={() => {
                try {
                  window.dispatchEvent(new CustomEvent('bitrunners:open-account'));
                } catch {
                  // non-DOM env — ignore
                }
                onClose();
              }}
            >
              [ sign in ]
            </button>
          </div>
        </section>
      ) : (
        <BadgeStrip
          badges={badges}
          equipped={id.equippedBadge}
          samaritanCorp={id.samaritanCorporate}
          samaritanBr={id.samaritanBitrunner}
          busy={busy}
          msg={msg}
          onEquip={(key, badgeKey) => {
            void onEquip(key, badgeKey);
          }}
        />
      )}

      <footer className="panel-footer">tap any owned tier to display it next to your name</footer>
    </dialog>
  );
}

interface BadgeStripProps {
  badges: MyBadge[] | null;
  equipped: string;
  samaritanCorp: number;
  samaritanBr: number;
  busy: boolean;
  msg: string | null;
  onEquip(key: string, badgeKey: string): void;
}

function BadgeStrip({
  badges,
  equipped,
  samaritanCorp,
  samaritanBr,
  busy,
  msg,
  onEquip,
}: BadgeStripProps): JSX.Element {
  const ownedKeys = useMemo(() => new Set((badges ?? []).map((b) => b.badgeKey)), [badges]);
  const unackKeys = useMemo(
    () => new Set((badges ?? []).filter((b) => !b.acknowledged).map((b) => b.badgeKey)),
    [badges],
  );

  return (
    <section className={`panel-section ${busy ? 'is-busy' : ''}`}>
      <div className="panel-row">
        <span className="panel-key">equipped</span>
        <span className="panel-value">{equipped || '(none)'}</span>
        {equipped && (
          <button
            type="button"
            className="panel-toggle"
            onClick={() => onEquip('', equipped)}
            aria-label="unequip"
          >
            [ x ]
          </button>
        )}
      </div>
      {msg && <div className="panel-stub">─── {msg}</div>}
      <div className="badge-ladders">
        <BadgeLadder
          faction="corp"
          owned={ownedKeys}
          unack={unackKeys}
          equipped={equipped}
          samaritan={samaritanCorp}
          onEquip={onEquip}
        />
        <BadgeLadder
          faction="br"
          owned={ownedKeys}
          unack={unackKeys}
          equipped={equipped}
          samaritan={samaritanBr}
          onEquip={onEquip}
        />
      </div>
    </section>
  );
}

function BadgeLadder({
  faction,
  owned,
  unack,
  equipped,
  samaritan,
  onEquip,
}: {
  faction: BadgeFaction;
  owned: Set<string>;
  unack: Set<string>;
  equipped: string;
  samaritan: number;
  onEquip(key: string, badgeKey: string): void;
}): JSX.Element {
  const currentTier = tierForSamaritan(samaritan);
  const label = faction === 'corp' ? 'corporate' : 'bitrunner';
  return (
    <div className="badge-ladder">
      <div className="badge-ladder-label">
        {label} · +{samaritan}
        {currentTier ? ` · ${currentTier}` : ''}
      </div>
      <div className="badge-ladder-list">
        {BADGE_TIERS.map((tier) => {
          const key = `${faction}:${tier}`;
          const meta = BADGES[key];
          if (!meta) return null;
          const isOwned = owned.has(key);
          const isEquipped = equipped === key;
          const isUnack = unack.has(key);
          const cls = `badge-cell${isOwned ? ' is-owned' : ''}${
            isEquipped ? ' is-equipped' : ''
          }${isUnack ? ' is-new' : ''}`;
          return (
            <button
              key={key}
              type="button"
              className={cls}
              disabled={!isOwned}
              onClick={() => onEquip(key, key)}
              style={isOwned ? { color: meta.tint } : undefined}
              title={`${label} ${tier} (+${meta.tierIndex * 10})`}
              aria-label={`${label} ${tier}${isOwned ? '' : ' (locked)'}${
                isEquipped ? ' (equipped)' : ''
              }`}
            >
              <span className="badge-cell-glyph">{meta.glyph}</span>
              <span className="badge-cell-name">{tier}</span>
              {isUnack && <span className="badge-cell-new">!</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
