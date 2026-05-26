import { useEffect, useState } from 'react';
import { listDialogue, saveDialogue } from './dialogue.js';
import {
  type DayCount,
  fetchSignOnStats,
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

        <DialogueEditor />

        <ActivityStats />

        <section className="panel-section">
          <div className="panel-section-title">$ coming next</div>
          <div className="panel-stub">
            ─── user table + token/credit grants (needs server-authoritative economy + live auth).
          </div>
        </section>

        <footer className="panel-footer">owner-only · actions are server-enforced</footer>
      </div>
    </div>
  );
}

function ActivityStats(): JSX.Element {
  const [stats, setStats] = useState<DayCount[] | null>(null);

  useEffect(() => {
    void fetchSignOnStats(14).then(setStats);
  }, []);

  const DAYS = 14;
  const W = 260;
  const H = 72;
  const BAR_GAP = 1;
  const LABEL_H = 12;
  const barW = Math.floor((W - (DAYS - 1) * BAR_GAP) / DAYS);
  const chartH = H - LABEL_H;

  const total = stats ? stats.reduce((s, d) => s + d.count, 0) : 0;
  const max = stats ? Math.max(...stats.map((d) => d.count), 1) : 1;

  return (
    <section className="panel-section">
      <div className="panel-section-title">$ activity · last 14 days</div>
      {!stats ? (
        <div className="panel-stub">─── loading…</div>
      ) : total === 0 ? (
        <div className="panel-stub">─── no sign-on data yet. run migration 0005 to enable.</div>
      ) : (
        <>
          <svg
            className="admin-chart"
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label="daily sign-ons — last 14 days"
          >
            <title>{'daily sign-ons — last 14 days'}</title>
            {stats.map((d, i) => {
              const barH = Math.max(2, Math.round((d.count / max) * (chartH - 2)));
              const x = i * (barW + BAR_GAP);
              const showLabel = i === 0 || i === 6 || i === DAYS - 1;
              return (
                <g key={d.day}>
                  <rect
                    x={x}
                    y={chartH - barH}
                    width={barW}
                    height={barH}
                    className="admin-chart-bar"
                  />
                  {showLabel && (
                    <text
                      x={x + barW / 2}
                      y={H - 2}
                      className="admin-chart-label"
                      textAnchor="middle"
                    >
                      {d.day.slice(5).replace('-', '/')}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <div className="panel-row">
            <span className="panel-key">sign-ons (14d)</span>
            <span className="panel-val">{total}</span>
          </div>
        </>
      )}
    </section>
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
