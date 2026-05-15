import { useEffect, useState } from 'react';
import {
  type AuthSnapshot,
  isAuthConfigured,
  signInWithEmail,
  signInWithProvider,
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

        <footer className="panel-footer">
          press [esc] or click outside to close · placeholder until account system lands
        </footer>
      </div>
    </div>
  );
}

function AccountSection(): JSX.Element {
  const [auth, setAuth] = useState<AuthSnapshot>({ status: 'guest' });
  const [mode, setMode] = useState<'idle' | 'email-in' | 'email-up'>('idle');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const oauth = (provider: 'google' | 'github' | 'azure') => async () => {
    setBusy(true);
    setError(null);
    const res = await signInWithProvider(provider);
    if (res.error) setError(res.error);
    setBusy(false);
  };

  const submitEmail = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const action = mode === 'email-up' ? signUpWithEmail : signInWithEmail;
    const res = await action(email, password);
    if (res.error) setError(res.error);
    setBusy(false);
  };

  return (
    <section className="panel-section">
      <div className="panel-section-title">$ account</div>
      <div className="auth-providers">
        <button
          type="button"
          className="auth-btn auth-google"
          onClick={oauth('google')}
          disabled={busy}
        >
          [ google ]
        </button>
        <button
          type="button"
          className="auth-btn auth-github"
          onClick={oauth('github')}
          disabled={busy}
        >
          [ github ]
        </button>
        <button
          type="button"
          className="auth-btn auth-microsoft"
          onClick={oauth('azure')}
          disabled={busy}
        >
          [ microsoft ]
        </button>
      </div>
      <div className="auth-or">─── or ───</div>
      {mode === 'idle' && (
        <div className="auth-email-row">
          <button
            type="button"
            className="auth-btn"
            onClick={() => setMode('email-in')}
            disabled={busy}
          >
            sign in (email)
          </button>
          <button
            type="button"
            className="auth-btn"
            onClick={() => setMode('email-up')}
            disabled={busy}
          >
            create account
          </button>
        </div>
      )}
      {mode !== 'idle' && (
        <form className="auth-form" onSubmit={submitEmail}>
          <input
            type="email"
            className="auth-input"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <input
            type="password"
            className="auth-input"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'email-up' ? 'new-password' : 'current-password'}
            minLength={8}
            required
          />
          <div className="auth-form-row">
            <button type="submit" className="auth-btn auth-submit" disabled={busy}>
              {mode === 'email-up' ? 'create' : 'sign in'}
            </button>
            <button
              type="button"
              className="auth-btn"
              onClick={() => {
                setMode('idle');
                setError(null);
              }}
            >
              cancel
            </button>
          </div>
        </form>
      )}
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

function SettingsSection(): JSX.Element {
  const [joystick, setJoystick] = useState<boolean>(readJoystick);

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
    </section>
  );
}
