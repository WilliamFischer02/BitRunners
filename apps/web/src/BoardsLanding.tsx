import { useCallback, useEffect, useState } from 'react';

// Landing surface for write.bitrunners.app/ (devlog 0106).
//
// Lists every board slug returned by /api/board and exposes a "+ Add Board"
// affordance that mints a fresh 16-char id and navigates to it. The board
// itself is created lazily on first save (the GET endpoint returns "" for
// unknown slugs, so the editor opens empty).
//
// Public-listing model — every slug is visible to anyone hitting the URL.
// See devlog for the privacy trade-off this represents.

interface BoardsResponse {
  slugs?: string[];
  complete?: boolean;
  error?: string;
}

function mintSlug(): string {
  // 12 random bytes → 16 url-safe base64 chars. Matches the API's
  // MIN_SLUG_LENGTH = 16 and the [A-Za-z0-9_-] charset.
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function BoardsLanding(): JSX.Element {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [slugs, setSlugs] = useState<string[]>([]);
  const [complete, setComplete] = useState(true);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/board', { cache: 'no-store' });
        if (!res.ok) {
          if (cancelled) return;
          setErrorText(`server responded ${res.status}`);
          setStatus('error');
          return;
        }
        const data = (await res.json()) as BoardsResponse;
        if (cancelled) return;
        setSlugs(Array.isArray(data.slugs) ? [...data.slugs].sort() : []);
        setComplete(data.complete !== false);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setErrorText(err instanceof Error ? err.message : 'network error');
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onAddBoard = useCallback((): void => {
    const slug = mintSlug();
    window.location.assign(`/${slug}`);
  }, []);

  return (
    <div className="board">
      <header className="board-header">
        <span className="board-title">bitrunners · writer portal</span>
        <span className="board-status">
          {status === 'loading' && 'fetching list…'}
          {status === 'ready' && `${slugs.length} board${slugs.length === 1 ? '' : 's'}`}
          {status === 'error' && `error: ${errorText}`}
        </span>
      </header>

      <main className="boards-landing">
        <section className="boards-landing-section">
          <div className="boards-landing-section-title">$ existing boards</div>

          {status === 'loading' && <div className="boards-landing-stub">─── loading…</div>}

          {status === 'error' && (
            <div className="boards-landing-stub">
              ─── couldn't fetch the list ({errorText}). reload to retry.
            </div>
          )}

          {status === 'ready' && slugs.length === 0 && (
            <div className="boards-landing-stub">
              ─── no boards yet. tap "+ add board" below to start one.
            </div>
          )}

          {status === 'ready' && slugs.length > 0 && (
            <ul className="boards-landing-list">
              {slugs.map((slug) => (
                <li key={slug} className="boards-landing-row">
                  <a className="boards-landing-link" href={`/${slug}`}>
                    {slug}
                  </a>
                </li>
              ))}
            </ul>
          )}

          {status === 'ready' && !complete && (
            <div className="boards-landing-stub">
              ─── more boards exist than this list shows (capped at 1000). pagination not wired yet.
            </div>
          )}

          <button type="button" className="boards-landing-add" onClick={onAddBoard}>
            + add board
          </button>
        </section>

        <footer className="boards-landing-foot">
          slugs are public · 16-char ids · share the URL to share the board
        </footer>
      </main>
    </div>
  );
}

export default BoardsLanding;
