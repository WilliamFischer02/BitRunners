# 0017 — WYSIWYG board: Tiptap editor + toolbar + prose styles

**Date:** 2026-05-09

Owner asked: render the markdown formatting characters as their actual visual styles (bold renders bold, headings render as headings, etc.) and add a toolbar with **B / I / U / H1 / H2 / H3 / Subheading (H4) / Quote** that toggles the formatting. Output saved/downloaded as proper `.md`. Plus margin around the text area so lines don't run to the screen edge.

## Implementation

### Editor — Tiptap with markdown serialization

Replaced the plain `<textarea>` with **Tiptap** running in WYSIWYG mode. Extensions:

- `@tiptap/starter-kit` — paragraphs, headings (levels 1–4), bold, italic, blockquote, lists, code, horizontal rule
- `@tiptap/extension-underline` — underline mark (not standard markdown, serialized as `<u>` HTML inline)
- `tiptap-markdown` — bidirectional markdown ↔ editor model. Renders incoming markdown into the rich editor view and re-serializes the editor state back to markdown on save / download.

Key flow:

```ts
const editor = useEditor({
  extensions: [
    StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
    Underline,
    Markdown.configure({ html: true, tightLists: true, linkify: true, breaks: false }),
  ],
});

// Load: GET → text → editor.commands.setContent(markdownString, false)
// Save: editor.storage.markdown.getMarkdown() → PUT
```

`html: true` lets the markdown serializer pass HTML through (so `<u>` tags survive a save/load round-trip). `tightLists` keeps `- a\n- b` from gaining blank lines between items. `linkify` auto-links URLs typed inline.

### Toolbar

Sticky bar above the editor area. Each button calls `editor.chain().focus().toggleX().run()` and reflects active state via `editor.isActive(name, attrs)` → `is-active` CSS class. Buttons:

| Glyph | Action | Markdown output |
|---|---|---|
| **B** | Toggle bold | `**text**` |
| *I* | Toggle italic | `*text*` |
| <u>U</u> | Toggle underline | `<u>text</u>` (HTML in markdown) |
| `H1` | Toggle heading 1 | `# text` |
| `H2` | Toggle heading 2 | `## text` |
| `H3` | Toggle heading 3 | `### text` |
| `H4` | Subheading | `#### text` |
| ❝ | Toggle blockquote | `> text` |
| • | Bulleted list | `- item` |
| `1.` | Numbered list | `1. item` |
| ¶ | Reset to plain paragraph | (removes block format) |

Buttons fire on `onMouseDown` (with `preventDefault`) instead of `onClick` so the editor doesn't lose focus during the click — typical issue with toolbar buttons in contenteditable widgets.

Keyboard shortcuts (from StarterKit + Underline) are also bound: `Cmd/Ctrl+B`, `+I`, `+U`, `+Shift+1..4` for headings.

### Prose styling

The editor's content area gets a `.board-prose` class. Real CSS for actual rendered prose:

- Headings: H1 has a thin border underline, H2/H3 plain, H4 uppercase-tracked (works as a "subheading" feel)
- Bold: brighter green-white
- Italic: softer green
- Underline: subtle offset
- Blockquote: left bar in tint color, dim background, italic
- Lists: standard padding, tight item spacing
- Code: green-tinted inline pill; pre with bordered block
- Links: phosphor-green underline
- Horizontal rule: thin separator

Paragraph font is `system-ui` sans-serif (not the monospace used elsewhere) so reading prose is comfortable. Headings inherit the same family.

### Margins

The editor sits in a flex container `.board-editor-wrap { display: flex; justify-content: center }` with a `max-width: 880px` content column at `padding: 32px 40px`. On viewports ≤ 720 px the side padding shrinks to 20 px so the line doesn't get squeezed. Lines no longer hug the screen edge.

The wrapper scrolls `overflow-y: auto` independently from the toolbar (which is `position: sticky` so it stays visible while reading long content).

### Mobile compat

The page-wide `body { user-select: none; touch-action: none }` (set for the game canvas to suppress page scroll while moving the joystick) breaks text editing — text can't be selected, mobile keyboard can't be shown reliably. Override on the board:

```css
.board { touch-action: auto; }
.board, .board-prose { user-select: text; -webkit-user-select: text; }
.board-editor-wrap { touch-action: pan-y; overscroll-behavior: contain; }
```

`pan-y` allows vertical scroll within the editor on mobile while still preventing horizontal page bounce.

## Dependencies added (per the working agreement)

| Package | Version | Why |
|---|---|---|
| `@tiptap/react` | ^2.10.4 | React bindings for the Tiptap editor |
| `@tiptap/starter-kit` | ^2.10.4 | Default extensions (headings, bold, italic, lists, blockquote, etc.) |
| `@tiptap/extension-underline` | ^2.10.4 | Underline mark (not in StarterKit) |
| `@tiptap/pm` | ^2.10.4 | ProseMirror peer (required by Tiptap) |
| `tiptap-markdown` | ^0.8.10 | Markdown ↔ editor-state serializer |

Bundle: 660.76 → ~830 kB. Mobile-acceptable; gz size scales similarly. Loads only when the writer board is visited (browser caches it; the game route still uses the same JS chunk for now). Could code-split per route in a future polish round.

## What didn't change

- KV namespace, slug, and the Pages Function — all the same; only the client-side editor changed
- API contract — still `GET /api/board/:slug` returns markdown, `PUT` accepts markdown
- The primer fallback path on first load — still works
- Auto-save debounce (2.5 s), download `.md`, status display

## Caveats

- **Underline → HTML in markdown**: not a portable markdown feature. Works fine in our round-trip and in GitHub's renderer, but if the writer pastes the raw `.md` into a stricter parser, the underline may show as literal `<u>` text.
- **Last-write-wins** — same as before; if both the owner and the writer edit simultaneously, one will overwrite the other. Refresh before editing.
- **Existing saved content**: if a previous plain-textarea version saved markdown, it parses cleanly into Tiptap on load.

## Build

- 30 files lint-clean, build green
- Bundle warning about chunk size — expected, see "Dependencies added" above

## What's next

If the board feels good, the queued items remain:

1. **Phase 2 networking** — Colyseus + Lucia + Neon + Upstash for two-player multiplayer
2. Stage B v0.2 directional glyphs (gated behind `?normals=on`)
3. Per-route code splitting (so the game URL doesn't pull Tiptap)
