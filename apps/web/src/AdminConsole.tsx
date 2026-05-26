import { useEffect, useState } from 'react';
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
      <div className="panel" onMouseDown={(e) => e.stopPropagation()}>
        <header className="panel-header">
          <span className="panel-title">{'// admin console'}</span>
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

        <section className="panel-section">
          <div className="panel-section-title">$ coming next</div>
          <div className="panel-stub">
            ─── dialogue editor · user table + token/credit grants · daily activity stats (next
            admin phases).
          </div>
        </section>

        <footer className="panel-footer">owner-only · actions are server-enforced</footer>
      </div>
    </div>
  );
}
