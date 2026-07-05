import { useEffect, useState } from 'react';
import {
  type AuthSnapshot,
  requestPasswordReset,
  resendVerificationEmail,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  subscribeAuth,
} from './supabase.js';

// Title screen (devlog 0133). Shown before the boot scroll: Data Amalgam
// branding, LINK (start) + ACCOUNT (auth menu incl. recovery / resend
// verification). "Data Amalgam Inc." is owner-authored canon.

const LOGO = String.raw`
█▄▄ █ ▀█▀ █▀█ █ █ █▄ █ █▄ █ █▀▀ █▀█ ▄▀▀
█▄█ █  █  █▀▄ █▄█ █ ▀█ █ ▀█ ██▄ █▀▄ ▄██`;

const TICKER =
  'Data Amalgam Incorporated is not responsible for Neural Resplicing or ' +
  'localized disruptions in the physical world. Read terms for details.';

type AuthMode = 'in' | 'up' | 'recover';

function AccountMenu({ onClose }: { onClose(): void }): JSX.Element {
  const [auth, setAuth] = useState<AuthSnapshot>({ status: 'guest' });
  const [mode, setMode] = useState<AuthMode>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => subscribeAuth(setAuth), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const run = async (fn: () => Promise<{ error: string | null }>, ok: string): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const res = await fn();
    setMsg(res.error ? `! ${res.error}` : ok);
    setBusy(false);
  };

  const submit = (): void => {
    if (!email) {
      setMsg('! enter your email');
      return;
    }
    if (mode === 'in') void run(() => signInWithEmail(email, password), 'linked ✓');
    else if (mode === 'up')
      void run(
        () => signUpWithEmail(email, password),
        'account created ✓ — check your email to verify',
      );
  };

  return (
    <div className="title-account-back" onMouseDown={onClose}>
      <dialog open className="panel title-account" onMouseDown={(e) => e.stopPropagation()}>
        <header className="panel-header">
          <span className="panel-title">{'// account'}</span>
          <button type="button" className="panel-close" onClick={onClose} aria-label="close">
            ✕
          </button>
        </header>
        {auth.status === 'authenticated' ? (
          <section className="panel-section">
            <div className="panel-stub">─── linked as {auth.user?.email ?? 'unknown'}.</div>
            <div className="panel-row">
              <span className="panel-key">progress saves to this account</span>
              <button
                type="button"
                className="panel-toggle"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await signOut();
                    return { error: null };
                  }, 'signed out')
                }
              >
                [ sign out ]
              </button>
            </div>
          </section>
        ) : (
          <section className="panel-section">
            <div className="title-auth-tabs">
              {(['in', 'up', 'recover'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={mode === m ? 'panel-toggle is-on' : 'panel-toggle'}
                  onClick={() => {
                    setMode(m);
                    setMsg(null);
                  }}
                >
                  {m === 'in' ? '[ log in ]' : m === 'up' ? '[ sign up ]' : '[ recover ]'}
                </button>
              ))}
            </div>
            <input
              className="admin-select"
              type="email"
              placeholder="email"
              autoComplete="email"
              value={email}
              disabled={busy}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="email"
            />
            {mode !== 'recover' && (
              <input
                className="admin-select"
                type="password"
                placeholder="password"
                autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
                value={password}
                disabled={busy}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit();
                }}
                aria-label="password"
              />
            )}
            {mode === 'recover' ? (
              <>
                <div className="panel-stub">
                  ─── forgot your password, or never got the verification email? enter your email
                  above, then:
                </div>
                <div className="title-auth-tabs">
                  <button
                    type="button"
                    className="panel-toggle"
                    disabled={busy || !email}
                    onClick={() =>
                      void run(() => requestPasswordReset(email), 'reset link sent ✓ — check email')
                    }
                  >
                    [ send password reset ]
                  </button>
                  <button
                    type="button"
                    className="panel-toggle"
                    disabled={busy || !email}
                    onClick={() =>
                      void run(
                        () => resendVerificationEmail(email),
                        'verification re-sent ✓ — check email',
                      )
                    }
                  >
                    [ resend verification ]
                  </button>
                </div>
              </>
            ) : (
              <div className="panel-row">
                <button
                  type="button"
                  className="title-auth-forgot"
                  onClick={() => {
                    setMode('recover');
                    setMsg(null);
                  }}
                >
                  forgot password / recover account
                </button>
                <button
                  type="button"
                  className="panel-toggle is-on"
                  disabled={busy}
                  onClick={submit}
                >
                  {mode === 'in' ? '[ log in ]' : '[ create account ]'}
                </button>
              </div>
            )}
            {msg && <div className="panel-stub">─── {msg}</div>}
          </section>
        )}
      </dialog>
    </div>
  );
}

export function TitleScreen({ onLink }: { onLink(): void }): JSX.Element {
  const [accountOpen, setAccountOpen] = useState(false);
  const [auth, setAuth] = useState<AuthSnapshot>({ status: 'guest' });
  useEffect(() => subscribeAuth(setAuth), []);

  return (
    <div className="title-screen">
      <div className="title-pre">brought to you by Data Amalgam Inc.</div>
      <pre className="title-logo" aria-label="bitrunners">
        {LOGO}
      </pre>
      <div className="title-sub">
        link your neural matrix to the cloud, explore the space between reality and the
        electromagnetic spectrum
      </div>
      <div className="title-actions">
        <button type="button" className="title-link-btn" onClick={onLink}>
          [ LINK ]
        </button>
        <button type="button" className="title-account-btn" onClick={() => setAccountOpen(true)}>
          [ account{auth.status === 'authenticated' ? ' ✓' : ''} ]
        </button>
      </div>
      <div className="title-ticker" aria-hidden="true">
        <div className="title-ticker-inner">
          <span>{TICKER}</span>
          <span>{TICKER}</span>
        </div>
      </div>
      {accountOpen && <AccountMenu onClose={() => setAccountOpen(false)} />}
    </div>
  );
}

export default TitleScreen;
