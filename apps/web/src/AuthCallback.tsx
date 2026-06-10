import { useEffect, useState } from 'react';
import { type AuthSnapshot, subscribeAuth, updatePassword } from './supabase.js';

// Landing surface for the two email-link redirects from Supabase:
//   - `#auth/verified`  — sign-up email verification succeeded; Supabase
//     auto-consumed the token from the URL hash via detectSessionInUrl
//     and the user is now signed in. We show a friendly confirmation
//     and an "enter the cloud" CTA that drops them into the game.
//   - `#auth/recovery`  — password-reset email click. The recovery token
//     in the URL hash establishes a temporary session; we present a
//     "set new password" form that calls auth.updateUser().
//
// If the URL hash is recognized but the user is NOT authenticated when
// the component mounts (token expired, link reused), we fall back to a
// friendly failure card with a "try again" CTA.

type Route = 'verified' | 'recovery';

interface AuthCallbackProps {
  route: Route;
}

export function AuthCallback({ route }: AuthCallbackProps): JSX.Element {
  const [auth, setAuth] = useState<AuthSnapshot>({ status: 'guest' });
  const [waited, setWaited] = useState(false);

  useEffect(() => {
    const unsub = subscribeAuth(setAuth);
    // Give detectSessionInUrl a moment to consume the hash token before
    // we decide whether the link "worked".
    const t = setTimeout(() => setWaited(true), 1200);
    return () => {
      unsub();
      clearTimeout(t);
    };
  }, []);

  const enterCloud = (): void => {
    // Strip the hash so the next render falls through to <Shell />.
    history.replaceState(null, '', window.location.pathname + window.location.search);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };

  if (route === 'verified') {
    return <VerifiedCard auth={auth} waited={waited} onContinue={enterCloud} />;
  }
  return <RecoveryCard auth={auth} waited={waited} onContinue={enterCloud} />;
}

function VerifiedCard({
  auth,
  waited,
  onContinue,
}: {
  auth: AuthSnapshot;
  waited: boolean;
  onContinue(): void;
}): JSX.Element {
  const signedIn = auth.status === 'authenticated';
  return (
    <div className="auth-callback">
      <div className="auth-callback-card">
        <div className="auth-callback-glyph">{signedIn ? '✓' : waited ? '!' : '…'}</div>
        <div className="auth-callback-title">
          {signedIn ? '// email verified' : waited ? '// link expired' : '// verifying…'}
        </div>
        {signedIn && (
          <>
            <div className="auth-callback-body">
              welcome to the cloud, {auth.user?.email?.split('@')[0] ?? 'runner'}.
              <br />
              your handle and progress are linked to your account.
            </div>
            <button type="button" className="auth-callback-cta" onClick={onContinue}>
              [ enter the cloud ]
            </button>
          </>
        )}
        {!signedIn && waited && (
          <>
            <div className="auth-callback-body">
              the verification link could not be processed. it may have already been used or
              expired. try signing in directly, or request a new verification email.
            </div>
            <button type="button" className="auth-callback-cta" onClick={onContinue}>
              [ try signing in ]
            </button>
          </>
        )}
        {!signedIn && !waited && (
          <div className="auth-callback-body">checking your verification token…</div>
        )}
      </div>
    </div>
  );
}

function RecoveryCard({
  auth,
  waited,
  onContinue,
}: {
  auth: AuthSnapshot;
  waited: boolean;
  onContinue(): void;
}): JSX.Element {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const signedIn = auth.status === 'authenticated';
  if (!signedIn && waited) {
    return (
      <div className="auth-callback">
        <div className="auth-callback-card">
          <div className="auth-callback-glyph">!</div>
          <div className="auth-callback-title">{'// recovery link expired'}</div>
          <div className="auth-callback-body">
            the password-reset link could not be processed. request a new one from the sign-in
            screen.
          </div>
          <button type="button" className="auth-callback-cta" onClick={onContinue}>
            [ back to sign in ]
          </button>
        </div>
      </div>
    );
  }
  if (!signedIn) {
    return (
      <div className="auth-callback">
        <div className="auth-callback-card">
          <div className="auth-callback-glyph">…</div>
          <div className="auth-callback-title">{'// preparing reset'}</div>
          <div className="auth-callback-body">processing your recovery token…</div>
        </div>
      </div>
    );
  }
  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (busy) return;
    if (password.length < 8) {
      setError('password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('passwords do not match');
      return;
    }
    setError(null);
    setBusy(true);
    const res = await updatePassword(password);
    setBusy(false);
    if (res.error) setError(res.error);
    else setOk(true);
  };
  if (ok) {
    return (
      <div className="auth-callback">
        <div className="auth-callback-card">
          <div className="auth-callback-glyph">✓</div>
          <div className="auth-callback-title">{'// password updated'}</div>
          <div className="auth-callback-body">
            you can sign in with your new password from any device.
          </div>
          <button type="button" className="auth-callback-cta" onClick={onContinue}>
            [ enter the cloud ]
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="auth-callback">
      <div className="auth-callback-card">
        <div className="auth-callback-glyph">⚙</div>
        <div className="auth-callback-title">{'// set a new password'}</div>
        <form className="auth-callback-form" onSubmit={submit}>
          <input
            type="password"
            className="auth-input"
            placeholder="new password (8+ chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
          <input
            type="password"
            className="auth-input"
            placeholder="confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
          <button type="submit" className="auth-callback-cta" disabled={busy}>
            {busy ? '…' : '[ update password ]'}
          </button>
          {error && <div className="auth-error">! {error}</div>}
        </form>
      </div>
    </div>
  );
}
