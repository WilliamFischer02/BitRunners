import { useCallback, useEffect, useRef, useState } from 'react';
import { listDialogue, saveDialogue } from './dialogue.js';
import {
  type AdminUser,
  type DailySignin,
  type PendingEmoticon,
  type PendingName,
  type Role,
  type Tier,
  adminApproveEmoticon,
  adminApproveName,
  adminGrantEconomy,
  adminGrantSamaritan,
  adminListPendingEmoticons,
  adminListPendingNames,
  adminListUsers,
  adminRejectEmoticon,
  adminRejectName,
  adminSetRole,
  adminSetTier,
  fetchActivityStats,
  fetchUnderConstruction,
  getMyRole,
  resendVerificationEmail,
  setUnderConstruction,
  subscribeAuth,
} from './supabase.js';
import { playDissolve } from './transitions/dissolve.js';

const DISSOLVE_OPTS = { durationMs: 280, cell: 8, color: '#c0ffd6' } as const;

// Owner-only console. The launcher renders only for admins; every action it
// exposes is also server-enforced (RLS), so the client gate is convenience,
// not security. Phase 1: the under-construction switch. Dialogue editor / user
// table + grants / activity stats are later phases (admin-panel-epic.md).
export function AdminConsole(): JSX.Element | null {
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);

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
  const [closing, setClosing] = useState(false);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Open as a true modal: native focus trap + Escape via cancel event + dissolve in.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = document.activeElement as HTMLElement | null;
    dialog.showModal();
    const inAnim = playDissolve(dialog, 'in', { ...DISSOLVE_OPTS, mountTarget: dialog });
    const onCancel = (e: Event): void => {
      e.preventDefault();
      setClosing(true);
    };
    dialog.addEventListener('cancel', onCancel);
    return () => {
      inAnim.cancel();
      dialog.removeEventListener('cancel', onCancel);
      trigger?.focus();
    };
  }, []);

  // Dissolve out when closing, then call onClose.
  useEffect(() => {
    if (!closing) return;
    const dialog = dialogRef.current;
    if (!dialog) {
      onCloseRef.current();
      return;
    }
    const anim = playDissolve(dialog, 'out', { ...DISSOLVE_OPTS, mountTarget: dialog }, () => {
      dialog.close();
      onCloseRef.current();
    });
    return () => anim.cancel();
  }, [closing]);

  useEffect(() => {
    void fetchUnderConstruction().then(setConstruction);
  }, []);

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
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop-click is pointer-only; keyboard close is handled by the native cancel event (Escape) wired in the useEffect above
    <dialog
      ref={dialogRef}
      className="panel"
      aria-modal="true"
      aria-labelledby="admin-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) setClosing(true);
      }}
    >
      <header className="panel-header">
        <span className="panel-title" id="admin-dialog-title">
          {'// admin console'}
        </span>
        <button type="button" className="panel-close" onClick={() => setClosing(true)}>
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

      <UsernameQueue />

      <EmoticonQueue />

      <ActivityStats />

      <UserTable />

      <footer className="panel-footer">owner-only · actions are server-enforced</footer>
    </dialog>
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

// ── User table + currency grants (admin phase 3, migration 0006) ───────────────

function UserTable(): JSX.Element {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selId, setSelId] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setErr(null);
    const data = await adminListUsers();
    if (data === null) {
      setErr('could not load (run migration 0006?)');
      setUsers([]);
    } else {
      setUsers(data);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = users?.find((u) => u.id === selId) ?? null;

  return (
    <section className="panel-section">
      <div className="panel-section-title">$ users</div>
      {err && <div className="panel-stub">─── {err}</div>}
      {!err && users === null && <div className="panel-stub">─── loading…</div>}
      {!err && users !== null && users.length === 0 && (
        <div className="panel-stub">─── no accounts yet.</div>
      )}
      {users !== null && users.length > 0 && (
        <div className="admin-userlist">
          {users.map((u) => (
            <button
              key={u.id}
              type="button"
              className={u.id === selId ? 'admin-userrow is-sel' : 'admin-userrow'}
              aria-pressed={u.id === selId}
              onClick={() => setSelId(u.id === selId ? null : u.id)}
            >
              <span className="admin-user-email">
                {u.email || u.displayName || u.id.slice(0, 8)}
              </span>
              <span className="admin-user-meta">
                {u.role}
                {u.tier === 'elevated' ? ' ★' : ''}
              </span>
              <span className="admin-user-bal">
                ¢{u.credits} ◈{u.tokens}
                {u.pendingCredits > 0 || u.pendingTokens > 0 ? (
                  <span className="admin-user-pending"> +pending</span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      )}
      {selected && (
        <UserEditor
          key={selected.id}
          user={selected}
          onChanged={() => {
            void load();
          }}
        />
      )}
    </section>
  );
}

function UserEditor({ user, onChanged }: { user: AdminUser; onChanged(): void }): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [credits, setCredits] = useState('');
  const [tokens, setTokens] = useState('');
  const [bits, setBits] = useState('');
  const [strings, setStrings] = useState('');
  const [serials, setSerials] = useState('');
  const [passcodes, setPasscodes] = useState('');
  const [reason, setReason] = useState('');

  const run = async (fn: () => Promise<{ error: string | null }>, ok: string): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const res = await fn();
    setMsg(res.error ? `! ${res.error}` : ok);
    setBusy(false);
    if (!res.error) onChanged();
  };

  const changeRole = (role: Role): void => {
    if (role === user.role) return;
    void run(() => adminSetRole(user.id, role), 'role updated ✓');
  };

  const changeTier = (tier: Tier): void => {
    if (tier === user.tier) return;
    void run(() => adminSetTier(user.id, tier), 'tier updated ✓');
  };

  const grant = (): void => {
    const c = Math.floor(Number(credits) || 0);
    const t = Math.floor(Number(tokens) || 0);
    const units = {
      bits: Math.floor(Number(bits) || 0),
      strings: Math.floor(Number(strings) || 0),
      serials: Math.floor(Number(serials) || 0),
      passcodes: Math.floor(Number(passcodes) || 0),
    };
    const unitTotal = units.bits + units.strings + units.serials + units.passcodes;
    if (c <= 0 && t <= 0 && unitTotal <= 0) {
      setMsg('! enter an amount (currency or units)');
      return;
    }
    void run(async () => {
      const res = await adminGrantEconomy(user.id, c, t, units, reason);
      if (!res.error) {
        setCredits('');
        setTokens('');
        setBits('');
        setStrings('');
        setSerials('');
        setPasscodes('');
        setReason('');
      }
      return res;
    }, 'queued ✓ — applies on their next load');
  };

  const resendVerification = (): void => {
    if (!user.email) {
      setMsg('! user has no email on file');
      return;
    }
    void run(
      () => resendVerificationEmail(user.email),
      'verification email re-sent ✓ (rate-limited — wait ~60s between sends)',
    );
  };

  const pending =
    user.pendingCredits > 0 || user.pendingTokens > 0
      ? ` · pending ¢${user.pendingCredits} ◈${user.pendingTokens}`
      : '';

  return (
    <div className="admin-usereditor">
      <div className="admin-user-headline">
        {user.email || '(no email)'}
        <span className="admin-user-sub">
          ¢{user.credits} ◈{user.tokens}
          {pending}
        </span>
      </div>

      <div className="panel-row">
        <span className="panel-key">
          email {user.emailConfirmed ? 'verified ✓' : 'NOT verified ✗'}
        </span>
        {!user.emailConfirmed && (
          <button
            type="button"
            className="panel-toggle"
            disabled={busy || !user.email}
            onClick={resendVerification}
          >
            [ resend verification ]
          </button>
        )}
      </div>

      <div className="panel-row">
        <span className="panel-key">permissions</span>
        <select
          className="admin-select admin-inline-select"
          value={user.role}
          disabled={busy}
          onChange={(e) => changeRole(e.target.value as Role)}
          aria-label="permissions role"
        >
          <option value="user">user</option>
          <option value="dev">dev</option>
          <option value="admin">admin</option>
        </select>
      </div>

      <div className="panel-row">
        <span className="panel-key">account tier</span>
        <select
          className="admin-select admin-inline-select"
          value={user.tier}
          disabled={busy}
          onChange={(e) => changeTier(e.target.value as Tier)}
          aria-label="account tier"
        >
          <option value="free">free</option>
          <option value="elevated">elevated ★</option>
        </select>
      </div>

      <div className="admin-grant-row">
        <input
          className="admin-select admin-grant-num"
          type="number"
          min={0}
          inputMode="numeric"
          placeholder="¢ credits"
          value={credits}
          disabled={busy}
          onChange={(e) => setCredits(e.target.value)}
          aria-label="grant credits"
        />
        <input
          className="admin-select admin-grant-num"
          type="number"
          min={0}
          inputMode="numeric"
          placeholder="◈ tokens"
          value={tokens}
          disabled={busy}
          onChange={(e) => setTokens(e.target.value)}
          aria-label="grant tokens"
        />
        <button type="button" className="panel-toggle is-on" disabled={busy} onClick={grant}>
          [ grant ]
        </button>
      </div>
      <div className="admin-grant-row">
        <input
          className="admin-select admin-grant-num"
          type="number"
          min={0}
          inputMode="numeric"
          placeholder="· bits"
          value={bits}
          disabled={busy}
          onChange={(e) => setBits(e.target.value)}
          aria-label="grant bits"
        />
        <input
          className="admin-select admin-grant-num"
          type="number"
          min={0}
          inputMode="numeric"
          placeholder=": strings"
          value={strings}
          disabled={busy}
          onChange={(e) => setStrings(e.target.value)}
          aria-label="grant strings"
        />
        <input
          className="admin-select admin-grant-num"
          type="number"
          min={0}
          inputMode="numeric"
          placeholder="= serials"
          value={serials}
          disabled={busy}
          onChange={(e) => setSerials(e.target.value)}
          aria-label="grant serials"
        />
        <input
          className="admin-select admin-grant-num"
          type="number"
          min={0}
          inputMode="numeric"
          placeholder="# passcodes"
          value={passcodes}
          disabled={busy}
          onChange={(e) => setPasscodes(e.target.value)}
          aria-label="grant passcodes"
        />
      </div>
      <input
        className="admin-select"
        type="text"
        maxLength={200}
        placeholder="reason (optional)"
        value={reason}
        disabled={busy}
        onChange={(e) => setReason(e.target.value)}
        aria-label="grant reason"
      />
      {msg && <div className="panel-stub">─── {msg}</div>}

      <SamaritanGrant userId={user.id} onChanged={onChanged} />
    </div>
  );
}

function SamaritanGrant({
  userId,
  onChanged,
}: {
  userId: string;
  onChanged(): void;
}): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [faction, setFaction] = useState<'corp' | 'br'>('corp');
  const [amount, setAmount] = useState('10');
  const [msg, setMsg] = useState<string | null>(null);

  const grant = (): void => {
    const n = Math.floor(Number(amount) || 0);
    if (n <= 0 || n > 100) {
      setMsg('! amount must be 1–100');
      return;
    }
    setBusy(true);
    setMsg(null);
    void adminGrantSamaritan(userId, faction, n).then((res) => {
      if ('error' in res) {
        setMsg(`! ${res.error}`);
      } else {
        const badgeStr = res.newBadges.length > 0 ? ` · new: ${res.newBadges.join(', ')}` : '';
        setMsg(`score → ${res.newScore}${badgeStr} ✓`);
        onChanged();
      }
      setBusy(false);
    });
  };

  return (
    <div className="admin-grant-row" style={{ marginTop: 4 }}>
      <select
        className="admin-select admin-inline-select"
        value={faction}
        disabled={busy}
        onChange={(e) => setFaction(e.target.value as 'corp' | 'br')}
        aria-label="samaritan faction"
      >
        <option value="corp">corp</option>
        <option value="br">br</option>
      </select>
      <input
        className="admin-select admin-grant-num"
        type="number"
        min={1}
        max={100}
        inputMode="numeric"
        placeholder="amt"
        value={amount}
        disabled={busy}
        onChange={(e) => setAmount(e.target.value)}
        aria-label="samaritan amount"
      />
      <button type="button" className="panel-toggle" disabled={busy} onClick={grant}>
        [ samaritan ]
      </button>
      {msg && (
        <div className="panel-stub" style={{ marginTop: 4 }}>
          ─── {msg}
        </div>
      )}
    </div>
  );
}

// ── Username approval queue (Sub-Phase B, migration 0007) ──────────────────

function UsernameQueue(): JSX.Element {
  const [rows, setRows] = useState<PendingName[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setErr(null);
    const data = await adminListPendingNames();
    if (data === null) {
      setErr('could not load (run migration 0007?)');
      setRows([]);
    } else {
      setRows(data);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const approve = async (id: string): Promise<void> => {
    if (busy) return;
    setBusy(id);
    setMsg(null);
    const res = await adminApproveName(id);
    if (res.error) setMsg(`! ${res.error}`);
    else {
      setMsg('approved ✓');
      await load();
    }
    setBusy(null);
  };

  const reject = async (id: string): Promise<void> => {
    if (busy) return;
    const note = window.prompt('rejection note (shown to the user):', 'inappropriate');
    if (note === null) return;
    setBusy(id);
    setMsg(null);
    const res = await adminRejectName(id, note);
    if (res.error) setMsg(`! ${res.error}`);
    else {
      setMsg('rejected ✓');
      await load();
    }
    setBusy(null);
  };

  return (
    <section className="panel-section">
      <div className="panel-section-title">$ username queue</div>
      {err && <div className="panel-stub">─── {err}</div>}
      {!err && rows === null && <div className="panel-stub">─── loading…</div>}
      {!err && rows !== null && rows.length === 0 && (
        <div className="panel-stub">─── no pending names.</div>
      )}
      {rows !== null && rows.length > 0 && (
        <div className="admin-userlist">
          {rows.map((r) => (
            <div key={r.id} className="admin-userrow">
              <span className="admin-user-email">{r.requested ?? '—'}</span>
              <span className="admin-user-meta">was: {r.currentName ?? '(unset)'}</span>
              <span className="admin-user-bal">
                <button
                  type="button"
                  className="panel-toggle is-on"
                  disabled={busy === r.id}
                  onClick={() => {
                    void approve(r.id);
                  }}
                >
                  [ ok ]
                </button>{' '}
                <button
                  type="button"
                  className="panel-toggle"
                  disabled={busy === r.id}
                  onClick={() => {
                    void reject(r.id);
                  }}
                >
                  [ no ]
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
      {msg && <div className="panel-stub">─── {msg}</div>}
    </section>
  );
}

// ── Emoticron approval queue (Sub-Phase D, migration 0010) ─────────────────

function EmoticonQueue(): JSX.Element {
  const [rows, setRows] = useState<PendingEmoticon[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setErr(null);
    const data = await adminListPendingEmoticons();
    if (data === null) {
      setErr('could not load (run migration 0010?)');
      setRows([]);
    } else {
      setRows(data);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const approve = async (userId: string): Promise<void> => {
    if (busy) return;
    setBusy(userId);
    setMsg(null);
    const res = await adminApproveEmoticon(userId);
    if (res.error) setMsg(`! ${res.error}`);
    else {
      setMsg('approved ✓');
      await load();
    }
    setBusy(null);
  };

  const reject = async (userId: string): Promise<void> => {
    if (busy) return;
    const note = window.prompt('rejection note (shown to the user):', 'inappropriate combination');
    if (note === null) return;
    setBusy(userId);
    setMsg(null);
    const res = await adminRejectEmoticon(userId, note);
    if (res.error) setMsg(`! ${res.error}`);
    else {
      setMsg('rejected ✓');
      await load();
    }
    setBusy(null);
  };

  return (
    <section className="panel-section">
      <div className="panel-section-title">$ emoticron queue</div>
      {err && <div className="panel-stub">─── {err}</div>}
      {!err && rows === null && <div className="panel-stub">─── loading…</div>}
      {!err && rows !== null && rows.length === 0 && (
        <div className="panel-stub">─── no pending combos.</div>
      )}
      {rows !== null && rows.length > 0 && (
        <div className="admin-userlist">
          {rows.map((r) => (
            <div key={r.userId} className="admin-userrow">
              <span className="admin-user-email">
                {r.word1} {r.word2}
              </span>
              <span className="admin-user-meta">{r.email || r.userId.slice(0, 8)}</span>
              <span className="admin-user-bal">
                <button
                  type="button"
                  className="panel-toggle is-on"
                  disabled={busy === r.userId}
                  onClick={() => {
                    void approve(r.userId);
                  }}
                >
                  [ ok ]
                </button>{' '}
                <button
                  type="button"
                  className="panel-toggle"
                  disabled={busy === r.userId}
                  onClick={() => {
                    void reject(r.userId);
                  }}
                >
                  [ no ]
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
      {msg && <div className="panel-stub">─── {msg}</div>}
    </section>
  );
}
