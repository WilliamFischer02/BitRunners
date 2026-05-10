import Underline from '@tiptap/extension-underline';
import { type Editor, EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Markdown } from 'tiptap-markdown';

interface BoardProps {
  slug: string;
}

const SAVE_DEBOUNCE_MS = 2500;
const PRIMER_FALLBACK_URL = '/PRIMER-FOR-WRITERS.md';

export function Board({ slug }: BoardProps): JSX.Element {
  const [status, setStatus] = useState('Loading…');
  const [loaded, setLoaded] = useState(false);
  const [, setTick] = useState(0);
  const dirtyRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      }),
      Underline,
      Markdown.configure({
        html: true,
        tightLists: true,
        linkify: true,
        breaks: false,
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'board-prose',
        spellcheck: 'false',
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const onUpdate = (): void => {
      dirtyRef.current = true;
      setStatus('Editing…');
      setTick((n) => n + 1);
    };
    const onSelection = (): void => setTick((n) => n + 1);
    editor.on('update', onUpdate);
    editor.on('selectionUpdate', onSelection);
    editor.on('transaction', onSelection);
    return () => {
      editor.off('update', onUpdate);
      editor.off('selectionUpdate', onSelection);
      editor.off('transaction', onSelection);
    };
  }, [editor]);

  const getMarkdown = useCallback((): string => {
    const md = editor?.storage.markdown?.getMarkdown?.() as string | undefined;
    return md ?? '';
  }, [editor]);

  const setMarkdown = useCallback(
    (md: string) => {
      if (!editor) return;
      editor.commands.setContent(md, false);
      dirtyRef.current = false;
    },
    [editor],
  );

  const load = useCallback(async () => {
    if (!editor) return;
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
            setMarkdown(primer);
            setStatus('Loaded primer (not yet saved)');
            dirtyRef.current = true;
            setLoaded(true);
            return;
          }
        } catch {
          // fall through
        }
        setMarkdown('');
        setStatus('Empty board — start writing');
      } else {
        setMarkdown(text);
        setStatus('Loaded');
      }
      setLoaded(true);
    } catch (err) {
      setStatus(`Load failed: ${(err as Error).message}`);
    }
  }, [editor, slug, setMarkdown]);

  useEffect(() => {
    if (editor) void load();
  }, [editor, load]);

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
        const t = new Date();
        const hh = String(t.getHours()).padStart(2, '0');
        const mm = String(t.getMinutes()).padStart(2, '0');
        const ss = String(t.getSeconds()).padStart(2, '0');
        setStatus(`Saved ${hh}:${mm}:${ss}`);
        dirtyRef.current = false;
      } catch (err) {
        setStatus(`Save failed: ${(err as Error).message}`);
      }
    },
    [slug],
  );

  useEffect(() => {
    if (!loaded || !editor) return;
    if (!dirtyRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void save(getMarkdown());
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  });

  const onSaveClick = (): void => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    void save(getMarkdown());
  };

  const onDownload = (): void => {
    const md = getMarkdown();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bitrunners-board.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const charCount = editor?.storage.characterCount?.characters?.() ?? getMarkdown().length;

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
      <Toolbar editor={editor} />
      <div className="board-editor-wrap">
        <EditorContent editor={editor} className="board-editor" />
      </div>
      <footer className="board-footer">
        <span>
          Markdown · auto-saves every {Math.round(SAVE_DEBOUNCE_MS / 1000)}s of idle ·{' '}
          {charCount.toLocaleString()} chars
        </span>
      </footer>
    </div>
  );
}

interface ToolbarProps {
  editor: Editor | null;
}

function Toolbar({ editor }: ToolbarProps): JSX.Element {
  if (!editor) return <div className="board-toolbar" />;
  const isActive = (name: string, attrs?: Record<string, unknown>): string =>
    editor.isActive(name, attrs) ? 'tb-btn is-active' : 'tb-btn';
  const run =
    (cb: () => void) =>
    (e: React.MouseEvent): void => {
      e.preventDefault();
      cb();
    };
  return (
    <div className="board-toolbar">
      <button
        type="button"
        className={isActive('bold')}
        onMouseDown={run(() => editor.chain().focus().toggleBold().run())}
        title="Bold (Cmd/Ctrl+B)"
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        className={isActive('italic')}
        onMouseDown={run(() => editor.chain().focus().toggleItalic().run())}
        title="Italic (Cmd/Ctrl+I)"
      >
        <em>I</em>
      </button>
      <button
        type="button"
        className={isActive('underline')}
        onMouseDown={run(() => editor.chain().focus().toggleUnderline().run())}
        title="Underline (Cmd/Ctrl+U)"
      >
        <u>U</u>
      </button>
      <span className="tb-sep" aria-hidden="true" />
      <button
        type="button"
        className={isActive('heading', { level: 1 })}
        onMouseDown={run(() => editor.chain().focus().toggleHeading({ level: 1 }).run())}
        title="Heading 1"
      >
        H1
      </button>
      <button
        type="button"
        className={isActive('heading', { level: 2 })}
        onMouseDown={run(() => editor.chain().focus().toggleHeading({ level: 2 }).run())}
        title="Heading 2"
      >
        H2
      </button>
      <button
        type="button"
        className={isActive('heading', { level: 3 })}
        onMouseDown={run(() => editor.chain().focus().toggleHeading({ level: 3 }).run())}
        title="Heading 3"
      >
        H3
      </button>
      <button
        type="button"
        className={isActive('heading', { level: 4 })}
        onMouseDown={run(() => editor.chain().focus().toggleHeading({ level: 4 }).run())}
        title="Subheading"
      >
        H4
      </button>
      <span className="tb-sep" aria-hidden="true" />
      <button
        type="button"
        className={isActive('blockquote')}
        onMouseDown={run(() => editor.chain().focus().toggleBlockquote().run())}
        title="Quote"
      >
        ❝
      </button>
      <button
        type="button"
        className={isActive('bulletList')}
        onMouseDown={run(() => editor.chain().focus().toggleBulletList().run())}
        title="Bulleted list"
      >
        •
      </button>
      <button
        type="button"
        className={isActive('orderedList')}
        onMouseDown={run(() => editor.chain().focus().toggleOrderedList().run())}
        title="Numbered list"
      >
        1.
      </button>
      <span className="tb-sep" aria-hidden="true" />
      <button
        type="button"
        className="tb-btn"
        onMouseDown={run(() => editor.chain().focus().setParagraph().run())}
        title="Plain paragraph"
      >
        ¶
      </button>
    </div>
  );
}
