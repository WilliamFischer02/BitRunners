import { useEffect, useState } from 'react';
import { listDialogue, saveDialogue } from './dialogue.js';
import {
  fetchUnderConstruction,
  getMyRole,
  setUnderConstruction,
  subscribeAuth,
} from './supabase.js';

// Owner-only console. The launcher renders only for admins; every action it
// exposes is also server-enforced (RLS), so the client gate is convenience,
// not security. Phase 1: the under-construction switch. Dialogue editor / user
// table + grants / activity stats are later phases (admin-panel-epic.md).
export function AdminConsole(): JSX.Element | null {
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(
    () =>
      subscribeAuth(() => {
        void getMyRole().then((r) => setIsAdmin(r === 'admin'));
      }),
    [],
  );

  if (!isAdmin) return null;
  return (
    <>
      <button
        type="button"
        className="admin-launch"
        onClick={() => setOpen(true)}
        title="admin console"
      >
        ⚙ admin
      </button>
      {open && <AdminPanel onClose={() => setOpen(false)} />}
    </>
  );
}

function AdminPanel({ onClose }: { onClose(): void }): JSX.Element {
  const [construction, setConstruction] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void fetchUnderConstruction().then(setConstruction);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggle = async (): Promise<void> => {
    if (busy || construction === null) return;
    setBusy(true);
    setErr(null);
    const next = !construction;
    const res = await setUnderConstruction(next);
    if (res.error) setErr(res.error);
    else setConstruction(next);
    setBusy(false);
  };

  return (
    <div className="panel-backdrop" onMouseDown={onClose}>
      <dialog
        open
        className="panel"
        aria-modal="true"
        aria-labelledby="admin-dialog-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="panel-header">
          <span className="panel-title" id="admin-dialog-title">
            {'// admin console'}
          </span>
          <button type="button" className="panel-close" onClick={onClose}>
            ✕
          </button>
        </header>

        <section className="panel-section">
          <div className="panel-section-title">$ site</div>
          <div className="panel-row">
            <span className="panel-key">under construction</span>
            <button
              type="button"
              className={construction ? 'panel-toggle is-on' : 'panel-toggle'}
              disabled={busy || construction === null}
              onClick={() => {
                void toggle();
              }}
            >
              {construction === null ? '…' : construction ? '[ on ]' : '[ off ]'}
            </button>
          </div>
          <div className="panel-stub">
            ─── when on, only dev/admin accounts can enter. live-testing gate.
          </div>
          {err && <div className="auth-error">! {err}</div>}
        </section>

        <DialogueEditor />

        <section className="panel-section">
          <div className="panel-section-title">$ coming next</div>
          <div className="panel-stub">
            ─── user table + token/credit grants · daily activity stats (next admin phases).
          </div>
        </section>

        <footer className="panel-footer">owner-only · actions are server-enforced</footer>
      </dialog>
    </div>
  );
}

function DialogueEditor(): JSX.Element {
  const entries = listDialogue();
  const [key, setKey] = useState<string>(entries[0]?.key ?? '');
  const [text, setText] = useState<string>(() => (entries[0]?.lines ?? []).join('\n'));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const select = (k: string): void => {
    setKey(k);
    const e = listDialogue().find((x) => x.key === k);
    setText((e?.lines ?? []).join('\n'));
    setMsg(null);
  };

  const save = async (): Promise<void> => {
    if (busy || !key) return;
    setBusy(true);
    setMsg(null);
    const lines = text
      .split('\n')
      .map((l) => l.trimEnd())
      .filter((l) => l.length > 0);
    const res = await saveDialogue(key, lines);
    setMsg(res.error ? `! ${res.error}` : 'saved ✓');
    setBusy(false);
  };

  return (
    <section className="panel-section">
      <div className="panel-section-title">$ dialogue</div>
      <select
        className="admin-select"
        value={key}
        onChange={(e) => select(e.target.value)}
        aria-label="dialogue entry"
      >
        {entries.map((e) => (
          <option key={e.key} value={e.key}>
            {e.label}
          </option>
        ))}
      </select>
      <textarea
        className="admin-textarea"
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="dialogue lines"
      />
      <div className="panel-row">
        <span className="panel-key">{msg ?? 'one line per row'}</span>
        <button
          type="button"
          className="panel-toggle is-on"
          disabled={busy}
          onClick={() => {
            void save();
          }}
        >
          [ save ]
        </button>
      </div>
    </section>
  );
}
