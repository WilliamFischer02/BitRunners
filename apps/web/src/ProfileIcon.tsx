import { useEffect, useState } from 'react';
import { getJoinedRoomId } from './network.js';
import {
  type AuthSnapshot,
  isAuthConfigured,
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
  const [rain, setRain] = useState<string[]>(() => Array.from({ length: 4 }, makeRainLine));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setRain((prev) => [makeRainLine(), ...prev.slice(0, 3)]);
    }, 380);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <button
        type="button"
        className="profile"
        onClick={() => setOpen((v) => !v)}
        title="open profile"
      >
        <div className="profile-rain" aria-hidden="true">
          {rain.map((l, i) => (
            <div key={`r-${i}-${l}`} className={`profile-rain-line profile-rain-line--${i}`}>
              {l}
            </div>
          ))}
        </div>
        <div className="profile-box">
          <div className="profile-label">{'// profile'}</div>
          <div className="profile-class">{className}</div>
          <div className="profile-status">{'// guest'}</div>
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="panel-backdrop" onMouseDown={onClose}>
      <div className="panel" onMouseDown={(e) => e.stopPropagation()}>
        <header className="panel-header">
          <span className="panel-title">{'// profile'}</span>
          <button type="button" className="panel-close" onClick={onClose}>
            close ✕
          </button>
        </header>

        <section className="panel-section">
          <div className="panel-section-title">$ stack</div>
          <div className="panel-row">
            <span className="panel-key">class</span>
            <span className="panel-val">{className}</span>
          </div>
          <div className="panel-row">
            <span className="panel-key">session</span>
            <span className="panel-val">guest · no user_id</span>
          </div>
        </section>

        <AccountSection />
        <section className="panel-section" hidden>
          <div className="panel-section-title">$ account-stub</div>
        </section>

        <section className="panel-section">
          <div className="panel-section-title">$ inventory</div>
          <div className="panel-stub">─── empty. tokens and outfits unlock in phase 3.</div>
          <div className="panel-row">
            <span className="panel-key">tokens</span>
            <span className="panel-val">─</span>
          </div>
          <div className="panel-row">
            <span className="panel-key">outfits</span>
            <span className="panel-val">─</span>
          </div>
        </section>

        <section className="panel-section">
          <div className="panel-section-title">$ samaritan status</div>
          <div className="panel-row">
            <span className="panel-key">corporate</span>
            <span className="panel-val">0</span>
          </div>
          <div className="panel-row">
            <span className="panel-key">bitrunner</span>
            <span className="panel-val">0</span>
          </div>
        </section>

        <SettingsSection />
        <RoomSection />

        <footer className="panel-footer">
          press [esc] or click outside to close · placeholder until account system lands
        </footer>
      </div>
    </div>
  );
}

function AccountSection(): JSX.Element {
  const [auth, setAuth] = useState<AuthSnapshot>({ status: 'guest' });
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = isAuthConfigured();

  useEffect(() => {
    return subscribeAuth(setAuth);
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

  const switchMode = (m: 'in' | 'up'): void => {
    setMode(m);
    setError(null);
  };

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (mode === 'up' && password !== confirm) {
      setError('passwords do not match');
      return;
    }
    setBusy(true);
    const action = mode === 'up' ? signUpWithEmail : signInWithEmail;
    const res = await action(email, password);
    if (res.error) setError(res.error);
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
          {busy ? '…' : mode === 'up' ? 'create account' : 'sign in'}
        </button>
      </form>
      {error && <div className="auth-error">! {error}</div>}
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
