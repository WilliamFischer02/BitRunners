import { useEffect, useRef, useState } from 'react';
import { type EconomyState, getEconomy, subscribeEconomy } from './economy.js';
import { getJoinedRoomId, getServerUrl } from './network.js';
import { type LocalIdentity, getIdentity, subscribeIdentity } from './profile.js';
import {
  type AuthSnapshot,
  isAuthConfigured,
  requestPasswordReset,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  subscribeAuth,
} from './supabase.js';

interface ProfileIconProps {
  className: string;
}

const RAIN_CHARS = ' .·:-=+*░#▒▓█01';

function makeRainLine(): string {
  let out = '';
  for (let i = 0; i < 14; i++) {
    out += RAIN_CHARS.charAt(Math.floor(Math.random() * RAIN_CHARS.length));
  }
  return out;
}

export function ProfileIcon({ className }: ProfileIconProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [identity, setIdentity] = useState<LocalIdentity>(getIdentity);
  const rainRef = useRef<HTMLDivElement>(null);

  // Decorative rain writes textContent directly (no React re-render every
  // 380 ms for the life of the app) and pauses while the tab is hidden
  // (perf pass, devlog 0138).
  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden) return;
      const host = rainRef.current;
      if (!host) return;
      const lines = host.children;
      for (let i = lines.length - 1; i > 0; i--) {
        const above = lines[i - 1];
        const line = lines[i];
        if (above && line) line.textContent = above.textContent;
      }
      if (lines[0]) lines[0].textContent = makeRainLine();
    }, 380);
    return () => clearInterval(id);
  }, []);

  // The floating status reflects the live runner handle the moment auth
  // resolves — profile.ts re-fetches identity on every auth flip, so a
  // signed-in runner shows their display_name, not a stale 'guest'.
  useEffect(() => subscribeIdentity(setIdentity), []);

  // Other components (e.g. the post-tutorial account CTA) can pop the profile
  // panel open by dispatching this event — keeps callers decoupled from the
  // panel's local state.
  useEffect(() => {
    const onOpen = (): void => setOpen(true);
    window.addEventListener('bitrunners:open-profile', onOpen);
    return () => window.removeEventListener('bitrunners:open-profile', onOpen);
  }, []);

  return (
    <>
      <button
        type="button"
        className="profile"
        onClick={() => setOpen((v) => !v)}
        title="open menu"
        aria-label="open menu"
      >
        <div className="profile-rain" aria-hidden="true" ref={rainRef}>
          {[0, 1, 2, 3].map((i) => (
            <div key={`r-${i}`} className={`profile-rain-line profile-rain-line--${i}`}>
              {makeRainLine()}
            </div>
          ))}
        </div>
        <div className="profile-box">
          {/* 4.1: the pill reads as the main-menu affordance ("Menu"), not the
              class name. The class still shows in the panel below (opened) and in
              the in-game .hint line, so it's not lost from the HUD. */}
          <div className="profile-label">{'// menu'}</div>
          <div className="profile-class">Menu</div>
          <div className="profile-status">
            {`// ${identity.displayName}`}
            {identity.signedIn && !identity.approved ? ' ·' : ''}
          </div>
        </div>
      </button>
      {open && <ProfilePanel className={className} onClose={() => setOpen(false)} />}
    </>
  );
}

interface ProfilePanelProps {
  className: string;
  onClose(): void;
}

function ProfilePanel({ className, onClose }: ProfilePanelProps): JSX.Element {
  const [eco, setEco] = useState<EconomyState>(() => ({ ...getEconomy() }));
  const [auth, setAuth] = useState<AuthSnapshot>({ status: 'guest' });
  const [identity, setIdentity] = useState<LocalIdentity>(getIdentity);

  useEffect(() => subscribeEconomy(() => setEco({ ...getEconomy() })), []);
  useEffect(() => subscribeAuth(setAuth), []);
  useEffect(() => subscribeIdentity(setIdentity), []);

  const [roomId, setRoomId] = useState<string>(() => getJoinedRoomId());

  const sessionLabel =
    auth.status === 'authenticated' && auth.user?.id
      ? `${auth.user.id.slice(0, 8)} · signed in`
      : 'guest · offline';
  const uuidShort = auth.user?.id ? auth.user.id.slice(0, 8) : '─';
  const serverRegion = (() => {
    try {
      const u = getServerUrl();
      return u ? new URL(u).host : 'offline';
    } catch {
      return 'offline';
    }
  })();

  useEffect(() => {
    const onJoined = (e: Event): void => {
      const id = (e as CustomEvent<{ roomId?: string }>).detail?.roomId;
      if (id) setRoomId(id);
    };
    window.addEventListener('bitrunners:room-joined', onJoined);
    return () => window.removeEventListener('bitrunners:room-joined', onJoined);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="panel-backdrop" onMouseDown={onClose}>
      <dialog
        open
        className="panel"
        aria-modal="true"
        aria-labelledby="profile-dialog-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="panel-header">
          <span className="panel-title" id="profile-dialog-title">
            {'// profile'}
          </span>
          <button type="button" className="panel-close" onClick={onClose}>
            close ✕
          </button>
        </header>

        <section className="panel-section">
          <div className="panel-section-title">$ identity</div>
          <div className="panel-row">
            <span className="panel-key">handle</span>
            <span className="panel-val">{identity.displayName}</span>
          </div>
          <div className="panel-row">
            <span className="panel-key">class</span>
            <span className="panel-val">{className}</span>
          </div>
          <div className="panel-row">
            <span className="panel-key">badge</span>
            <span className="panel-val">{identity.equippedBadge || '─'}</span>
          </div>
          <div className="panel-row">
            <span className="panel-key">theme</span>
            <span className="panel-val">{identity.equippedTheme || 'default'}</span>
          </div>
          <div className="panel-row">
            <span className="panel-key">change runner</span>
            <button
              type="button"
              className="panel-toggle is-on"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('bitrunners:change-runner'));
                onClose();
              }}
            >
              [ switch ]
            </button>
          </div>
        </section>

        <section className="panel-section">
          <div className="panel-section-title">$ samaritan</div>
          <div className="panel-row">
            <span className="panel-key">corporate</span>
            <span className="panel-val">{eco.repCorporate}</span>
          </div>
          <div className="panel-row">
            <span className="panel-key">bitrunner</span>
            <span className="panel-val">{eco.repBitrunner}</span>
          </div>
        </section>

        <AccountSection />

        <section className="panel-section">
          <div className="panel-section-title">$ economy</div>
          <div className="panel-row">
            <span className="panel-key">credits</span>
            <span className="panel-val">{eco.credits}</span>
          </div>
          <div className="panel-row">
            <span className="panel-key">tokens</span>
            <span className="panel-val">{eco.tokens}</span>
          </div>
          <div className="panel-row">
            <span className="panel-key">items owned</span>
            <span className="panel-val">{eco.owned.length > 0 ? eco.owned.length : '─'}</span>
          </div>
          <div className="panel-stub">─── full inventory + shop in the data scrape panel.</div>
        </section>

        <SettingsSection />
        <RoomSection />

        <section className="panel-section">
          <div className="panel-section-title">$ debug</div>
          <div className="panel-row">
            <span className="panel-key">user id</span>
            <span className="panel-val">{uuidShort}</span>
          </div>
          <div className="panel-row">
            <span className="panel-key">session</span>
            <span className="panel-val">{sessionLabel}</span>
          </div>
          <div className="panel-row">
            <span className="panel-key">room id</span>
            <span className="panel-val">{roomId || '─'}</span>
          </div>
          <div className="panel-row">
            <span className="panel-key">server</span>
            <span className="panel-val">{serverRegion}</span>
          </div>
        </section>

        <footer className="panel-footer">press [esc] or click outside to close</footer>
      </dialog>
    </div>
  );
}

function AccountSection(): JSX.Element {
  const [auth, setAuth] = useState<AuthSnapshot>({ status: 'guest' });
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [synced, setSynced] = useState(false);
  const configured = isAuthConfigured();

  useEffect(() => {
    return subscribeAuth(setAuth);
  }, []);

  useEffect(() => {
    const on = (): void => setSynced(true);
    window.addEventListener('bitrunners:economy-synced', on);
    return () => window.removeEventListener('bitrunners:economy-synced', on);
  }, []);

  if (!configured) {
    return (
      <section className="panel-section">
        <div className="panel-section-title">$ account</div>
        <div className="panel-stub">
          ─── auth not configured. owner: set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY in
          Cloudflare Pages env and redeploy. see devlog 0026.
        </div>
        <button type="button" className="panel-action" disabled>
          sign in [pending env]
        </button>
      </section>
    );
  }

  if (auth.status === 'authenticated') {
    return (
      <section className="panel-section">
        <div className="panel-section-title">$ account</div>
        <div className="panel-row">
          <span className="panel-key">email</span>
          <span className="panel-val">{auth.user?.email ?? '─'}</span>
        </div>
        <div className="panel-row">
          <span className="panel-key">user id</span>
          <span className="panel-val">{auth.user?.id?.slice(0, 8) ?? '─'}</span>
        </div>
        <div className="panel-row">
          <span className="panel-key">progress</span>
          <span className="panel-val">{synced ? 'synced ✓' : 'syncing…'}</span>
        </div>
        <button
          type="button"
          className="panel-action"
          onClick={() => {
            void signOut();
          }}
        >
          sign out
        </button>
      </section>
    );
  }

  const switchMode = (m: 'in' | 'up' | 'reset'): void => {
    setMode(m);
    setError(null);
    setNotice(null);
  };

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);
    if (mode === 'reset') {
      setBusy(true);
      const res = await requestPasswordReset(email);
      setBusy(false);
      if (res.error) setError(res.error);
      else setNotice('check your email for a reset link');
      return;
    }
    if (mode === 'up' && password !== confirm) {
      setError('passwords do not match');
      return;
    }
    setBusy(true);
    const action = mode === 'up' ? signUpWithEmail : signInWithEmail;
    const res = await action(email, password);
    if (res.error) setError(res.error);
    else if (mode === 'up') {
      setNotice('check your email to verify your account.');
    }
    setBusy(false);
  };

  return (
    <section className="panel-section">
      <div className="panel-section-title">$ account</div>
      <div className="auth-tabs">
        <button
          type="button"
          className={mode === 'in' ? 'auth-tab is-on' : 'auth-tab'}
          onClick={() => switchMode('in')}
        >
          sign in
        </button>
        <button
          type="button"
          className={mode === 'up' ? 'auth-tab is-on' : 'auth-tab'}
          onClick={() => switchMode('up')}
        >
          sign up
        </button>
        <button
          type="button"
          className={mode === 'reset' ? 'auth-tab is-on' : 'auth-tab'}
          onClick={() => switchMode('reset')}
        >
          reset
        </button>
      </div>
      <form className="auth-form" onSubmit={submit}>
        <input
          type="email"
          className="auth-input"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        {mode !== 'reset' && (
          <div className="auth-pw-row">
            <input
              type={showPw ? 'text' : 'password'}
              className="auth-input"
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
              minLength={8}
              required
            />
            <button
              type="button"
              className="auth-peek"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? 'hide password' : 'show password'}
            >
              {showPw ? 'hide' : 'show'}
            </button>
          </div>
        )}
        {mode === 'up' && (
          <input
            type={showPw ? 'text' : 'password'}
            className="auth-input"
            placeholder="confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        )}
        <button type="submit" className="auth-btn auth-submit" disabled={busy}>
          {busy
            ? '…'
            : mode === 'up'
              ? 'create account'
              : mode === 'reset'
                ? 'send reset link'
                : 'sign in'}
        </button>
        {mode === 'in' && (
          <button type="button" className="auth-link" onClick={() => switchMode('reset')}>
            forgot your password?
          </button>
        )}
      </form>
      {error && <div className="auth-error">! {error}</div>}
      {notice && <div className="auth-notice">{notice}</div>}
    </section>
  );
}

function readJoystick(): boolean {
  try {
    const v = localStorage.getItem('bitrunners.settings.joystick');
    return v === null || v === 'true';
  } catch {
    return true;
  }
}

function readRun(): boolean {
  try {
    return localStorage.getItem('bitrunners.settings.run') === 'true';
  } catch {
    return false;
  }
}

function SettingsSection(): JSX.Element {
  const [joystick, setJoystick] = useState<boolean>(readJoystick);
  const [run, setRun] = useState<boolean>(readRun);

  const toggleJoystick = (): void => {
    const next = !joystick;
    setJoystick(next);
    try {
      localStorage.setItem('bitrunners.settings.joystick', String(next));
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent('bitrunners:settings-changed'));
  };

  const toggleRun = (): void => {
    const next = !run;
    setRun(next);
    try {
      localStorage.setItem('bitrunners.settings.run', String(next));
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent('bitrunners:settings-changed'));
  };

  return (
    <section className="panel-section">
      <div className="panel-section-title">$ settings</div>
      <div className="panel-row">
        <span className="panel-key">on-screen joystick</span>
        <button
          type="button"
          className={joystick ? 'panel-toggle is-on' : 'panel-toggle'}
          onClick={toggleJoystick}
        >
          {joystick ? '[ on ]' : '[ off ]'}
        </button>
      </div>
      <div className="panel-row">
        <span className="panel-key">run speed</span>
        <button
          type="button"
          className={run ? 'panel-toggle is-on' : 'panel-toggle'}
          onClick={toggleRun}
        >
          {run ? '[ on ]' : '[ off ]'}
        </button>
      </div>
    </section>
  );
}

function RoomSection(): JSX.Element {
  const [roomId, setRoomId] = useState<string>(() => getJoinedRoomId());
  const [code, setCode] = useState('');

  useEffect(() => {
    const onJoined = (e: Event): void => {
      const id = (e as CustomEvent<{ roomId?: string }>).detail?.roomId;
      if (id) setRoomId(id);
    };
    window.addEventListener('bitrunners:room-joined', onJoined);
    return () => window.removeEventListener('bitrunners:room-joined', onJoined);
  }, []);

  // Applied on reload — the scene reads the stored code at connect time and
  // joins that room (falling back to matchmaking if it's gone). Live re-join
  // without a reload is a later polish item.
  const join = (): void => {
    const c = code.trim();
    if (!c) return;
    try {
      localStorage.setItem('bitrunners.settings.roomCode', c);
    } catch {
      // ignore
    }
    window.location.reload();
  };
  const reset = (): void => {
    try {
      localStorage.removeItem('bitrunners.settings.roomCode');
    } catch {
      // ignore
    }
    window.location.reload();
  };

  return (
    <section className="panel-section">
      <div className="panel-section-title">$ room</div>
      <div className="panel-row">
        <span className="panel-key">your room code</span>
        <span className="panel-val">{roomId || '─'}</span>
      </div>
      <div className="panel-stub">─── share your code so a friend can join your sphere.</div>
      <form
        className="auth-form"
        onSubmit={(e) => {
          e.preventDefault();
          join();
        }}
      >
        <input
          type="text"
          className="auth-input"
          placeholder="join a room code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <div className="auth-form-row">
          <button type="submit" className="auth-btn auth-submit">
            join (reloads)
          </button>
          <button type="button" className="auth-btn" onClick={reset}>
            reset
          </button>
        </div>
      </form>
    </section>
  );
}
