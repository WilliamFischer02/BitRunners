import { useEffect, useState } from 'react';
import { listDialogue, saveDialogue } from './dialogue.js';
import {
  type DailySignin,
  fetchActivityStats,
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
            ─── user table + token/credit grants (needs live economy).
          </div>
        </section>

        <footer className="panel-footer">owner-only · actions are server-enforced</footer>
      </div>
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

// ── Activity stats (admin phase 4) ────────────────────────────────────────────

const CHART_W = 280;
const CHART_H = 60;
const BAR_GAP = 1;

function DauChart({ rows }: { rows: DailySignin[] }): JSX.Element {
  if (rows.length === 0) {
    return <div className="panel-stub">─── no sign-in data yet.</div>;
  }

  // Oldest → newest for left-to-right rendering.
  const sorted = [...rows].sort((a, b) => a.day.localeCompare(b.day));
  const n = sorted.length;
  const maxDau = Math.max(...sorted.map((r) => r.dau), 1);
  const barW = Math.max(1, (CHART_W - BAR_GAP * (n - 1)) / n);

  const bars = sorted.map((row, i) => {
    const barH = Math.max(1, Math.round((row.dau / maxDau) * CHART_H));
    const x = i * (barW + BAR_GAP);
    const y = CHART_H - barH;
    return (
      <rect
        key={row.day}
        x={x}
        y={y}
        width={barW}
        height={barH}
        fill="var(--ascii-fg, #00ff41)"
        opacity={0.75}
      >
        <title>
          {row.day}: {row.dau} DAU
        </title>
      </rect>
    );
  });

  // X-axis labels: first, middle, last
  const labelIdxs = [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i);
  const labels = labelIdxs.flatMap((i) => {
    const row = sorted[i];
    if (!row) return [];
    const x = i * (barW + BAR_GAP) + barW / 2;
    return [
      <text
        key={row.day}
        x={x}
        y={CHART_H + 10}
        textAnchor="middle"
        fontSize={7}
        fill="var(--ascii-fg, #00ff41)"
        opacity={0.6}
      >
        {row.day.slice(5)}
      </text>,
    ];
  });

  // Peak label
  const peakRow = sorted.reduce((a, b) => (a.dau >= b.dau ? a : b));
  const peakIdx = sorted.indexOf(peakRow);
  const peakX = peakIdx * (barW + BAR_GAP) + barW / 2;

  return (
    <svg
      width={CHART_W}
      height={CHART_H + 16}
      aria-labelledby="dau-chart-title"
      className="admin-dau-chart"
      role="img"
    >
      <title id="dau-chart-title">{`daily active users — last ${n} days`}</title>
      {bars}
      {labels}
      <text
        x={Math.min(peakX, CHART_W - 4)}
        y={CHART_H - Math.round((peakRow.dau / maxDau) * CHART_H) - 3}
        textAnchor={peakX > CHART_W / 2 ? 'end' : 'start'}
        fontSize={7}
        fill="var(--ascii-fg, #00ff41)"
      >
        {peakRow.dau}
      </text>
    </svg>
  );
}

function ActivityStats(): JSX.Element {
  const [rows, setRows] = useState<DailySignin[] | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    void fetchActivityStats(30).then((data) => {
      if (data === null) setErr(true);
      else setRows(data);
    });
  }, []);

  return (
    <section className="panel-section">
      <div className="panel-section-title">$ activity · last 30 days</div>
      {err && <div className="panel-stub">─── could not load (run migration 0005?).</div>}
      {!err && rows === null && <div className="panel-stub">─── loading…</div>}
      {!err && rows !== null && <DauChart rows={rows} />}
      {!err && rows !== null && (
        <div className="panel-stub">
          ─── daily active users (distinct accounts / day) · {rows.length} day
          {rows.length !== 1 ? 's' : ''} with activity.
        </div>
      )}
    </section>
  );
}
