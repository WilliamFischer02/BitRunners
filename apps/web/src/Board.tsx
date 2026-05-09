import { useCallback, useEffect, useRef, useState } from 'react';

interface BoardProps {
  slug: string;
}

const SAVE_DEBOUNCE_MS = 2500;
const PRIMER_FALLBACK_URL = '/PRIMER-FOR-WRITERS.md';

export function Board({ slug }: BoardProps): JSX.Element {
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('Loading…');
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/board/${encodeURIComponent(slug)}`, {
        headers: { 'cache-control': 'no-store' },
      });
      if (res.status === 404) {
        setStatus('Invalid board key');
        return;
      }
      if (res.status === 503) {
        setStatus('KV binding missing — owner must wire it in Pages dashboard');
        return;
      }
      const text = await res.text();
      if (text.trim().length === 0) {
        try {
          const primerRes = await fetch(PRIMER_FALLBACK_URL);
          if (primerRes.ok) {
            const primer = await primerRes.text();
            setContent(primer);
            setStatus('Loaded primer (not yet saved)');
            setDirty(true);
            setLoaded(true);
            return;
          }
        } catch {
          // ignore — fall through to empty
        }
        setContent('');
        setStatus('Empty board — start writing');
      } else {
        setContent(text);
        setStatus('Loaded');
      }
      setLoaded(true);
    } catch (err) {
      setStatus(`Load failed: ${(err as Error).message}`);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (text: string) => {
      setStatus('Saving…');
      try {
        const res = await fetch(`/api/board/${encodeURIComponent(slug)}`, {
          method: 'PUT',
          headers: { 'content-type': 'text/markdown; charset=utf-8' },
          body: text,
        });
        if (!res.ok) {
          setStatus(`Save failed (${res.status})`);
          return;
        }
        const time = new Date();
        const hh = String(time.getHours()).padStart(2, '0');
        const mm = String(time.getMinutes()).padStart(2, '0');
        const ss = String(time.getSeconds()).padStart(2, '0');
        setStatus(`Saved ${hh}:${mm}:${ss}`);
        setDirty(false);
      } catch (err) {
        setStatus(`Save failed: ${(err as Error).message}`);
      }
    },
    [slug],
  );

  useEffect(() => {
    if (!dirty || !loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void save(content);
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [content, dirty, loaded, save]);

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setContent(e.target.value);
    setDirty(true);
    setStatus('Editing…');
  };

  const onSaveClick = (): void => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    void save(content);
  };

  const onDownload = (): void => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bitrunners-board.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="board">
      <header className="board-header">
        <span className="board-title">bitrunners · writer board</span>
        <span className="board-status">{status}</span>
        <button type="button" className="board-btn" onClick={onSaveClick}>
          save
        </button>
        <button type="button" className="board-btn" onClick={onDownload}>
          download .md
        </button>
      </header>
      <textarea
        className="board-textarea"
        value={content}
        onChange={onChange}
        spellCheck={false}
        placeholder="Write here. Auto-saves a few seconds after you stop typing."
      />
      <footer className="board-footer">
        <span>
          Markdown · auto-saves every {Math.round(SAVE_DEBOUNCE_MS / 1000)}s of idle ·{' '}
          {content.length.toLocaleString()} chars
        </span>
      </footer>
    </div>
  );
}
