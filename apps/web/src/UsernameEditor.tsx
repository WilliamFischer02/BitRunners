import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BADGES, BADGE_TIERS, type BadgeFaction, tierForSamaritan } from './badges.js';
import {
  decrementUnacknowledged,
  getIdentity,
  refreshIdentity,
  setEquippedBadgeLocal,
  subscribeIdentity,
} from './profile.js';
import {
  type DictionaryWord,
  type MyBadge,
  acknowledgeBadge,
  equipBadge,
  fetchDictionary,
  fetchMyBadges,
  isAuthConfigured,
  submitDisplayName,
} from './supabase.js';
import { openWithDissolve } from './transitions/dialog-dissolve.js';

// Opens when the user taps the floating name above their character.
// Mounted inside App next to the Tutorial/AdminConsole overlays. Driven by
// the 'bitrunners:edit-identity' event the scene dispatches on tap.
//
// Guest gating: when the user is not signed in, the panel renders the
// "make account to change username and display badges" prompt + a sign-up
// button. The composer + BadgeStrip render greyed-out behind it.

const EDIT_EVENT = 'bitrunners:edit-identity';

export function UsernameEditor(): JSX.Element | null {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = (): void => setOpen(true);
    window.addEventListener(EDIT_EVENT, onOpen);
    return () => window.removeEventListener(EDIT_EVENT, onOpen);
  }, []);

  if (!open) return null;
  return <EditorPanel onClose={() => setOpen(false)} />;
}

function EditorPanel({ onClose }: { onClose(): void }): JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Identity / badges state.
  const [id, setId] = useState(getIdentity());
  const [badges, setBadges] = useState<MyBadge[] | null>(null);
  const [dict, setDict] = useState<DictionaryWord[] | null>(null);
  const [wordA, setWordA] = useState('');
  const [wordB, setWordB] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Subscribe to identity changes so equip flips re-render instantly.
  useEffect(() => subscribeIdentity(setId), []);

  // Modal lifecycle (showModal + ESC + restore focus on close).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = document.activeElement as HTMLElement | null;
    openWithDissolve(dialog);
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

  // Initial data fetches (only when signed in).
  useEffect(() => {
    if (!id.signedIn) return;
    void fetchMyBadges().then((b) => setBadges(b ?? []));
    void fetchDictionary().then((d) => setDict(d));
  }, [id.signedIn]);

  const nameWords = useMemo(() => {
    if (!dict) return [];
    return dict.filter((d) => d.category === 'name').map((d) => d.word);
  }, [dict]);

  const composedName = wordB ? `${wordA}_${wordB}` : wordA;

  const submit = useCallback(async (): Promise<void> => {
    if (busy) return;
    if (composedName.length < 3) {
      setMsg('! pick a word');
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await submitDisplayName(composedName);
    if (res.error) {
      setMsg(`! ${res.error}`);
    } else {
      setMsg('name queued for review ✓');
      await refreshIdentity();
    }
    setBusy(false);
  }, [busy, composedName]);

  const onEquip = useCallback(
    async (key: string, badgeKeyForAck: string): Promise<void> => {
      if (busy) return;
      setBusy(true);
      setMsg(null);
      // Optimistic local flip so the floating label updates immediately.
      setEquippedBadgeLocal(key);
      const res = await equipBadge(key || null);
      if (res.error) {
        setMsg(`! ${res.error}`);
        // Roll back to whatever the server thinks.
        await refreshIdentity();
      } else if (badgeKeyForAck) {
        // Equipping silences the '!' dot for that badge.
        const ack = await acknowledgeBadge(badgeKeyForAck);
        if (!ack.error) {
          decrementUnacknowledged();
          // Re-fetch the badge list so the UI shows the acknowledged state.
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
      aria-labelledby="username-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header className="panel-header">
        <span className="panel-title" id="username-dialog-title">
          {'// runner identity'}
        </span>
        <button type="button" className="panel-close" onClick={onClose}>
          ✕
        </button>
      </header>

      <section className="panel-section">
        <div className="panel-section-title">$ current</div>
        <div className="panel-row">
          <span className="panel-key">handle</span>
          <span className="panel-value">{id.displayName}</span>
        </div>
        <div className="panel-row">
          <span className="panel-key">status</span>
          <span className="panel-value">
            {id.signedIn
              ? id.approved
                ? 'approved'
                : id.rejected
                  ? 'rejected'
                  : 'pending'
              : 'guest (auto-assigned)'}
          </span>
        </div>
        {id.rejected && id.rejectionNote && (
          <div className="panel-stub">─── reviewer: {id.rejectionNote}</div>
        )}
      </section>

      {!id.signedIn && <GuestGate />}

      {id.signedIn && (
        <>
          <section className={`panel-section ${busy ? 'is-busy' : ''}`}>
            <div className="panel-section-title">$ request new handle</div>
            <div className="panel-stub">
              ─── pick 1–2 words from the dictionary. owner reviews before it becomes your public
              name.
            </div>
            {dict === null ? (
              <div className="panel-stub">─── loading dictionary…</div>
            ) : (
              <div className="username-composer">
                <WordPicker label="word 1" words={nameWords} value={wordA} onChange={setWordA} />
                <WordPicker
                  label="word 2 (optional)"
                  words={['', ...nameWords]}
                  value={wordB}
                  onChange={setWordB}
                />
                <div className="panel-row">
                  <span className="panel-key">preview</span>
                  <span className="panel-value">{composedName || '—'}</span>
                </div>
                <div className="panel-row">
                  <span className="panel-key">{msg ?? 'submit to queue for review'}</span>
                  <button
                    type="button"
                    className="panel-toggle is-on"
                    disabled={busy || composedName.length < 3}
                    onClick={() => {
                      void submit();
                    }}
                  >
                    [ submit ]
                  </button>
                </div>
              </div>
            )}
          </section>

          <BadgeStrip
            badges={badges}
            equipped={id.equippedBadge}
            samaritanCorp={id.samaritanCorporate}
            samaritanBr={id.samaritanBitrunner}
            onEquip={(key, badgeKey) => {
              void onEquip(key, badgeKey);
            }}
          />
        </>
      )}

      <footer className="panel-footer">
        identity changes sync to the world within one network tick
      </footer>
    </dialog>
  );
}

function WordPicker({
  label,
  words,
  value,
  onChange,
}: {
  label: string;
  words: string[];
  value: string;
  onChange(v: string): void;
}): JSX.Element {
  return (
    <div className="panel-row">
      <span className="panel-key">{label}</span>
      <select
        className="admin-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
      >
        {words.map((w) => (
          <option key={w || '__blank__'} value={w}>
            {w || '(none)'}
          </option>
        ))}
      </select>
    </div>
  );
}

function GuestGate(): JSX.Element {
  const authed = isAuthConfigured();
  return (
    <section className="panel-section">
      <div className="panel-section-title">$ guest mode</div>
      <div className="panel-stub">
        ─── {authed ? 'sign in' : 'auth not configured in this build'} to change your handle and
        display earned badges.
      </div>
      {authed && (
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
            }}
          >
            [ sign in ]
          </button>
        </div>
      )}
    </section>
  );
}

interface BadgeStripProps {
  badges: MyBadge[] | null;
  equipped: string;
  samaritanCorp: number;
  samaritanBr: number;
  onEquip(key: string, badgeKey: string): void;
}

function BadgeStrip({
  badges,
  equipped,
  samaritanCorp,
  samaritanBr,
  onEquip,
}: BadgeStripProps): JSX.Element {
  const ownedKeys = useMemo(() => new Set((badges ?? []).map((b) => b.badgeKey)), [badges]);
  const unackKeys = useMemo(
    () => new Set((badges ?? []).filter((b) => !b.acknowledged).map((b) => b.badgeKey)),
    [badges],
  );

  return (
    <section className="panel-section">
      <div className="panel-section-title">$ badges</div>
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
