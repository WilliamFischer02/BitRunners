import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NAME_TINT_OPTIONS,
  type NameTint,
  type NameWeight,
  getNameStyle,
  setNameStyle,
  subscribeNameStyle,
} from './name-style.js';
import { getIdentity, refreshIdentity, subscribeIdentity } from './profile.js';
import {
  type DictionaryWord,
  fetchDictionary,
  isAuthConfigured,
  submitDisplayName,
} from './supabase.js';

// Opens when the user taps the floating name above their character.
// Driven by the 'bitrunners:edit-identity' event the scene dispatches on
// tap. Badge management lives in its own modal (BadgesModal.tsx) — open
// from the badge slot of the player tag.

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

  const [id, setId] = useState(getIdentity());
  const [dict, setDict] = useState<DictionaryWord[] | null>(null);
  const [wordA, setWordA] = useState('');
  const [wordB, setWordB] = useState('');
  const [custom, setCustom] = useState('');
  const [tab, setTab] = useState<'pick' | 'custom'>('pick');
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
    void fetchDictionary().then((d) => setDict(d));
  }, [id.signedIn]);

  const nameWords = useMemo(() => {
    if (!dict) return [];
    return dict.filter((d) => d.category === 'name').map((d) => d.word);
  }, [dict]);

  const composedName = tab === 'custom' ? custom.trim() : wordB ? `${wordA}_${wordB}` : wordA;

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
            <div className="auth-tabs">
              <button
                type="button"
                className={tab === 'pick' ? 'auth-tab is-on' : 'auth-tab'}
                onClick={() => setTab('pick')}
              >
                from dictionary
              </button>
              <button
                type="button"
                className={tab === 'custom' ? 'auth-tab is-on' : 'auth-tab'}
                onClick={() => setTab('custom')}
              >
                custom (review)
              </button>
            </div>
            <div className="panel-stub">
              ─── owner reviews all handles before they become public. custom requests take longer.
            </div>
            {tab === 'pick' ? (
              dict === null ? (
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
                </div>
              )
            ) : (
              <div className="username-composer">
                <div className="panel-row">
                  <span className="panel-key">handle</span>
                  <input
                    type="text"
                    className="auth-input"
                    maxLength={24}
                    placeholder="my_handle"
                    value={custom}
                    onChange={(e) =>
                      setCustom(e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24))
                    }
                    aria-label="custom handle"
                  />
                </div>
                <div className="panel-stub">
                  ─── 3–24 chars · letters, numbers, _ or - only · no slurs / impersonation
                </div>
              </div>
            )}
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
          </section>

          <NameStyleSection />
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

function NameStyleSection(): JSX.Element {
  const [style, setStyle] = useState(getNameStyle());
  useEffect(() => subscribeNameStyle(setStyle), []);

  const setWeight = (weight: NameWeight): void => setNameStyle({ weight });
  const setTint = (tint: NameTint): void => setNameStyle({ tint });

  return (
    <section className="panel-section">
      <div className="panel-section-title">$ name styling</div>
      <div className="panel-stub">
        ─── account-only flair for the floating name above your runner.
      </div>
      <div className="panel-row">
        <span className="panel-key">weight</span>
        <div className="name-style-row">
          <button
            type="button"
            className={style.weight === 'regular' ? 'name-style-pill is-on' : 'name-style-pill'}
            onClick={() => setWeight('regular')}
          >
            regular
          </button>
          <button
            type="button"
            className={style.weight === 'bold' ? 'name-style-pill is-on' : 'name-style-pill'}
            onClick={() => setWeight('bold')}
          >
            bold
          </button>
        </div>
      </div>
      <div className="panel-row">
        <span className="panel-key">tint</span>
        <div className="name-style-row">
          {NAME_TINT_OPTIONS.map((opt) => {
            const previewClass = `name-style-pill name--${opt.value}${
              style.tint === opt.value ? ' is-on' : ''
            }`;
            return (
              <button
                key={opt.value}
                type="button"
                className={previewClass}
                onClick={() => setTint(opt.value)}
                aria-label={`tint ${opt.label}`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
